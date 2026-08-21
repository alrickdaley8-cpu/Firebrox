import { evaluate } from './calculator.js';
import { webSearch, fetchPage } from './web.js';
import { listFiles, readFile, writeFile } from './files.js';
import { runCode } from './run_code.js';
import { remember, recall } from './memory.js';

/**
 * Tool definitions (unified JSON Schema) + dispatcher.
 * Adding a tool = add its definition + a handler here.
 */
export const TOOLS = [
  {
    name: 'web_search',
    description: 'Search the web and return a list of results with titles, URLs, and snippets. Use for current events, facts, and anything requiring up-to-date information.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The search query.' } },
      required: ['query'],
    },
  },
  {
    name: 'fetch_page',
    description: 'Fetch the text content of a web page given its URL. Returns the page title and extracted text (truncated). Use to read the full content behind a search result.',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string', description: 'Full URL starting with http(s)://' } },
      required: ['url'],
    },
  },
  {
    name: 'calculator',
    description: 'Safely evaluate a mathematical expression (supports + - * / ^ %, parentheses, and functions sqrt, sin, cos, tan, log, ln, exp, abs, floor, ceil, round; constants pi, e).',
    parameters: {
      type: 'object',
      properties: { expression: { type: 'string', description: 'The math expression to evaluate, e.g. "(128 + 512) * 3" or "sqrt(144)"' } },
      required: ['expression'],
    },
  },
  {
    name: 'list_files',
    description: 'List files and directories in the agent workspace.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file in the agent workspace.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Path relative to the workspace, e.g. "notes.txt"' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write (create or overwrite) a file in the agent workspace.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the workspace, e.g. "poem.txt"' },
        content: { type: 'string', description: 'The full file content.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'run_code',
    description: 'Run Python, JavaScript, or bash code in a sandboxed subprocess (15s timeout) and return stdout/stderr. Provide code without markdown fences.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The source code to run.' },
        language: { type: 'string', description: 'One of: python, javascript, bash (default: auto-detect).' },
      },
      required: ['code'],
    },
  },
  {
    name: 'remember',
    description: 'Persistently save a note to long-term memory (survives across chats).',
    parameters: {
      type: 'object',
      properties: { note: { type: 'string', description: 'The note to remember.' } },
      required: ['note'],
    },
  },
  {
    name: 'recall',
    description: 'Recall saved notes from long-term memory.',
    parameters: { type: 'object', properties: {} },
  },
];

const HANDLERS = {
  web_search: (args) => webSearch(args.query),
  fetch_page: (args) => fetchPage(args.url),
  calculator: (args) => ({ expression: args.expression, result: evaluate(args.expression) }),
  list_files: () => listFiles(),
  read_file: (args) => readFile(args.path),
  write_file: (args) => writeFile(args.path, args.content),
  run_code: (args) => runCode(args.code, args.language),
  remember: (args) => remember(args.note),
  recall: () => recall(),
};

export function toolNames() {
  return new Set(TOOLS.map((t) => t.name));
}

export async function executeTool(name, args) {
  const handler = HANDLERS[name];
  if (!handler) throw new Error(`Unknown tool "${name}"`);
  const started = Date.now();
  try {
    const result = await handler(args || {});
    return { ok: true, name, args: args || {}, result, ms: Date.now() - started };
  } catch (err) {
    return { ok: false, name, args: args || {}, error: String(err.message || err), ms: Date.now() - started };
  }
}

export function toolResultAsText(result) {
  if (!result.ok) return `Error: ${result.error}`;
  return JSON.stringify(result.result);
}
