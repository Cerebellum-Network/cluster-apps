import { describe, expect, it } from 'vitest';

import type { AgentDefinition } from './agentDefinition';
import {
  buildCreateRequest,
  LineSplitter,
  modelRule,
  parseEventLine,
  RETAINED_FILES,
  runAgent,
  runFiles,
  type RunEvent,
  type RunStep,
} from './agentRun';
import { ComputeError, type ComputeClient } from './client';
import type { CreateSandboxRequest, ExecEvent, ExecRequest, Sandbox } from './types';
import { EMPTY_USAGE } from './types';

const SRE: AgentDefinition = {
  schema: 'cere.agent/v1',
  name: 'sre',
  harness: 'claude-code',
  image: 'cerebellumnetwork/ddc-agent-runner:0.1.0',
  command: null,
  system_prompt: 'You are an SRE engineer.',
  model: {
    base_url: 'https://inference-gateway.compute.test.ddcdragon.com/anthropic',
    model: 'm1',
    credential: 'ddc-inference',
  },
  tools: ['Bash'],
  resources: { cpu: 1, memory_mib: 2048 },
  timeout_s: 900,
  egress: { allow: [{ host: 'api.github.com', methods: ['GET'], credential: 'github-readonly' }] },
  files: { 'notes/a.md': 'hello', '/etc/x': 'y' },
};

const sandbox = (over: Partial<Sandbox>): Sandbox => ({
  id: 'sb-1',
  status: 'starting',
  bucket: 7,
  node: 'ab'.repeat(32),
  runtime: 'gvisor',
  image: SRE.image,
  command: ['sleep', 'infinity'],
  workdir: '/workspace',
  resources: { cpu: 1, memory_mib: 2048 },
  timeout_s: 1020,
  idle_timeout_s: 0,
  env_keys: [],
  egress: { allow: [] },
  labels: {},
  created_at: '2026-11-25T10:00:00Z',
  started_at: null,
  ended_at: null,
  startup_ms: null,
  exit_reason: null,
  exit_code: null,
  retained: [],
  usage: EMPTY_USAGE,
  ...over,
});

/** A compute client that behaves like the gateway for one run, recording what it was asked. */
function fakeClient(opts: {
  stdout: string[];
  output?: string | null;
  exitCode?: number;
  startStatus?: Sandbox['status'];
  /** The node ended the sandbox under the run with this reason: terminate answers it as it is (idempotent). */
  endedWith?: string;
}) {
  const log: {
    created?: CreateSandboxRequest;
    files: Record<string, string>;
    exec?: ExecRequest;
    terminated?: { retain?: string[]; reason?: string };
  } = { files: {} };
  let polls = 0;
  const client = {
    baseUrl: 'x',
    createSandbox: async (req: CreateSandboxRequest) => {
      log.created = req;
      return sandbox({ labels: req.labels ?? {} });
    },
    getSandbox: async () => {
      polls += 1;
      return sandbox({
        status: polls < 2 ? 'starting' : (opts.startStatus ?? 'running'),
        exit_reason: opts.startStatus === 'failed' ? 'failed: image pull x' : null,
      });
    },
    putFile: async (_id: string, path: string, body: string) => {
      log.files[path] = body;
    },
    execStream: async (_id: string, req: ExecRequest, on: (e: ExecEvent) => void) => {
      log.exec = req;
      // Split lines across chunks the way a stream does.
      const all = opts.stdout.join('\n') + '\n';
      on({ type: 'stdout', data: all.slice(0, 7) });
      on({ type: 'stdout', data: all.slice(7) });
      on({ type: 'stderr', data: 'a warning\n' });
      const exit = { exit_code: opts.exitCode ?? 0, duration_ms: 5, timed_out: false };
      on({ type: 'exit', exit });
      return exit;
    },
    getFile: async (_id: string, path: string) => {
      if (path === '/workspace/output.json' && opts.output != null) return new Blob([opts.output]);
      if (path === '/workspace/transcript.jsonl') return new Blob(['{"kind":"input"}\n']);
      throw new ComputeError(404, 'no such file', 'file_not_found');
    },
    terminate: async (_id: string, t?: { retain?: string[]; reason?: string }) => {
      log.terminated = t;
      return sandbox({
        status: 'terminated',
        exit_reason: opts.endedWith ?? 'terminated by API: agent run finished',
        resources: { cpu: 0.5, memory_mib: 512, memory_limit_mib: 2048 },
      });
    },
  } as unknown as ComputeClient;
  return { client, log };
}

