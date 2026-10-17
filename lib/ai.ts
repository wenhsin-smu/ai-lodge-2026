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
  const response = await client.beta.messages.parse(
    {
      model: AI_MODEL,
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
      output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
      // If the main model declines, Anthropic re-runs the request on a suitable fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    },
    { signal: AbortSignal.timeout(opts.timeoutMs) },
  );
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
