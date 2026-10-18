"use client";

import { useBooth, type Post } from "@/components/BoothProvider";

/**
 * Which posts to show, shared by the feed, the stories row and the widget.
 * Reported posts are hidden; in focus mode, friends' posts that arrive after
 * the timer started wait until it ends.
 */
export function useFeed() {
  const { me, posts, revealed, reported, session, nameOf } = useBooth();
  const myId = me?.id;
  const focusFrom = session?.focus ? session.startedAt : null;
  const visible = posts.filter((p) => !reported.has(p.id));
  const waiting = focusFrom
    ? visible.filter((p) => p.user_id !== myId && new Date(p.created_at).getTime() > focusFrom)
    : [];
  const shown = visible.filter((p) => !waiting.includes(p));

  const isMine = (p: Post) => p.user_id === myId;
  return {
    shown,
    waiting,
    focus: Boolean(focusFrom),
    isMine,
    isCovered: (p: Post) => !isMine(p) && !revealed.has(p.id),
    authorOf: (p: Post) => (isMine(p) ? (me?.display_name ?? "you") : nameOf(p.user_id)),
    /** A member's posts from the last 24 hours, as their story (newest first). */
    storyPosts: (userId: string) =>
      shown.filter((p) => p.user_id === userId && (p.status === "approved" || userId === myId)),
  };
}
