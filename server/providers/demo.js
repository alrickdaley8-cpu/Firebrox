/**
 * "Demo brain" — a fully offline, deterministic fallback that keeps Firebrox
 * usable with zero API keys. It routes requests to the real tools (web search,
 * files, code, calculator, memory) using lightweight heuristics and otherwise
 * answers with a small built-in playbook. Swap in any real provider from the
 * Settings panel for full model reasoning.
 */

import { evaluate } from '../tools/calculator.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function streamText(text, cb) {
  const words = text.split(/(\s+)/);
  for (const w of words) {
    cb.onText(w);
    await sleep(8);
  }
}

function looksLikeMath(q) {
  const s = String(q).trim();
  if (!s || s.length > 200) return false;
  // Must be "mathy": contain an operator/parentheses, or named functions.
  if (!/[+\-*/^%()]/.test(s) && !/[a-z_]+/.test(s)) return false;
  try {
    evaluate(s);
    return true;
  } catch {
    return false;
  }
}

function extractSearchQuery(q) {
  let s = String(q).trim();
  s = s.replace(/^(please\s+)?(search\s+(the\s+web\s+)?|web\s+search\s+|find\s+|look\s+up\s+|google\s+)/i, '');
  s = s.replace(/^(for\s+|about\s+|on\s+|:)/i, '');
  s = s.replace(/[?!.]+$/, '').trim();
  return s;
}

function isFactualQuestion(q) {
  return /^(what|who|when|where|why|how|is|are|does|do|can|could|should|which|tell me about|explain|compare)\b/i.test(q.trim())
    || /\b(latest|news|today|current|recent|price|weather|score|population|capital)\b/i.test(q);
}

function extractCode(q) {
  const fence = q.match(/```(?:python|py|javascript|js|bash|sh)?\s*([\s\S]*?)```/);
  if (fence) return { lang: fence[1], code: fence[1] };
  const m = q.match(/(?:run|execute)\s+(?:code\s*)?:?\s*([\s\S]*)/i);
  if (m && m[1].trim()) return { code: m[1].trim() };
  return null;
}

function extractFilename(q, keyword) {
  const m = q.match(new RegExp(`${keyword}\\s+["']?([\\w./-]+)["']?`, 'i'));
  return m ? m[1] : 'notes.txt';
}

function summarize(result, name) {
  if (name === 'web_search') {
    const res = result?.results || [];
    if (!res.length) return result?.note || 'No results found.';
    const lines = res.slice(0, 5).map((r, i) => `${i + 1}. **${r.title || 'Result'}**\n   ${r.snippet || ''}\n   ${r.url || ''}`);
    return `Here's what I found:\n\n${lines.join('\n\n')}`;
  }
  if (name === 'calculator') {
    return `The result is **${result?.result}**.`;
  }
  if (name === 'list_files') {
    const files = result?.files || [];
    if (!files.length) return 'The workspace is currently empty.';
    return `Here are the files in the workspace:\n\n${files.map((f) => `• ${f.name}${f.type === 'dir' ? '/' : ` (${f.size ?? 0} bytes)`}`).join('\n')}`;
  }
  if (name === 'read_file') {
    return `**${result?.path}**\n\n${result?.content?.slice(0, 3000) ?? '(empty file)'}`;
  }
  if (name === 'write_file') {
    return `Wrote **${result?.path}** (${result?.bytes ?? 0} bytes). ✅`;
  }
  if (name === 'run_code') {
    const out = (result?.stdout || '').trim();
    const err = (result?.stderr || '').trim();
    const status = result?.exitCode === 0 ? 'exited 0' : `exited ${result?.exitCode}${result?.killed ? ' (timed out)' : ''}`;
    let s = `The program ${status}.`;
    if (out) s += `\n\nOutput:\n\`\`\`\n${out.slice(0, 3000)}\n\`\`\``;
    if (err) s += `\n\nErrors:\n\`\`\`\n${err.slice(0, 2000)}\n\`\`\``;
    return s;
  }
  if (name === 'remember') {
    return `Got it — I've saved: "${result?.remembered}". I'll be able to recall this in any future chat.`;
  }
  if (name === 'recall') {
    const notes = result?.notes || [];
    if (!notes.length) return result?.message || 'I have nothing saved in memory yet.';
    return `Here's what I remember:\n\n${notes.map((n) => `• ${n.note}`).join('\n')}`;
  }
  if (name === 'fetch_page') {
    return `**${result?.title || result?.url}**\n\n${(result?.text || '').slice(0, 2500)}`;
  }
  return JSON.stringify(result);
}

