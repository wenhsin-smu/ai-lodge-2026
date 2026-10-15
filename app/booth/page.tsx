"use client";

import { useState } from "react";
import Feed from "@/components/Feed";
import FogBooth from "@/components/FogBooth";
import PopOut from "@/components/PopOut";

export default function BoothPage() {
  const [eraserSize, setEraserSize] = useState(28);

  return (
    <div className="booth-layout">
      <div className="window">
        <div className="title-bar">
          <div className="title-bar-text">Fog camera</div>
        </div>
        <div className="window-body">
          <FogBooth />
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
