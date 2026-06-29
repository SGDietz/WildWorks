// One-off: ingest the McNulty "PutInThese-InNumericOrder" photos into the
// wildfire gallery as 53.jpg..N.jpg (after keeping existing 01-52), matching
// the existing optimization (2000px long edge, JPEG q82) and rebuilding manifest.json.
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

const SRC_DIR = "G:/My Drive/WW-Website-Artwork-20260603/McNulty-LatestWildFire-Pics/PutInThese-InNumericOrder";
const OUT_DIR = path.resolve("public/wildfire");
const MANIFEST = path.join(OUT_DIR, "manifest.json");
const MAX_LONG_EDGE = 2000;
const JPEG_QUALITY = 82;
const KEEP_THROUGH = 52; // keep existing gallery images 01..52

const numKey = (name) => {
  const m = name.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
};

const run = async () => {
  const manifest = JSON.parse(await fs.readFile(MANIFEST, "utf8"));
  const kept = manifest.images.filter((im) => im.index <= KEEP_THROUGH);

  const entries = (await fs.readdir(SRC_DIR))
    .filter((f) => /\.(jpe?g)$/i.test(f))
    .sort((a, b) => numKey(a) - numKey(b));

  console.log(`Source files: ${entries.length}`);

  const newImages = [];
  let index = KEEP_THROUGH; // next index = 53
  for (const file of entries) {
    index += 1;
    const srcPath = path.join(SRC_DIR, file);
    const outName = `${String(index).padStart(2, "0")}.jpg`;
    const outPath = path.join(OUT_DIR, outName);

    const input = sharp(srcPath, { failOn: "none" }).rotate();
    const meta = await input.metadata();
    const srcBytes = (await fs.stat(srcPath)).size;

    const buf = await input
      .resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    await fs.writeFile(outPath, buf.data);

    newImages.push({
      index,
      output: `public/wildfire/${outName}`,
      source: file,
      sourceBytes: srcBytes,
      outputBytes: buf.info.size,
      sourceWidth: meta.width,
      sourceHeight: meta.height,
      outputWidth: buf.info.width,
      outputHeight: buf.info.height,
    });
    console.log(`  ${file} -> ${outName} (${Math.round(buf.info.size / 1024)} KB, ${buf.info.width}x${buf.info.height})`);
  }

  const images = [...kept, ...newImages];
  const out = {
    ...manifest,
    maxLongEdge: MAX_LONG_EDGE,
    jpegQuality: JPEG_QUALITY,
    totalImages: images.length,
    images,
  };
  await fs.writeFile(MANIFEST, JSON.stringify(out, null, 2) + "\n");
  console.log(`Done. totalImages=${images.length} (kept ${kept.length}, added ${newImages.length})`);
};

run().catch((e) => { console.error(e); process.exit(1); });
