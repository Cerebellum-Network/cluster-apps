/**
 * Run results for the Agents pages: from each run's sandbox (agentOutcome.ts),
 * and for runs whose client recorded no result, from the output.json the
 * sandbox kept. A kept file of an ended sandbox never changes, so each is read
 * once per page load.
 */
import { useEffect, useState } from 'react';

import { legacyOutcome, OUTPUT_PATH, outcomeOf, type RunOutcome } from './agentOutcome';
import { ComputeError, errorMessage } from './client';
import { useComputeClient } from './ComputeProvider';
import type { Sandbox } from './types';

/** sandbox id → the kept output.json's text, or null when it is gone. */
const keptOutputs = new Map<string, Promise<string | null>>();

function readKeptOutput(client: ReturnType<typeof useComputeClient>, id: string): Promise<string | null> {
  let p = keptOutputs.get(id);
  if (!p) {
    p = client
      .getFile(id, OUTPUT_PATH)
      .then((b) => b.text())
      .catch((e) => {
        keptOutputs.delete(id);
        if (e instanceof ComputeError && (e.status === 404 || e.status === 410)) return null;
        throw e;
      });
    keptOutputs.set(id, p);
  }
  return p;
}

/** Whether resolving `sb`'s result needs its kept output.json. */
const needsOutput = (sb: Sandbox) => {
  const o = outcomeOf(sb);
  return !!o.legacy && sb.retained.includes(OUTPUT_PATH);
};

/**
 * The result of each run's sandbox, by sandbox id. A run that needs its
 * output.json read shows as unknown ("Reading its output…") until it is.
 */
export function useRunOutcomes(sandboxes: Sandbox[]): Map<string, RunOutcome> {
  const client = useComputeClient();
  const [read, setRead] = useState<Map<string, RunOutcome>>(new Map());
  const pending = sandboxes.filter((s) => needsOutput(s) && !read.has(s.id));
  const pendingKey = pending.map((s) => s.id).join(',');

  useEffect(() => {
    if (!pending.length) return undefined;
    let alive = true;
    for (const sb of pending) {
      readKeptOutput(client, sb.id)
        .then((text) => legacyOutcome(sb, text))
        .catch((e): RunOutcome => ({ state: 'unknown', detail: `Couldn’t read its output.json: ${errorMessage(e)}` }))
        .then((o) => {
          if (alive) setRead((m) => new Map(m).set(sb.id, o));
        });
    }
    return () => {
      alive = false;
    };
    // pendingKey names the sandboxes still to read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, pendingKey]);

  const out = new Map<string, RunOutcome>();
  for (const sb of sandboxes) {
    const o = outcomeOf(sb);
    if (!o.legacy) out.set(sb.id, o);
    else if (!sb.retained.includes(OUTPUT_PATH)) out.set(sb.id, legacyOutcome(sb, null));
    else out.set(sb.id, read.get(sb.id) ?? { state: 'unknown', detail: 'Reading its output…' });
  }
  return out;
}
