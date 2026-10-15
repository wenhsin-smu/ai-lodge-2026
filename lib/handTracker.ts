// On-device fingertip tracking with MediaPipe HandLandmarker.
// Video frames are processed locally in the browser and never uploaded.

import type { HandLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

const WASM_URL = "/mediapipe";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export type HandReading = {
  /** Index fingertip in raw (un-mirrored) video coordinates, 0..1. */
  x: number;
  y: number;
  /** True when only the index finger is extended (the "write" pose). */
  pointing: boolean;
};

export type HandTracker = {
  detect(video: HTMLVideoElement, timestampMs: number): HandReading | null;
  close(): void;
};

function dist(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isPointing(lm: NormalizedLandmark[]) {
  const wrist = lm[0];
  const fromWrist = (i: number) => dist(lm[i], wrist);
  // Index: tip farther from the wrist than the middle joint, and joints in a line.
  const indexExtended = fromWrist(8) > fromWrist(6) && fromWrist(6) > fromWrist(5);
  // Middle, ring and pinky: tip closer to the wrist than the middle joint.
  const othersCurled =
    fromWrist(12) < fromWrist(10) && fromWrist(16) < fromWrist(14) && fromWrist(20) < fromWrist(18);
  return indexExtended && othersCurled;
}

export async function createHandTracker(): Promise<HandTracker> {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const create = (delegate: "GPU" | "CPU") =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numHands: 1,
    });
  // Some laptops can't run the GPU delegate; fall back to CPU.
  const landmarker: HandLandmarker = await create("GPU").catch(() => create("CPU"));

  return {
    detect(video, timestampMs) {
      const result = landmarker.detectForVideo(video, timestampMs);
      const lm = result.landmarks[0];
      if (!lm) return null;
      return { x: lm[8].x, y: lm[8].y, pointing: isPointing(lm) };
    },
    close() {
      landmarker.close();
    },
  };
}
