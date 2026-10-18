// On-device hand tracking with MediaPipe HandLandmarker.
// Video frames are processed locally in the browser and never uploaded.

import type { HandLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

const WASM_URL = "/mediapipe";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export type HandReading = {
  /** 21 landmarks in raw (un-mirrored) video coordinates, 0..1. */
  landmarks: NormalizedLandmark[];
  /** Handedness confidence for the detected hand, 0..1. */
  score: number;
};

export type HandTracker = {
  detect(video: HTMLVideoElement, timestampMs: number): HandReading | null;
  backend: "GPU" | "CPU";
  close(): void;
};

export async function createHandTracker(): Promise<HandTracker> {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const create = (delegate: "GPU" | "CPU") =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
  // Some laptops can't run the GPU delegate; fall back to CPU.
  let backend: "GPU" | "CPU" = "GPU";
  const landmarker: HandLandmarker = await create("GPU").catch(() => {
    backend = "CPU";
    return create("CPU");
  });

  let lastTs = 0;
  return {
    backend,
    detect(video, timestampMs) {
      // MediaPipe needs strictly increasing timestamps.
      const ts = Math.max(timestampMs, lastTs + 1);
      lastTs = ts;
      const result = landmarker.detectForVideo(video, ts);
      const lm = result.landmarks[0];
      if (!lm) return null;
      return { landmarks: lm, score: result.handedness[0]?.[0]?.score ?? 0 };
    },
    close() {
      landmarker.close();
    },
  };
}
