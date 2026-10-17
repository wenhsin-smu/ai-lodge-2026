"use client";

import { useState } from "react";
import ScratchCard from "@/components/ScratchCard";
import { useBooth, type Post } from "@/components/BoothProvider";

type Props = {
  limit?: number;
  eraserSize: number;
  /** Show your own posts covered too, to preview what friends see. Not saved. */
  previewAsFriend?: boolean;
  compact?: boolean;
};

/** Last-24-hours posts for the group. No infinite feed: a fixed, short list. */
export default function PostList({ limit, eraserSize, previewAsFriend = false, compact = false }: Props) {
  const { me, posts, imageUrls, revealed, reported, session, nameOf, reveal } = useBooth();
  const [previewRevealed, setPreviewRevealed] = useState<Set<string>>(new Set());

  const focusFrom = session?.focus ? session.startedAt : null;
  const visible = posts.filter((p) => !reported.has(p.id));
  const waiting = focusFrom
    ? visible.filter((p) => p.user_id !== me?.id && new Date(p.created_at).getTime() > focusFrom)
    : [];
  const shown = visible.filter((p) => !waiting.includes(p)).slice(0, limit ?? visible.length);

  if (visible.length === 0) return <p className="hint">Nothing in the last 24 hours yet. Posts from your group show up here.</p>;

  return (
    <div className="stack">
      {waiting.length > 0 && (
        <p className="focus-waiting">
          Focus mode: {waiting.length} new {waiting.length === 1 ? "post is" : "posts are"} waiting for you when your timer ends.
        </p>
      )}
      {shown.map((p) => {
        const mine = p.user_id === me?.id;
        const covered = previewAsFriend
          ? p.status === "approved" && !previewRevealed.has(p.id)
          : !mine && !revealed.has(p.id);
        return (
          <ScratchCard
            key={`${p.id}-${previewAsFriend}`}
            postId={p.id}
            imageUrl={imageUrls[p.image_path]}
            author={mine ? (me?.display_name ?? "you") : nameOf(p.user_id)}
            covered={covered}
            eraserSize={eraserSize}
            onRevealed={() => {
              if (previewAsFriend) setPreviewRevealed((s) => new Set(s).add(p.id));
              else void reveal(p.id);
            }}
            footer={<PostFooter post={p} mine={mine} covered={covered} compact={compact} />}
          />
        );
      })}
    </div>
  );
}

function PostFooter({ post, mine, covered, compact }: { post: Post; mine: boolean; covered: boolean; compact: boolean }) {
  const { nameOf, deletePost, report } = useBooth();
  const [mode, setMode] = useState<"idle" | "delete" | "report" | "reported">("idle");
  const time = new Date(post.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="post-footer">
      <div className="post-meta">
        <b>{nameOf(post.user_id)}</b> <span className="hint">{time}</span>
        {new Date(post.created_at).getHours() < 4 && <span className="badge badge-night">still up?</span>}
        {mine && post.status === "pending" && <span className="badge">checking...</span>}
        {mine && post.status === "held" && <span className="badge badge-held">not shared</span>}
      </div>
      {!covered && post.caption && <div className="post-caption">{post.caption}</div>}
      {mine && post.status === "held" && post.moderation_reason && !compact && (
        <div className="hint">Only you can see this. {post.moderation_reason.replace(/^[a-z_]+: /, "")}</div>
      )}
      <div className="field-row post-actions">
        {mode === "idle" && mine && (
          <button className="small" onClick={() => setMode("delete")}>
            Delete
          </button>
        )}
        {mode === "idle" && !mine && (
          <button className="small" onClick={() => setMode("report")}>
            Report
          </button>
        )}
        {mode === "delete" && (
          <>
            <span>Delete this post?</span>
            <button className="small" onClick={() => void deletePost(post)}>
              Yes
            </button>
            <button className="small" onClick={() => setMode("idle")}>
              No
            </button>
          </>
        )}
        {mode === "report" && (
          <>
            {["Mean or bullying", "Inappropriate", "Something else"].map((reason) => (
              <button
                key={reason}
                className="small"
                onClick={() => {
                  setMode("reported");
                  void report(post.id, reason);
                }}
              >
                {reason}
              </button>
            ))}
            <button className="small" onClick={() => setMode("idle")}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