describe('buildCreateRequest', () => {
  it('starts sleep infinity with the definition rules then the model rule, the labels and the model environment', () => {
    const req = buildCreateRequest(SRE, '01jdx3q4w8m2v6r9t0kz5c7b1n');
    expect(req.command).toEqual(['sleep', 'infinity']);
    expect(req.timeout_s).toBe(900 + 120);
    expect(req.egress?.allow[1]).toEqual({
      host: 'inference-gateway.compute.test.ddcdragon.com',
      methods: ['GET', 'POST'],
      path_prefix: '/anthropic',
      credential: 'ddc-inference',
    });
    expect(req.egress?.allow[0]).toEqual(SRE.egress!.allow[0]);
    expect(req.labels).toEqual({
      'cere.kind': 'agent-run',
      'cere.agent': 'sre',
      'cere.harness': 'claude-code',
      'cere.run': '01jdx3q4w8m2v6r9t0kz5c7b1n',
    });
    expect(req.env).toEqual({
      ANTHROPIC_BASE_URL: SRE.model.base_url,
      ANTHROPIC_API_KEY: 'placeholder-egress-proxy-injects',
      DDC_MODEL: 'm1',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
      DISABLE_AUTOUPDATER: '1',
    });
  });

  it('asks for the definition’s request and limits, else the agent layer’s (0.5 vCPU, 512 MiB, up to 2 and 2048)', () => {
    expect(buildCreateRequest({ ...SRE, resources: undefined }, 'r').resources).toEqual({
      cpu: 0.5,
      memory_mib: 512,
      cpu_limit: 2,
      memory_limit_mib: 2048,
    });
    // A request above the default limit raises the limit with it.
    expect(buildCreateRequest({ ...SRE, resources: { cpu: 3, memory: 4096 } }, 'r').resources).toEqual({
      cpu: 3,
      memory_mib: 4096,
      cpu_limit: 3,
      memory_limit_mib: 4096,
    });
    const limited = { ...SRE, resources: { cpu: 0.5, memory: 512, cpu_limit: 4, memory_limit: 1024 } };
    expect(buildCreateRequest(limited, 'r').resources).toEqual({
      cpu: 0.5,
      memory_mib: 512,
      cpu_limit: 4,
      memory_limit_mib: 1024,
    });
    // Definitions written before the API's names were settled are read the same way.
    const old = { ...SRE, resources: { cpu: 0.5, memory_mib: 768, memory_limit_mib: 1536 } };
    expect(buildCreateRequest(old, 'r').resources).toMatchObject({ memory_mib: 768, memory_limit_mib: 1536 });
  });

  it('leaves path_prefix out for a base URL at the host root', () => {
    expect(modelRule({ ...SRE, model: { ...SRE.model, base_url: 'https://m.example/' } })).toEqual({
      host: 'm.example',
      methods: ['GET', 'POST'],
      credential: 'ddc-inference',
    });
  });
});

describe('runFiles', () => {
  it('writes agent.json, input.txt and the definition files under /workspace', () => {
    const files = runFiles(SRE, 'status?');
    expect(files.map((f) => f.path)).toEqual([
      '/workspace/agent.json',
      '/workspace/input.txt',
      '/workspace/notes/a.md',
      '/etc/x',
    ]);
    expect(JSON.parse(files[0].body)).toEqual(SRE);
    expect(files[1].body).toBe('status?');
  });
});

describe('parseEventLine and LineSplitter', () => {
  it('turns JSON lines with an event into events and keeps other lines raw', () => {
    expect(parseEventLine('{"event":"text","ts":1,"text":"hi"}')).toEqual({ event: 'text', ts: 1, text: 'hi' });
    expect(parseEventLine('plain')).toEqual({ event: 'raw', stream: 'stdout', text: 'plain' });
    expect(parseEventLine('{"no":"event"}')).toEqual({ event: 'raw', stream: 'stdout', text: '{"no":"event"}' });
  });
  it('splits chunks into whole lines', () => {
    const s = new LineSplitter();
    expect(s.push('a\nb')).toEqual(['a']);
    expect(s.push('c\r\nd')).toEqual(['bc']);
    expect(s.flush()).toEqual(['d']);
  });
});

