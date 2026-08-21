import { sseLines, httpError, toolsToOpenAI } from './index.js';

/** OpenAI / Groq / Ollama / any OpenAI-compatible Chat Completions endpoint. */
export async function runOpenAICompatible({ messages, tools, settings, signal }, cb) {
  const baseURL = (settings.baseURL || '').replace(/\/+$/, '');
  const url = `${baseURL}/chat/completions`;

  const body = {
    model: settings.model,
    messages,
    temperature: settings.temperature ?? 0.7,
    stream: true,
  };
  if (tools.length) {
    body.tools = toolsToOpenAI(tools);
    body.tool_choice = 'auto';
  }

  const headers = { 'Content-Type': 'application/json' };
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error(`Could not reach ${url} — ${err.message}. Check your base URL / network.`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI-compatible API error ${res.status}: ${text.slice(0, 500)}`);
  }

  let content = '';
  const toolCalls = new Map(); // index -> {id, name, arguments}
  const order = [];

  for await (const line of sseLines(res)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (data === '[DONE]') break;
    let json;
    try {
      json = JSON.parse(data);
    } catch {
      continue;
    }
    const delta = json.choices?.[0]?.delta;
    if (!delta) continue;

    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content;
      cb.onText(delta.content);
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        if (!toolCalls.has(idx)) {
          const entry = {
            id: tc.id || `call_${idx}_${Date.now()}`,
            name: '',
            arguments: '',
          };
          toolCalls.set(idx, entry);
          order.push(idx);
        }
        const entry = toolCalls.get(idx);
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) {
          entry.name = (entry.name || '') + tc.function.name;
        }
        if (tc.function?.arguments) {
          entry.arguments += tc.function.arguments;
          cb.onToolDelta(entry.id, tc.function.arguments);
        }
      }
    }
  }

  // Emit completed tool calls.
  const toolCallList = [];
  for (const idx of order) {
    const entry = toolCalls.get(idx);
    let args = {};
    try {
      args = entry.arguments ? JSON.parse(entry.arguments) : {};
    } catch {
      args = { _raw: entry.arguments };
    }
    toolCallList.push({ id: entry.id, name: entry.name, arguments: args });
    cb.onToolEnd({ id: entry.id, name: entry.name, args });
  }

  return { content, toolCalls: toolCallList };
}
