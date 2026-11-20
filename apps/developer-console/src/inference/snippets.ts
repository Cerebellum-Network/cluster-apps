/**
 * Quickstart code samples (Inference → Quickstart, step 3 "Call a model").
 * Pure string builders so every tab can be unit-tested: base URLs come from the
 * gateway surfaces, the model id from the live catalogue, and the API key is
 * substituted once the developer has created one (a placeholder before that).
 */
import { openAiBaseUrl, anthropicBaseUrl, speechHttpUrl } from './gateway';

export type SnippetTabId = 'curl' | 'python' | 'javascript' | 'anthropic' | 'claude-code' | 'tools' | 'speech';

export interface SnippetTab {
  readonly id: SnippetTabId;
  readonly label: string;
}

export const SNIPPET_TABS: readonly SnippetTab[] = [
  { id: 'curl', label: 'curl' },
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'anthropic', label: 'Anthropic SDK' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'tools', label: 'Cursor / Cline / OpenCode' },
  { id: 'speech', label: 'Speech models' },
];

export const KEY_PLACEHOLDER = '<YOUR_API_KEY>';
export const MODEL_PLACEHOLDER = '<MODEL_ID>';
export const SPEECH_MODEL_PLACEHOLDER = '<SPEECH_MODEL_ID>';

/** Claude Code's request timeout: long agentic turns on open models run past the default. */
export const CLAUDE_CODE_TIMEOUT_MS = '3000000';

export interface SnippetInput {
  /** The key just created; null/empty → `<YOUR_API_KEY>`. */
  apiKey?: string | null;
  /** Chat model id from the catalogue; null/empty → `<MODEL_ID>`. */
  model?: string | null;
  /** Speech model id from the catalogue; null/empty → `<SPEECH_MODEL_ID>`. */
  speechModel?: string | null;
}

/** One copyable block in a tab. */
export interface SnippetBlock {
  /** Short caption above the block ("~/.claude/settings.json"); omitted when the tab has one block. */
  title?: string;
  code: string;
}

/** A labelled value for tools configured through a settings form. */
export interface ProviderField {
  label: string;
  value: string;
}

const keyOf = (i: SnippetInput) => i.apiKey || KEY_PLACEHOLDER;
const modelOf = (i: SnippetInput) => i.model || MODEL_PLACEHOLDER;
const speechOf = (i: SnippetInput) => i.speechModel || SPEECH_MODEL_PLACEHOLDER;

/** The `env` block Claude Code reads from `~/.claude/settings.json` (or the shell). */
export function claudeCodeEnv(input: SnippetInput = {}): Record<string, string> {
  return {
    ANTHROPIC_BASE_URL: anthropicBaseUrl(),
    ANTHROPIC_AUTH_TOKEN: keyOf(input),
    ANTHROPIC_MODEL: modelOf(input),
    ANTHROPIC_SMALL_FAST_MODEL: modelOf(input),
    API_TIMEOUT_MS: CLAUDE_CODE_TIMEOUT_MS,
  };
}

/** Base URL + key + model, for editors that take an "OpenAI-compatible provider". */
export function providerFields(input: SnippetInput = {}): ProviderField[] {
  return [
    { label: 'Base URL', value: openAiBaseUrl() },
    { label: 'API key', value: keyOf(input) },
    { label: 'Model', value: modelOf(input) },
  ];
}

/** The ready-to-run blocks for one tab. */
export function snippetsFor(tab: SnippetTabId, input: SnippetInput = {}): SnippetBlock[] {
  const key = keyOf(input);
  const model = modelOf(input);
  switch (tab) {
    case 'curl':
      return [
        {
          code: [
            `curl "${openAiBaseUrl()}/chat/completions" \\`,
            `  -H "Authorization: Bearer ${key}" \\`,
            '  -H "Content-Type: application/json" \\',
            "  -d '{",
            `    "model": "${model}",`,
            '    "messages": [{"role": "user", "content": "Hello"}]',
            "  }'",
          ].join('\n'),
        },
      ];
    case 'python':
      return [
        {
          code: [
            '# pip install openai',
            'from openai import OpenAI',
            '',
            'client = OpenAI(',
            `    base_url="${openAiBaseUrl()}",`,
            `    api_key="${key}",`,
            ')',
            'reply = client.chat.completions.create(',
            `    model="${model}",`,
            '    messages=[{"role": "user", "content": "Hello"}],',
            ')',
            'print(reply.choices[0].message.content)',
          ].join('\n'),
        },
      ];
    case 'javascript':
      return [
        {
          code: [
            '// npm install openai',
            "import OpenAI from 'openai';",
            '',
            'const client = new OpenAI({',
            `  baseURL: '${openAiBaseUrl()}',`,
            `  apiKey: '${key}',`,
            '});',
            'const reply = await client.chat.completions.create({',
            `  model: '${model}',`,
            "  messages: [{ role: 'user', content: 'Hello' }],",
            '});',
            'console.log(reply.choices[0].message.content);',
          ].join('\n'),
        },
      ];
    case 'anthropic':
      return [
        {
          code: [
            '# pip install anthropic',
            'from anthropic import Anthropic',
            '',
            'client = Anthropic(',
            `    base_url="${anthropicBaseUrl()}",`,
            `    api_key="${key}",`,
            ')',
            'msg = client.messages.create(',
            `    model="${model}",`,
            '    max_tokens=1024,',
            '    messages=[{"role": "user", "content": "Hello"}],',
            ')',
            'print(msg.content[0].text)',
          ].join('\n'),
        },
      ];
    case 'claude-code': {
      const env = claudeCodeEnv(input);
      return [
        { title: 'Add to ~/.claude/settings.json', code: JSON.stringify({ env }, null, 2) },
        {
          title: 'Or export in your shell, then run claude',
          code: [...Object.entries(env).map(([k, v]) => `export ${k}="${v}"`), 'claude'].join('\n'),
        },
      ];
    }
    case 'tools':
      return [
        {
          code: providerFields(input)
            .map((f) => `${f.label}: ${f.value}`)
            .join('\n'),
        },
      ];
    case 'speech':
      // The gateway's /api/v1/inference takes a JSON body — `model.alias` (or
      // `model.name`) and an `input.audio` that is a URL (recommended; ~1MB edge
      // cap) or a base64 data-URI. Verified live against the test gateway
      // (parakeet-tdt-0.6b-v2); a `-F model=/-F file=` multipart form is
      // rejected with "model.name or model.alias is required".
      return [
        {
          code: [
            '# input.audio: a public URL (recommended, ~1MB limit) or a base64 data-URI',
            `curl "${speechHttpUrl()}" \\`,
            `  -H "Authorization: Bearer ${key}" \\`,
            '  -H "Content-Type: application/json" \\',
            "  -d '{",
            `    "model": {"alias": "${speechOf(input)}"},`,
            '    "input": {"audio": "https://example.com/clip.wav"}',
            "  }'",
          ].join('\n'),
        },
      ];
  }
}
