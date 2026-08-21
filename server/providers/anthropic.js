import { sseLines, httpError, toolsToAnthropic } from './index.js';

/** Convert OpenAI-style messages -> Anthropic Messages format. */
function toAnthropic(messages) {
  const systemParts = [];
  const out = [];

  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content);
      continue;
    }
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content || '' });
      continue;
    }
    if (m.role === 'assistant') {
      const blocks = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          let input = {};
          try {
            input = typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments || '{}')
              : tc.function.arguments || {};
          } catch {
            input = {};
          }
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
        }
      }
      out.push({ role: 'assistant', content: blocks });
      continue;
    }
    if (m.role === 'tool') {
      out.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content || '' }],
      });
    }
  }
  return { system: systemParts.join('\n\n'), messages: out };
}

export async function runAnthropic({ messages, tools, settings, signal }, cb) {
  const baseURL = (settings.baseURL || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
  const url = `${baseURL}/messages`;

  const { system, messages: am } = toAnthropic(messages);

  const body = {
    model: settings.model,
    max_tokens: 4096,
    temperature: settings.temperature ?? 0.7,
    stream: true,
  };
  if (system) body.system = system;
  if (tools.length) body.tools = toolsToAnthropic(tools);
  body.messages = am;

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': settings.apiKey || '',
    'anthropic-version': '2023-06-01',
  };

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error(`Could not reach ${url} — ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 500)}`);
  }

  let content = '';
  const toolUses = []; // {id, name, inputJson}
  let currentTool = null;

  for await (const line of sseLines(res)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (data === '[DONE]') break;
    let ev;
    try {
      ev = JSON.parse(data);
    } catch {
      continue;
    }

    if (ev.type === 'content_block_delta') {
      const d = ev.delta;
      if (d?.type === 'text_delta' && d.text) {
        content += d.text;
        cb.onText(d.text);
      } else if (d?.type === 'input_json_delta' && currentTool) {
        currentTool.inputJson += d.partial_json || '';
        cb.onToolDelta(currentTool.id, d.partial_json || '');
      }
    } else if (ev.type === 'content_block_start') {
      const block = ev.content_block;
      if (block?.type === 'tool_use') {
        currentTool = { id: block.id, name: block.name, inputJson: '' };
        toolUses.push(currentTool);
        cb.onToolStart({ id: block.id, name: block.name });
      } else if (block?.type === 'text') {
        if (block.text) {
          content += block.text;
          cb.onText(block.text);
        }
      }
    } else if (ev.type === 'content_block_stop') {
      if (currentTool) {
        let args = {};
        try {
          args = currentTool.inputJson ? JSON.parse(currentTool.inputJson) : {};
        } catch {
          args = { _raw: currentTool.inputJson };
        }
        cb.onToolEnd({ id: currentTool.id, name: currentTool.name, args });
        currentTool = null;
      }
    }
  }

  if (currentTool) {
    let args = {};
    try {
      args = currentTool.inputJson ? JSON.parse(currentTool.inputJson) : {};
    } catch {
      args = { _raw: currentTool.inputJson };
    }
    cb.onToolEnd({ id: currentTool.id, name: currentTool.name, args });
  }

  const toolCalls = toolUses.map((t) => {
    let args = {};
    try {
      args = t.inputJson ? JSON.parse(t.inputJson) : {};
    } catch {
      args = { _raw: t.inputJson };
    }
    return { id: t.id, name: t.name, arguments: args };
  });

  return { content, toolCalls };
}
