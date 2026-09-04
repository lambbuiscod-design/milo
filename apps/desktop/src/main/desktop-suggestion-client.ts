import { randomUUID } from "node:crypto";
import { z } from "zod";

const MAX_ACCESS_TOKEN_LENGTH = 4_096;
const MAX_RESPONSE_BYTES = 32 * 1024;
const MAX_MESSAGES = 8;
const MAX_CONTEXT_CHARACTERS = 4_000;

const messageSchema = z.object({
  role: z.enum(["self", "other", "unknown"]),
  text: z.string().trim().min(1).max(1_000),
}).strict();

const responseSchema = z.object({
  requestId: z.string().uuid(),
  conversationStatus: z.enum(["clear", "unclear", "unsafe"]),
  detectedLanguage: z.string().min(1).max(80),
  briefContext: z.string().max(500),
  warning: z.string().max(500).nullable(),
  replies: z.array(z.object({
    category: z.enum(["safe", "confident", "playful"]),
    text: z.string().max(280),
    whyItWorks: z.string().min(1).max(360),
  }).strict()).length(3),
  remaining: z.number().int().min(0).max(150),
}).strict().superRefine((value, context) => {
  const categories = new Set(value.replies.map((reply) => reply.category));
  if (categories.size !== 3) {
    context.addIssue({ code: "custom", message: "Reply categories must be unique", path: ["replies"] });
  }
  const hasReplyText = value.replies.some((reply) => reply.text.trim().length > 0);
  if ((value.conversationStatus === "unsafe") === hasReplyText) {
    context.addIssue({ code: "custom", message: "Safety status does not match reply content", path: ["replies"] });
  }
});

export type DesktopSuggestionMessage = z.infer<typeof messageSchema>;
export type DesktopSuggestionResult = z.infer<typeof responseSchema>;

export type DesktopSuggestionClientOptions = Readonly<{
  apiBaseUrl: string;
  clientId: string;
  clientVersion: string;
  fetchRequest?: typeof fetch;
  requestId?: () => string;
  allowInsecureLocalhost?: boolean;
}>;

export class DesktopSuggestionClientError extends Error {
  constructor(
    readonly code: "configuration" | "unauthorized" | "paywall" | "rate_limit" | "unavailable" | "protocol",
    message: string,
  ) {
    super(message);
    this.name = "DesktopSuggestionClientError";
  }
}

/** Main-process-only, content-free transport wrapper for Milo's suggestion API. */
export class DesktopSuggestionClient {
  private readonly endpoint: URL;
  private readonly fetchRequest: typeof fetch;
  private readonly createRequestId: () => string;

  constructor(private readonly options: DesktopSuggestionClientOptions) {
    this.endpoint = suggestionEndpoint(options.apiBaseUrl, options.allowInsecureLocalhost === true);
    this.fetchRequest = options.fetchRequest ?? fetch;
    this.createRequestId = options.requestId ?? randomUUID;
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(options.clientId) || !/^[A-Za-z0-9._+-]{1,32}$/.test(options.clientVersion)) {
      throw new DesktopSuggestionClientError("configuration", "Milo desktop API configuration is invalid.");
    }
  }

  async suggest(input: Readonly<{
    accessToken: string;
    messages: readonly DesktopSuggestionMessage[];
    tone: "standard" | "romantic" | "witty" | "professional" | "warm" | "confident" | "playful" | "direct";
    relationshipStage: "new_match" | "first_dates" | "dating" | "relationship" | "conflict";
  }>): Promise<DesktopSuggestionResult> {
    validateAccessToken(input.accessToken);
    const parsedMessages = z.array(messageSchema).min(1).max(MAX_MESSAGES).safeParse(input.messages);
    if (!parsedMessages.success) {
      throw new DesktopSuggestionClientError("protocol", "Milo rejected invalid local context.");
    }
    const messages = parsedMessages.data;
    if (messages.reduce((total, message) => total + message.text.length, 0) > MAX_CONTEXT_CHARACTERS) {
      throw new DesktopSuggestionClientError("protocol", "Milo rejected oversized local context.");
    }

    const requestId = this.createRequestId();
    if (!z.string().uuid().safeParse(requestId).success) {
      throw new DesktopSuggestionClientError("configuration", "Milo could not create a valid request identifier.");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40_000);
    let response: Response;
    try {
      response = await this.fetchRequest(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
          "X-Milo-Client-Id": this.options.clientId,
        },
        body: JSON.stringify({
          requestId,
          clientVersion: this.options.clientVersion,
          tone: input.tone,
          relationshipStage: input.relationshipStage,
          messages,
        }),
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
    } catch {
      throw new DesktopSuggestionClientError("unavailable", "Milo's reply service is temporarily unavailable.");
    } finally {
      clearTimeout(timer);
    }

    const body = await readBoundedBody(response);
    if (!response.ok) throw mapFailure(response.status, body);
    if (!(response.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
      throw new DesktopSuggestionClientError("protocol", "Milo received an invalid reply response.");
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(body);
    } catch {
      throw new DesktopSuggestionClientError("protocol", "Milo received malformed reply data.");
    }
    const parsed = responseSchema.safeParse(decoded);
    if (!parsed.success || parsed.data.requestId !== requestId) {
      throw new DesktopSuggestionClientError("protocol", "Milo rejected an invalid reply response.");
    }
    return parsed.data;
  }
}

function suggestionEndpoint(rawBaseUrl: string, allowInsecureLocalhost: boolean): URL {
  let base: URL;
  try {
    base = new URL(rawBaseUrl);
  } catch {
    throw new DesktopSuggestionClientError("configuration", "Milo desktop API URL is invalid.");
  }
  const localHttp = allowInsecureLocalhost && base.protocol === "http:" &&
    (base.hostname === "127.0.0.1" || base.hostname === "localhost");
  if ((base.protocol !== "https:" && !localHttp) || base.username || base.password) {
    throw new DesktopSuggestionClientError("configuration", "Milo desktop API URL is not trusted.");
  }
  return new URL("/api/v1/suggest", base.origin);
}

function validateAccessToken(value: string): void {
  if (value.length < 1 || value.length > MAX_ACCESS_TOKEN_LENGTH || /\s/u.test(value)) {
    throw new DesktopSuggestionClientError("unauthorized", "Sign in to use Milo suggestions.");
  }
}

async function readBoundedBody(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new DesktopSuggestionClientError("protocol", "Milo received an oversized reply response.");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new DesktopSuggestionClientError("protocol", "Milo received an oversized reply response.");
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
    throw new DesktopSuggestionClientError("protocol", "Milo received invalid reply response encoding.");
  }
}

function mapFailure(status: number, body: string): DesktopSuggestionClientError {
  let code = "";
  try {
    const parsed = JSON.parse(body) as { code?: unknown };
    if (typeof parsed.code === "string" && parsed.code.length <= 64) code = parsed.code;
  } catch {
    // The server error remains content-free and is mapped by status below.
  }
  if (status === 401 || code === "MFA_REQUIRED" || code === "ACCOUNT_INELIGIBLE") {
    return new DesktopSuggestionClientError("unauthorized", "Sign in again to use Milo suggestions.");
  }
  if (status === 402 || code === "PAYWALL") {
    return new DesktopSuggestionClientError("paywall", "Your current Milo allowance is exhausted.");
  }
  if (status === 429 || code === "RATE_LIMIT") {
    return new DesktopSuggestionClientError("rate_limit", "Milo needs a short pause before another suggestion.");
  }
  return new DesktopSuggestionClientError("unavailable", "Milo's reply service is temporarily unavailable.");
}
