const DEFAULT_JSON_BODY_LIMIT = 16 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body is too large.");
    this.name = "RequestBodyTooLargeError";
  }
}

export class InvalidRequestBodyError extends Error {
  constructor() {
    super("Request body is invalid.");
    this.name = "InvalidRequestBodyError";
  }
}

function privateJson(body: Record<string, unknown>, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  return Response.json(body, { ...init, headers });
}

/**
 * Browser mutations use Supabase cookies, so require an exact same-origin
 * request in addition to SameSite cookie protection. Stripe webhooks must not
 * use this guard because they are authenticated with their signed raw body.
 */
export function rejectCrossOriginMutation(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return privateJson(
      { error: "This request must come from Milo.", code: "INVALID_ORIGIN" },
      { status: 403 },
    );
  }

  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    return privateJson(
      { error: "This request must come from Milo.", code: "INVALID_ORIGIN" },
      { status: 403 },
    );
  }

  try {
    const suppliedOrigin = new URL(origin).origin;
    const requestUrl = new URL(request.url);
    const allowedOrigins = new Set([requestUrl.origin]);
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (configuredAppUrl) {
      allowedOrigins.add(new URL(configuredAppUrl).origin);
    }
    if (!allowedOrigins.has(suppliedOrigin)) {
      return privateJson(
        { error: "This request must come from Milo.", code: "INVALID_ORIGIN" },
        { status: 403 },
      );
    }
  } catch {
    return privateJson(
      { error: "This request must come from Milo.", code: "INVALID_ORIGIN" },
      { status: 403 },
    );
  }

  return null;
}

async function readBodyWithinLimit(request: Request, maxBytes: number) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new InvalidRequestBodyError();

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      throw new InvalidRequestBodyError();
    }
    if (parsedLength > maxBytes) throw new RequestBodyTooLargeError();
  }

  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        value.fill(0);
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }

    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return body;
  } finally {
    for (const chunk of chunks) chunk.fill(0);
    reader.releaseLock();
  }
}

export async function readJsonWithinLimit(
  request: Request,
  maxBytes = DEFAULT_JSON_BODY_LIMIT,
): Promise<unknown> {
  const body = await readBodyWithinLimit(request, maxBytes);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw error;
    throw new InvalidRequestBodyError();
  } finally {
    body.fill(0);
  }
}

export async function readTextWithinLimit(request: Request, maxBytes: number) {
  const body = await readBodyWithinLimit(request, maxBytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new InvalidRequestBodyError();
  } finally {
    body.fill(0);
  }
}

export async function readFormDataWithinLimit(request: Request, maxBytes: number) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new InvalidRequestBodyError();
  }

  const body = await readBodyWithinLimit(request, maxBytes);
  try {
    const boundedRequest = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });
    return await boundedRequest.formData();
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw error;
    throw new InvalidRequestBodyError();
  } finally {
    body.fill(0);
  }
}

export function requestBodyErrorResponse(error: unknown, oversizedMessage: string) {
  if (error instanceof RequestBodyTooLargeError) {
    return privateJson(
      { error: oversizedMessage, code: "REQUEST_TOO_LARGE" },
      { status: 413 },
    );
  }
  if (error instanceof InvalidRequestBodyError) {
    return privateJson(
      { error: "The request body is invalid.", code: "INVALID_REQUEST_BODY" },
      { status: 400 },
    );
  }
  return null;
}