describe('runAgent', () => {
  const output = JSON.stringify({ output: '# Status\nall good', turns: 3, tool_calls: 2, error: null });
  const stdout = [
    '{"event":"log","ts":1,"message":"agent sre"}',
    '{"event":"tool_call","ts":2,"tool":"Bash","input":{"command":"gh run list"},"id":"t1"}',
    '{"event":"tool_result","ts":3,"id":"t1","output":"ok","is_error":false}',
    '{"event":"done","ts":4,"turns":3,"tool_calls":2,"error":null,"model_usage":{}}',
  ];

  it('runs the six steps and terminates retaining the run files', async () => {
    const { client, log } = fakeClient({ stdout, output });
    const steps: RunStep[] = [];
    const events: RunEvent[] = [];
    const saved: { id: string; names: string[] }[] = [];
    const res = await runAgent({
      client,
      def: SRE,
      input: 'status?',
      runId: 'r1',
      sleep: async () => undefined,
      save: async (id, files) => {
        saved.push({ id, names: files.map((f) => f.name) });
        return files.map((f) => `cere/runs/${id}/${f.name}`);
      },
      progress: { step: (s) => steps.push(s), event: (e) => events.push(e) },
    });
    expect(res.error).toBeNull();
    expect(res.output?.output).toBe('# Status\nall good');
    expect(res.sandbox?.status).toBe('terminated');
    expect(steps).toEqual(['create', 'start', 'files', 'run', 'collect', 'save', 'terminate', 'done']);
    expect(log.exec).toEqual({
      command: ['ddc-agent-run', '/workspace/agent.json', '/workspace/input.txt'],
      timeout_s: 900,
      workdir: '/workspace',
    });
    expect(Object.keys(log.files)).toContain('/workspace/input.txt');
    expect(log.terminated).toEqual({ retain: RETAINED_FILES, reason: 'agent run succeeded' });
    expect(events.filter((e) => e.event !== 'raw').map((e) => e.event)).toEqual([
      'log',
      'tool_call',
      'tool_result',
      'done',
    ]);
    expect(events).toContainEqual({ event: 'raw', stream: 'stderr', text: 'a warning' });
    expect(saved).toEqual([{ id: 'sb-1', names: ['output.json', 'transcript.jsonl'] }]);
    expect(res.saved).toEqual(['cere/runs/sb-1/output.json', 'cere/runs/sb-1/transcript.jsonl']);
  });

  it('execs the definition command for a container and takes plain stdout as the output', async () => {
    const { client, log } = fakeClient({ stdout: ['the answer is 42'], output: null });
    const res = await runAgent({
      client,
      def: { ...SRE, harness: 'container', command: ['/app/entrypoint.sh', 'python', '/app/agent.py'] },
      input: 'q',
      sleep: async () => undefined,
    });
    expect(log.exec?.command).toEqual(['/app/entrypoint.sh', 'python', '/app/agent.py']);
    expect(res.output?.output).toBe('the answer is 42');
    expect(res.error).toBeNull();
  });

  it('terminates the sandbox when the run fails, and says why', async () => {
    const { client, log } = fakeClient({ stdout: [], output: null, exitCode: 1 });
    const res = await runAgent({ client, def: SRE, input: 'q', sleep: async () => undefined });
    expect(res.error).toMatch(/wrote no \/workspace\/output.json/);
    expect(log.terminated?.retain).toEqual(RETAINED_FILES);
    expect(log.terminated?.reason).toMatch(/^agent run failed: The agent wrote no \/workspace\/output.json\./);
  });

  it('records the agent’s own error as a failed run', async () => {
    const { client, log } = fakeClient({
      stdout: [],
      output: '{"output":"","turns":1,"error":"There\'s an issue with the selected model (glm-5.3)."}',
      exitCode: 1,
    });
    const res = await runAgent({ client, def: SRE, input: 'q', sleep: async () => undefined });
    expect(res.error).toBe("There's an issue with the selected model (glm-5.3).");
    expect(log.terminated?.reason).toBe("agent run failed: There's an issue with the selected model (glm-5.3).");
  });

  it('records a stopped run as stopped', async () => {
    const { client, log } = fakeClient({ stdout: [], output: null });
    const ctl = new AbortController();
    ctl.abort();
    const res = await runAgent({ client, def: SRE, input: 'q', sleep: async () => undefined, signal: ctl.signal });
    expect(res.error).toBe('Stopped.');
    expect(log.terminated?.reason).toBe('agent run stopped');
  });

  it('fails a run whose sandbox the node ended for memory, and says what to raise', async () => {
    const reclaimed = fakeClient({ stdout: [], output: null, exitCode: 137, endedWith: 'memory_reclaimed' });
    const r = await runAgent({ client: reclaimed.client, def: SRE, input: 'q', sleep: async () => undefined });
    expect(r.error).toMatch(/^The sandbox ended: Memory reclaimed: It used more memory than its request of 512 MiB/);
    expect(r.error).toContain('Raise the memory request');
    expect(r.sandbox?.exit_reason).toBe('memory_reclaimed');

    const oom = fakeClient({ stdout: [], output: null, exitCode: 137, endedWith: 'oom_killed' });
    const o = await runAgent({ client: oom.client, def: SRE, input: 'q', sleep: async () => undefined });
    expect(o.error).toMatch(/^The sandbox ended: Out of memory: It reached its memory limit of 2 GiB/);
  });

  it('reports a sandbox that failed to start, and still deletes it', async () => {
    const { client, log } = fakeClient({ stdout: [], startStatus: 'failed' });
    const res = await runAgent({ client, def: SRE, input: 'q', sleep: async () => undefined });
    expect(res.error).toBe('The sandbox failed before the run: failed: image pull x.');
    expect(log.exec).toBeUndefined();
    expect(log.terminated).toBeDefined();
  });
});
