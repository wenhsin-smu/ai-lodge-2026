"use client";

import { useSyncExternalStore } from "react";
import ScratchCard from "@/components/ScratchCard";
import { useLocalPosts } from "@/components/useLocalPosts";
import { addSampleFriendPost, clearPosts, getIdentity } from "@/lib/localPosts";

const noSubscribe = () => () => {};

export default function Feed({ eraserSize }: { eraserSize: number }) {
  const posts = useLocalPosts();
  const me = useSyncExternalStore(noSubscribe, getIdentity, () => null);

  return (
    <div className="stack">
      {me && (
        <p>
          Testing as <b>{me.name}</b>. To be a friend, open this page in a new tab (paste the address, don&apos;t
          duplicate the tab).
        </p>
      )}
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
