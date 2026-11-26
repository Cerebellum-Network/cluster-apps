/**
 * One agent run, the way the CLI and the SDK do it (build design 3.9, with the
 * 24 Nov clarification that both harnesses start as `sleep infinity` and exec
 * their command, see status/contract-changes.md):
 *
 *   1. create the sandbox: the definition's image, egress rules plus one rule
 *      for the model host with the model's credential, `cere.*` labels and the
 *      model environment; wait until it runs;
 *   2. write /workspace/agent.json, /workspace/input.txt and the definition's files;
 *   3. exec the runner (`claude-code`) or the definition's command (`container`)
 *      with streaming, and turn its stdout JSON lines into events;
 *   4. read /workspace/output.json;
 *   5. terminate, retaining the run's files, with a reason that records the
 *      run's result on the sandbox (agentOutcome.ts);
 *   6. copy output.json and transcript.jsonl to the bucket, when the caller can.
 *
 * Everything goes through the public compute API with the caller's token;
 * nothing here is simulated.
 */
import { AGENT_DEFAULT_RESOURCES, type AgentDefinition } from './agentDefinition';
import { OUT_OF_BALANCE, terminateReason, withoutFiles } from './agentOutcome';
import { ComputeError, errorMessage, isNoBalance, type ComputeClient } from './client';
import { exitReasonSentence, memoryEnding } from './exitReasons';
import { effectiveOf } from './resources';
import {
  EXIT_INSUFFICIENT_BALANCE,
  type CreateSandboxRequest,
  type EgressRule,
  type ExecExit,
  type Resources,
  type Sandbox,
} from './types';
import { ulid } from './ulid';

export const RUNNER_COMMAND = ['ddc-agent-run', '/workspace/agent.json', '/workspace/input.txt'];
export const RETAINED_FILES = [
  '/workspace/output.json',
  '/workspace/output.md',
  '/workspace/transcript.jsonl',
  '/workspace/agent.json',
  '/workspace/input.txt',
];
export const DEFAULT_AGENT_TIMEOUT_S = 900;
/** The sandbox outlives the exec by this much, so the output can be read and retained after it. */
export const SANDBOX_HEADROOM_S = 120;
export const MODEL_KEY_PLACEHOLDER = 'placeholder-egress-proxy-injects';
/** A run the API refused (create, file upload or exec) because the bucket's owner has no balance. */
export const REFUSED_FOR_BALANCE = 'The bucket is out of balance: top up in Billing, then run the agent again.';

/** Labels the agent layer puts on a run's sandbox. */
export const LABEL = {
  kind: 'cere.kind',
  agent: 'cere.agent',
  harness: 'cere.harness',
  run: 'cere.run',
} as const;
export const AGENT_RUN_KIND = 'agent-run';

/** The runner's events (one JSON object per stdout line, `event` names it). */
export type RunEvent =
  | { event: 'log'; message: string; stream?: string; ts?: number }
  | { event: 'text'; text: string; ts?: number }
  | { event: 'tool_call'; tool: string; input: unknown; id: string; ts?: number }
  | { event: 'tool_result'; id: string; output: string; is_error: boolean; ts?: number }
  | { event: 'denied'; tool: string; input: unknown; reason: string; id?: string; ts?: number }
  | { event: 'output'; output: string; ts?: number }
  | {
      event: 'done';
      turns: number;
      tool_calls: number;
      error: string | null;
      model_usage: Record<string, unknown>;
      ts?: number;
    }
  /** A stdout line that is not an event, or a stderr line. */
  | { event: 'raw'; stream: 'stdout' | 'stderr'; text: string };

/** What the runner (or a container following the contract) writes to /workspace/output.json. */
export interface RunOutput {
  output: string;
  turns?: number;
  tool_calls?: number;
  denied?: number;
  model_usage?: Record<string, unknown>;
  error?: string | null;
  duration_s?: number;
  harness?: string;
  harness_version?: string;
}

export type RunStep = 'create' | 'start' | 'files' | 'run' | 'collect' | 'terminate' | 'save' | 'done';

