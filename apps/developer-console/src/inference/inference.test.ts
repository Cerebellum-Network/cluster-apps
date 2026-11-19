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
  pricePerMillionOf,
  taskLabel,
} from './model';
import { COMPUTE_OPERATION, COMPUTE_OPERATIONS } from './inferenceKey';
import { openAiBaseUrl, anthropicBaseUrl, speechHttpUrl } from './gateway';
import { envSnippet, callSnippet, SNIPPET_TABS } from './snippets';
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

describe('exampleModels', () => {
  const card = (name: string, task: string | null, status: GatewayModel['status']) =>
    toModelCard(base({ name, alias: name, status }), task ? { name, version: '1', task } : null);

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
  it('has a tab per mockup surface (OpenAI, Anthropic, curl, speech)', () => {
    expect(SNIPPET_TABS.map((t) => t.id)).toEqual(['openai', 'anthropic', 'curl', 'speech']);
  });

  it('env: OpenAI/curl export the OpenAI base URL + key', () => {
    expect(envSnippet('openai')).toContain(`export OPENAI_BASE_URL="${openAiBaseUrl()}"`);
    expect(envSnippet('openai')).toContain('export OPENAI_API_KEY=');
    expect(envSnippet('curl')).toContain(`export OPENAI_BASE_URL="${openAiBaseUrl()}"`);
  });

  it('env: Anthropic uses the /anthropic base (SDK appends /v1/messages)', () => {
    expect(envSnippet('anthropic')).toContain(`export ANTHROPIC_BASE_URL="${anthropicBaseUrl()}"`);
    expect(anthropicBaseUrl().endsWith('/anthropic')).toBe(true);
  });

  it('env: Speech exports the plain-HTTP inference URL', () => {
    expect(envSnippet('speech')).toContain(`export SPEECH_URL="${speechHttpUrl()}"`);
    expect(speechHttpUrl().endsWith('/api/v1/inference')).toBe(true);
  });

  it('call: OpenAI reads env and names the model', () => {
    const s = callSnippet('openai', { chatModel: 'glm-5.3' });
    expect(s).toContain('client = OpenAI()');
    expect(s).toContain('model="glm-5.3"');
  });

  it('call: curl hits chat/completions via the env base URL', () => {
    const s = callSnippet('curl', { chatModel: 'glm-5.3' });
    expect(s).toContain('"$OPENAI_BASE_URL/chat/completions"');
    expect(s).toContain('Authorization: Bearer $OPENAI_API_KEY');
  });

  it('call: speech posts the JSON model.alias + input.audio body, placeholders when unknown', () => {
    const s = callSnippet('speech', { speechModel: 'parakeet' });
    expect(s).toContain('"$SPEECH_URL"');
    expect(s).toContain('Authorization: Bearer $CERE_API_KEY');
    expect(s).toContain('"model": {"alias": "parakeet"}');
    expect(s).toContain('"input": {"audio"');
    // The old multipart form the deployed gateway rejects must not reappear.
    expect(s).not.toContain('-F ');
    expect(callSnippet('speech')).toContain('"model": {"alias": "your-speech-model"}');
    expect(callSnippet('openai')).toContain('model="your-model"');
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
