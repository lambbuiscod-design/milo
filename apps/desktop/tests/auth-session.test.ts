import { describe, expect, it, vi } from "vitest";
import {
  AUTH_CALLBACK_HOST,
  AUTH_CALLBACK_PORT,
  AUTH_CALLBACK_PATH,
  AuthSession,
  AuthSessionError,
  createPkceChallenge,
  createPkceVerifier,
  normalizeSupabaseOrigin,
  validateAuthBrowserUrl,
  validateLoopbackCallback,
  type EncryptedRefreshTokenStore,
  type LoopbackCallback,
  type LoopbackCallbackServer,
} from "../src/main/auth-session";
import { createNodeLoopbackCallbackServer } from "../src/main/loopback-callback-server";

function createStore(initial: string | null = null, encryptionAvailable = true, readOverride?: () => Promise<string | null>): EncryptedRefreshTokenStore & { writes: string[]; cleared: number } {
  let value = initial;
  const store = {
    writes: [] as string[],
    cleared: 0,
    isEncryptionAvailable: () => encryptionAvailable,
    read: readOverride ?? (async () => value),
    write: async (next: string) => {
      value = next;
      store.writes.push(next);
    },
    clear: async () => {
      value = null;
      store.cleared += 1;
    },
  };
  return store;
}

