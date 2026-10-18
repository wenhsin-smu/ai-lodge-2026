"use client";

import StoryWindow from "@/components/StoryWindow";

export default function StoryScreen() {
  return (
    <section className="window card">
      <div className="window-body stack">
        <h2>Weekly Story</h2>
        <StoryWindow />
      </div>
    </section>
  );
}
