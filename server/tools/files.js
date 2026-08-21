import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE_DIR } from '../config.js';

function resolveSafe(p) {
  const rel = String(p || '').replace(/^\.\.[/\\]+/, '');
  const abs = path.resolve(WORKSPACE_DIR, rel);
  if (abs !== WORKSPACE_DIR && !abs.startsWith(WORKSPACE_DIR + path.sep)) {
    throw new Error(`Path "${p}" escapes the workspace and is not allowed.`);
  }
  return abs;
}

export function listFiles() {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  const walk = (dir, depth = 0) => {
    const entries = [];
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        entries.push({ name: name + '/', type: 'dir', size: null });
        if (depth < 3) entries.push(...walk(full, depth + 1).map((e) => ({ ...e, name: path.join(name, e.name) })));
      } else {
        entries.push({ name, type: 'file', size: stat.size });
      }
    }
    return entries;
  };
  const files = walk(WORKSPACE_DIR).sort((a, b) => a.name.localeCompare(b.name));
  return { workspace: WORKSPACE_DIR, files };
}

export function readFile(p) {
  const abs = resolveSafe(p);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${p}`);
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) throw new Error(`${p} is a directory, not a file.`);
  if (stat.size > 1024 * 1024) throw new Error('File is larger than 1 MB — refusing to read it fully.');
  const content = fs.readFileSync(abs, 'utf8');
  return { path: p, content };
}

export function writeFile(p, content) {
  const abs = resolveSafe(p);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const data = String(content ?? '');
  if (data.length > 1024 * 1024) throw new Error('Content is larger than 1 MB — refusing to write.');
  fs.writeFileSync(abs, data, 'utf8');
  return { path: p, bytes: Buffer.byteLength(data), wrote: true };
}
