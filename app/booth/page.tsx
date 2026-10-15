"use client";

import { useState } from "react";
import Feed from "@/components/Feed";
import FogBooth from "@/components/FogBooth";
import NoteComposer from "@/components/NoteComposer";
import PopOut from "@/components/PopOut";

export default function BoothPage() {
  const [eraserSize, setEraserSize] = useState(28);
  const [tab, setTab] = useState<"camera" | "note">("camera");

  return (
    <div className="booth-layout">
      <div className="window">
        <div className="title-bar">
          <div className="title-bar-text">New post</div>
        </div>
        <div className="window-body">
          <menu role="tablist">
            <Tab label="Fog camera" selected={tab === "camera"} onSelect={() => setTab("camera")} />
            <Tab label="Stitched note" selected={tab === "note"} onSelect={() => setTab("note")} />
          </menu>
          <div className="window" role="tabpanel">
            <div className="window-body">{tab === "camera" ? <FogBooth /> : <NoteComposer />}</div>
          </div>
        </div>
      </div>

      <div className="window">
        <div className="title-bar">
          <div className="title-bar-text">Group feed (local test mode)</div>
        </div>
        <div className="window-body stack">
          <div className="field-row">
            <PopOut eraserSize={eraserSize} />
          </div>
          <div className="field-row">
            <label htmlFor="eraser">Eraser size</label>
            <input
              id="eraser"
              type="range"
              min={10}
              max={60}
              value={eraserSize}
              onChange={(e) => setEraserSize(Number(e.target.value))}
            />
          </div>
          <Feed eraserSize={eraserSize} />
        </div>
      </div>
    </div>
  );
}

function Tab({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <li role="tab" aria-selected={selected}>
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onSelect();
        }}
      >
        {label}
      </a>
    </li>
  );
}
