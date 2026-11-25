import { observer } from 'mobx-react-lite';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@cluster-apps/ui';
import { NavLink, useNavigate } from 'react-router-dom';

import { Pill } from '~/components';
import type { RunOutcome } from '~/compute/agentOutcome';
import { LABEL } from '~/compute/agentRun';
import { agentRuns, type LiveRun } from '~/compute/agentRuns';
import { useNow } from '~/compute/hooks';
import { fmtAgo, fmtDuration, shortId } from '~/compute/format';
import { useRunOutcomes } from '~/compute/runOutcomes';
import { isLive, type Sandbox } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import BilledUsage, { billedHeader } from '../../Sandboxes/components/BilledUsage';
import { RunOutcomeLabel } from './RunOutcome';

export interface RunRow {
  runId: string;
  agent: string;
  harness: string;
  startedAt: number;
  endedAt: number | null;
  sandbox: Sandbox | null;
  /** Driven by this tab right now. */
  live: LiveRun | null;
}

/**
 * Runs = the sandboxes labelled `cere.kind=agent-run`, from any client, plus
 * the runs this tab has started whose sandbox isn't listed yet.
 */
export function runRows(sandboxes: Sandbox[], live: LiveRun[]): RunRow[] {
  const rows = new Map<string, RunRow>();
  for (const s of sandboxes) {
    const runId = s.labels[LABEL.run] || s.id;
    rows.set(runId, {
      runId,
      agent: s.labels[LABEL.agent] ?? '—',
      harness: s.labels[LABEL.harness] ?? '—',
      startedAt: Date.parse(s.created_at),
      endedAt: s.ended_at ? Date.parse(s.ended_at) : null,
      sandbox: s,
      live: null,
    });
  }
  for (const r of live) {
    const row = rows.get(r.runId);
    if (row) {
      row.live = r;
      // This tab terminated it: its final state is newer than the last listing.
      if (r.sandbox && !isLive(r.sandbox.status)) row.sandbox = r.sandbox;
    } else
      rows.set(r.runId, {
        runId: r.runId,
        agent: r.def.name,
        harness: r.def.harness,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        sandbox: r.sandbox,
        live: r,
      });
  }
  return [...rows.values()].sort((a, b) => b.startedAt - a.startedAt);
}

/** A row's result: the live run's while this tab drives it, else what its sandbox records. */
export function rowOutcome(r: RunRow, outcomes: Map<string, RunOutcome>): RunOutcome {
  if (r.live && !r.live.endedAt) return { state: 'running' };
  const recorded = r.sandbox ? outcomes.get(r.sandbox.id) : undefined;
  if (recorded) return recorded;
  if (r.live?.result?.error) return { state: 'failed', detail: r.live.result.error };
  return { state: 'running', detail: 'creating…' };
}

const RunsTable = ({ rows, showAgent = true, empty }: { rows: RunRow[]; showAgent?: boolean; empty?: string }) => {
  const now = useNow(1000);
  const navigate = useNavigate();
  const outcomes = useRunOutcomes(rows.flatMap((r) => (r.sandbox ? [r.sandbox] : [])));
  return (
    <TableContainer sx={{ '& td': { whiteSpace: 'nowrap' } }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Run</TableCell>
            {showAgent && <TableCell>Agent</TableCell>}
            <TableCell>Result</TableCell>
            <TableCell>Started</TableCell>
            <TableCell>Took</TableCell>
            <TableCell>Sandbox</TableCell>
            <TableCell align="right">{billedHeader(rows.flatMap((r) => (r.sandbox ? [r.sandbox] : [])))}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => {
            const end = r.sandbox?.ended_at ? Date.parse(r.sandbox.ended_at) : (r.endedAt ?? now);
            return (
              <TableRow
                key={r.runId}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/agents/runs/${r.runId}`)}
              >
                <TableCell>
                  <Box component="span" sx={{ fontFamily: mono, fontSize: 13, fontWeight: 600 }}>
                    {shortId(r.runId)}
                  </Box>
                  {r.live && !r.live.endedAt && (
                    <Box component="span" marginLeft="8px">
                      <Pill tone="primary">this tab</Pill>
                    </Box>
                  )}
                </TableCell>
                {showAgent && (
                  <TableCell>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{r.agent}</Typography>
                    <Typography sx={text.caption}>{r.harness}</Typography>
                  </TableCell>
                )}
                <TableCell sx={{ whiteSpace: 'normal !important' }}>
                  <RunOutcomeLabel outcome={rowOutcome(r, outcomes)} />
                </TableCell>
                <TableCell sx={{ color: color.textSecondary }}>
                  {fmtAgo(new Date(r.startedAt).toISOString(), now)}
                </TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtDuration((end - r.startedAt) / 1000)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {r.sandbox ? (
                    <Box
                      component={NavLink}
                      to={`/sandboxes/list/${r.sandbox.id}`}
                      sx={{
                        fontFamily: mono,
                        fontSize: 12.5,
                        color: color.primary,
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {shortId(r.sandbox.id)}
                    </Box>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {r.sandbox ? <BilledUsage sandbox={r.sandbox} /> : '—'}
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} sx={{ textAlign: 'center', padding: '28px' }}>
                <Typography sx={text.secondary}>{empty ?? 'No runs yet.'}</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default observer(RunsTable);

/** The runs this tab is driving. Read it inside an observer component. */
export const liveRuns = (): LiveRun[] => [...agentRuns.runs.values()];
