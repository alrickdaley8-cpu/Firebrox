import { runProvider } from './providers/index.js';
import { TOOLS, executeTool, toolResultAsText } from './tools/index.js';

export const SYSTEM_PROMPT = `You are Firebrox, a powerful, helpful multi-tool AI agent.

Capabilities (use your tools rather than guessing):
- web_search — search the live web for current, factual, or up-to-date information.
- fetch_page — read the full text of a web page by URL.
- calculator — evaluate math precisely.
- list_files / read_file / write_file — work with files in your sandbox workspace.
- run_code — execute Python, JavaScript, or bash in a sandbox and see the output.
- remember / recall — save and retrieve long-term memory notes.

Guidelines:
1. For anything factual, current, or uncertain, search the web instead of relying on memory.
2. When running code, check the actual output; if it errors, fix it and retry.
3. Be concise but complete. Use formatting (lists, code blocks) when it helps.
4. If a tool returns an error, adapt and try a different approach rather than giving up.
5. Never fabricate citations or URLs — only cite what your tools actually returned.`;

/**
 * Run the agent loop, streaming events to the client.
 *
 * events: {
 *   text(delta)                    — assistant text token
 *   toolStart({ id, name, args })  — tool invocation begins (args may be partial)
 *   toolResult({ id, name, ok, output, ms })
 *   step(n)                        — agent loop iteration began
 * }
 */
export async function runAgent({ messages, settings, signal, events, maxSteps }) {
  const history = [];
  for (const m of messages) history.push({ ...m });

  // Attach the system prompt (respecting a user override).
  if (!history.some((m) => m.role === 'system')) {
    history.unshift({ role: 'system', content: settings.systemPrompt?.trim() || SYSTEM_PROMPT });
  }

  const cap = maxSteps || settings.maxSteps || 8;
  let finalContent = '';

  for (let step = 0; step < cap; step++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    events.step(step + 1);

    // Tool start events are emitted from the execution loop below once the
    // full arguments are known, so the streaming callbacks are no-ops.
    const cb = {
      onText: (d) => events.text(d),
      onToolStart: () => {},
      onToolDelta: () => {},
      onToolEnd: () => {},
    };

    const { content, toolCalls } = await runProvider(settings, history, TOOLS, cb, signal);

    if (toolCalls.length) {
      // Record the assistant message (with tool calls) in provider-neutral form.
      history.push({
        role: 'assistant',
        content: content || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      });

      // Execute each tool call and append results.
      for (const tc of toolCalls) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        events.toolStart({ id: tc.id, name: tc.name, args: tc.arguments });
        const res = await executeTool(tc.name, tc.arguments);
        events.toolResult({
          id: tc.id,
          name: tc.name,
          ok: res.ok,
          output: res.ok ? res.result : res.error,
          ms: res.ms,
        });
        history.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.name,
          content: toolResultAsText(res),
        });
      }
      // Continue the loop so the model can respond after seeing tool results.
      continue;
    }

    finalContent = content;
    break;
  }

  return { content: finalContent, messages: history };
}
