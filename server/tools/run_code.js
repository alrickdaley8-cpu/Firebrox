import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WORKSPACE_DIR } from '../config.js';

const execFileP = promisify(execFile);

const RUNNERS = {
  python: (code) => ({ file: 'python3', args: ['-c', code] }),
  py: (code) => ({ file: 'python3', args: ['-c', code] }),
  python3: (code) => ({ file: 'python3', args: ['-c', code] }),
  js: (code) => ({ file: 'node', args: ['-e', code] }),
  javascript: (code) => ({ file: 'node', args: ['-e', code] }),
  node: (code) => ({ file: 'node', args: ['-e', code] }),
  bash: (code) => ({ file: 'bash', args: ['-c', code] }),
  sh: (code) => ({ file: 'sh', args: ['-c', code] }),
};

function detectLanguage(code, hint) {
  const h = String(hint || 'auto').toLowerCase();
  if (h !== 'auto' && RUNNERS[h]) return h;
  if (/^\s*(import\s+|from\s+[\w.]+\s+import|def\s+\w+\s*\(|print\(|class\s+\w+)/.test(code)) return 'python';
  if (/^\s*(const\s+|let\s+|var\s+|function\s+|console\.log|=>)/.test(code)) return 'javascript';
  return 'python';
}

export async function runCode(code, language = 'auto') {
  const src = String(code ?? '').trim();
  if (!src) throw new Error('No code provided.');
  if (src.length > 200000) throw new Error('Code too long (max 200 KB).');

  const lang = detectLanguage(src, language);
  const runner = RUNNERS[lang];
  if (!runner) throw new Error(`Unsupported language "${lang}". Use python, javascript, or bash.`);
  const { file, args } = runner(src);

  try {
    const { stdout, stderr } = await execFileP(file, args, {
      cwd: WORKSPACE_DIR,
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });
    return { language: lang, stdout: stdout.slice(0, 20000), stderr: stderr.slice(0, 20000), exitCode: 0 };
  } catch (err) {
    return {
      language: lang,
      stdout: (err.stdout || '').slice(0, 20000),
      stderr: (err.stderr || String(err.message || err)).slice(0, 20000),
      exitCode: err.code ?? 1,
      killed: err.killed || err.signal === 'SIGTERM',
    };
  }
}
