import { createHash, randomBytes } from "node:crypto";

export const AUTH_CALLBACK_HOST = "127.0.0.1";
export const AUTH_CALLBACK_PORT = 38_947;
export const AUTH_CALLBACK_PATH = "/oauth/callback";
export const AUTH_TIMEOUT_MS = 120_000;
export const MAX_TOKEN_RESPONSE_BYTES = 32 * 1024;
export const MAX_TOKEN_FIELD_CHARS = 8 * 1024;

export type AuthErrorCode =
  | "AUTH_CONFIG_INVALID"
  | "AUTH_FLOW_IN_PROGRESS"
  | "AUTH_FLOW_CANCELLED"
  | "AUTH_CALLBACK_INVALID"
  | "AUTH_CALLBACK_TIMEOUT"
  | "AUTH_TOKEN_RESPONSE_INVALID"
  | "AUTH_TOKEN_REQUEST_FAILED"
  | "AUTH_NOT_SIGNED_IN"
  | "AUTH_STORAGE_UNAVAILABLE"
  | "AUTH_STORAGE_CORRUPT"
  | "AUTH_STORAGE_FAILED";

export class AuthSessionError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string = code) {
    super(message);
    this.name = "AuthSessionError";
    this.code = code;
  }
}

export type AuthSessionStatus = "signed_out" | "authenticated" | "unavailable" | "error";

export type AuthSessionSnapshot = Readonly<{
  status: AuthSessionStatus;
  expiresAt: number | null;
  storageAvailable: boolean;
}>;

export type LoopbackCallback = Readonly<{
  host: string;
  pathname: string;
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}>;

export type LoopbackCallbackServer = Readonly<{
  start: () => Promise<{ port: number }>;
  waitForCallback: () => Promise<LoopbackCallback>;
  close: () => Promise<void>;
}>;

export type LoopbackCallbackServerFactory = (input: Readonly<{
  host: string;
  pathname: string;
}>) => LoopbackCallbackServer;

export type EncryptedRefreshTokenStore = Readonly<{
  isEncryptionAvailable: () => boolean;
  read: () => Promise<string | null>;
  write: (refreshToken: string) => Promise<void>;
  clear: () => Promise<void>;
}>;

export type AuthSessionDependencies = Readonly<{
  openExternal: (url: string) => Promise<void> | void;
  createCallbackServer: LoopbackCallbackServerFactory;
  refreshTokenStore: EncryptedRefreshTokenStore;
  fetcher?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}>;

export type AuthSessionConfig = Readonly<{
  supabaseOrigin: string;
  clientId: string;
}>;

type AccessToken = Readonly<{
  value: string;
  expiresAt: number;
}>;

type TokenResponse = Readonly<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}>;

export function normalizeSupabaseOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AuthSessionError("AUTH_CONFIG_INVALID", "Supabase origin is not a valid URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    (url.pathname !== "" && url.pathname !== "/") ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new AuthSessionError("AUTH_CONFIG_INVALID", "Supabase origin must be an HTTPS origin.");
  }
  return url.origin;
}

export function validateAuthBrowserUrl(configuredOrigin: string, rawUrl: string): string {
  const expectedOrigin = normalizeSupabaseOrigin(configuredOrigin);
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new AuthSessionError("AUTH_CONFIG_INVALID", "The authentication browser URL is invalid.");
  }
  if (target.origin !== expectedOrigin || target.protocol !== "https:" || target.pathname !== "/auth/v1/oauth/authorize" || target.username || target.password) {
    throw new AuthSessionError("AUTH_CONFIG_INVALID", "Milo rejected an authentication browser URL outside Supabase.");
  }
  return target.toString();
}

export function createPkceVerifier(): string {
  return base64Url(randomBytes(32));
}

export function createOAuthState(): string {
  return base64Url(randomBytes(32));
}

export function createPkceChallenge(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier, "ascii").digest());
}

export function validateLoopbackCallback(callback: LoopbackCallback, expectedState: string): { code: string } {
  if (callback.host !== AUTH_CALLBACK_HOST || callback.pathname !== AUTH_CALLBACK_PATH) {
    throw new AuthSessionError("AUTH_CALLBACK_INVALID", "Milo rejected an unexpected authentication callback.");
  }
  if (callback.state !== expectedState) {
    throw new AuthSessionError("AUTH_CALLBACK_INVALID", "Milo rejected an authentication callback with invalid state.");
  }
  if (callback.error !== undefined || callback.errorDescription !== undefined) {
    throw new AuthSessionError("AUTH_CALLBACK_INVALID", "The authentication provider rejected the sign-in request.");
  }
  if (callback.code === undefined || !isBoundedTokenField(callback.code)) {
    throw new AuthSessionError("AUTH_CALLBACK_INVALID", "Milo received an incomplete authentication callback.");
  }
  return { code: callback.code };
}

