"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ScratchCard from "@/components/ScratchCard";
import { postStyle, useBooth, type Post, type Profile } from "@/components/BoothProvider";
import { useShell } from "@/components/AppShell";
import { useFeed } from "@/components/useFeed";
import { Avatar, timeAgo, useFocusTrap, useNow } from "@/components/ui";

export default function HomeScreen() {
  const { group } = useBooth();
  const { openNewPost } = useShell();
  const [eraserSize, setEraserSize] = useState(28);
  const [previewAsFriend, setPreviewAsFriend] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  if (!group) {
    return (
      <section className="window card empty-state">
        <div className="window-body stack">
          <EmptyArt />
          <h2>Welcome to Study Booth</h2>
          <p>Start a group or join a friend&apos;s with their invite code, then share little handmade posts while you study.</p>
          <Link href="/group" className="pill-link pill-green">
            Go to My Group
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="stack home">
      <StoriesRow onOpen={setViewing} onNewPost={openNewPost} />
      <div className="feed-head">
        <h2>Today</h2>
        <FeedSettings
          eraserSize={eraserSize}
          setEraserSize={setEraserSize}
          previewAsFriend={previewAsFriend}
          setPreviewAsFriend={setPreviewAsFriend}
        />
      </div>
      <Feed eraserSize={eraserSize} previewAsFriend={previewAsFriend} onNewPost={openNewPost} />
      {viewing && <StoryViewer startWith={viewing} eraserSize={eraserSize} onClose={() => setViewing(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- stories

/** Members in bubble order: you first, then friends with unseen posts, then the rest. */
function useStoryMembers() {
  const { me, members } = useBooth();
  const { storyPosts, isCovered, focus } = useFeed();
  const friends = members.filter((m) => m.id !== me?.id);
  const rows = friends.map((m) => {
    const posts = storyPosts(m.id);
    return { member: m, posts, unseen: posts.some(isCovered) };
  });
  rows.sort((a, b) => Number(b.unseen) - Number(a.unseen) || Number(b.posts.length > 0) - Number(a.posts.length > 0));
  const mine = me ? { member: me, posts: storyPosts(me.id), unseen: false } : null;
  return { mine, friends: rows, focus };
}

function StoriesRow({ onOpen, onNewPost }: { onOpen: (userId: string) => void; onNewPost: () => void }) {
  const { mine, friends, focus } = useStoryMembers();

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button.story-bubble:not(:disabled)"));
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    items[(i + step + items.length) % items.length].focus();
  };

  return (
    <div className="stories" role="list" aria-label="Stories" onKeyDown={onKeyDown}>
      {mine && (
        <div className="story" role="listitem">
          <button
            className={`story-bubble ${mine.posts.length ? "ring-seen" : "ring-none"}`}
            onClick={() => (mine.posts.length ? onOpen(mine.member.id) : onNewPost())}
            aria-label={mine.posts.length ? `Your posts (${mine.posts.length})` : "New post"}
          >
            <Avatar id={mine.member.id} name={mine.member.display_name} size={58} />
          </button>
          <button className="story-plus pill-green" aria-label="New post" tabIndex={-1} onClick={onNewPost}>
            +
          </button>
          <span className="story-name">You</span>
        </div>
      )}
      {friends.map(({ member, posts, unseen }) => {
        const ring = posts.length === 0 ? "ring-none" : unseen && !focus ? "ring-unseen" : "ring-seen";
        return (
          <div className="story" role="listitem" key={member.id}>
            <button
              className={`story-bubble ${ring}`}
              disabled={posts.length === 0}
              onClick={() => onOpen(member.id)}
              aria-label={
                posts.length === 0
                  ? `${member.display_name}: no posts today`
                  : `${member.display_name}: ${posts.length} ${posts.length === 1 ? "post" : "posts"}${unseen && !focus ? ", new" : ""}`
              }
            >
              <Avatar id={member.id} name={member.display_name} size={58} />
            </button>
            <span className="story-name">{member.display_name}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Full-screen viewer: one post at a time, scratch to reveal, then tap or → for the next. */
function StoryViewer({ startWith, eraserSize, onClose }: { startWith: string; eraserSize: number; onClose: () => void }) {
  const { imageUrls, reveal } = useBooth();
  const { isCovered, authorOf } = useFeed();
  const { mine, friends } = useStoryMembers();
  const now = useNow();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);

  // Snapshot the queue when opened so it doesn't reshuffle as posts get revealed.
  const [queue] = useState<{ member: Profile; posts: Post[] }[]>(() =>
    [...(mine ? [mine] : []), ...friends].filter((r) => r.posts.length > 0).map((r) => ({ member: r.member, posts: [...r.posts].reverse() })),
  );
  const [pos, setPos] = useState(() => {
    const m = Math.max(0, queue.findIndex((r) => r.member.id === startWith));
    // Start at the friend's first unseen post, oldest first.
    const firstUnseen = queue[m]?.posts.findIndex(isCovered) ?? -1;
    return { m, p: Math.max(0, firstUnseen) };
  });

  const current = queue[pos.m];
  const post = current?.posts[pos.p];

  const go = (step: 1 | -1) => {
    const { m, p } = pos;
    const np = p + step;
    if (np >= 0 && np < queue[m].posts.length) return setPos({ m, p: np });
    const nm = m + step;
    if (nm < 0) return;
    if (nm >= queue.length) return onClose();
    setPos({ m: nm, p: step === 1 ? 0 : queue[nm].posts.length - 1 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!current || !post) return null;
  const covered = isCovered(post);

  return (
    <div className="viewer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="viewer" role="dialog" aria-modal="true" aria-label={`${authorOf(post)}'s posts`} tabIndex={-1}>
        <div className="viewer-progress" aria-hidden="true">
          {current.posts.map((p, i) => (
            <span key={p.id} className={i < pos.p ? "done" : i === pos.p ? "now" : ""} />
          ))}
        </div>
        <div className="viewer-head">
          <Avatar id={current.member.id} name={current.member.display_name} size={34} />
          <b>{authorOf(post)}</b>
          <span className="hint">{timeAgo(post.created_at, now)}</span>
          <span className="style-tag">{postStyle(post)}</span>
          <button className="small viewer-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="viewer-stage">
          <button className="viewer-nav prev" aria-label="Previous post" onClick={() => go(-1)} disabled={pos.m === 0 && pos.p === 0}>
            ‹
          </button>
          <div
            className="viewer-card"
            onClick={() => {
              if (!covered) go(1);
            }}
          >
            <ScratchCard
              key={post.id}
              postId={post.id}
              imageUrl={imageUrls[post.image_path]}
              author={authorOf(post)}
              covered={covered}
              eraserSize={eraserSize * 1.6}
              onRevealed={() => void reveal(post.id)}
              twinkle={postStyle(post) === "Bedazzled"}
            />
          </div>
          <button className="viewer-nav next" aria-label="Next post" onClick={() => go(1)}>
            ›
          </button>
        </div>
        <p className="viewer-caption">{covered ? "Scratch to reveal" : (post.caption ?? "")}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- feed

function FeedSettings({
  eraserSize,
  setEraserSize,
  previewAsFriend,
  setPreviewAsFriend,
}: {
  eraserSize: number;
  setEraserSize: (n: number) => void;
  previewAsFriend: boolean;
  setPreviewAsFriend: (b: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, open, () => setOpen(false));
  return (
    <div className="popover-anchor" ref={ref}>
      <button className="small" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        ⚙ Settings
      </button>
      {open && (
        <div className="popover settings-popover" role="dialog" aria-label="Feed settings">
          <div className="field-row">
            <label htmlFor="eraser">Eraser size</label>
            <input id="eraser" type="range" min={10} max={60} value={eraserSize} onChange={(e) => setEraserSize(Number(e.target.value))} />
          </div>
          <div className="field-row">
            <input id="preview-friend" type="checkbox" checked={previewAsFriend} onChange={(e) => setPreviewAsFriend(e.target.checked)} />
            <label htmlFor="preview-friend">Preview my posts as a friend sees them</label>
          </div>
        </div>
      )}
    </div>
  );
}

function Feed({ eraserSize, previewAsFriend, onNewPost }: { eraserSize: number; previewAsFriend: boolean; onNewPost: () => void }) {
  const { shown, waiting, isMine } = useFeed();
  const [previewRevealed, setPreviewRevealed] = useState<Set<string>>(new Set());

  // Your own posts still being checked (or not shared) go first.
  const ordered = [...shown.filter((p) => isMine(p) && p.status !== "approved"), ...shown.filter((p) => !(isMine(p) && p.status !== "approved"))];

  return (
    <div className="stack feed">
      {waiting.length > 0 && (
        <p className="focus-waiting">
          Focus mode: {waiting.length} new {waiting.length === 1 ? "post is" : "posts are"} waiting for you when your timer ends.
        </p>
      )}
      {ordered.length === 0 && waiting.length === 0 && (
        <section className="window card empty-state">
          <div className="window-body stack">
            <EmptyArt />
            <p>
              <b>No posts yet today. Be the first!</b>
            </p>
            <button className="pill-green" onClick={onNewPost}>
              New post
            </button>
          </div>
        </section>
      )}
      {ordered.map((p) => (
        <FeedCard
          key={`${p.id}-${previewAsFriend}`}
          post={p}
          eraserSize={eraserSize}
          previewAsFriend={previewAsFriend}
          previewRevealed={previewRevealed.has(p.id)}
          onPreviewRevealed={() => setPreviewRevealed((s) => new Set(s).add(p.id))}
        />
      ))}
    </div>
  );
}

function FeedCard({
  post,
  eraserSize,
  previewAsFriend,
  previewRevealed,
  onPreviewRevealed,
}: {
  post: Post;
  eraserSize: number;
  previewAsFriend: boolean;
  previewRevealed: boolean;
  onPreviewRevealed: () => void;
}) {
  const { imageUrls, reveal } = useBooth();
  const { isMine, isCovered, authorOf, focus } = useFeed();
  const now = useNow();
  const mine = isMine(post);
  const covered = previewAsFriend ? post.status === "approved" && !previewRevealed : isCovered(post);
  const style = postStyle(post);

  return (
    <article className="window card post-card" aria-label={`${style} from ${authorOf(post)}`}>
      <header className="post-head">
        <Avatar id={post.user_id} name={authorOf(post)} size={36} />
        <div className="post-who">
          <b>{mine ? "You" : authorOf(post)}</b>
          <span className="hint">{timeAgo(post.created_at, now)}</span>
        </div>
        {!focus && <span className="style-tag">{style}</span>}
        {!focus && new Date(post.created_at).getHours() < 4 && <span className="badge badge-night">still up?</span>}
        {mine && post.status === "pending" && (
          <span className="badge" title="Only you can see this until it has been checked">
            Checking…
          </span>
        )}
        {mine && post.status === "held" && <span className="badge badge-held">Not shared</span>}
        <PostMenu post={post} mine={mine} />
      </header>
      <ScratchCard
        postId={post.id}
        imageUrl={imageUrls[post.image_path]}
        author={authorOf(post)}
        covered={covered}
        eraserSize={eraserSize}
        onRevealed={() => {
          if (previewAsFriend) onPreviewRevealed();
          else void reveal(post.id);
        }}
        twinkle={style === "Bedazzled"}
      />
      {!covered && post.caption && <p className="post-caption">{post.caption}</p>}
      {mine && post.status === "held" && post.moderation_reason && (
        <p className="hint held-reason">
          Only you can see this.{" "}
          {post.moderation_reason.startsWith("moderation error")
            ? `We couldn't check it (${post.moderation_reason.replace(/^moderation error:? ?/, "") || "AI error"}), so it wasn't shared. Delete it and try again.`
            : post.moderation_reason.replace(/^[a-z_]+: /, "")}
        </p>
      )}
    </article>
  );
}

/** "⋯" menu: Report for friends' posts, Delete for your own. */
function PostMenu({ post, mine }: { post: Post; mine: boolean }) {
  const { deletePost, report } = useBooth();
  const [mode, setMode] = useState<"closed" | "menu" | "delete" | "report">("closed");
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, mode !== "closed", () => setMode("closed"));

  return (
    <div className="popover-anchor post-menu" ref={ref}>
      <button
        className="small dots"
        aria-label="Post options"
        aria-haspopup="menu"
        aria-expanded={mode !== "closed"}
        onClick={() => setMode(mode === "closed" ? "menu" : "closed")}
      >
        ⋯
      </button>
      {mode !== "closed" && (
        <div className="popover menu-popover" role="menu">
          {mode === "menu" &&
            (mine ? (
              <button role="menuitem" className="small" onClick={() => setMode("delete")}>
                Delete
              </button>
            ) : (
              <button role="menuitem" className="small" onClick={() => setMode("report")}>
                Report
              </button>
            ))}
          {mode === "delete" && (
            <>
              <span>Delete this post?</span>
              <div className="field-row">
                <button role="menuitem" className="small pill-pink" onClick={() => void deletePost(post)}>
                  Yes, delete
                </button>
                <button role="menuitem" className="small" onClick={() => setMode("closed")}>
                  No
                </button>
              </div>
            </>
          )}
          {mode === "report" && (
            <>
              <span>What&apos;s wrong?</span>
              {["Mean or bullying", "Inappropriate", "Something else"].map((reason) => (
                <button
                  key={reason}
                  role="menuitem"
                  className="small"
                  onClick={() => {
                    setMode("closed");
                    void report(post.id, reason);
                  }}
                >
                  {reason}
                </button>
              ))}
              <button role="menuitem" className="small" onClick={() => setMode("closed")}>
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, close]);
}

/** A little glossy camera with sparkles for empty states. */
function EmptyArt() {
  return (
    <svg className="empty-art" width="120" height="90" viewBox="0 0 120 90" aria-hidden="true">
      <defs>
        <linearGradient id="empty-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbd6e3" />
          <stop offset="1" stopColor="#efa3bf" />
        </linearGradient>
      </defs>
      <rect x="22" y="26" width="76" height="52" rx="14" fill="url(#empty-body)" stroke="#cf6f95" strokeWidth="1.5" />
      <rect x="44" y="18" width="24" height="12" rx="5" fill="#fff" stroke="#cf6f95" strokeWidth="1.2" />
      <circle cx="60" cy="52" r="17" fill="#fff" stroke="#cf6f95" strokeWidth="1.5" />
      <circle cx="60" cy="52" r="11" fill="#94c8ee" />
      <circle cx="55" cy="47" r="3.5" fill="#fff" opacity="0.9" />
      <path d="M26 36 C26 30 30 28 36 28 H84 C90 28 94 30 94 36 V40 C76 44 44 44 26 40 Z" fill="#fff" opacity="0.45" />
      <path d="M104 14 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#c8e88a" />
      <path d="M14 58 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z" fill="#94c8ee" />
      <path d="M100 70 l1.2 2.8 2.8 1.2 -2.8 1.2 -1.2 2.8 -1.2 -2.8 -2.8 -1.2 2.8 -1.2z" fill="#efa3bf" />
    </svg>
  );
}
