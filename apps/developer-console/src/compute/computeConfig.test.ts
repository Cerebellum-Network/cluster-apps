import { describe, expect, it } from 'vitest';

import { computeGatewayUrl, GATEWAY_BY_NETWORK } from './computeConfig';

describe('computeGatewayUrl', () => {
  it('follows the network when nothing is configured', () => {
    expect(computeGatewayUrl('devnet')).toBe('https://agent-gateway.compute.dev.ddcdragon.com');
    expect(computeGatewayUrl('devnet')).toBe(GATEWAY_BY_NETWORK.devnet);
  });

  it('has no gateway for a network without sandboxes, instead of calling another network’s', () => {
    expect(computeGatewayUrl('testnet')).toBe('');
    expect(computeGatewayUrl('mainnet')).toBe('');
  });

  it('takes the configured URL over the default, without a trailing slash', () => {
    expect(computeGatewayUrl('testnet', 'https://agent-gateway.compute.test.ddcdragon.com/')).toBe(
      'https://agent-gateway.compute.test.ddcdragon.com',
    );
    expect(computeGatewayUrl('devnet', 'http://localhost:8083')).toBe('http://localhost:8083');
  });
});
