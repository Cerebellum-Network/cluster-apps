import { describe, it, expect } from 'vitest';

import {
  capacityOf,
  hostingOf,
  contextWindowOf,
  priceOf,
  atCapacityNotice,
  toModelCard,
  isSpeechModel,
  isChatModel,
  exampleModels,
  chatModelChoices,
  pricePerMillionOf,
  taskLabel,
} from './model';
import { COMPUTE_OPERATION, COMPUTE_OPERATIONS } from './inferenceKey';
import { openAiBaseUrl, anthropicBaseUrl, speechHttpUrl } from './gateway';
import {
  snippetsFor,
  claudeCodeEnv,
  providerFields,
  SNIPPET_TABS,
  KEY_PLACEHOLDER,
  MODEL_PLACEHOLDER,
  type SnippetTabId,
} from './snippets';
import { rememberKey, forgetKey, sessionKeyFor } from './sessionKey';
import type { GatewayModel, ModelManifest } from './gateway';

const base = (over: Partial<GatewayModel> = {}): GatewayModel => ({
  id: '1338/m/v1.0.0',
  bucket: 1338,
  name: 'm',
  version: 'v1.0.0',
  available: true,
  routableReplicas: 1,
  replicas: [],
  ...over,
});

describe('capacityOf', () => {
  it('uses the gateway status when present', () => {
    expect(capacityOf(base({ status: 'available' })).tone).toBe('success');
    expect(capacityOf(base({ status: 'saturated' })).label).toBe('at capacity');
    expect(capacityOf(base({ status: 'unavailable' })).tone).toBe('neutral');
  });

  it('busy shows in-flight against the ceiling', () => {
    const c = capacityOf(base({ status: 'busy', inFlight: 1, ceiling: 2 }));
    expect(c.label).toBe('busy · 1/2');
    expect(c.tone).toBe('warning');
  });

  it('falls back to routability on an older gateway with no status', () => {
    expect(capacityOf(base({ status: undefined, routableReplicas: 0 })).status).toBe('unavailable');
    expect(capacityOf(base({ status: undefined, routableReplicas: 2 })).status).toBe('available');
  });
});

describe('hosting / context / price', () => {
  it('hosting: self-hosted vs external by manifest', () => {
    expect(hostingOf(null).label).toBe('Self-hosted');
    expect(hostingOf({ name: 'm', version: '1', sovereign: false, remote: { pool: 'zai' } }).label).toBe('External · Z.AI');
    expect(hostingOf({ name: 'm', version: '1', framework: 'remote' }).external).toBe(true);
  });

  it('context window formats token counts', () => {
    expect(contextWindowOf({ name: 'm', version: '1', max_input_tokens: 131072 })).toBe('128K context');
    expect(contextWindowOf({ name: 'm', version: '1' })).toBeNull();
  });

  it('price: in/out per unit, no scientific notation', () => {
    const man: ModelManifest = { name: 'm', version: '1', pricing: { unit: 'token', inputCost: 0.0000025, outputCost: 0.00001 } };
    expect(priceOf(man)).toBe('$0.0000025 in · $0.00001 out / token');
    expect(priceOf({ name: 'm', version: '1' })).toBeNull();
  });
});

describe('pricePerMillionOf', () => {
  it('scales per-unit prices to per-million for the table', () => {
    const man: ModelManifest = { name: 'm', version: '1', pricing: { unit: 'token', inputCost: 0.00000028, outputCost: 0.0000014 } };
    expect(pricePerMillionOf(man)).toEqual({ amount: '$0.28 / $1.40', note: 'per 1M tokens in / out' });
  });

  it('single-sided price (requests)', () => {
    const man: ModelManifest = { name: 'm', version: '1', pricing: { unit: 'request', inputCost: 0.000056 } };
    expect(pricePerMillionOf(man)).toEqual({ amount: '$56.00', note: 'per 1M requests' });
  });

  it('null when no pricing', () => {
    expect(pricePerMillionOf({ name: 'm', version: '1' })).toBeNull();
  });
});

describe('taskLabel', () => {
  it('maps known tasks to friendly labels, else echoes', () => {
    expect(taskLabel('text-generation')).toBe('Chat');
    expect(taskLabel('automatic-speech-recognition')).toBe('Speech to text');
    expect(taskLabel('audio-segmentation')).toBe('Who spoke when');
    expect(taskLabel('something-new')).toBe('something-new');
    expect(taskLabel(null)).toBe('Model');
  });
});

