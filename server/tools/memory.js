import fs from 'node:fs';
import path from 'node:path';
import { STATE_DIR } from '../config.js';

const MEMORY_PATH = path.join(STATE_DIR, 'memory.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function save(notes) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(notes, null, 2));
}

export function remember(note) {
  const text = String(note || '').trim();
  if (!text) throw new Error('Nothing to remember — note was empty.');
  const notes = load();
  notes.push({ id: `n${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, note: text, at: new Date().toISOString() });
  save(notes.slice(-200)); // keep last 200 notes
  return { remembered: text, total: notes.length };
}

export function recall() {
  const notes = load();
  if (!notes.length) return { notes: [], message: 'I have nothing saved in memory yet.' };
  return { notes: notes.slice(-50).reverse(), total: notes.length };
}
