import { describe, expect, it } from 'vitest';


describe('latestPerModel', () => {
  const m = (name: string, version: string, available: boolean) =>
    ({ id: `1338/${name}/${version}`, bucket: 1338, name, version, available, routableReplicas: 0, replicas: [] }) as any;
  it('keeps one entry per model: the newest serving version, else the newest', async () => {
    const { latestPerModel } = await import('./model');
    const out = latestPerModel([
      m('qwen', 'v1.0.0', false), m('qwen', 'v1.0.10', false), m('qwen', 'v1.0.4', false),
      m('gemma', 'v1.1.0', false), m('gemma', 'v1.0.0', true),
    ]);
    expect(out.map((x: any) => `${x.name}@${x.version}`).sort()).toEqual(['gemma@v1.0.0', 'qwen@v1.0.10']);
  });
});
