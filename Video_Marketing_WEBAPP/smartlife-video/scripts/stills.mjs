// Renders preview stills of the main composition: node scripts/stills.mjs <outDir> <frame> [frame...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [outDir, ...frames] = process.argv.slice(2);
if (!outDir || frames.length === 0) {
  console.error("usage: node scripts/stills.mjs <outDir> <frame> [frame...]");
  process.exit(1);
}

const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "SmartLifeLaunch" });
for (const f of frames.map(Number)) {
  const output = path.join(outDir, `f${String(f).padStart(5, "0")}.jpg`);
  await renderStill({ serveUrl, composition, frame: f, output, imageFormat: "jpeg", jpegQuality: 80, scale: 0.5 });
  console.log("rendered", output);
}
