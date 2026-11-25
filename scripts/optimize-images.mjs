import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'public', 'images');
const RAW_DIR = path.join(ROOT, 'assets-raw');

const SLUGS = [
  'hero-villa',
  'penthouse-interior',
  'townhouse-facade',
  'garden-villa',
  'waterfront-tower',
];

async function run() {
  await fs.mkdir(RAW_DIR, { recursive: true });

  for (const slug of SLUGS) {
    const srcPath = path.join(SRC_DIR, `${slug}.jpg`);
    const rawBackupPath = path.join(RAW_DIR, `${slug}.jpg`);

    // Back up original file into assets-raw/ before converting and removing source
    await fs.copyFile(srcPath, rawBackupPath);

    const pipeline = sharp(rawBackupPath).rotate();

    await Promise.all([
      pipeline
        .clone()
        .resize({ width: 640, withoutEnlargement: true })
        .avif({ quality: 52, effort: 5 })
        .toFile(path.join(SRC_DIR, `${slug}-640.avif`)),
      pipeline
        .clone()
        .resize({ width: 1200, withoutEnlargement: true })
        .avif({ quality: 54, effort: 5 })
        .toFile(path.join(SRC_DIR, `${slug}-1200.avif`)),
      pipeline
        .clone()
        .resize({ width: 640, withoutEnlargement: true })
        .webp({ quality: 74 })
        .toFile(path.join(SRC_DIR, `${slug}-640.webp`)),
      pipeline
        .clone()
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 76 })
        .toFile(path.join(SRC_DIR, `${slug}-1200.webp`)),
      pipeline
        .clone()
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 76, mozjpeg: true })
        .toFile(path.join(SRC_DIR, `${slug}-800.jpg`)),
    ]);

    if (slug === 'hero-villa') {
      await pipeline
        .clone()
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(path.join(SRC_DIR, `${slug}-1200.jpg`));
    }

    await fs.unlink(srcPath);
  }

  const files = (await fs.readdir(SRC_DIR)).sort();
  for (const file of files) {
    const stat = await fs.stat(path.join(SRC_DIR, file));
    console.log(`${file}: ${(stat.size / 1024).toFixed(1)} KB`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
