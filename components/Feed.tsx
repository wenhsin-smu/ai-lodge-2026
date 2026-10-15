"use client";

import ScratchCard from "@/components/ScratchCard";
import { useLocalPosts } from "@/components/useLocalPosts";
import { addSampleFriendPost, clearPosts } from "@/lib/localPosts";

export default function Feed({ eraserSize }: { eraserSize: number }) {
  const posts = useLocalPosts();

  return (
    <div className="stack">
      <div className="field-row">
        <button onClick={addSampleFriendPost}>Simulate friend post</button>
        <button onClick={clearPosts}>Clear all</button>
      </div>
      {posts.length === 0 ? (
        <p>No posts in the last 24 hours yet.</p>
      ) : (
        posts.map((p) => <ScratchCard key={p.id} post={p} eraserSize={eraserSize} />)
      )}
    </div>
  );
}
