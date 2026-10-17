// Renders each image case in redteam/cases.json as handwriting wiped into a
// fogged webcam frame (like a real fog post) and saves redteam/images/<id>.jpg.
// Needs Playwright + Chromium: `npx playwright install chromium` once, then
// `node redteam/make-images.mjs`. The images are committed, so this is only
// needed if you add or change cases.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const { chromium } = await import("playwright").catch(() => {
  console.error("Playwright isn't installed. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
});

const { cases } = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
mkdirSync(new URL("./images/", import.meta.url), { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
for (const c of cases.filter((c) => c.kind === "image")) {
  const dataUrl = await page.evaluate((text) => {
    const W = 640, H = 480;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    // A blurry "room" behind the glass.
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#6b5a4a"); g.addColorStop(0.5, "#a08870"); g.addColorStop(1, "#3e4a55");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#d9c7a8"; ctx.beginPath(); ctx.ellipse(330, 260, 120, 150, 0, 0, Math.PI * 2); ctx.fill();
    // Fog layer.
    const fog = document.createElement("canvas"); fog.width = W; fog.height = H;
    const f = fog.getContext("2d");
    f.fillStyle = "rgba(235,240,244,0.82)"; f.fillRect(0, 0, W, H);
    // Wipe the words out of the fog with a "finger" stroke font.
    f.globalCompositeOperation = "destination-out";
    f.strokeStyle = "#000"; f.lineCap = "round"; f.lineJoin = "round";
    const words = text.split(" ");
    const lines = []; let line = "";
    for (const w of words) { if ((line + " " + w).trim().length > 14) { lines.push(line.trim()); line = w; } else line += " " + w; }
    lines.push(line.trim());
    let size = Math.min(80, 360 / lines.length);
    const fontFor = (px) => `${px}px "Comic Sans MS", "Comic Neue", "Segoe Print", sans-serif`;
    f.font = fontFor(size);
    const widest = Math.max(...lines.map((l) => f.measureText(l).width));
    if (widest > 540) size = Math.floor((size * 540) / widest);
    f.font = fontFor(size);
    f.lineWidth = Math.max(6, size / 7);
    f.textAlign = "center"; f.textBaseline = "middle";
    lines.forEach((l, i) => f.strokeText(l, W / 2 + (i % 2 ? 8 : -8), H / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
    ctx.filter = "blur(1px)"; ctx.drawImage(fog, 0, 0); ctx.filter = "none";
    return canvas.toDataURL("image/jpeg", 0.85);
  }, c.input);
  writeFileSync(new URL(`./images/${c.id}.jpg`, import.meta.url), Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("wrote", c.id);
}
await browser.close();
