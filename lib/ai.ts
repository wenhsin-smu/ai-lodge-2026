// Server-only helper for Claude calls. Every call returns JSON validated with zod;
// anything else (timeout, refusal, bad JSON) throws, and callers decide how to fail.
//
// Configuration comes only from env vars (no model names or URLs in code):
//   ANTHROPIC_API_KEY          required
//   ANTHROPIC_MODEL            required, e.g. the model name your provider gives you
//   ANTHROPIC_BASE_URL         optional, for a compatible provider (e.g. https://api.apiyi.com)
//   ANTHROPIC_FALLBACK_MODELS  optional, comma-separated. Empty = model fallback OFF.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export function aiConfig() {
  return {
    apiKey: process.env.ANTHROPIC_API_KEY?.trim() || "",
    model: process.env.ANTHROPIC_MODEL?.trim() || "",
    baseURL: process.env.ANTHROPIC_BASE_URL?.trim() || undefined,
    fallbackModels: (process.env.ANTHROPIC_FALLBACK_MODELS ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
  };
}

export function aiConfigured() {
  const c = aiConfig();
  return Boolean(c.apiKey && c.model);
}

export function missingAiConfig() {
  const c = aiConfig();
  return [!c.apiKey && "ANTHROPIC_API_KEY", !c.model && "ANTHROPIC_MODEL"].filter(Boolean).join(" and ");
}

/** An AI failure with everything needed to debug it. */
export class AiError extends Error {
  constructor(
    message: string,
    readonly detail: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AiError";
  }
}

type Effort = "low" | "medium" | "high";

// Some Anthropic-compatible providers don't support structured outputs / effort.
// After the first rejection we use plain requests (JSON instructions + zod) for this server process.
let plainMode = false;

export function aiMode() {
  return plainMode ? "plain JSON (provider rejected structured outputs)" : "structured outputs";
}

export async function askJson<T extends z.ZodType>(opts: {
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: T;
  timeoutMs: number;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const cfg = aiConfig();
  if (!cfg.apiKey || !cfg.model) throw new AiError(`Missing ${missingAiConfig()}`, { config: "missing" });
  const client = new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, maxRetries: 0, timeout: opts.timeoutMs });
  const signal = AbortSignal.timeout(opts.timeoutMs);
  const maxTokens = opts.maxTokens ?? 4000;

  if (!plainMode) {
    const structured = {
      model: cfg.model,
      max_tokens: maxTokens,
      system: opts.system,
      messages: [{ role: "user" as const, content: opts.content }],
      output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
    };
    try {
      const response = cfg.fallbackModels.length
        ? // Fallback only to the models you listed (never Anthropic's "default" routing).
          await client.beta.messages
            .parse(
              {
                ...structured,
                betas: ["server-side-fallback-2026-06-01"],
                fallbacks: cfg.fallbackModels.map((model) => ({ model })),
              },
              { signal },
            )
            .catch(async (e) => {
              if (!isUnsupported(e, /fallback|beta/i)) throw e;
              console.warn("[ai] provider rejected model fallback; continuing with fallback OFF");
              return client.beta.messages.parse(structured, { signal });
            })
        : await client.beta.messages.parse(structured, { signal });
      checkStop(response.stop_reason, "structured");
      return opts.schema.parse(response.parsed_output);
    } catch (e) {
      if (!isUnsupported(e)) throw wrap(e, "structured");
      console.warn("[ai] provider rejected structured outputs; switching to plain JSON requests", errorDetail(e));
      plainMode = true;
    }
  }

  // Plain request: ask for JSON matching the schema, then validate it ourselves.
  const jsonSchema = JSON.stringify(z.toJSONSchema(opts.schema));
  try {
    const response = await client.messages.create(
      {
        model: cfg.model,
        max_tokens: maxTokens,
        system: `${opts.system}\n\nRespond with ONLY a JSON object (no prose, no code fences) matching this JSON Schema:\n${jsonSchema}`,
        messages: [{ role: "user", content: opts.content as Anthropic.ContentBlockParam[] }],
      },
      { signal },
    );
    checkStop(response.stop_reason, "plain");
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < start) throw new AiError("the AI's answer had no JSON", { attempt: "plain", text: text.slice(0, 500) });
    return opts.schema.parse(JSON.parse(text.slice(start, end + 1)));
  } catch (e) {
    throw wrap(e, "plain");
  }
}

