import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import UsageView, { EmptyUsage } from './UsageView';
import { usageFixture } from './usageFixture';
import type { UsageData } from '~/inference/useUsage';

const render = (data: UsageData) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <UsageView data={data} preset="24h" gatewayKey="k" onAuthError={() => {}} />
    </MemoryRouter>,
  );

describe('UsageView', () => {
  it('renders the notice, tiles, charts and only the models used', () => {
    const html = render(usageFixture);
    expect(html).toContain('37 requests were refused at your plan’s limit of 8 at once.');
    expect(html).toContain('Upgrade plan');
    expect(html).toContain('Talk to us');
    for (const tile of ['GPU units', 'Requests', 'Refused (429)', 'Closest to limit']) expect(html).toContain(`aria-label="${tile}"`);
    expect(html).toContain('41'); // refused total
    expect(html).toContain('37 your limit · 4 model full');
    expect(html).toContain('↑ 38.6% vs the previous 24 hours'); // GPU 415.7 vs 300
    expect(html).toContain('per 15 minutes, by model');
    expect(html).toContain('glm-5.3');
    expect(html).toContain('qwen3-embed');
    expect(html).not.toContain('never-used');
    expect(html).toContain('8 / 8');
  });

  it('shows the empty state with a way to the quickstart when nothing was used', () => {
    const empty: UsageData = {
      ...usageFixture,
      reads: {
        ...usageFixture.reads,
        gpu: new Map(), requests: new Map(), tokensIn: new Map(), tokensCached: new Map(), tokensOut: new Map(),
        peak: new Map(), refusedLimit: new Map(), refusedFull: new Map(),
      },
      gpuSteps: [],
      requestSteps: [],
    };
    const html = render(empty);
    expect(html).toBe(renderToStaticMarkup(<MemoryRouter><EmptyUsage /></MemoryRouter>));
    expect(html).toContain('No usage yet');
    expect(html).toContain('href="/inference?how=1"');
  });

  it('has no upgrade notice when refusals were only "model full"', () => {
    const html = render({ ...usageFixture, reads: { ...usageFixture.reads, refusedLimit: new Map() } });
    expect(html).not.toContain('Upgrade plan');
  });
});