export class AuthSession {
  readonly #config: Readonly<{ supabaseOrigin: string; clientId: string }>;
  readonly #openExternal: AuthSessionDependencies["openExternal"];
  readonly #createCallbackServer: LoopbackCallbackServerFactory;
  readonly #refreshTokenStore: EncryptedRefreshTokenStore;
  readonly #fetcher: typeof fetch;
  readonly #now: () => number;
  readonly #timeoutMs: number;
  #accessToken: AccessToken | null = null;
  #refreshToken: string | null = null;
  #storageFailure: AuthSessionError | null = null;
  #flowActive = false;
  #flowEpoch = 0;
  #activeCallbackServer: LoopbackCallbackServer | null = null;
  #refreshPromise: Promise<string> | null = null;

  constructor(config: AuthSessionConfig, dependencies: AuthSessionDependencies) {
    this.#config = {
      supabaseOrigin: normalizeSupabaseOrigin(config.supabaseOrigin),
      clientId: validateClientId(config.clientId),
    };
    this.#openExternal = dependencies.openExternal;
    this.#createCallbackServer = dependencies.createCallbackServer;
    this.#refreshTokenStore = dependencies.refreshTokenStore;
    this.#fetcher = dependencies.fetcher ?? fetch;
    this.#now = dependencies.now ?? Date.now;
    this.#timeoutMs = dependencies.timeoutMs ?? AUTH_TIMEOUT_MS;
    if (!Number.isInteger(this.#timeoutMs) || this.#timeoutMs < 1_000 || this.#timeoutMs > AUTH_TIMEOUT_MS) {
      throw new AuthSessionError("AUTH_CONFIG_INVALID", "Authentication timeout is outside the safe range.");
    }
  }

  getSnapshot(): AuthSessionSnapshot {
    if (this.#storageFailure !== null) {
      return { status: "error", expiresAt: null, storageAvailable: false };
    }
    if (!this.#refreshTokenStore.isEncryptionAvailable()) {
      return { status: "unavailable", expiresAt: null, storageAvailable: false };
    }
    return {
      status: this.#accessToken === null && this.#refreshToken === null ? "signed_out" : "authenticated",
      expiresAt: this.#accessToken?.expiresAt ?? null,
      storageAvailable: true,
    };
  }

  async restore(): Promise<AuthSessionSnapshot> {
    this.assertStorageAvailable();
    try {
      this.#refreshToken = await this.#refreshTokenStore.read();
      this.#storageFailure = null;
    } catch (error) {
      this.#refreshToken = null;
      this.#accessToken = null;
      this.#storageFailure = error instanceof AuthSessionError
        ? error
        : new AuthSessionError("AUTH_STORAGE_CORRUPT", "Milo could not verify the saved sign-in session.");
    }
    return this.getSnapshot();
  }