export interface RunProgress {
  step?: (step: RunStep) => void;
  sandbox?: (sb: Sandbox) => void;
  event?: (e: RunEvent) => void;
}

export interface RunResult {
  runId: string;
  sandbox: Sandbox | null;
  output: RunOutput | null;
  exit: ExecExit | null;
  /** The first thing that went wrong, in words; null for a clean run. */
  error: string | null;
  /** Bucket keys written in step 6. */
  saved: string[];
}

export interface RunOptions {
  client: ComputeClient;
  def: AgentDefinition;
  input: string;
  runId?: string;
  /** Leave the sandbox running after the run (no step 5). */
  keep?: boolean;
  /** Step 6: copy files to the bucket; returns the keys written. */
  save?: (sandboxId: string, files: { name: string; body: string }[]) => Promise<string[]>;
  progress?: RunProgress;
  signal?: AbortSignal;
  /** How often to look at a starting sandbox, and for how long. */
  pollMs?: number;
  startTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** The model host as an egress rule: GET and POST under the base URL's path, with the model's credential (as the CLI adds it). */
export function modelRule(def: AgentDefinition): EgressRule {
  const u = new URL(def.model.base_url);
  const path = u.pathname.replace(/\/+$/, '');
  return {
    host: u.hostname,
    methods: ['GET', 'POST'],
    ...(path ? { path_prefix: path } : {}),
    ...(def.model.credential ? { credential: def.model.credential } : {}),
  };
}

/** The run's time limit: the definition's `timeout_s` (no upper cap), or 900 s when it leaves it out or says 0. */
export function agentTimeout(def: AgentDefinition): number {
  return Math.max(1, Math.round(def.timeout_s || DEFAULT_AGENT_TIMEOUT_S));
}

/**
 * The run's resources: CPU and memory as the definition sets them, else the agent layer's defaults (0.5 vCPU,
 * 512 MiB, up to 2 vCPU and 2048 MiB), always with both limits, so a run never depends on the sandbox API's defaults;
 * `disk` and `pids` only when the definition sets them (else the sandbox API's).
 */
export function runResources(
  def: AgentDefinition,
): Required<Pick<Resources, 'cpu' | 'memory' | 'cpu_limit' | 'memory_limit'>> & Pick<Resources, 'disk' | 'pids'> {
  const e = effectiveOf(def.resources, AGENT_DEFAULT_RESOURCES);
  return {
    cpu: e.cpu,
    memory: e.memoryMib,
    cpu_limit: e.cpuLimit ?? AGENT_DEFAULT_RESOURCES.cpuLimit,
    memory_limit: e.memoryLimitMib,
    ...(def.resources?.disk ? { disk: def.resources.disk } : {}),
    ...(def.resources?.pids ? { pids: def.resources.pids } : {}),
  };
}

/** Step 1's request, from the definition alone. */
export function buildCreateRequest(def: AgentDefinition, runId: string): CreateSandboxRequest {
  return {
    image: def.image,
    command: ['sleep', 'infinity'],
    runtime: 'gvisor',
    workdir: '/workspace',
    resources: runResources(def),
    timeout_s: agentTimeout(def) + SANDBOX_HEADROOM_S,
    idle_timeout_s: 0,
    env: {
      ANTHROPIC_BASE_URL: def.model.base_url,
      ANTHROPIC_API_KEY: MODEL_KEY_PLACEHOLDER,
      DDC_MODEL: def.model.model,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
      DISABLE_AUTOUPDATER: '1',
    },
    egress: { allow: [...(def.egress?.allow ?? []), modelRule(def)] },
    labels: {
      [LABEL.kind]: AGENT_RUN_KIND,
      [LABEL.agent]: def.name,
      [LABEL.harness]: def.harness,
      [LABEL.run]: runId,
    },
  };
}

/** The command step 3 runs. */
export function runCommand(def: AgentDefinition): string[] {
  return def.harness === 'container' ? [...(def.command ?? [])] : [...RUNNER_COMMAND];
}

/** Step 2's files: absolute paths; relative ones in `files` go under /workspace. */
export function runFiles(def: AgentDefinition, input: string): { path: string; body: string }[] {
  const files = [
    { path: '/workspace/agent.json', body: `${JSON.stringify(def, null, 2)}\n` },
    { path: '/workspace/input.txt', body: input },
  ];
  for (const [p, body] of Object.entries(def.files ?? {})) {
    files.push({ path: p.startsWith('/') ? p : `/workspace/${p.replace(/^\.\//, '')}`, body });
  }
  return files;
}

/** One stdout line → an event: a JSON object with `event`, else the raw line. */
export function parseEventLine(line: string): RunEvent {
  const t = line.trim();
  if (t.startsWith('{')) {
    try {
      const o = JSON.parse(t) as { event?: unknown };
      if (o && typeof o.event === 'string' && o.event) return o as RunEvent;
    } catch {
      /* not JSON: a plain line */
    }
  }
  return { event: 'raw', stream: 'stdout', text: line };
}

/** Splits a stream of chunks into whole lines; `flush` returns the tail. */
export class LineSplitter {
  private buf = '';
  push(chunk: string): string[] {
    this.buf += chunk;
    const parts = this.buf.split('\n');
    this.buf = parts.pop() ?? '';
    return parts.map((l) => l.replace(/\r$/, ''));
  }
  flush(): string[] {
    const rest = this.buf;
    this.buf = '';
    return rest ? [rest] : [];
  }
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const aborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('The run was stopped.', 'AbortError');
};

export async function runAgent(opts: RunOptions): Promise<RunResult> {
  const { client, def, input, keep, save, progress = {}, signal } = opts;
  const sleep = opts.sleep ?? defaultSleep;
  const pollMs = opts.pollMs ?? 1000;
  const startTimeoutMs = opts.startTimeoutMs ?? 10 * 60 * 1000;
  const runId = opts.runId ?? ulid();
  const result: RunResult = { runId, sandbox: null, output: null, exit: null, error: null, saved: [] };
  const step = (s: RunStep) => progress.step?.(s);
  const setSandbox = (sb: Sandbox) => {
    result.sandbox = sb;
    progress.sandbox?.(sb);
  };
  const stdoutLines: string[] = [];
  const stderrTail: string[] = [];
  let created: Sandbox | null = null;
  let stopped = false;

  try {
    // 1. Create and wait for it to run.
    step('create');
    created = await client.createSandbox(buildCreateRequest(def, runId), signal);
    setSandbox(created);
    step('start');
    let sb = created;
    const deadline = Date.now() + startTimeoutMs;
    while (sb.status === 'starting') {
      aborted(signal);
      if (Date.now() > deadline) throw new Error('The sandbox did not start in time.');
      await sleep(pollMs);
      sb = await client.getSandbox(sb.id, signal);
      setSandbox(sb);
    }
    if (sb.status !== 'running') {
      throw new Error(
        `The sandbox ${sb.status === 'failed' ? 'failed' : 'stopped'} before the run: ${
          sb.exit_reason ? exitReasonSentence(sb.exit_reason, sb) : sb.status
        }`.replace(/([^.])$/, '$1.'),
      );
    }

    // 2. Files.
    step('files');
    for (const f of runFiles(def, input)) {
      aborted(signal);
      await client.putFile(sb.id, f.path, f.body, signal);
    }

    // 3. Run, streaming.
    step('run');
    const lines = new LineSplitter();
    const errLines = new LineSplitter();
    const emitLine = (line: string) => {
      const e = parseEventLine(line);
      if (e.event === 'raw' && line.trim()) stdoutLines.push(line);
      if (e.event !== 'raw' || line.trim()) progress.event?.(e);
    };
    const emitErr = (line: string) => {
      stderrTail.push(line);
      if (stderrTail.length > 20) stderrTail.shift();
      progress.event?.({ event: 'raw', stream: 'stderr', text: line });
    };
    result.exit = await client.execStream(
      sb.id,
      { command: runCommand(def), timeout_s: agentTimeout(def), workdir: '/workspace' },
      (e) => {
        if (e.type === 'stdout') lines.push(e.data).forEach(emitLine);
        else if (e.type === 'stderr') errLines.push(e.data).forEach(emitErr);
      },
      signal,
    );
    lines.flush().forEach(emitLine);
    errLines.flush().forEach(emitErr);

    // 4. The output.
    step('collect');
    result.output = await readOutput(client, sb.id, signal);
    if (!result.output && stdoutLines.length) result.output = { output: stdoutLines.join('\n') };
    if (!result.output)
      result.error = `The agent wrote no /workspace/output.json. ${stderrTail.slice(-3).join(' | ')}`.trim();
    else if (result.output.error) result.error = result.output.error;
    else if (result.exit.timed_out) result.error = `The run hit its ${agentTimeout(def)} s limit.`;
    else if (result.exit.exit_code !== 0)
      result.error = `The agent exited with code ${result.exit.exit_code}. ${stderrTail.slice(-3).join(' | ')}`.trim();

    // 6 (read before 5, while the sandbox runs): copy to the bucket.
    if (save) {
      step('save');
      const files: { name: string; body: string }[] = [];
      for (const name of ['output.json', 'transcript.jsonl']) {
        const body = await readText(client, sb.id, `/workspace/${name}`, signal);
        if (body !== null) files.push({ name, body });
      }
      if (files.length) {
        try {
          result.saved = await save(sb.id, files);
        } catch (e) {
          progress.event?.({
            event: 'raw',
            stream: 'stderr',
            text: `Couldn’t copy the run to the bucket: ${errorMessage(e)}`,
          });
        }
      }
    }
  } catch (e) {
    stopped = e instanceof DOMException && e.name === 'AbortError';
    result.error = stopped ? 'Stopped.' : isNoBalance(e) ? REFUSED_FOR_BALANCE : errorMessage(e);
  }

  // 5. Terminate, keeping the run's files. Always, unless asked to keep it:
  // a run never leaves a sandbox behind because something above failed. The
  // reason records the run's result, where every client reads it.
  if (created && !keep) {
    step('terminate');
    const final = await terminateRetaining(client, created.id, terminateReason({ stopped, error: result.error }));
    if (final) setSandbox(final);
    else if (!result.error) result.error = 'Couldn’t terminate the sandbox; it stops at its timeout.';
    // The node ended the sandbox under the run (out of memory, memory reclaimed): that is the run's failure, whatever
    // the exec or the output said after it, and it says what to raise.
    if (final && !stopped && memoryEnding(final.exit_reason))
      result.error = `The sandbox ended: ${exitReasonSentence(final.exit_reason ?? '', final)}`;
    // The node stopped it because the bucket ran out of balance: a top-up, not a fix, is what the run needs.
    if (final && !stopped && final.exit_reason === EXIT_INSUFFICIENT_BALANCE) result.error = OUT_OF_BALANCE;
  }
  step('done');
  return result;
}

/** DELETE with `retain=`; if the node refuses the retaining delete, a plain one, so nothing is left running. */
export async function terminateRetaining(client: ComputeClient, id: string, reason: string): Promise<Sandbox | null> {
  try {
    return await client.terminate(id, { retain: RETAINED_FILES, reason });
  } catch (e) {
    if (e instanceof ComputeError && e.status >= 400 && e.status < 500 && e.status !== 404) {
      try {
        return await client.terminate(id, { reason: withoutFiles(reason) });
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function readText(client: ComputeClient, id: string, path: string, signal?: AbortSignal): Promise<string | null> {
  try {
    return await (await client.getFile(id, path, signal)).text();
  } catch (e) {
    if (e instanceof ComputeError && (e.status === 404 || e.status === 410)) return null;
    throw e;
  }
}

export async function readOutput(client: ComputeClient, id: string, signal?: AbortSignal): Promise<RunOutput | null> {
  const text = await readText(client, id, '/workspace/output.json', signal);
  return text === null ? null : parseRunOutput(text);
}

export function parseRunOutput(text: string): RunOutput | null {
  try {
    const o = JSON.parse(text) as Partial<RunOutput>;
    if (!o || typeof o !== 'object') return null;
    return { ...o, output: typeof o.output === 'string' ? o.output : '' };
  } catch {
    return null;
  }
}
