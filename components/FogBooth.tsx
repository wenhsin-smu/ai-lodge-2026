"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createBlowDetector, type BlowDetector } from "@/lib/blowDetector";
import { FingerPen, PEN, type Pt } from "@/lib/fingerPen";
import { createHandTracker, type HandTracker } from "@/lib/handTracker";
import { FILTERS, applyFilter, type FilterId } from "@/lib/photoFilters";

const W = 640;
const H = 480;
const WIPE_WIDTH = 22;
// Blowing must stay above the threshold this long before fog starts forming.
const SUSTAIN_MS = 200;
// Average brightness (0-255) below which hand tracking gets unreliable.
const DARK_LUMA = 55;
const HINT_KEY = "studybooth.pinchHintSeen";
const FILTER_KEY = "studybooth.photoFilter";

function readSavedFilter(): FilterId {
  try {
    const saved = window.localStorage.getItem(FILTER_KEY);
    if (FILTERS.some((f) => f.id === saved)) return saved as FilterId;
  } catch {}
  return "none";
}
const noSubscribe = () => () => {};
const readDebugFlag = () => new URLSearchParams(window.location.search).has("debug");

// Hand skeleton for the debug overlay.
const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

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
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const debugTextRef = useRef<HTMLPreElement>(null);

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
  const [tooDark, setTooDark] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const debug = useSyncExternalStore(noSubscribe, readDebugFlag, () => false);
  // Photo filter, remembered for this browser only.
  const [filter, setFilterState] = useState<FilterId>(() => (typeof window === "undefined" ? "none" : readSavedFilter()));
  const filterRef = useRef<FilterId>(filter);
  const [flashKey, setFlashKey] = useState(0);
  const setFilter = (id: FilterId) => {
    setFilterState(id);
    filterRef.current = id;
    try {
      window.localStorage.setItem(FILTER_KEY, id);
    } catch {}
  };

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

      // 5. Photo mode: live filter, so the preview is exactly what gets captured.
      if (!fog) applyFilter(canvas, filterRef.current);

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, fog]);

  // Finger writing: hand detection runs only while fog mode is open and finger mode is on.
  const fingerActive = running && fog && !hidden && mode === "finger" && handStatus === "ready";
  useEffect(() => {
    if (!fingerActive) return;
    const video = videoRef.current!;
    const tracker = handRef.current!;
    const fogCtx = fogRef.current!.getContext("2d")!;
    const pen = new FingerPen(W, H);
    const cursor = cursorRef.current;
    const lumaCanvas = document.createElement("canvas");
    lumaCanvas.width = 32;
    lumaCanvas.height = 24;
    const lumaCtx = lumaCanvas.getContext("2d", { willReadFrequently: true })!;
    let stopped = false;
    let handle = 0;
    let frames = 0;
    let fps = 0;
    let fpsSince = performance.now();
    let lastLumaCheck = 0;
    let dark = false;
    let luma = 0;
    let score = 0;

    const useVfc = "requestVideoFrameCallback" in video;
    const schedule = () => {
      if (stopped) return;
      handle = useVfc ? video.requestVideoFrameCallback(onFrame) : requestAnimationFrame(() => onFrame(performance.now()));
    };

    const onFrame = (now: number) => {
      if (stopped) return;
      const reading = tracker.detect(video, now);
      score = reading?.score ?? 0;
      for (const ev of pen.update(reading?.landmarks ?? null, now)) {
        if (ev.type === "stroke") wipeCurve(fogCtx, ev.from, ev.ctrl, ev.to);
      }
      moveCursor(pen.debug.handVisible ? pen.debug.point : null, pen.debug.down);

      frames++;
      if (now - fpsSince >= 1000) {
        fps = (frames * 1000) / (now - fpsSince);
        frames = 0;
        fpsSince = now;
      }
      if (now - lastLumaCheck > 1000) {
        lastLumaCheck = now;
        lumaCtx.drawImage(video, 0, 0, 32, 24);
        const px = lumaCtx.getImageData(0, 0, 32, 24).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        luma = sum / (px.length / 4);
        if (luma < DARK_LUMA !== dark) {
          dark = luma < DARK_LUMA;
          setTooDark(dark);
        }
      }
      if (debugCanvasRef.current) drawDebug(debugCanvasRef.current, reading?.landmarks ?? null, pen.debug.point, pen.debug.down);
      if (debugTextRef.current) {
        const d = pen.debug;
        debugTextRef.current.textContent = [
          `detector ${tracker.backend} · ${fps.toFixed(0)} fps · ${useVfc ? "videoFrameCallback" : "rAF"}`,
          `hand ${d.handVisible ? `yes (conf ${score.toFixed(2)})` : Number.isFinite(d.lostForMs) ? `no (lost ${d.lostForMs} ms)` : "not seen yet"}`,
          `pinch ${d.ratio === null ? "-" : d.ratio.toFixed(2)}  (down < ${PEN.downRatio}, up > ${PEN.upRatio})`,
          `pen ${d.down ? "DOWN (writing)" : "up"}`,
          `brightness ${luma.toFixed(0)}${luma < DARK_LUMA ? " (too dark)" : ""}`,
        ].join("\n");
      }
      schedule();
    };

    const moveCursor = (p: Pt | null, down: boolean) => {
      const el = cursorRef.current;
      if (!el) return;
      if (!p) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      el.style.left = `${(p.x / W) * 100}%`;
      el.style.top = `${(p.y / H) * 100}%`;
      el.classList.toggle("down", down);
    };

    schedule();
    return () => {
      stopped = true;
      if (useVfc) video.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
      if (cursor) cursor.style.display = "none";
      setTooDark(false);
    };
  }, [fingerActive]);

  // One-time hint the first time finger writing starts.
  useEffect(() => {
    if (!fingerActive) return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(HINT_KEY) === "1";
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {}
    if (seen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to finger mode starting
    setShowHint(true);
    const t = window.setTimeout(() => setShowHint(false), 7000);
    return () => window.clearTimeout(t);
  }, [fingerActive]);

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
    // The canvas already shows the filtered frame, so the photo matches the preview exactly.
    const image = canvas.toDataURL("image/jpeg", 0.88);
    const kind = fog && fogUsedRef.current ? "fog" : "photo";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (fog || reduceMotion) {
      onCapture(image, kind);
      return;
    }
    // Let the shutter flash show on the viewfinder before switching to the preview.
    setFlashKey((k) => k + 1);
    window.setTimeout(() => onCapture(image, kind), 180);
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
      <div className="camera-body">
        <span className="camera-lens" aria-hidden="true" />
        <span className="camera-flash" aria-hidden="true" />
        <span className="camera-label" aria-hidden="true">{fog ? "fog cam" : "booth cam"}</span>
      <div className={fog ? "viewfinder lens-fog" : "viewfinder"}>
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
            <button className="pill-green" onClick={start} disabled={starting}>
              {starting ? "Waiting for permission..." : "Turn on camera"}
            </button>
            <p className="viewfinder-hint">
              {fog
                ? "The browser will ask for your camera and microphone (blow into the mic to fog the glass). Nothing is saved until you press the shutter button."
                : "The browser will ask for your camera. Nothing is saved until you press the shutter button."}
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
        <div ref={cursorRef} className="pen-cursor" aria-hidden="true" />
        {flashKey > 0 && <div key={flashKey} className="shutter-flash" aria-hidden="true" />}
        {debug && fingerActive && (
          <>
            <canvas ref={debugCanvasRef} width={W} height={H} className="debug-overlay" />
            <pre ref={debugTextRef} className="debug-readout" />
          </>
        )}
        {fingerActive && showHint && (
          <button type="button" className="pen-hint" onClick={() => setShowHint(false)}>
            Pinch to write, open your hand to lift ✋
          </button>
        )}
        {fingerActive && tooDark && <div className="dark-warning">It&apos;s a bit dark: turn on a light so finger tracking can see your hand.</div>}
        {running && (
          <div className="shutter-controls">
            {fog && (
              <button type="button" className="clear-fog-button pill-pink" aria-label="Clear fog" title="Clear fog" onClick={clearFog}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M4 15c3-1 5-4 8-4s4 3 8 2M4 10c3-1 5-4 8-4s4 3 8 2M6 19c2-1 4-2 6-2s3 1 6 1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <button type="button" className="shutter-button" aria-label="Take photo" title="Take photo" onClick={takePhoto}>
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.2-1.8h5l1.2 1.8h1.8A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" fill="currentColor" />
                <circle cx="12" cy="12.5" r="3.6" fill="#fff" />
                <circle cx="12" cy="12.5" r="2.2" fill="currentColor" />
              </svg>
            </button>
          </div>
        )}
      </div>
      </div>

      {running && !fog && (
        <div className="field-row">
          <span>Filter</span>
          <div className="filter-chips" role="radiogroup" aria-label="Photo filter">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="radio"
                aria-checked={filter === f.id}
                className={filter === f.id ? "small pill-pink" : "small"}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {running && fog && (
        <div className="stack">
          <div className="field-row">
            <span>Mic</span>
            <div className="mic-meter">
              <div ref={meterRef} className={blowing ? "mic-meter-fill blowing" : "mic-meter-fill"} />
              <div className="mic-meter-threshold" style={{ left: `${threshold * 100}%` }} title="Blow threshold" />
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
          <div className="field-row">
            <span>Write with</span>
            <div className="pill-toggle" role="radiogroup" aria-label="Write with">
              <button
                role="radio"
                aria-checked={mode === "mouse"}
                className={mode === "mouse" ? "pill-blue" : ""}
                onClick={() => chooseMode("mouse")}
              >
                Mouse / trackpad
              </button>
              <button
                role="radio"
                aria-checked={mode === "finger"}
                className={mode === "finger" ? "pill-blue" : ""}
                onClick={() => chooseMode("finger")}
              >
                Finger (pinch)
              </button>
            </div>
          </div>
          {handStatus === "loading" && <p className="hint">Loading hand tracking…</p>}
          {handStatus === "error" && <p role="alert">Hand tracking couldn&apos;t load. Mouse and trackpad still work.</p>}
          {mode === "finger" && handStatus === "ready" && (
            <p className="hint">Pinch your thumb and index finger together to write; open your hand to lift the pen. Keep your hand in the middle of the camera view.</p>
          )}
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

/** Wipes a smooth quadratic curve through the fog (finger strokes). */
function wipeCurve(ctx: CanvasRenderingContext2D, from: Pt, ctrl: Pt, to: Pt) {
  ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = "rgba(0,0,0,1)";
  ctx.lineWidth = WIPE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(ctrl.x, ctrl.y, to.x === from.x && to.y === from.y ? to.x + 0.1 : to.x, to.y);
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

/** Debug overlay: hand skeleton (mirrored camera view), active region, pen point. */
function drawDebug(canvas: HTMLCanvasElement, lm: { x: number; y: number }[] | null, pen: Pt | null, down: boolean) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  const m = ((1 - PEN.activeRegion) / 2) * W;
  const mh = ((1 - PEN.activeRegion) / 2) * H;
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(m, mh, W - 2 * m, H - 2 * mh);
  ctx.setLineDash([]);
  if (lm) {
    const at = (i: number) => ({ x: (1 - lm[i].x) * W, y: lm[i].y * H });
    ctx.strokeStyle = "rgba(148,200,238,0.9)";
    ctx.lineWidth = 2;
    for (const [a, b] of BONES) {
      ctx.beginPath();
      ctx.moveTo(at(a).x, at(a).y);
      ctx.lineTo(at(b).x, at(b).y);
      ctx.stroke();
    }
    lm.forEach((_, i) => {
      const p = at(i);
      ctx.fillStyle = i === 4 || i === 8 ? "#efa3bf" : "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === 4 || i === 8 ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = "#efa3bf";
    ctx.beginPath();
    ctx.moveTo(at(4).x, at(4).y);
    ctx.lineTo(at(8).x, at(8).y);
    ctx.stroke();
  }
  if (pen) {
    ctx.fillStyle = down ? "#cf6f95" : "rgba(255,255,255,0.9)";
    ctx.strokeStyle = "#3a3a40";
    ctx.beginPath();
    ctx.arc(pen.x, pen.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
