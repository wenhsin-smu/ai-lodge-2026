// Server-only helper for Claude calls. Every call returns JSON validated with zod;
// anything else (timeout, refusal, bad JSON) throws, and callers decide how to fail.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

type Effort = "low" | "medium" | "high";

export async function askJson<T extends z.ZodType>(opts: {
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: T;
  timeoutMs: number;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  if (!aiConfigured()) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ maxRetries: 0, timeout: opts.timeoutMs });
  const signal = AbortSignal.timeout(opts.timeoutMs);
  const request = {
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    messages: [{ role: "user" as const, content: opts.content }],
    output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
  };
  let response;
  try {
    // If the main model declines, Anthropic re-runs the request on a suitable fallback model.
    response = await client.beta.messages.parse(
      { ...request, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" },
      { signal },
    );
  } catch (e) {
    // Some accounts/models don't accept the fallback option: retry once without it.
    if (!(e instanceof Anthropic.BadRequestError) || !/fallback|beta/i.test(e.message)) throw e;
    response = await client.beta.messages.parse(request, { signal });
  }
  if (response.stop_reason === "refusal") throw new Error("model refused");
  if (response.stop_reason === "max_tokens") throw new Error("output truncated");
  // Validate again ourselves: invalid output is treated as a failure.
  return opts.schema.parse(response.parsed_output);
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
  if (e instanceof Anthropic.AuthenticationError) return "the AI key (ANTHROPIC_API_KEY) was rejected";
  if (e instanceof Anthropic.PermissionDeniedError) return "this AI key isn't allowed to use the model";
  if (e instanceof Anthropic.NotFoundError) return `the model "${AI_MODEL}" wasn't found for this key (try ANTHROPIC_MODEL)`;
  if (e instanceof Anthropic.RateLimitError) return "the AI is rate-limited or out of credits";
  if (e instanceof Anthropic.BadRequestError) return `the AI request was rejected: ${e.message.slice(0, 160)}`;
  if (e instanceof Anthropic.APIUserAbortError || e instanceof Anthropic.APIConnectionTimeoutError) return "the AI took too long";
  if (e instanceof Anthropic.APIConnectionError) return "couldn't reach the AI service";
  if (e instanceof Anthropic.APIError) return `AI service error ${e.status ?? ""}`.trim();
  if (e instanceof Error && e.name === "ZodError") return "the AI's answer wasn't in the expected format";
  if (e instanceof Error) return e.message.slice(0, 160);
  return "unknown error";
}
