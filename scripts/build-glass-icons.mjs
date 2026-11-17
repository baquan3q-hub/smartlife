// Exports the Glass 3D icons used by the app into public/icons/glass/.
//   - reads the slugs listed in src/components/icons/glassIcons.ts
//   - writes <slug>.webp (512px) and <slug>-sm.webp (128px) for each
// Source: Glass_3D_Icons/WebP_512 (kept out of git, see .gitignore).
// Run: node scripts/build-glass-icons.mjs
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'Glass_3D_Icons', 'WebP_512');
const OUT = join(ROOT, 'public', 'icons', 'glass');
const REGISTRY = join(ROOT, 'src', 'components', 'icons', 'glassIcons.ts');

if (!existsSync(SRC)) {
    console.error(`Missing ${SRC}. Put the Glass_3D_Icons folder in the project root first.`);
    process.exit(1);
}

const slugs = [...new Set([...readFileSync(REGISTRY, 'utf8').matchAll(/'(\d{3}-[a-z-]+)'/g)].map((m) => m[1]))];

// slug -> source file, across the category subfolders
const sources = new Map();
for (const dir of readdirSync(SRC)) {
    const sub = join(SRC, dir);
    if (!statSync(sub).isDirectory()) continue;
    for (const f of readdirSync(sub)) if (f.endsWith('.webp')) sources.set(f.replace(/\.webp$/, ''), join(sub, f));
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let bytes = 0;
for (const slug of slugs) {
    const file = sources.get(slug);
    if (!file) {
        console.error(`No source for ${slug}`);
        process.exit(1);
    }
    for (const [suffix, size, quality] of [['', 512, 82], ['-sm', 128, 85]]) {
        const out = join(OUT, `${slug}${suffix}.webp`);
        const info = await sharp(file)
            .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality, alphaQuality: 90, effort: 6 })
            .toFile(out);
        bytes += info.size;
    }
}

console.log(`${slugs.length} icons -> ${OUT} (${(bytes / 1024).toFixed(0)} KB)`);
