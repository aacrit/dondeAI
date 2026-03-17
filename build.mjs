#!/usr/bin/env node

/**
 * DondeAI — Production Build Script
 *
 * Bundles JS and CSS via esbuild, generates content-hashed filenames
 * for cache busting, and produces a self-contained dist/ directory.
 *
 * Usage:
 *   node build.mjs           # production build (minified)
 *   node build.mjs --watch   # rebuild on file changes
 *
 * The original source files remain untouched — the app still works
 * without building by opening index.html directly.
 */

import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir, cp, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');
const isWatch = process.argv.includes('--watch');

// ---------------------------------------------------------------------------
// CSS files in load-order (must match index.html <link> order)
// ---------------------------------------------------------------------------
const CSS_FILES = [
  'css/fonts.css',
  'css/reset.css',
  'css/tokens.css',
  'css/themes/neutral.css',
  'css/themes/indian.css',
  'css/themes/japanese.css',
  'css/themes/southamerican.css',
  'css/themes/middleeastern.css',
  'css/layout.css',
  'css/typography.css',
  'css/components/canvas.css',
  'css/components/result.css',
  'css/components/modals.css',
  'css/components/ui.css',
  'css/components/taste-dna.css',
  'css/components/conversational-search.css',
  'css/components/first-bite.css',
  'css/animations.css',
  'css/responsive.css',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contentHash(buf) {
  return createHash('md5').update(buf).digest('hex').slice(0, 10);
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

/** Copy a directory recursively, creating it if needed. */
async function copyDir(src, dest) {
  try {
    await stat(src);
  } catch {
    return; // source doesn't exist, skip
  }
  await cp(src, dest, { recursive: true });
}

// ---------------------------------------------------------------------------
// 1. Bundle JS with esbuild
// ---------------------------------------------------------------------------

async function bundleJS() {
  const result = await esbuild.build({
    entryPoints: [join(__dirname, 'js/app.js')],
    bundle: true,
    format: 'esm',
    minify: true,
    sourcemap: true,
    target: ['es2020'],
    outdir: DIST,
    entryNames: '[name]',  // temporary name, we rename with hash below
    write: false,
    // Motion One is loaded via importmap from CDN — keep it external
    external: ['motion'],
    // Tree-shake unused exports
    treeShaking: true,
  });

  // Find the JS output (not the .map)
  const jsOutput = result.outputFiles.find(f => f.path.endsWith('.js'));
  const mapOutput = result.outputFiles.find(f => f.path.endsWith('.js.map'));

  const hash = contentHash(jsOutput.contents);
  const jsName = `app.${hash}.js`;
  const mapName = `app.${hash}.js.map`;

  await ensureDir(DIST);

  // Fix sourceMappingURL to point to hashed map filename
  let jsText = new TextDecoder().decode(jsOutput.contents);
  jsText = jsText.replace(
    /\/\/# sourceMappingURL=app\.js\.map/,
    `//# sourceMappingURL=${mapName}`
  );
  await writeFile(join(DIST, jsName), jsText);

  if (mapOutput) {
    await writeFile(join(DIST, mapName), mapOutput.contents);
  }

  return jsName;
}

// ---------------------------------------------------------------------------
// 2. Bundle CSS (concatenate in order + minify via esbuild)
// ---------------------------------------------------------------------------

async function bundleCSS() {
  // Read all CSS files in order and concatenate
  const parts = [];
  for (const file of CSS_FILES) {
    const content = await readFile(join(__dirname, file), 'utf8');
    // Add a comment marker for debugging (stripped by minifier)
    parts.push(`/* --- ${file} --- */\n${content}`);
  }
  const combined = parts.join('\n');

  // Minify with esbuild
  const minified = await esbuild.transform(combined, {
    loader: 'css',
    minify: true,
    target: ['es2020'],
  });

  // Fix font paths: fonts.css references ../fonts/ but in dist/ fonts
  // are at ./fonts/, so url(../fonts/x) needs to become url(./fonts/x)
  let cssText = minified.code;
  cssText = cssText.replace(/url\(\s*\.\.\/fonts\//g, 'url(./fonts/');

  const hash = contentHash(Buffer.from(cssText));
  const cssName = `app.${hash}.css`;

  await ensureDir(DIST);
  await writeFile(join(DIST, cssName), cssText);

  return cssName;
}

// ---------------------------------------------------------------------------
// 3. Generate dist/index.html
// ---------------------------------------------------------------------------

async function generateHTML(jsName, cssName) {
  let html = await readFile(join(__dirname, 'index.html'), 'utf8');

  // Remove all individual CSS <link> tags (the ones in our CSS_FILES list)
  // Match: <link rel="stylesheet" href="css/...">
  html = html.replace(
    /[ \t]*<link\s+rel="stylesheet"\s+href="css\/[^"]*">\n?/g,
    ''
  );

  // Insert the bundled CSS link right before </head>
  html = html.replace(
    '</head>',
    `  <link rel="stylesheet" href="${cssName}">\n</head>`
  );

  // Replace the module script src with the hashed bundle.
  // The importmap is preserved because the bundle uses dynamic
  // import("motion") which resolves via the importmap at runtime.
  html = html.replace(
    /<script type="module" src="js\/app\.js"><\/script>/,
    `<script type="module" src="${jsName}"></script>`
  );

  await writeFile(join(DIST, 'index.html'), html);
}

// ---------------------------------------------------------------------------
// 4. Generate dist/sw.js — adapted for bundled assets
// ---------------------------------------------------------------------------

async function generateServiceWorker(jsName, cssName) {
  let sw = await readFile(join(__dirname, 'sw.js'), 'utf8');

  // Update PRECACHE_URLS to reference bundled files
  const newPrecacheUrls = [
    "'/'",
    "'/index.html'",
    `'/${cssName}'`,
    `'/${jsName}'`,
    "'/img/icons.svg'",
  ];

  sw = sw.replace(
    /const PRECACHE_URLS = \[[\s\S]*?\];/,
    `const PRECACHE_URLS = [\n  ${newPrecacheUrls.join(',\n  ')},\n];`
  );

  // Bump cache version so the new SW takes over
  sw = sw.replace(
    /const CACHE_VERSION = '[^']*';/,
    `const CACHE_VERSION = 'donde-v2-build';`
  );

  await writeFile(join(DIST, 'sw.js'), sw);
}

// ---------------------------------------------------------------------------
// 5. Copy static assets
// ---------------------------------------------------------------------------

async function copyAssets() {
  await ensureDir(DIST);

  // Fonts
  await copyDir(join(__dirname, 'fonts'), join(DIST, 'fonts'));

  // Images
  await copyDir(join(__dirname, 'img'), join(DIST, 'img'));

  // Data files (JSON used by command center etc.)
  await copyDir(join(__dirname, 'data'), join(DIST, 'data'));

  // Manifest
  try {
    await cp(join(__dirname, 'manifest.json'), join(DIST, 'manifest.json'));
  } catch { /* ok if missing */ }

  // Other HTML pages (command-center, gauntlet, etc.) — copy as-is
  // These are admin pages that don't need the build pipeline
  for (const htmlFile of ['command-center.html', 'gauntlet.html', 'arcade-ops.html', 'maintenance.html']) {
    try {
      await cp(join(__dirname, htmlFile), join(DIST, htmlFile));
    } catch { /* ok if missing */ }
  }

  // CSS files used by other HTML pages (not bundled into app.css)
  await ensureDir(join(DIST, 'css'));
  for (const extraCss of ['css/command-center.css', 'css/arcade-ops.css', 'css/components.css']) {
    try {
      await cp(join(__dirname, extraCss), join(DIST, extraCss));
    } catch { /* ok if missing */ }
  }

  // JS files used by other HTML pages (command center etc.)
  await ensureDir(join(DIST, 'js'));
  const ccFiles = ['cc-queries.js', 'cc-analytics.js', 'cc-coo.js', 'cc-config.js', 'cc-tests.js', 'cc-ui.js', 'cc-grading.js'];
  for (const ccFile of ccFiles) {
    try {
      await cp(join(__dirname, 'js', ccFile), join(DIST, 'js', ccFile));
    } catch { /* ok if missing */ }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function build() {
  const t0 = performance.now();
  console.log('[build] Starting production build...');

  // Clean dist/
  await rm(DIST, { recursive: true, force: true });
  await ensureDir(DIST);

  // Run bundling in parallel
  const [jsName, cssName] = await Promise.all([
    bundleJS(),
    bundleCSS(),
  ]);

  // Generate HTML + SW + copy assets (depends on bundle names)
  await Promise.all([
    generateHTML(jsName, cssName),
    generateServiceWorker(jsName, cssName),
    copyAssets(),
  ]);

  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  console.log(`[build] Done in ${elapsed}s`);
  console.log(`[build]   JS:  ${jsName}`);
  console.log(`[build]   CSS: ${cssName}`);
  console.log(`[build]   Output: dist/`);
}

if (isWatch) {
  console.log('[build] Watch mode — rebuilding...');
  await build();
  console.log('[build] Tip: Use `node --watch build.mjs` for auto-rebuild on file changes.');
} else {
  await build();
}