  async signIn(): Promise<AuthSessionSnapshot> {
    this.assertStorageAvailable();
    if (this.#flowActive) throw new AuthSessionError("AUTH_FLOW_IN_PROGRESS", "A sign-in request is already in progress.");
    this.#flowActive = true;
    const flowEpoch = ++this.#flowEpoch;
    const state = createOAuthState();
    const verifier = createPkceVerifier();
    const challenge = createPkceChallenge(verifier);
    const callbackServer = this.#createCallbackServer({ host: AUTH_CALLBACK_HOST, pathname: AUTH_CALLBACK_PATH });
    this.#activeCallbackServer = callbackServer;
    let started = false;
    try {
      const { port } = await callbackServer.start();
      if (port !== AUTH_CALLBACK_PORT) {
        throw new AuthSessionError("AUTH_CALLBACK_INVALID", "Milo could not create a safe local callback.");
      }
      started = true;
      const redirectUri = `http://${AUTH_CALLBACK_HOST}:${port}${AUTH_CALLBACK_PATH}`;
      const authorizeUrl = this.buildAuthorizeUrl(redirectUri, state, challenge);
      const callbackPromise = callbackServer.waitForCallback();
      await this.#openExternal(authorizeUrl);
      let callback: LoopbackCallback;
      try {
        callback = await withTimeout(callbackPromise, this.#timeoutMs, "AUTH_CALLBACK_TIMEOUT");
      } catch (error) {
        if (flowEpoch !== this.#flowEpoch) {
          throw new AuthSessionError("AUTH_FLOW_CANCELLED", "Milo cancelled the sign-in request.");
        }
        throw error;
      }
      if (flowEpoch !== this.#flowEpoch) throw new AuthSessionError("AUTH_FLOW_CANCELLED", "Milo cancelled the sign-in request.");
      const { code } = validateLoopbackCallback(callback, state);
      const tokens = await this.exchangeCode(code, verifier, redirectUri);
      if (flowEpoch !== this.#flowEpoch) throw new AuthSessionError("AUTH_FLOW_CANCELLED", "Milo cancelled the sign-in request.");
      if (tokens.refreshToken === undefined) {
        throw new AuthSessionError("AUTH_TOKEN_RESPONSE_INVALID", "The authentication provider did not return a refresh token.");
      }
      await this.#refreshTokenStore.write(tokens.refreshToken);
      if (flowEpoch !== this.#flowEpoch) {
        await this.#refreshTokenStore.clear().catch(() => undefined);
        throw new AuthSessionError("AUTH_FLOW_CANCELLED", "Milo cancelled the sign-in request.");
      }
      this.#refreshToken = tokens.refreshToken;
      this.#accessToken = this.toAccessToken(tokens);
      this.#storageFailure = null;
      return this.getSnapshot();
    } finally {
      // Closing is idempotent for the injected/default callback server and also
      // cleans up a partially-started listener when browser launch fails.
      if (started || callbackServer.close !== undefined) await callbackServer.close().catch(() => undefined);
      if (this.#activeCallbackServer === callbackServer) this.#activeCallbackServer = null;
      this.#flowActive = false;
    }
  }

  async getAccessToken(): Promise<string> {
    this.assertStorageAvailable();
    if (this.#accessToken !== null && this.#accessToken.expiresAt > this.#now() + 30_000) {
      return this.#accessToken.value;
    }
    return this.refreshAccessToken();
  }

  async refreshAccessToken(): Promise<string> {
    this.#refreshPromise ??= this.performRefreshAccessToken().finally(() => {
      this.#refreshPromise = null;
    });
    return this.#refreshPromise;
  }

  private async performRefreshAccessToken(): Promise<string> {
    this.assertStorageAvailable();
    if (this.#refreshToken === null) {
      try {
        this.#refreshToken = await this.#refreshTokenStore.read();
      } catch (error) {
        this.#storageFailure = error instanceof AuthSessionError
          ? error
          : new AuthSessionError("AUTH_STORAGE_CORRUPT", "Milo could not verify the saved sign-in session.");
        throw this.#storageFailure;
      }
    }
    if (this.#refreshToken === null) throw new AuthSessionError("AUTH_NOT_SIGNED_IN", "Milo is not signed in.");
    const currentRefreshToken = this.#refreshToken;
    const refreshEpoch = this.#flowEpoch;
    try {
      const response = await this.#fetcher(`${this.#config.supabaseOrigin}/auth/v1/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: currentRefreshToken,
          client_id: this.#config.clientId,
        }).toString(),
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
      });
      const tokens = await parseTokenResponse(response);
      if (refreshEpoch !== this.#flowEpoch) {
        throw new AuthSessionError("AUTH_FLOW_CANCELLED", "Milo cancelled the session refresh.");
      }
      if (tokens.refreshToken !== undefined) {
        await this.#refreshTokenStore.write(tokens.refreshToken);
        this.#refreshToken = tokens.refreshToken;
      }
      this.#accessToken = this.toAccessToken(tokens);
      return this.#accessToken.value;
    } catch (error) {
      this.#accessToken = null;
      if (error instanceof AuthSessionError && error.code === "AUTH_TOKEN_RESPONSE_INVALID") {
        await this.#refreshTokenStore.clear().catch(() => undefined);
        this.#refreshToken = null;
      }
      if (error instanceof AuthSessionError) throw error;
      throw new AuthSessionError("AUTH_TOKEN_REQUEST_FAILED", "Milo could not refresh the sign-in session.");
    }
  }

  async signOut(): Promise<AuthSessionSnapshot> {
    this.#flowEpoch += 1;
    const activeCallbackServer = this.#activeCallbackServer;
    this.#activeCallbackServer = null;
    if (activeCallbackServer !== null) await activeCallbackServer.close().catch(() => undefined);
    await this.#refreshPromise?.catch(() => undefined);
    this.#accessToken = null;
    this.#refreshToken = null;
    this.#storageFailure = null;
    await this.#refreshTokenStore.clear();
    return this.getSnapshot();
  }

