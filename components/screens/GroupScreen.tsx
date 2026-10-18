"use client";

import GroupWindow from "@/components/GroupWindow";

export default function GroupScreen() {
  return (
    <section className="window card">
      <div className="window-body stack">
        <h2>My Group</h2>
        <GroupWindow />
      </div>
    </section>
  );
}