/** True when a 4xx means "this provider/model doesn't support that request feature". */
function isUnsupported(e: unknown, pattern = /output_config|format|effort|structured|json_schema|beta|fallback|extra|unknown|not support|unsupported/i) {
  return (
    (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.UnprocessableEntityError || e instanceof Anthropic.NotFoundError) &&
    pattern.test(`${e.message} ${JSON.stringify(e.error ?? "")}`) &&
    !/model/i.test(e instanceof Anthropic.NotFoundError ? e.message : "")
  );
}

function checkStop(stop: string | null, attempt: string) {
  if (stop === "refusal") throw new AiError("model refused", { attempt, stop_reason: stop });
  if (stop === "max_tokens") throw new AiError("output truncated", { attempt, stop_reason: stop });
}

function errorDetail(e: unknown): Record<string, unknown> {
  if (e instanceof AiError) return e.detail;
  if (e instanceof Anthropic.APIError) {
    return {
      status: e.status,
      message: e.message,
      error: e.error,
      request_id: e.requestID ?? undefined,
    };
  }
  if (e instanceof z.ZodError) return { zod: e.issues };
  if (e instanceof Error) return { name: e.name, message: e.message };
  return { error: String(e) };
}

function wrap(e: unknown, attempt: string) {
  if (e instanceof AiError) return e;
  return new AiError(describeAiError(e), { attempt, ...errorDetail(e) });
}

/** Image content block from a data URL or raw base64 JPEG/PNG. */
export function imageBlock(data: string, mediaType: "image/jpeg" | "image/png" = "image/jpeg"): Anthropic.Beta.BetaImageBlockParam {
  const match = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(data);
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: (match?.[1] as "image/jpeg" | "image/png") ?? mediaType,
      data: match ? match[2] : data,
    },
  };
}

/** Wraps user-provided text so the model treats it as data, never as instructions. */
export function asData(tag: string, text: string) {
  // Strip anything that could close our tag early.
  const clean = text.replace(new RegExp(`</?${tag}>`, "gi"), "");
  return `<${tag}>\n${clean}\n</${tag}>`;
}

/** Short, human-readable reason for an AI failure (shown to the sender and logged). */
export function describeAiError(e: unknown): string {
  const model = aiConfig().model;
  if (e instanceof AiError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return "the AI key (ANTHROPIC_API_KEY) was rejected";
  if (e instanceof Anthropic.PermissionDeniedError) return `this AI key isn't allowed to use "${model}"`;
  if (e instanceof Anthropic.NotFoundError) return `"${model}" wasn't found at this AI provider (check ANTHROPIC_MODEL and ANTHROPIC_BASE_URL)`;
  if (e instanceof Anthropic.RateLimitError) return "the AI is rate-limited or out of credits";
  if (e instanceof Anthropic.BadRequestError) return `the AI request was rejected: ${e.message.slice(0, 200)}`;
  if (e instanceof Anthropic.APIUserAbortError || e instanceof Anthropic.APIConnectionTimeoutError) return "the AI took too long";
  if (e instanceof Anthropic.APIConnectionError) return "couldn't reach the AI service (check ANTHROPIC_BASE_URL)";
  if (e instanceof Anthropic.APIError) return `AI service error ${e.status ?? ""}: ${e.message.slice(0, 160)}`.trim();
  if (e instanceof z.ZodError) return "the AI's answer wasn't in the expected format";
  if (e instanceof Error) return e.message.slice(0, 200);
  return "unknown error";
}

/** Full error details for logs and the AI check endpoint. */
export function fullAiError(e: unknown) {
  return { reason: describeAiError(e), ...errorDetail(e) };
}