  async dispose(): Promise<void> {
    this.#flowEpoch += 1;
    const activeCallbackServer = this.#activeCallbackServer;
    this.#activeCallbackServer = null;
    if (activeCallbackServer !== null) await activeCallbackServer.close().catch(() => undefined);
    await this.#refreshPromise?.catch(() => undefined);
    this.#accessToken = null;
    this.#refreshToken = null;
  }

  private buildAuthorizeUrl(redirectUri: string, state: string, challenge: string): string {
    const url = new URL("/auth/v1/oauth/authorize", this.#config.supabaseOrigin);
    url.searchParams.set("client_id", this.#config.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    return url.toString();
  }

  private async exchangeCode(code: string, verifier: string, redirectUri: string): Promise<TokenResponse> {
    let response: Response;
    try {
      response = await this.#fetcher(`${this.#config.supabaseOrigin}/auth/v1/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
          client_id: this.#config.clientId,
        }).toString(),
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
      });
    } catch {
      throw new AuthSessionError("AUTH_TOKEN_REQUEST_FAILED", "Milo could not complete sign-in.");
    }
    return parseTokenResponse(response);
  }

  private toAccessToken(tokens: TokenResponse): AccessToken {
    return { value: tokens.accessToken, expiresAt: this.#now() + tokens.expiresIn * 1_000 };
  }

  private assertStorageAvailable(): void {
    if (this.#storageFailure !== null) throw this.#storageFailure;
    if (!this.#refreshTokenStore.isEncryptionAvailable()) {
      throw new AuthSessionError("AUTH_STORAGE_UNAVAILABLE", "Milo cannot securely store the sign-in session on this device.");
    }
  }
}

async function parseTokenResponse(response: Response): Promise<TokenResponse> {
  let body: string;
  try {
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_TOKEN_RESPONSE_BYTES)) {
      throw new AuthSessionError("AUTH_TOKEN_RESPONSE_INVALID", "Milo rejected an oversized token response.");
    }
    body = await readBoundedResponse(response);
  } catch (error) {
    if (error instanceof AuthSessionError) throw error;
    throw new AuthSessionError("AUTH_TOKEN_REQUEST_FAILED", "Milo could not read the token response.");
  }
  if (new TextEncoder().encode(body).byteLength > MAX_TOKEN_RESPONSE_BYTES) {
    throw new AuthSessionError("AUTH_TOKEN_RESPONSE_INVALID", "Milo rejected an oversized token response.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new AuthSessionError("AUTH_TOKEN_RESPONSE_INVALID", "Milo rejected an invalid token response.");
  }
  if (!isRecord(parsed) || !response.ok) {
    throw new AuthSessionError("AUTH_TOKEN_RESPONSE_INVALID", "The authentication provider rejected the token request.");
  }
  const accessToken = parsed.access_token;
  const refreshToken = parsed.refresh_token;
  const expiresIn = parsed.expires_in;
  if (!isBoundedTokenField(accessToken) || (refreshToken !== undefined && !isBoundedTokenField(refreshToken))) {
    throw new AuthSessionError("AUTH_TOKEN_RESPONSE_INVALID", "Milo rejected an incomplete token response.");
  }
  if (typeof expiresIn !== "number" || !Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 86_400 * 30) {
    throw new AuthSessionError("AUTH_TOKEN_RESPONSE_INVALID", "Milo rejected an invalid token lifetime.");
  }
  return { accessToken, refreshToken, expiresIn };
}

function validateClientId(value: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{1,256}$/.test(value)) {
    throw new AuthSessionError("AUTH_CONFIG_INVALID", "The public OAuth client configuration is invalid.");
  }
  return value;
}

async function readBoundedResponse(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > MAX_TOKEN_RESPONSE_BYTES) {
      await reader.cancel();
      throw new AuthSessionError("AUTH_TOKEN_RESPONSE_INVALID", "Milo rejected an oversized token response.");
    }
    chunks.push(chunk.value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(combined);
  } catch {
    throw new AuthSessionError("AUTH_TOKEN_RESPONSE_INVALID", "Milo rejected invalid token response encoding.");
  }
}

function isBoundedTokenField(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_TOKEN_FIELD_CHARS && !/[\u0000-\u001f\u007f]/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function base64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: "AUTH_CALLBACK_TIMEOUT"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new AuthSessionError(code, "Milo timed out waiting for sign-in.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
