// build.mjs
// esbuild script to bundle the CTIP extension TypeScript into Chrome-loadable JS.
// Usage: node build.mjs         (one-shot build)
//        node build.mjs --watch (rebuild on file changes)

import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const isWatch = process.argv.includes('--watch');

// ── Common esbuild options ───────────────────────────────────
const commonOptions = {
  bundle: true,
  minify: false,      // keep readable for debugging during dev
  sourcemap: false,
  target: ['chrome100'],
  format: 'esm',
  logLevel: 'info',
};

// ── Build entries ────────────────────────────────────────────
const entries = [
  {
    entryPoints: ['background/background.ts'],
    outfile: 'dist/background/background.js',
    // Service workers need iife format, not esm
    format: 'iife',
  },
  {
    entryPoints: ['content/content.ts'],
    outfile: 'dist/content/content.js',
    format: 'iife',
  },
  {
    entryPoints: ['popup/popup.ts'],
    outfile: 'dist/popup/popup.js',
    format: 'iife',
  },
];

// ── Copy static files to dist ────────────────────────────────
function copyStatic() {
  const staticFiles = [
    ['manifest.json', 'dist/manifest.json'],
    ['popup/index.html', 'dist/popup/index.html'],
    ['popup/popup.css', 'dist/popup/popup.css'],
    ['content/content-inject.css', 'dist/content/content-inject.css'],
  ];

  // Ensure directories exist
  ['dist', 'dist/popup', 'dist/content', 'dist/background', 'dist/assets'].forEach((dir) => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  });

  staticFiles.forEach(([src, dest]) => {
    if (existsSync(src)) {
      copyFileSync(src, dest);
      console.log(`  copied ${src} → ${dest}`);
    }
  });

  // Copy assets (icons)
  if (existsSync('assets')) {
    readdirSync('assets').forEach((file) => {
      copyFileSync(join('assets', file), join('dist/assets', file));
      console.log(`  copied assets/${file} → dist/assets/${file}`);
    });
  }
}

// ── Fix manifest paths (background service worker format) ────
// The manifest references background/background.js which is correct for dist/

// ── Build ────────────────────────────────────────────────────
async function build() {
  console.log('\n🔨 Building CTIP Extension...\n');

  for (const entry of entries) {
    await esbuild.build({
      ...commonOptions,
      ...entry,
      format: entry.format || 'iife',
    });
  }

  copyStatic();
  console.log('\n✅ Build complete! Load dist/ folder in chrome://extensions\n');
}

if (isWatch) {
  // Watch mode: rebuild on changes
  console.log('👀 Watching for changes...\n');

  for (const entry of entries) {
    const ctx = await esbuild.context({
      ...commonOptions,
      ...entry,
      format: entry.format || 'iife',
    });
    await ctx.watch();
  }

  // Initial copy of static files
  copyStatic();

  // Note: static files won't auto-copy on change in watch mode.
  // Re-run `node build.mjs` after changing HTML/CSS/manifest.
  console.log('\n⚡ Watching TS files. Re-run build for HTML/CSS/manifest changes.\n');
} else {
  build().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