describe('atCapacityNotice', () => {
  it('names the models at capacity', () => {
    expect(atCapacityNotice([])).toBeNull();
    expect(atCapacityNotice(['glm-5.3'])).toContain('glm-5.3 is at capacity');
    expect(atCapacityNotice(['a', 'b'])).toContain('2 models are at capacity');
  });
});

describe('inference key operations', () => {
  it('COMPUTE operation is the wire value 4, and the set is COMPUTE only', () => {
    // ddc-node ddc-dac/pb Operation_COMPUTE = 4; widening past this breaks the
    // DAC chain walk, so pin it.
    expect(COMPUTE_OPERATION).toBe(4);
    expect([...COMPUTE_OPERATIONS]).toEqual([4]);
  });
});

describe('task classification', () => {
  it('speech tasks: asr / transcription / audio / speech', () => {
    expect(isSpeechModel('automatic-speech-recognition')).toBe(true);
    expect(isSpeechModel('audio-transcription')).toBe(true);
    expect(isSpeechModel('ASR')).toBe(true);
    expect(isSpeechModel('text-generation')).toBe(false);
    expect(isSpeechModel(null)).toBe(false);
  });

  it('chat tasks: text / chat / generation / instruct', () => {
    expect(isChatModel('text-generation')).toBe(true);
    expect(isChatModel('conversational')).toBe(true);
    expect(isChatModel('automatic-speech-recognition')).toBe(false);
    expect(isChatModel(null)).toBe(false);
  });
});

const card = (name: string, task: string | null, status: GatewayModel['status']) =>
  toModelCard(base({ name, alias: name, status }), task ? { name, version: '1', task } : null);

describe('exampleModels', () => {

  it('prefers a serving model, and picks chat vs speech by task', () => {
    const cards = [
      card('saturated-llm', 'text-generation', 'saturated'),
      card('glm-live', 'text-generation', 'available'),
      card('parakeet', 'automatic-speech-recognition', 'available'),
    ];
    const ex = exampleModels(cards);
    expect(ex.chat).toBe('glm-live'); // available beats the saturated one
    expect(ex.speech).toBe('parakeet');
  });

  it('falls back to any card for chat, and null speech when none is a speech model', () => {
    const ex = exampleModels([card('only-llm', 'text-generation', 'available')]);
    expect(ex.chat).toBe('only-llm');
    expect(ex.speech).toBeNull();
    expect(exampleModels([]).chat).toBeNull();
  });
});