function createCallbackServer(): LoopbackCallbackServer & { resolve: (callback: LoopbackCallback) => void; closed: boolean } {
  let resolveCallback: ((callback: LoopbackCallback) => void) | null = null;
  let callbackPromise: Promise<LoopbackCallback> | null = null;
  const server = {
    closed: false,
    resolve: (callback: LoopbackCallback) => resolveCallback?.(callback),
    start: async () => ({ port: AUTH_CALLBACK_PORT }),
    waitForCallback: () => {
      callbackPromise ??= new Promise<LoopbackCallback>((resolve) => {
        resolveCallback = resolve;
      });
      return callbackPromise;
    },
    close: async () => {
      server.closed = true;
    },
  };
  return server;
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("AuthSession security boundary", () => {
  it("requires an HTTPS Supabase origin with no path, credentials, query, or fragment", () => {
    expect(normalizeSupabaseOrigin("https://project.supabase.co/")).toBe("https://project.supabase.co");
    for (const value of [
      "http://project.supabase.co",
      "https://project.supabase.co/auth",
      "https://user:pass@project.supabase.co",
      "https://project.supabase.co?x=1",
      "https://project.supabase.co/#fragment",
    ]) {
      expect(() => normalizeSupabaseOrigin(value)).toThrowError(AuthSessionError);
    }
  });

  it("creates high-entropy S256 PKCE material", () => {
    const verifier = createPkceVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(40);
    expect(createPkceChallenge(verifier)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("allows the system browser to open only Supabase's authorize endpoint", () => {
    const allowed = validateAuthBrowserUrl("https://project.supabase.co", "https://project.supabase.co/auth/v1/oauth/authorize?state=s");
    expect(new URL(allowed).pathname).toBe("/auth/v1/oauth/authorize");
    expect(() => validateAuthBrowserUrl("https://project.supabase.co", "https://evil.example/auth/v1/oauth/authorize")).toThrowError(AuthSessionError);
    expect(() => validateAuthBrowserUrl("https://project.supabase.co", "https://project.supabase.co/other")).toThrowError(AuthSessionError);
  });

  it("rejects callbacks unless host, path, and state match exactly", () => {
    expect(validateLoopbackCallback({ host: AUTH_CALLBACK_HOST, pathname: AUTH_CALLBACK_PATH, state: "s", code: "c" }, "s")).toEqual({ code: "c" });
    for (const callback of [
      { host: "localhost", pathname: AUTH_CALLBACK_PATH, state: "s", code: "c" },
      { host: AUTH_CALLBACK_HOST, pathname: "/other", state: "s", code: "c" },
      { host: AUTH_CALLBACK_HOST, pathname: AUTH_CALLBACK_PATH, state: "different", code: "c" },
      { host: AUTH_CALLBACK_HOST, pathname: AUTH_CALLBACK_PATH, state: "s", code: "c", error: "access_denied" },
    ]) {
      expect(() => validateLoopbackCallback(callback, "s")).toThrowError(AuthSessionError);
    }
  });

  it("opens only the configured Supabase HTTPS authorize URL and persists no access token", async () => {
    const store = createStore();
    const server = createCallbackServer();
    let openedUrl = "";
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      expect(init?.method).toBe("POST");
      return response({ access_token: "access-secret", refresh_token: "refresh-one", expires_in: 3_600 });
    });
    const session = new AuthSession(
      { supabaseOrigin: "https://project.supabase.co", clientId: "public-client" },
      {
        openExternal: async (url) => {
          openedUrl = url;
          const state = new URL(url).searchParams.get("state");
          server.resolve({ host: AUTH_CALLBACK_HOST, pathname: AUTH_CALLBACK_PATH, state: state ?? "", code: "auth-code" });
        },
        createCallbackServer: () => server,
        refreshTokenStore: store,
        fetcher,
        now: () => 0,
        timeoutMs: 2_000,
      },
    );
    const snapshot = await session.signIn();
    const authorize = new URL(openedUrl);
    expect(authorize.origin).toBe("https://project.supabase.co");
    expect(authorize.pathname).toBe("/auth/v1/oauth/authorize");
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorize.searchParams.get("redirect_uri")).toBe(`http://127.0.0.1:${AUTH_CALLBACK_PORT}/oauth/callback`);
    expect(snapshot).toEqual({ status: "authenticated", expiresAt: 3_600_000, storageAvailable: true });
    expect(store.writes).toEqual(["refresh-one"]);
    expect(JSON.stringify(snapshot)).not.toContain("access-secret");
    expect(server.closed).toBe(true);
  });

  it("refreshes with a rotated token and clears local session on logout", async () => {
    const store = createStore("refresh-one");
    const fetcher = vi.fn<typeof fetch>(async () => response({ access_token: "access-two", refresh_token: "refresh-two", expires_in: 3_600 }));
    const session = new AuthSession(
      { supabaseOrigin: "https://project.supabase.co", clientId: "public-client" },
      { openExternal: vi.fn(), createCallbackServer: () => createCallbackServer(), refreshTokenStore: store, fetcher, now: () => 1_000_000 },
    );
    const accessToken = await session.getAccessToken();
    expect(accessToken).toBe("access-two");
    expect(store.writes).toEqual(["refresh-two"]);
    expect(JSON.stringify(session.getSnapshot())).not.toContain("access-two");
    expect((await session.signOut()).status).toBe("signed_out");
    expect(store.cleared).toBe(1);
  });

  it("fails closed when encryption is unavailable or saved state is corrupt", async () => {
    const unavailableStore = createStore(null, false);
    const openExternal = vi.fn();
    const unavailable = new AuthSession(
      { supabaseOrigin: "https://project.supabase.co", clientId: "public-client" },
      { openExternal, createCallbackServer: () => createCallbackServer(), refreshTokenStore: unavailableStore },
    );
    expect(unavailable.getSnapshot().status).toBe("unavailable");
    await expect(unavailable.signIn()).rejects.toMatchObject({ code: "AUTH_STORAGE_UNAVAILABLE" });
    expect(openExternal).not.toHaveBeenCalled();

    const corruptStore = createStore(null, true, async () => { throw new Error("corrupt"); });
    const corrupt = new AuthSession(
      { supabaseOrigin: "https://project.supabase.co", clientId: "public-client" },
      { openExternal: vi.fn(), createCallbackServer: () => createCallbackServer(), refreshTokenStore: corruptStore },
    );
    expect((await corrupt.restore()).status).toBe("error");
    await expect(corrupt.getAccessToken()).rejects.toMatchObject({ code: "AUTH_STORAGE_CORRUPT" });
  });

  it("rejects oversized token responses before using their contents", async () => {
    const oversized = new AuthSession(
      { supabaseOrigin: "https://project.supabase.co", clientId: "public-client" },
      {
        openExternal: vi.fn(),
        createCallbackServer: () => createCallbackServer(),
        refreshTokenStore: createStore("refresh-one"),
        fetcher: vi.fn<typeof fetch>(async () => new Response("x".repeat(32 * 1024 + 1), { status: 200 })),
      },
    );
    await expect(oversized.getAccessToken()).rejects.toMatchObject({ code: "AUTH_TOKEN_RESPONSE_INVALID" });
  });

  it("maps refresh network failures to a safe auth error", async () => {
    const session = new AuthSession(
      { supabaseOrigin: "https://project.supabase.co", clientId: "public-client" },
      {
        openExternal: vi.fn(),
        createCallbackServer: () => createCallbackServer(),
        refreshTokenStore: createStore("refresh-one"),
        fetcher: vi.fn<typeof fetch>(async () => { throw new Error("network"); }),
      },
    );
    await expect(session.getAccessToken()).rejects.toMatchObject({ code: "AUTH_TOKEN_REQUEST_FAILED" });
  });

  it("binds the real callback listener to 127.0.0.1 and accepts only its fixed path", async () => {
    const server = createNodeLoopbackCallbackServer({ host: AUTH_CALLBACK_HOST, pathname: AUTH_CALLBACK_PATH });
    const { port } = await server.start();
    const callbackPromise = server.waitForCallback();
    const responseValue = await fetch(`http://127.0.0.1:${port}${AUTH_CALLBACK_PATH}?state=state&code=code`);
    expect(responseValue.status).toBe(200);
    await expect(callbackPromise).resolves.toMatchObject({ host: AUTH_CALLBACK_HOST, pathname: AUTH_CALLBACK_PATH, state: "state", code: "code" });
    await server.close();
  });
});
