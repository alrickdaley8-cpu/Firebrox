import { runOpenAICompatible } from './openai.js';
import { runAnthropic } from './anthropic.js';
import { runGemini } from './gemini.js';
import { runDemo } from './demo.js';
import { PROVIDER_META } from '../config.js';

/**
 * All providers share one contract:
 *   run({ messages, tools, settings, signal }, callbacks) -> Promise<{ content, toolCalls }>
 *
 * messages:  OpenAI-style [{ role, content, tool_calls?, tool_call_id? }]
 * tools:     [{ name, description, parameters }]
 * callbacks: {
 *   onText(delta),                  // assistant text tokens
 *   onToolStart({ id, name }),      // model decided to call a tool
 *   onToolDelta(id, deltaJson),     // raw argument fragments (optional)
 *   onToolEnd({ id, name, args }),  // complete tool call
 * }
 * Returns: { content: string, toolCalls: [{ id, name, arguments }] }
 */
export async function runProvider(settings, messages, tools, callbacks, signal) {
  const provider = settings.provider;
  const meta = PROVIDER_META[provider];

  if (!meta) throw new Error(`Unknown provider "${provider}"`);

  if (provider === 'demo') {
    return runDemo({ messages, tools, settings, signal }, callbacks);
  }
  if (provider === 'anthropic') {
    return runAnthropic({ messages, tools, settings, signal }, callbacks);
  }
  if (provider === 'gemini') {
    return runGemini({ messages, tools, settings, signal }, callbacks);
  }
  // openai, groq, ollama, custom all speak the OpenAI Chat Completions protocol.
  return runOpenAICompatible({ messages, tools, settings, signal }, callbacks);
}

/** Parse a Server-Sent-Events stream line-by-line. */
export async function* sseLines(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);
      if (line) yield line;
    }
  }
  if (buffer) yield buffer;
}

export function httpError(provider, res) {
  return new Error(`${provider} API error ${res.status} ${res.statusText}`);
}

/** Convert unified tool list -> OpenAI format. */
export function toolsToOpenAI(tools) {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

/** Convert unified tool list -> Anthropic format. */
export function toolsToAnthropic(tools) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

/** Convert unified tool list -> Gemini format. */
export function toolsToGemini(tools) {
  if (!tools.length) return undefined;
  return [{ functionDeclarations: tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  })) }];
}
