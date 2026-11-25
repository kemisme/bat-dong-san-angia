import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PUB_IMG_DIR = path.join(ROOT, 'public', 'images');
const RAW_DIR = path.join(ROOT, 'assets-raw');
const VALID_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const GENERATED_SUFFIX_RE = /-(640|800|1200)\.(avif|webp|jpg)$/i;

async function collectRawSources() {
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(PUB_IMG_DIR, { recursive: true });

  // Also pick up any newly dropped raw images placed directly inside public/images/
  const pubFiles = await fs.readdir(PUB_IMG_DIR);
  for (const file of pubFiles) {
    const ext = path.extname(file).toLowerCase();
    if (!VALID_EXTS.has(ext) || GENERATED_SUFFIX_RE.test(file)) continue;
    const fromPath = path.join(PUB_IMG_DIR, file);
    const toPath = path.join(RAW_DIR, file);
    await fs.copyFile(fromPath, toPath);
    await fs.unlink(fromPath);
  }

  const rawFiles = await fs.readdir(RAW_DIR);
  return rawFiles
    .filter((file) => VALID_EXTS.has(path.extname(file).toLowerCase()))
    .map((file) => ({
      slug: path.basename(file, path.extname(file)),
      rawPath: path.join(RAW_DIR, file),
    }));
}

async function run() {
  const sources = await collectRawSources();
  if (!sources.length) {
    console.log('No source images found in assets-raw/ or public/images/.');
    return;
  }

  for (const { slug, rawPath } of sources) {
    const pipeline = sharp(rawPath).rotate();

    const tasks = [
      pipeline
        .clone()
        .resize({ width: 640, withoutEnlargement: true })
        .avif({ quality: 45, effort: 5 })
        .toFile(path.join(PUB_IMG_DIR, `${slug}-640.avif`)),
      pipeline
        .clone()
        .resize({ width: 800, withoutEnlargement: true })
        .avif({ quality: 45, effort: 5 })
        .toFile(path.join(PUB_IMG_DIR, `${slug}-800.avif`)),
      pipeline
        .clone()
        .resize({ width: 1200, withoutEnlargement: true })
        .avif({ quality: 48, effort: 5 })
        .toFile(path.join(PUB_IMG_DIR, `${slug}-1200.avif`)),
      pipeline
        .clone()
        .resize({ width: 640, withoutEnlargement: true })
        .webp({ quality: 70 })
        .toFile(path.join(PUB_IMG_DIR, `${slug}-640.webp`)),
      pipeline
        .clone()
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 72 })
        .toFile(path.join(PUB_IMG_DIR, `${slug}-800.webp`)),
      pipeline
        .clone()
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 74 })
        .toFile(path.join(PUB_IMG_DIR, `${slug}-1200.webp`)),
      pipeline
        .clone()
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 74, mozjpeg: true })
        .toFile(path.join(PUB_IMG_DIR, `${slug}-800.jpg`)),
    ];

    if (slug.startsWith('hero-')) {
      tasks.push(
        pipeline
          .clone()
          .resize({ width: 1200, withoutEnlargement: true })
          .jpeg({ quality: 78, mozjpeg: true })
          .toFile(path.join(PUB_IMG_DIR, `${slug}-1200.jpg`)),
      );
    }

    await Promise.all(tasks);
    console.log(`Optimized: ${slug}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
