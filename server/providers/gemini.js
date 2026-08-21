import { sseLines, httpError, toolsToGemini } from './index.js';

/** Convert OpenAI-style messages -> Gemini contents. */
function toGemini(messages) {
  const contents = [];
  let systemInstruction = null;

  for (const m of messages) {
    if (m.role === 'system') {
      systemInstruction = { parts: [{ text: m.content }] };
      continue;
    }
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: m.content || '' }] });
      continue;
    }
    if (m.role === 'assistant') {
      const parts = [];
      if (m.content) parts.push({ text: m.content });
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          let args = {};
          try {
            args = typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments || '{}')
              : tc.function.arguments || {};
          } catch {
            args = {};
          }
          parts.push({ functionCall: { name: tc.function.name, args } });
        }
      }
      contents.push({ role: 'model', parts: parts.length ? parts : [{ text: '' }] });
      continue;
    }
    if (m.role === 'tool') {
      let response = {};
      try {
        response = JSON.parse(m.content || '{}');
      } catch {
        response = { result: m.content };
      }
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: m.tool_name || m.name, response } }],
      });
    }
  }
  return { contents, systemInstruction };
}

export async function runGemini({ messages, tools, settings, signal }, cb) {
  const baseURL = (settings.baseURL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
  const url = `${baseURL}/models/${settings.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(settings.apiKey || '')}`;

  const { contents, systemInstruction } = toGemini(messages);
  const body = {
    contents,
    generationConfig: { temperature: settings.temperature ?? 0.7 },
  };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  const geminiTools = toolsToGemini(tools);
  if (geminiTools) body.tools = geminiTools;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error(`Could not reach ${url} — ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 500)}`);
  }

  let content = '';
  const toolCalls = [];
  const seen = new Set();

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
    const parts = json.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (typeof part.text === 'string' && part.text) {
        content += part.text;
        cb.onText(part.text);
      }
      if (part.functionCall) {
        const key = JSON.stringify(part.functionCall);
        if (seen.has(key)) continue;
        seen.add(key);
        const id = `gc_${toolCalls.length}_${Date.now()}`;
        const name = part.functionCall.name;
        const args = part.functionCall.args || {};
        toolCalls.push({ id, name, arguments: args });
        cb.onToolStart({ id, name });
        cb.onToolDelta(id, JSON.stringify(args));
        cb.onToolEnd({ id, name, args });
      }
    }
  }

  return { content, toolCalls };
}
