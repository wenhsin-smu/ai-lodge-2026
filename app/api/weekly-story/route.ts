import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCaller, isMember, isUuid } from "@/lib/apiAuth";
import { aiConfigured, askJson, asData } from "@/lib/ai";
import { createAdminClient, hasAdminEnv } from "@/utils/supabase/admin";

export const maxDuration = 45;

const StorySchema = z.object({
  title: z.string().max(60),
  story: z.string().max(900),
});

const SYSTEM = `You write a short, fun weekly recap for a small group of student friends who study together in Study Booth.

Use ONLY the numbers in <week_stats>. Do not invent any other facts, names, subjects or events. If a number is 0, skip it or turn it into a gentle "next week" invitation.

Style: 80-140 words, warm and playful, like a cosy story or a little newspaper bulletin, written about the group as a whole ("you all", "the group"). Positive and factual only: never compare members, never single anyone out, never shame, never judge productivity. Suitable for under-18s.`;

// POST { groupId, tz } -> { title, story, stats }. Stats come from SQL; the AI only writes prose.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { groupId?: unknown; tz?: unknown };
  const { supabase, user } = await getCaller();
  if (!user || !isUuid(body.groupId) || !(await isMember(supabase, body.groupId))) {
    return NextResponse.json({ error: "Not a member of this group." }, { status: 401 });
  }
  if (!hasAdminEnv) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });

  const tz = typeof body.tz === "string" && /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(body.tz) ? body.tz : "UTC";
  const admin = createAdminClient();
  const { data: stats, error } = await admin.rpc("group_week_stats", { gid: body.groupId, tz });
  if (error || !stats) return NextResponse.json({ error: "Couldn't compute this week's stats." }, { status: 500 });

  if (!aiConfigured()) return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY.", stats }, { status: 500 });
  try {
    const result = await askJson({
      system: SYSTEM,
      content: [{ type: "text", text: `Write this week's story.\n\n${asData("week_stats", JSON.stringify(stats, null, 2))}` }],
      schema: StorySchema,
      timeoutMs: 30_000,
      effort: "medium",
    });
    await admin.from("weekly_stories").insert({ group_id: body.groupId, story: `${result.title}\n\n${result.story}`, stats });
    return NextResponse.json({ ...result, stats });
  } catch (e) {
    console.warn("weekly story failed", String(e));
    return NextResponse.json({ error: "The story writer is taking a nap. Try again in a minute.", stats }, { status: 503 });
  }
}
