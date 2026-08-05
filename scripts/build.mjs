// Build the single-file, GitHub-Pages-ready index.html from the modular sources.
//
//   dev.html + css/style.css + js/{config,engine,ai,render,audio,main}.js
//     → index.html   (one file, zero external references, plain <script>)
//
// Usage:
//   node scripts/build.mjs           write index.html
//   node scripts/build.mjs --check   fail if the committed index.html is stale
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFile(join(ROOT, p), 'utf8');

// dependency order: config must come first, main last
const MODULE_ORDER = ['config', 'engine', 'ai', 'render', 'audio', 'main'];

async function bundle() {
  const css = await read('css/style.css');
  let js = '';
  for (const name of MODULE_ORDER) {
    let src = await read(`js/${name}.js`);
    src = src
      .replace(/^import[\s\S]*?from\s+'[^']+';\s*$/gm, '') // drop import statements
      .replace(/\bexport\s+/g, '');                        // flatten exports into one scope
    if (name === 'ai' || name === 'main') {
      src = src.replace(/\bE\./g, ''); // engine namespace → direct calls
    }
    js += `\n/* ---------------- ${name}.js ---------------- */\n${src.trim()}\n`;
  }

  let html = await read('dev.html');
  html = html.replace(
    '<link rel="stylesheet" href="css/style.css">',
    () => `<style>\n${css.trim()}\n</style>`,
  );
  html = html.replace(
    '<script type="module" src="js/main.js"></script>',
    () => `<script>${js.trim()}\n</script>`,
  );

  // sanity guards: nothing external left, everything inlined
  if (html.includes('src="js/') || html.includes('href="css/')) {
    throw new Error('external asset reference survived the build');
  }
  if (/^\s*import\s/m.test(js) || /\bexport\s/.test(js)) {
    throw new Error('module syntax survived the build');
  }
  return html;
}

const html = await bundle();

if (process.argv.includes('--check')) {
  let current = '';
  try { current = await read('index.html'); } catch { /* missing */ }
  if (current !== html) {
    console.error('❌ index.html is stale — run `npm run build`');
    process.exit(1);
  }
  console.log('✓ index.html is up to date');
} else {
  await writeFile(join(ROOT, 'index.html'), html);
  console.log(`✓ wrote index.html — ${(html.length / 1024).toFixed(1)} KB single-file game`);
}
