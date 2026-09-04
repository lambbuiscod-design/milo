import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  AUTH_CALLBACK_HOST,
  AUTH_CALLBACK_PATH,
  AUTH_CALLBACK_PORT,
  type LoopbackCallback,
  type LoopbackCallbackServer,
  type LoopbackCallbackServerFactory,
} from "./auth-session";

const MAX_CALLBACK_URL_CHARS = 8 * 1024;

export const createNodeLoopbackCallbackServer: LoopbackCallbackServerFactory = ({ host, pathname }) => {
  if (host !== AUTH_CALLBACK_HOST || pathname !== AUTH_CALLBACK_PATH) {
    throw new Error("AUTH_CALLBACK_CONFIG_INVALID");
  }
  let callbackResolve: ((callback: LoopbackCallback) => void) | null = null;
  let callbackReject: ((error: Error) => void) | null = null;
  let callbackPromise: Promise<LoopbackCallback> | null = null;
  let boundPort: number | null = null;
  const server = createServer((request, response) => {
    handleCallbackRequest(request, response, host, pathname, boundPort, (callback) => {
      callbackResolve?.(callback);
      callbackResolve = null;
      callbackReject = null;
    });
  });

  const value: LoopbackCallbackServer = {
    start: () => new Promise<{ port: number }>((resolve, reject) => {
      const onError = (error: Error) => {
        server.removeListener("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.removeListener("error", onError);
        const address = server.address();
        if (address === null || typeof address === "string") {
          reject(new Error("AUTH_CALLBACK_BIND_FAILED"));
          return;
        }
        boundPort = address.port;
        resolve({ port: address.port });
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(AUTH_CALLBACK_PORT, host);
    }),
    waitForCallback: () => {
      if (callbackPromise === null) {
        callbackPromise = new Promise<LoopbackCallback>((resolvePromise, rejectPromise) => {
          callbackResolve = resolvePromise;
          callbackReject = rejectPromise;
        });
      }
      return callbackPromise;
    },
    close: () => new Promise<void>((resolve) => {
      callbackReject?.(new Error("AUTH_CALLBACK_CLOSED"));
      callbackResolve = null;
      callbackReject = null;
      callbackPromise = null;
      boundPort = null;
      if (!server.listening) {
        resolve();
        return;
      }
      server.close(() => resolve());
    }),
  };
  return value;
};

function handleCallbackRequest(
  request: IncomingMessage,
  response: ServerResponse,
  expectedHost: string,
  expectedPath: string,
  expectedPort: number | null,
  onCallback: (callback: LoopbackCallback) => void,
): void {
  if (request.method !== "GET" || request.url === undefined || request.url.length > MAX_CALLBACK_URL_CHARS) {
    writeResponse(response, 405, "This sign-in callback is not available.");
    return;
  }
  const rawHost = request.headers.host;
  const expectedHostHeader = expectedPort === null ? null : `${expectedHost}:${expectedPort}`;
  const hostWithPort = rawHost === expectedHostHeader ? rawHost : null;
  if (hostWithPort === null) {
    writeResponse(response, 400, "This sign-in callback is not available.");
    return;
  }
  let url: URL;
  try {
    url = new URL(request.url, `http://${hostWithPort}`);
  } catch {
    writeResponse(response, 400, "This sign-in callback is not available.");
    return;
  }
  if (url.protocol !== "http:" || url.hostname !== expectedHost || url.pathname !== expectedPath || url.username || url.password) {
    writeResponse(response, 400, "This sign-in callback is not available.");
    return;
  }
  const state = singleParam(url.searchParams, "state");
  const code = singleParam(url.searchParams, "code");
  const error = singleParam(url.searchParams, "error");
  const errorDescription = singleParam(url.searchParams, "error_description");
  if (state === null || (code === null && error === null)) {
    writeResponse(response, 400, "Sign-in was incomplete. You can close this window.");
    return;
  }
  writeResponse(response, 200, "Sign-in complete. You can return to Milo.");
  onCallback({ host: expectedHost, pathname: expectedPath, state, ...(code === null ? {} : { code }), ...(error === null ? {} : { error }), ...(errorDescription === null ? {} : { errorDescription }) });
}

function singleParam(params: URLSearchParams, name: string): string | null {
  const values = params.getAll(name);
  return values.length === 1 && values[0].length <= 8 * 1024 ? values[0] : null;
}

function writeResponse(response: ServerResponse, statusCode: number, message: string): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "text/plain; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(message);
}
