import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import type { AgentDefinition } from '~/compute/agentDefinition';
import MissingSecrets from './MissingSecrets';

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
  egress: { allow: [{ host: 'api.github.com', methods: ['GET'], credential: 'github-readonly' }] },
} as unknown as AgentDefinition;

describe('MissingSecrets', () => {
  it('says what each missing secret is for, where its value comes from, and links to add it', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <MissingSecrets def={def} missing={['ddc-inference', 'github-readonly']} />
      </MemoryRouter>,
    );
    expect(html).toContain('The run needs secrets this bucket doesn’t hold:');
    // The model's key: an inference API key of the model gateway's network (testnet here, devnet console).
    expect(html).toContain('glm-5.3');
    expect(html).toContain('inference-gateway.compute.test.ddcdragon.com');
    expect(html).toContain('href="https://developer.compute.test.ddcdragon.com"');
    expect(html).toContain('create a key under Inference › API keys');
    expect(html).toContain('its SSCP wallet is separate from this one');
    expect(html).toContain('have a bucket with balance there');
    expect(html).toContain('href="/sandboxes/secrets?add=ddc-inference"');
    // A rule's credential: the hosts it is sent to, and for GitHub where a read-only token comes from.
    expect(html).toContain('api.github.com');
    expect(html).toContain('GitHub fine-grained personal access token with read-only access');
    expect(html).toContain('href="https://github.com/settings/personal-access-tokens/new"');
    expect(html).toContain('href="/sandboxes/secrets?add=github-readonly"');
  });
});
