/**
 * "Show me how" code samples (the quickstart modal: "Call a model from your
 * laptop or app"). Split into step 2 (base URL + key as env vars) and step 3
 * (call a model reading those env vars), one of each per tab. Pure string
 * builders so the tabs can be unit-tested; base URLs come from the verified
 * gateway surfaces, model ids are substituted from the live catalogue.
 */
import { openAiBaseUrl, anthropicBaseUrl, speechHttpUrl } from './gateway';

export type SnippetLang = 'openai' | 'anthropic' | 'curl' | 'speech';

export interface SnippetTab {
  readonly id: SnippetLang;
  readonly label: string;
}

export const SNIPPET_TABS: readonly SnippetTab[] = [
  { id: 'openai', label: 'OpenAI SDK' },
  { id: 'anthropic', label: 'Anthropic SDK' },
  { id: 'curl', label: 'curl' },
  { id: 'speech', label: 'Speech models' },
];

export const KEY_PLACEHOLDER = '<your key>';
const CHAT_PLACEHOLDER = 'your-model';
const SPEECH_PLACEHOLDER = 'your-speech-model';

export interface SnippetInput {
  chatModel?: string | null;
  speechModel?: string | null;
}

/** Step 2 — put the base URL and the key in the environment. */
export function envSnippet(lang: SnippetLang): string {
  switch (lang) {
    case 'openai':
    case 'curl':
      return [`export OPENAI_BASE_URL="${openAiBaseUrl()}"`, `export OPENAI_API_KEY="${KEY_PLACEHOLDER}"`].join('\n');
    case 'anthropic':
      return [`export ANTHROPIC_BASE_URL="${anthropicBaseUrl()}"`, `export ANTHROPIC_API_KEY="${KEY_PLACEHOLDER}"`].join(
        '\n',
      );
    case 'speech':
      return [`export SPEECH_URL="${speechHttpUrl()}"`, `export CERE_API_KEY="${KEY_PLACEHOLDER}"`].join('\n');
  }
}

/** Step 3 — call a model, reading the env vars from step 2. */
export function callSnippet(lang: SnippetLang, input: SnippetInput = {}): string {
  const chat = input.chatModel || CHAT_PLACEHOLDER;
  const speech = input.speechModel || SPEECH_PLACEHOLDER;
  switch (lang) {
    case 'openai':
      return [
        '# pip install openai',
        'from openai import OpenAI',
        '',
        'client = OpenAI()  # reads OPENAI_BASE_URL and OPENAI_API_KEY',
        'reply = client.chat.completions.create(',
        `    model="${chat}",`,
        '    messages=[{"role": "user", "content": "Hello"}],',
        ')',
        'print(reply.choices[0].message.content)',
      ].join('\n');
    case 'anthropic':
      return [
        '# pip install anthropic',
        'from anthropic import Anthropic',
        '',
        'client = Anthropic()  # reads ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY',
        'msg = client.messages.create(',
        `    model="${chat}",`,
        '    max_tokens=256,',
        '    messages=[{"role": "user", "content": "Hello"}],',
        ')',
        'print(msg.content[0].text)',
      ].join('\n');
    case 'curl':
      return [
        'curl "$OPENAI_BASE_URL/chat/completions" \\',
        '  -H "Authorization: Bearer $OPENAI_API_KEY" \\',
        '  -H "Content-Type: application/json" \\',
        "  -d '{",
        `    "model": "${chat}",`,
        '    "messages": [{"role": "user", "content": "Hello"}]',
        "  }'",
      ].join('\n');
    case 'speech':
      return [
        'curl "$SPEECH_URL" \\',
        '  -H "Authorization: Bearer $CERE_API_KEY" \\',
        `  -F model="${speech}" \\`,
        '  -F file=@sample.wav',
      ].join('\n');
  }
}
