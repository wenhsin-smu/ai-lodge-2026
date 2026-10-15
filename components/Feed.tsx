"use client";

import ScratchCard from "@/components/ScratchCard";
import { useIdentity } from "@/components/useIdentity";
import { useLocalPosts } from "@/components/useLocalPosts";
import { clearPosts, getSelf, setViewAsFriend } from "@/lib/localPosts";

export default function Feed({ eraserSize }: { eraserSize: number }) {
  const posts = useLocalPosts();
  const viewer = useIdentity();
  if (!viewer) return null;
  const asFriend = viewer.id !== getSelf().id;

  return (
    <div className="stack">
      {asFriend ? (
        <p>
          <b>Friend view:</b> this is what <b>{viewer.name}</b> sees. Scratch your posts to reveal them.
        </p>
      ) : (
        <p>
          You are <b>{viewer.name}</b>. Switch to friend view to see your posts the way friends do.
        </p>
      )}
      <div className="field-row">
        <button onClick={() => setViewAsFriend(!asFriend)}>{asFriend ? "Back to me" : "View as friend"}</button>
        <button onClick={clearPosts}>Clear all</button>
      </div>
      {posts.length === 0 ? (
        <p>No posts in the last 24 hours yet.</p>
      ) : (
        // Keyed by viewer too, so switching views resets each card's scratch state.
        posts.map((p) => (
          <ScratchCard key={`${p.id}-${viewer.id}`} post={p} viewerId={viewer.id} eraserSize={eraserSize} />
        ))
      )}
    </div>
  );
}