describe('snippets', () => {
  const KEY = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
  const code = (tab: SnippetTabId, input = {}) => snippetsFor(tab, input).map((b) => b.code).join('\n');

  it('has the quickstart tabs in order', () => {
    expect(SNIPPET_TABS.map((t) => t.id)).toEqual([
      'curl',
      'python',
      'javascript',
      'anthropic',
      'claude-code',
      'tools',
      'speech',
    ]);
  });

  it('OpenAI-compatible tabs use the /openai/v1 base URL', () => {
    expect(openAiBaseUrl().endsWith('/openai/v1')).toBe(true);
    expect(code('curl')).toContain(`curl "${openAiBaseUrl()}/chat/completions"`);
    expect(code('python')).toContain(`base_url="${openAiBaseUrl()}"`);
    expect(code('javascript')).toContain(`baseURL: '${openAiBaseUrl()}'`);
    expect(providerFields()[0]).toEqual({ label: 'Base URL', value: openAiBaseUrl() });
  });

  it('Anthropic SDK and Claude Code use the /anthropic base URL (no /v1)', () => {
    expect(anthropicBaseUrl().endsWith('/anthropic')).toBe(true);
    expect(code('anthropic')).toContain(`base_url="${anthropicBaseUrl()}"`);
    expect(claudeCodeEnv().ANTHROPIC_BASE_URL).toBe(anthropicBaseUrl());
    expect(code('claude-code')).not.toContain('/openai/v1');
  });

  it('speech posts JSON model.alias + input.audio to the plain-HTTP endpoint', () => {
    const s = code('speech', { apiKey: KEY, speechModel: 'parakeet' });
    expect(speechHttpUrl().endsWith('/api/v1/inference')).toBe(true);
    expect(s).toContain(`curl "${speechHttpUrl()}"`);
    expect(s).toContain(`Authorization: Bearer ${KEY}`);
    expect(s).toContain('"model": {"alias": "parakeet"}');
    expect(s).toContain('"input": {"audio"');
    expect(s).not.toContain('-F ');
  });

  it('substitutes the key and model into every tab', () => {
    for (const t of SNIPPET_TABS) {
      const s = code(t.id, { apiKey: KEY, model: 'glm-5.3', speechModel: 'parakeet' });
      expect(s, t.id).toContain(KEY);
      expect(s, t.id).not.toContain(KEY_PLACEHOLDER);
      if (t.id !== 'speech') expect(s, t.id).toContain('glm-5.3');
    }
    expect(code('curl', { apiKey: KEY })).toContain(`Authorization: Bearer ${KEY}`);
    expect(code('python', { apiKey: KEY })).toContain(`api_key="${KEY}"`);
    expect(code('javascript', { apiKey: KEY })).toContain(`apiKey: '${KEY}'`);
  });

  it('uses the <YOUR_API_KEY> placeholder in every tab when there is no key', () => {
    expect(KEY_PLACEHOLDER).toBe('<YOUR_API_KEY>');
    for (const t of SNIPPET_TABS) {
      expect(code(t.id), t.id).toContain(KEY_PLACEHOLDER);
      expect(code(t.id, { apiKey: '' }), t.id).toContain(KEY_PLACEHOLDER);
    }
    expect(code('curl')).toContain(`"model": "${MODEL_PLACEHOLDER}"`);
  });

  it('Claude Code: settings.json env block and the shell export alternative', () => {
    const [settings, shell] = snippetsFor('claude-code', { apiKey: KEY, model: 'glm-5.3' });
    expect(settings.title).toContain('~/.claude/settings.json');
    expect(JSON.parse(settings.code)).toEqual({
      env: {
        ANTHROPIC_BASE_URL: anthropicBaseUrl(),
        ANTHROPIC_AUTH_TOKEN: KEY,
        ANTHROPIC_MODEL: 'glm-5.3',
        ANTHROPIC_SMALL_FAST_MODEL: 'glm-5.3',
        API_TIMEOUT_MS: '3000000',
      },
    });
    expect(shell.code).toContain(`export ANTHROPIC_BASE_URL="${anthropicBaseUrl()}"`);
    expect(shell.code).toContain(`export ANTHROPIC_AUTH_TOKEN="${KEY}"`);
    expect(shell.code).toContain('export API_TIMEOUT_MS="3000000"');
  });
});

describe('chatModelChoices', () => {
  it('offers chat models only, serving ones first', () => {
    const cards = [
      card('asr', 'automatic-speech-recognition', 'available'),
      card('full-llm', 'text-generation', 'saturated'),
      card('glm-5.3', 'text-generation', 'available'),
    ];
    expect(chatModelChoices(cards)).toEqual(['glm-5.3', 'full-llm']);
  });

  it('falls back to every model when none is tagged chat', () => {
    expect(chatModelChoices([card('x', null, 'available')])).toEqual(['x']);
    expect(chatModelChoices([])).toEqual([]);
  });
});

describe('sessionKey', () => {
  it('returns the key only for the signing account and before expiry', () => {
    rememberKey({ token: 't', expiresAt: 1000, account: 'a' });
    expect(sessionKeyFor('a', 500)?.token).toBe('t');
    expect(sessionKeyFor('b', 500)).toBeNull();
    expect(sessionKeyFor('a', 1000)).toBeNull();
    expect(sessionKeyFor(null, 500)).toBeNull();
    forgetKey();
    expect(sessionKeyFor('a', 500)).toBeNull();
  });
});

describe('toModelCard', () => {
  it('combines gateway model + manifest into a card', () => {
    const card = toModelCard(base({ alias: 'glm-5.3', status: 'available' }), {
      name: 'm',
      version: '1',
      task: 'text-generation',
      max_input_tokens: 131072,
      pricing: { unit: 'token', inputCost: 0.0000025, outputCost: 0.00001 },
    });
    expect(card.name).toBe('glm-5.3'); // alias preferred
    expect(card.task).toBe('text-generation');
    expect(card.context).toBe('128K context');
    expect(card.capacity.tone).toBe('success');
    expect(card.price).toContain('/ token');
  });
});
