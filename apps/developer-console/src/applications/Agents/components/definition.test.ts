import { describe, expect, it } from 'vitest';

import type { AgentDefinition } from '~/compute/agentDefinition';
import { consoleForGateway, EXAMPLE_MODEL_URL, missingSecrets, onConsoleGateway, secretPurpose } from './definition';

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

  it('says a model on this console’s own gateway takes this console’s token', () => {
    const p = secretPurpose(def, 'ddc-inference', 'https://inference-gateway.compute.test.ddcdragon.com/');
    expect(p).toMatchObject({ kind: 'model', sameConsole: true, console: null });
  });

  it('names the hosts a rule credential is sent to', () => {
    expect(secretPurpose(def, 'github-readonly', DEVNET_IG)).toEqual({
      kind: 'rule',
      name: 'github-readonly',
      hosts: ['api.github.com'],
      source: {
        what: expect.stringContaining('GitHub fine-grained personal access token with read-only access'),
        url: 'https://github.com/settings/personal-access-tokens/new',
      },
    });
  });

  it('knows no source for a host it has no rule for', () => {
    const npm = { ...def, egress: { allow: [{ host: 'registry.npmjs.org', methods: ['GET'], credential: 'npm' }] } };
    expect(secretPurpose(npm, 'npm', DEVNET_IG)).toMatchObject({ kind: 'rule', source: null });
  });

  it('lists only the secrets the bucket lacks', () => {
    const have = [{ name: 'github-readonly', type: 'header', header: 'Authorization', created_at: '', updated_at: '' }];
    expect(missingSecrets(def, have)).toEqual(['ddc-inference']);
  });
});

describe('onConsoleGateway', () => {
  it('is true for the examples’ model on a devnet console, and only for the same host', () => {
    expect(onConsoleGateway(EXAMPLE_MODEL_URL, DEVNET_IG)).toBe(true);
    expect(onConsoleGateway(EXAMPLE_MODEL_URL, `${DEVNET_IG}/`)).toBe(true);
    expect(onConsoleGateway(EXAMPLE_MODEL_URL, 'https://inference-gateway.compute.test.ddcdragon.com')).toBe(false);
    expect(onConsoleGateway('not a url', DEVNET_IG)).toBe(false);
    expect(onConsoleGateway(EXAMPLE_MODEL_URL, '')).toBe(false);
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
