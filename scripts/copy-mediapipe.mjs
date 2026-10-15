// Copies the MediaPipe WASM runtime into public/ so hand tracking doesn't depend on a CDN.
import { cpSync, mkdirSync } from "node:fs";

const src = "node_modules/@mediapipe/tasks-vision/wasm";
const dest = "public/mediapipe";
mkdirSync(dest, { recursive: true });
for (const file of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  cpSync(`${src}/${file}`, `${dest}/${file}`);
}
