"use client";

import { useEffect, useRef, useState } from "react";
import { createBlowDetector, type BlowDetector } from "@/lib/blowDetector";
import { createHandTracker, type HandTracker } from "@/lib/handTracker";

const W = 640;
const H = 480;
const WIPE_WIDTH = 22;
// Blowing must stay above the threshold this long before fog starts forming.
const SUSTAIN_MS = 200;
// Frames a pose must hold before finger writing starts or stops (reduces flicker).
const POSE_FRAMES = 3;
const SMOOTHING = 0.35;

type Mode = "mouse" | "finger";
type Point = { x: number; y: number };

type Props = {
  /** Fog mode: blow into the mic to fog the glass, then write on it. Off = plain photo. */
  fog: boolean;
  /** Hidden while the parent shows the preview, so the camera keeps running for a retake. */
  hidden?: boolean;
  onCapture: (image: string, kind: "fog" | "photo") => void;
};

export default function FogBooth({ fog, hidden = false, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);

  // Offscreen canvases: the fog mask (alpha = fog density) and the blurred layer.
  const fogRef = useRef<HTMLCanvasElement | null>(null);
  const blurRef = useRef<HTMLCanvasElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const blowRef = useRef<BlowDetector | null>(null);
  const handRef = useRef<HandTracker | null>(null);

  const thresholdRef = useRef(0.55);
  const modeRef = useRef<Mode>("mouse");
  const fogUsedRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [threshold, setThreshold] = useState(0.55);
  const [mode, setMode] = useState<Mode>("mouse");
  const [handStatus, setHandStatus] = useState<"off" | "loading" | "ready" | "error">("off");
  const [blowing, setBlowing] = useState(false);

  useEffect(() => {
    thresholdRef.current = threshold;
  }, [threshold]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Stop camera, mic and hand tracking when leaving the page.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      blowRef.current?.close();
      handRef.current?.close();
    };
  }, []);

  async function start() {
    setError("");
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: W, height: H, facingMode: "user" },
        // Raw mic signal: browser noise suppression would hide the blowing sound.
        audio: fog ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      if (fog) blowRef.current = createBlowDetector(stream);

      const fogCanvas = document.createElement("canvas");
      fogCanvas.width = W;
      fogCanvas.height = H;
      fogRef.current = fogCanvas;
      const blur = document.createElement("canvas");
      blur.width = W;
      blur.height = H;
      blurRef.current = blur;

      setRunning(true);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Camera or microphone permission was denied. Allow both in the browser's address bar and try again."
          : e instanceof Error && e.name === "NotFoundError"
            ? "No camera or microphone was found on this computer."
            : e instanceof Error && e.name === "NotReadableError"
              ? "The camera is busy. Close other apps using it (Zoom, Teams, another tab) and try again."
              : "Couldn't start the camera and microphone.",
      );
    } finally {
      setStarting(false);
    }
  }

  // Render loop: fog build-up, compositing, finger writing.
  useEffect(() => {
    if (!running) return;
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const fogCtx = fogRef.current!.getContext("2d")!;
    const blurCtx = blurRef.current!.getContext("2d")!;

    let frame = 0;
    let aboveSince: number | null = null;
    let wasBlowing = false;
    let lastMeterUpdate = 0;
    let lastVideoTime = -1;
    let smoothed: Point | null = null;
    let lastFingerPoint: Point | null = null;
    let poseCount = 0;
    let drawingWithFinger = false;

    const tick = (now: number) => {
      // 1. Blow detection.
      const level = blowRef.current?.read() ?? 0;
      if (level > thresholdRef.current) aboveSince ??= now;
      else aboveSince = null;
      const isBlowing = aboveSince !== null && now - aboveSince >= SUSTAIN_MS;
      if (isBlowing !== wasBlowing) {
        wasBlowing = isBlowing;
        setBlowing(isBlowing);
      }
      if (now - lastMeterUpdate > 80 && meterRef.current) {
        lastMeterUpdate = now;
        meterRef.current.style.width = `${Math.round(level * 100)}%`;
      }

      // 2. Fog builds up while blowing, densest in the middle like breath on glass.
      if (isBlowing) {
        fogUsedRef.current = true;
        const strength = Math.min(1, (level - thresholdRef.current) / (1 - thresholdRef.current) + 0.3);
        fogCtx.globalCompositeOperation = "source-over";
        fogCtx.fillStyle = `rgba(255,255,255,${0.02 * strength})`;
        fogCtx.fillRect(0, 0, W, H);
        const g = fogCtx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55);
        g.addColorStop(0, `rgba(255,255,255,${0.07 * strength})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        fogCtx.fillStyle = g;
        fogCtx.fillRect(0, 0, W, H);
      }

      // 3. Finger writing.
      if (modeRef.current === "finger" && handRef.current && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const hand = handRef.current.detect(video, now);
        if (hand) {
          // Mirror x to match the selfie view.
          const target = { x: (1 - hand.x) * W, y: hand.y * H };
          smoothed = smoothed
            ? {
                x: smoothed.x + (target.x - smoothed.x) * SMOOTHING,
                y: smoothed.y + (target.y - smoothed.y) * SMOOTHING,
              }
            : target;

          if (hand.pointing !== drawingWithFinger) {
            poseCount++;
            if (poseCount >= POSE_FRAMES) {
              drawingWithFinger = hand.pointing;
              poseCount = 0;
              lastFingerPoint = null;
            }
          } else {
            poseCount = 0;
          }

          if (drawingWithFinger) {
            wipe(fogCtx, lastFingerPoint ?? smoothed, smoothed);
            lastFingerPoint = smoothed;
          }
          showCursor(smoothed, drawingWithFinger);
        } else {
          smoothed = null;
          lastFingerPoint = null;
          drawingWithFinger = false;
          poseCount = 0;
          showCursor(null, false);
        }
      } else if (modeRef.current !== "finger") {
        showCursor(null, false);
      }

      // 4. Composite: mirrored video, then a blurred, frosted copy masked by the fog.
      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, W, H);
      ctx.restore();

      blurCtx.globalCompositeOperation = "source-over";
      blurCtx.clearRect(0, 0, W, H);
      blurCtx.save();
      blurCtx.filter = "blur(12px)";
      blurCtx.translate(W, 0);
      blurCtx.scale(-1, 1);
      blurCtx.drawImage(video, -20, -20, W + 40, H + 40);
      blurCtx.restore();
      blurCtx.globalCompositeOperation = "source-atop";
      blurCtx.fillStyle = "rgba(232,238,242,0.55)";
      blurCtx.fillRect(0, 0, W, H);
      blurCtx.globalCompositeOperation = "destination-in";
      blurCtx.drawImage(fogRef.current!, 0, 0);
      ctx.drawImage(blurRef.current!, 0, 0);

      frame = requestAnimationFrame(tick);
    };

    const showCursor = (p: Point | null, active: boolean) => {
      const el = cursorRef.current;
      if (!el) return;
      if (!p) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      el.style.left = `${(p.x / W) * 100}%`;
      el.style.top = `${(p.y / H) * 100}%`;
      el.style.background = active ? "rgba(0,128,255,0.8)" : "rgba(255,255,255,0.6)";
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  // Load the hand tracker the first time finger mode is turned on.
  async function chooseMode(next: Mode) {
    setMode(next);
    if (next !== "finger" || handRef.current || handStatus === "loading") return;
    setHandStatus("loading");
    try {
      handRef.current = await createHandTracker();
      setHandStatus("ready");
    } catch {
      setHandStatus("error");
      setMode("mouse");
    }
  }

  // Mouse writing.
  const lastMouse = useRef<Point | null>(null);
  function toCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  }
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== "mouse" || !fogRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toCanvasPoint(e);
    wipe(fogRef.current.getContext("2d")!, p, p);
    lastMouse.current = p;
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== "mouse" || !lastMouse.current || !fogRef.current) return;
    const p = toCanvasPoint(e);
    wipe(fogRef.current.getContext("2d")!, lastMouse.current, p);
    lastMouse.current = p;
  }
  function onPointerUp() {
    lastMouse.current = null;
  }

  function clearFog() {
    fogRef.current?.getContext("2d")!.clearRect(0, 0, W, H);
    fogUsedRef.current = false;
  }

  function takePhoto() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onCapture(canvas.toDataURL("image/jpeg", 0.85), fog && fogUsedRef.current ? "fog" : "photo");
  }

  return (
    <div className="stack" style={{ display: hidden ? "none" : undefined }}>
      {/* Kept invisible but rendered so the browser keeps decoding frames. */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />

      {/* Viewfinder: always visible (except during preview) so it's clear where the camera goes. */}
      <div className={fog ? "viewfinder crt-glass" : "viewfinder"}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{
            display: running ? "block" : "none",
            cursor: fog && mode === "mouse" ? "crosshair" : "default",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {!running && (
          <div className="viewfinder-empty">
            <p>Your camera will appear here.</p>
            <button onClick={start} disabled={starting}>
              {starting ? "Waiting for permission..." : "Turn on camera"}
            </button>
            <p className="viewfinder-hint">
              {fog
                ? "The browser will ask for your camera and microphone (blow into the mic to fog the glass). Nothing is saved until you press Take photo."
                : "The browser will ask for your camera. Nothing is saved until you press Take photo."}
            </p>
            {error && (
              <p role="alert" className="viewfinder-error">
                {error}
              </p>
            )}
          </div>
        )}
        <span className="viewfinder-corner tl" />
        <span className="viewfinder-corner tr" />
        <span className="viewfinder-corner bl" />
        <span className="viewfinder-corner br" />
        <div
          ref={cursorRef}
          style={{
            position: "absolute",
            width: 14,
            height: 14,
            marginLeft: -7,
            marginTop: -7,
            borderRadius: "50%",
            border: "2px solid white",
            pointerEvents: "none",
            display: "none",
          }}
        />
      </div>

      {running && !fog && (
        <div className="field-row">
          <button onClick={takePhoto}>Take photo</button>
        </div>
      )}

      {running && fog && (
        <div className="stack">
          <div className="field-row">
            <span>Mic</span>
            <div style={{ flex: 1, height: 12, background: "#fff", border: "1px solid #808080", position: "relative" }}>
              <div ref={meterRef} style={{ height: "100%", width: 0, background: blowing ? "#2a8" : "#888" }} />
              <div
                style={{ position: "absolute", top: -2, bottom: -2, left: `${threshold * 100}%`, width: 2, background: "red" }}
                title="Blow threshold"
              />
            </div>
            <span style={{ width: 60 }}>{blowing ? "Fogging" : ""}</span>
          </div>
          <div className="field-row">
            <label htmlFor="sensitivity">Blow threshold</label>
            <input
              id="sensitivity"
              type="range"
              min={0.1}
              max={0.95}
              step={0.01}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </div>
          <fieldset>
            <legend>Write with</legend>
            <div className="field-row">
              <input
                id="mode-mouse"
                type="radio"
                name="mode"
                checked={mode === "mouse"}
                onChange={() => chooseMode("mouse")}
              />
              <label htmlFor="mode-mouse">Mouse</label>
              <input
                id="mode-finger"
                type="radio"
                name="mode"
                checked={mode === "finger"}
                onChange={() => chooseMode("finger")}
              />
              <label htmlFor="mode-finger">Finger</label>
            </div>
            {handStatus === "loading" && <p>Loading hand tracking...</p>}
            {handStatus === "error" && <p role="alert">Hand tracking couldn&apos;t load. Mouse still works.</p>}
            {mode === "finger" && handStatus === "ready" && (
              <p>Point with only your index finger to write. Open your hand to move without writing.</p>
            )}
          </fieldset>
          <div className="field-row">
            <button onClick={clearFog}>Clear fog</button>
            <button onClick={takePhoto}>Take photo</button>
          </div>
        </div>
      )}

    </div>
  );
}

function wipe(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
  ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = "rgba(0,0,0,1)";
  ctx.lineWidth = WIPE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x === from.x && to.y === from.y ? to.x + 0.1 : to.x, to.y);
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}
