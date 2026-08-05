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

import { readFileSync, writeFileSync } from 'fs';

// ── Copy static files to dist and dist-firefox ───────────────
function copyStatic() {
  const staticFiles = [
    ['popup/index.html', 'popup/index.html'],
    ['popup/popup.css', 'popup/popup.css'],
    ['content/content-inject.css', 'content/content-inject.css'],
  ];

  // Ensure directories exist for both Chrome (dist) and Firefox (dist-firefox)
  ['dist', 'dist/popup', 'dist/content', 'dist/background', 'dist/assets',
   'dist-firefox', 'dist-firefox/popup', 'dist-firefox/content', 'dist-firefox/background', 'dist-firefox/assets'
  ].forEach((dir) => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  });

  // Copy Chrome manifest
  if (existsSync('manifest.json')) {
    copyFileSync('manifest.json', 'dist/manifest.json');
    console.log(`  copied manifest.json → dist/manifest.json (Chrome)`);

    // Create Firefox-compatible manifest for dist-firefox
    const rawManifest = JSON.parse(readFileSync('manifest.json', 'utf-8'));
    const firefoxManifest = {
      ...rawManifest,
      background: {
        scripts: ['background/background.js']
      },
      browser_specific_settings: {
        gecko: {
          id: "ctip-extension@campus-threat-intelligence.org",
          strict_min_version: "109.0"
        }
      }
    };
    writeFileSync('dist-firefox/manifest.json', JSON.stringify(firefoxManifest, null, 2));
    console.log(`  generated dist-firefox/manifest.json (Firefox)`);
  }

  staticFiles.forEach(([src, relativeDest]) => {
    if (existsSync(src)) {
      copyFileSync(src, `dist/${relativeDest}`);
      copyFileSync(src, `dist-firefox/${relativeDest}`);
      console.log(`  copied ${src} → dist & dist-firefox`);
    }
  });

  // Copy assets (icons) to both
  if (existsSync('assets')) {
    readdirSync('assets').forEach((file) => {
      copyFileSync(join('assets', file), join('dist/assets', file));
      copyFileSync(join('assets', file), join('dist-firefox/assets', file));
      console.log(`  copied assets/${file} → dist/assets & dist-firefox/assets`);
    });
  }

  // Copy compiled JS files to dist-firefox too
  ['background/background.js', 'content/content.js', 'popup/popup.js'].forEach((jsFile) => {
    if (existsSync(`dist/${jsFile}`)) {
      copyFileSync(`dist/${jsFile}`, `dist-firefox/${jsFile}`);
    }
  });
}

// ── Build ────────────────────────────────────────────────────
async function build() {
  console.log('\n🔨 Building CTIP Extension (Chrome & Firefox)...\n');

  for (const entry of entries) {
    await esbuild.build({
      ...commonOptions,
      ...entry,
      format: entry.format || 'iife',
    });
  }

  copyStatic();
  console.log('\n✅ Build complete!');
  console.log('👉 Chrome: Load "extension/dist" in chrome://extensions');
  console.log('👉 Firefox: Load "extension/dist-firefox/manifest.json" in about:debugging\n');
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