export async function runDemo({ messages, tools, settings, signal }, cb) {
  const available = new Set(tools.map((t) => t.name));
  const user = [...messages].reverse().find((m) => m.role === 'user');
  const q = (user?.content || '').trim();

  const call = (name, args) => ({ name, arguments: args, id: `demo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` });

  // ---- 0. Tool result just arrived -> summarize it as the final answer -------
  const lastTool = [...messages].reverse().find((m) => m.role === 'tool');
  if (lastTool) {
    let result;
    try {
      result = JSON.parse(lastTool.content || '{}');
    } catch {
      result = lastTool.content;
    }
    const reply = summarize(result, lastTool.name);
    await streamText(reply, cb);
    return { content: reply, toolCalls: [] };
  }

  // ---- 1. Code execution ----------------------------------------------------
  const code = extractCode(q);
  if (code && available.has('run_code')) {
    await streamText('Let me run that code for you.', cb);
    const tc = call('run_code', { code: code.code, language: code.lang || 'auto' });
    cb.onToolStart({ id: tc.id, name: tc.name });
    cb.onToolEnd({ id: tc.id, name: tc.name, args: tc.arguments });
    return { content: '', toolCalls: [tc] };
  }

  // ---- 2. File operations ----------------------------------------------------
  if (/list\s+(files|directory|dir)/i.test(q) && available.has('list_files')) {
    await streamText('Listing the files in the agent workspace.', cb);
    const tc = call('list_files', {});
    cb.onToolStart({ id: tc.id, name: tc.name });
    cb.onToolEnd({ id: tc.id, name: tc.name, args: tc.arguments });
    return { content: '', toolCalls: [tc] };
  }
  if (/\bread\b/i.test(q) && available.has('read_file')) {
    await streamText('Reading that file for you.', cb);
    const tc = call('read_file', { path: extractFilename(q, 'read') });
    cb.onToolStart({ id: tc.id, name: tc.name });
    cb.onToolEnd({ id: tc.id, name: tc.name, args: tc.arguments });
    return { content: '', toolCalls: [tc] };
  }
  if (/(\bwrite\b|\bcreate\b|\bsave\b)/i.test(q) && /file/i.test(q) && available.has('write_file')) {
    await streamText('Writing that to a file.', cb);
    const path = extractFilename(q, 'file');
    const contentMatch = q.match(/\bwith\b\s+(.+)$/i) || q.match(/\bcontaining\b\s+(.+)$/i);
    const content = contentMatch ? contentMatch[1] : q;
    const tc = call('write_file', { path, content });
    cb.onToolStart({ id: tc.id, name: tc.name });
    cb.onToolEnd({ id: tc.id, name: tc.name, args: tc.arguments });
    return { content: '', toolCalls: [tc] };
  }

  // ---- 3. Math ----------------------------------------------------------------
  const mathExpr = q.replace(/^(please\s+)?(calculate|compute|evaluate|solve|what\s+is|what's|how\s+much\s+is)\s+/i, '').trim();
  if (looksLikeMath(mathExpr) && available.has('calculator')) {
    await streamText('I can calculate that.', cb);
    const tc = call('calculator', { expression: mathExpr.replace(/\s+/g, '') });
    cb.onToolStart({ id: tc.id, name: tc.name });
    cb.onToolEnd({ id: tc.id, name: tc.name, args: tc.arguments });
    return { content: '', toolCalls: [tc] };
  }

  // ---- 4. Web search / factual questions --------------------------------------
  const searchIntent = /\b(search|find|look\s+up|google)\b/i.test(q);
  const selfRef = /(who are you|what are you|what can you do|help|capabilities|commands|your name|about you)/i.test(q);
  if ((searchIntent || isFactualQuestion(q)) && !selfRef && available.has('web_search')) {
    const query = extractSearchQuery(q) || q;
    await streamText(`Searching the web for "${query}"…`, cb);
    const tc = call('web_search', { query });
    cb.onToolStart({ id: tc.id, name: tc.name });
    cb.onToolEnd({ id: tc.id, name: tc.name, args: tc.arguments });
    return { content: '', toolCalls: [tc] };
  }

  // ---- 5. Memory ----------------------------------------------------------------
  if (/\bremember\b/i.test(q) && available.has('remember')) {
    await streamText('Committing that to memory.', cb);
    const m = q.replace(/^please\s+remember\s+/i, '').replace(/^remember\s+/i, '');
    const tc = call('remember', { note: m || q });
    cb.onToolStart({ id: tc.id, name: tc.name });
    cb.onToolEnd({ id: tc.id, name: tc.name, args: tc.arguments });
    return { content: '', toolCalls: [tc] };
  }
  if (/\b(recall|what do you remember|memories)\b/i.test(q) && available.has('recall')) {
    await streamText('Recalling my notes.', cb);
    const tc = call('recall', {});
    cb.onToolStart({ id: tc.id, name: tc.name });
    cb.onToolEnd({ id: tc.id, name: tc.name, args: tc.arguments });
    return { content: '', toolCalls: [tc] };
  }

  // ---- 6. Built-in playbook ----------------------------------------------------
  const lower = q.toLowerCase();
  let reply;
  if (/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))\b/.test(lower)) {
    reply = "Hey! I'm Firebrox — your AI agent. I'm currently running on the built-in demo brain because no model API key is configured yet.\n\nEven in demo mode I can do real work: search the web, run code, read and write files, do math, and remember things. Try asking me to \"search the web for the latest AI news\" or \"calculate (128 + 512) * 3\".\n\nTo unlock full reasoning, open Settings (the gear icon) and plug in any provider — OpenAI, Anthropic, Gemini, Groq, or a local model via Ollama.";
  } else if (/(who are you|what are you|your name|about you)/.test(lower)) {
    reply = "I'm Firebrox, a provider-agnostic multi-tool AI agent. I run an agent loop that can call tools — web search, page fetching, a calculator, file I/O, sandboxed code execution, and persistent memory — and I stream everything back to you live.\n\nRight now I'm running on the offline demo brain. Add an API key for OpenAI, Anthropic, Gemini, or Groq (or point me at a local Ollama server) in Settings and I'll reason with a real model instead.";
  } else if (/(what can you do|help|capabilities|commands)/.test(lower)) {
    reply = "Here's what I can do:\n\n• Search the web and summarize results (with sources)\n• Fetch and read any web page\n• Run Python / JavaScript code in a sandbox\n• Read, write, and list files in my workspace\n• Evaluate math expressions\n• Remember and recall notes across your chats\n\nTry prompts like \"search for the best laptops 2026\", \"run code: print(2**20)\", \"write a file poem.txt with a haiku\", or \"remember my favorite color is blue\".";
  } else if (/(time|date)/.test(lower) && !/\b(time out|timeout)\b/.test(lower)) {
    reply = `The current time is ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' })} (your local timezone).`;
  } else {
    reply = `I'm running on the offline demo brain, which can't reason broadly about that — but it can still do real work. For open-ended questions like this one, I'd search the web. Want me to?\n\nJust say "search the web for ${q.length > 80 ? q.slice(0, 80) + '…' : q}" — or, for the full experience, add a model API key in Settings (OpenAI, Anthropic, Gemini, Groq, or Ollama).`;
  }

  await streamText(reply, cb);
  return { content: reply, toolCalls: [] };
}
