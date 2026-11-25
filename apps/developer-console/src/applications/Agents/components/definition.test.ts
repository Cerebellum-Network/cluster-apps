import { describe, expect, it } from 'vitest';

import type { AgentDefinition } from '~/compute/agentDefinition';
import { consoleForGateway, missingSecrets, secretPurpose } from './definition';

const def = {
  schema: 'cere.agent/v1',
  name: 'sre',
  harness: 'claude-code',
  image: 'cerebellumnetwork/ddc-agent-runner:0.1.0',
  model: {
    base_url: 'https://inference-gateway.compute.test.ddcdragon.com/anthropic',
    model: 'glm-5.3',
    credential: 'ddc-inference',
  },
  egress: {
    allow: [
      { host: 'api.github.com', methods: ['GET'], credential: 'github-readonly' },
      { host: 'github.com', methods: ['GET'] },
    ],
  },
} as unknown as AgentDefinition;

const DEVNET_IG = 'https://inference-gateway.compute.dev.ddcdragon.com';

describe('secretPurpose', () => {
  it('says the model credential is an inference API key from the console of the model gateway’s network', () => {
    expect(secretPurpose(def, 'ddc-inference', DEVNET_IG)).toEqual({
      kind: 'model',
      name: 'ddc-inference',
      model: 'glm-5.3',
      baseUrl: 'https://inference-gateway.compute.test.ddcdragon.com/anthropic',
      host: 'inference-gateway.compute.test.ddcdragon.com',
      sameConsole: false,
      console: 'https://developer.compute.test.ddcdragon.com',
    });
  });

  it('points at this console’s own Inference → API keys when the model is on its gateway', () => {
    const p = secretPurpose(def, 'ddc-inference', 'https://inference-gateway.compute.test.ddcdragon.com/');
    expect(p).toMatchObject({ kind: 'model', sameConsole: true, console: null });
  });

  it('names the hosts a rule credential is sent to', () => {
    expect(secretPurpose(def, 'github-readonly', DEVNET_IG)).toEqual({
      kind: 'rule',
      name: 'github-readonly',
      hosts: ['api.github.com'],
    });
  });

  it('lists only the secrets the bucket lacks', () => {
    const have = [{ name: 'github-readonly', type: 'header', header: 'Authorization', created_at: '', updated_at: '' }];
    expect(missingSecrets(def, have)).toEqual(['ddc-inference']);
  });
});

describe('consoleForGateway', () => {
  it('maps an inference gateway host to the developer console of its network', () => {
    expect(consoleForGateway('inference-gateway.compute.dev.ddcdragon.com')).toBe(
      'https://developer.compute.dev.ddcdragon.com',
    );
    expect(consoleForGateway('api.anthropic.com')).toBeNull();
    expect(consoleForGateway('inference-gateway.')).toBeNull();
  });
});
