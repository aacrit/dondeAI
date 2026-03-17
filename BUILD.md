# DondeAI Frontend Build

## Quick Start

```bash
npm install          # one-time: install esbuild
npm run build        # production build → dist/
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Production build: bundles JS + CSS with content hashes into `dist/` |
| `npm run dev` | Serve original source files on http://localhost:3000 (no build needed) |
| `npm run preview` | Build, then serve `dist/` on http://localhost:3000 |

## How It Works

The build script (`build.mjs`) does the following:

1. **JS bundling** — esbuild bundles `js/app.js` and all its ES module imports into a single minified file: `dist/app.[hash].js`. The `motion` package (from CDN via importmap) is kept external.

2. **CSS bundling** — All 19 CSS files are concatenated in load-order and minified into `dist/app.[hash].css`. Font URL paths are rewritten for the flat dist structure.

3. **Cache busting** — Both bundles include a content hash in the filename. When files change, the hash changes, so browsers always fetch the latest version.

4. **HTML generation** — `dist/index.html` is generated from the source `index.html` with individual `<link>` and `<script>` tags replaced by the hashed bundle references. The importmap for Motion One is preserved.

5. **Service worker** — `dist/sw.js` is generated with updated precache URLs pointing to the bundled files.

6. **Static assets** — Fonts, images, manifest.json, data files, and admin HTML pages are copied to `dist/`.

## Development

No build step is required for local development. The app works directly from the source files:

```bash
npm run dev
# or just open index.html in a browser
```

The original `index.html` loads individual CSS and JS files via standard `<link>` and `<script type="module">` tags. ES modules resolve natively in modern browsers.

## Production Deployment

Deploy the `dist/` directory as static files. The build output is self-contained.

## Architecture Notes

- **Build tool**: esbuild only (no webpack, vite, or rollup)
- **Module format**: ES modules (preserved in bundle)
- **External dependency**: Motion One loaded via importmap from `cdn.jsdelivr.net`
- **Source maps**: Generated alongside the JS bundle (`app.[hash].js.map`)
- **Zero modification**: No existing JS or CSS files are changed by the build
