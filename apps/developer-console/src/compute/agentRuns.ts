/**
 * Agent runs this browser tab is driving. A run is client-driven (Section 6 of
 * the build design): it lasts as long as this tab drives it, so the registry
 * keeps it streaming while the user moves between pages. Runs started
 * elsewhere (the CLI, the SDK, another tab) are read from their sandbox and
 * its files instead; see the Agents pages.
 */
import { makeAutoObservable, observable, runInAction } from 'mobx';

import type { AgentDefinition } from './agentDefinition';
import { runAgent, type RunEvent, type RunResult, type RunStep } from './agentRun';
import type { ComputeClient } from './client';
import type { Sandbox } from './types';
import { ulid } from './ulid';

const MAX_EVENTS = 5000;

export interface LiveRun {
  runId: string;
  def: AgentDefinition;
  /** The S3-gateway bucket the definition came from, where step 6 copies the run. */
  bucket: string | null;
  input: string;
  startedAt: number;
  endedAt: number | null;
  step: RunStep;
  sandbox: Sandbox | null;
  events: RunEvent[];
  result: RunResult | null;
}

export class AgentRunsStore {
  readonly runs = observable.map<string, LiveRun>([], { deep: true });
  private controllers = new Map<string, AbortController>();

  constructor() {
    makeAutoObservable<AgentRunsStore, 'controllers'>(this, { controllers: false });
  }

  get(runId: string): LiveRun | undefined {
    return this.runs.get(runId);
  }

  bySandbox(sandboxId: string): LiveRun | undefined {
    for (const r of this.runs.values()) if (r.sandbox?.id === sandboxId) return r;
    return undefined;
  }

  get active(): LiveRun[] {
    return [...this.runs.values()].filter((r) => !r.endedAt);
  }

  /** Start a run in the background; returns its id at once. */
  start(opts: {
    client: ComputeClient;
    def: AgentDefinition;
    input: string;
    bucket: string | null;
    save?: (sandboxId: string, files: { name: string; body: string }[]) => Promise<string[]>;
  }): string {
    const runId = ulid();
    const ctl = new AbortController();
    this.controllers.set(runId, ctl);
    this.runs.set(runId, {
      runId,
      def: opts.def,
      bucket: opts.bucket,
      input: opts.input,
      startedAt: Date.now(),
      endedAt: null,
      step: 'create',
      sandbox: null,
      events: [],
      result: null,
    });
    const run = () => this.runs.get(runId)!;
    void runAgent({
      client: opts.client,
      def: opts.def,
      input: opts.input,
      runId,
      save: opts.save,
      signal: ctl.signal,
      progress: {
        step: (s) => runInAction(() => (run().step = s)),
        sandbox: (sb) => runInAction(() => (run().sandbox = sb)),
        event: (e) =>
          runInAction(() => {
            const evs = run().events;
            if (evs.length >= MAX_EVENTS) evs.splice(0, evs.length - MAX_EVENTS + 1);
            evs.push(e);
          }),
      },
    }).then((result) =>
      runInAction(() => {
        const r = run();
        r.result = result;
        r.sandbox = result.sandbox ?? r.sandbox;
        r.endedAt = Date.now();
        this.controllers.delete(runId);
      }),
    );
    return runId;
  }

  /** Stop a run: the stream is cut and its sandbox terminated (keeping what it wrote). */
  stop(runId: string): void {
    this.controllers.get(runId)?.abort();
  }
}

export const agentRuns = new AgentRunsStore();
