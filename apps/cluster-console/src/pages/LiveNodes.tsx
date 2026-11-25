import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { IconButton, Tooltip } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { KeyboardArrowDown, KeyboardArrowRight } from '@mui/icons-material';

import type { LiveNode, LiveSandbox } from '~/api/types';
import { SERIES } from '~/components/charts';
import { color, hairline, Status, text } from '~/components/ui';
import { gibTime, mib, num, plural, vcpuTime } from '~/format';

/** A machine's whole CPU and memory, from node metrics, when known. */
export interface MachineTotal {
  cpu: number | null;
  memoryMiB: number | null;
}

/** The reserved, not-used part of a block: a light step of slot 1. */
const RESERVED = '#D3C8F3';
const QUOTA = color.primaryTint;

const arrive = keyframes`
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
`;
const glow = keyframes`
  0% { box-shadow: 0 0 0 3px rgba(91, 43, 201, 0.45); }
  100% { box-shadow: 0 0 0 3px rgba(91, 43, 201, 0); }
`;
const leave = keyframes`
  to { opacity: 0; transform: scale(0.92); }
`;

const ARRIVAL_MS = 2500;
const LEAVE_MS = 600;

type Shown = LiveSandbox & { phase: 'here' | 'new' | 'leaving' };

/**
 * Keeps the order stable and says what just changed: a sandbox seen for the
 * first time (after the first read) is "new" for a moment; one that went is
 * kept a moment longer as "leaving", so nothing jumps.
 */
function useArrivals(nodes: LiveNode[] | undefined): Map<string, Shown[]> {
  const seen = useRef<Map<string, number> | null>(null);
  const last = useRef<Map<string, LiveSandbox[]>>(new Map());
  const [leaving, setLeaving] = useState<Map<string, { s: LiveSandbox; until: number }>>(new Map());
  const [, setTick] = useState(0);

  const now = Date.now();
  if (nodes && seen.current === null) {
    // The first read: what is already there is not "new".
    seen.current = new Map(nodes.flatMap((n) => n.sandboxes.map((s) => [s.id, 0] as [string, number])));
  }
  if (nodes && seen.current) {
    for (const n of nodes) for (const s of n.sandboxes) if (!seen.current.has(s.id)) seen.current.set(s.id, now);
  }

  useEffect(() => {
    if (!nodes || !seen.current) return;
    const ids = new Set(nodes.flatMap((n) => n.sandboxes.map((s) => s.id)));
    const gone = new Map(leaving);
    for (const [node, list] of last.current) {
      for (const s of list)
        if (!ids.has(s.id) && !gone.has(s.id)) gone.set(s.id, { s: { ...s, node }, until: Date.now() + LEAVE_MS });
    }
    last.current = new Map(nodes.map((n) => [n.id, n.sandboxes]));
    if (gone.size !== leaving.size) setLeaving(gone);
    const t = setTimeout(
      () => {
        setLeaving((m) => new Map([...m].filter(([, v]) => v.until > Date.now())));
        setTick((x) => x + 1);
      },
      Math.max(LEAVE_MS, 400),
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  return useMemo(() => {
    const out = new Map<string, Shown[]>();
    for (const n of nodes ?? []) {
      const list: Shown[] = n.sandboxes.map((s) => {
        const first = seen.current?.get(s.id) ?? 0;
        return { ...s, phase: first && now - first < ARRIVAL_MS ? 'new' : 'here' };
      });
      for (const { s } of leaving.values()) if (s.node === n.id) list.push({ ...s, phase: 'leaving' });
      list.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      out.set(n.id, list);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, leaving, now - (now % 500)]);
}

const tail = (id: string) => `…${id.slice(-5)}`;
const share = (a: number | null | undefined, b: number) => (a != null && b > 0 ? Math.min(1, a / b) : 0);

function blockTitle(s: LiveSandbox): string {
  const parts = [
    `${s.id} · bucket ${s.bucket} · ${s.image}`,
    `reserved ${num(s.resources.cpu, 2)} vCPU · ${mib(s.resources.memory_mib)}`,
    s.live
      ? `using ${num(s.live.cpu, 2)} vCPU · ${mib(s.live.memory_mib)}${s.live.memory_peak_mib ? ` (peak ${mib(s.live.memory_peak_mib)})` : ''} · ${s.live.source === 'node metrics' ? 'node metrics, last minute' : 'usage record, last minute'}`
      : s.status === 'starting'
        ? 'starting'
        : 'no minute recorded yet',
  ];
  if (s.billed_cpu_s != null)
    parts.push(
      `billed so far ${vcpuTime(s.billed_cpu_s)}${s.billed_ram_gib_s != null ? ` · ${gibTime(s.billed_ram_gib_s)}` : ''}`,
    );
  return parts.join('\n');
}

const motion = (phase: Shown['phase']) =>
  phase === 'new'
    ? { animation: `${arrive} 160ms ease-out, ${glow} ${ARRIVAL_MS}ms ease-out` }
    : phase === 'leaving'
      ? { animation: `${leave} ${LEAVE_MS}ms ease-in forwards`, pointerEvents: 'none' as const }
      : {};

/**
 * One resource of a node as a lane: the machine's total (when known) is the
 * track, the sandbox quota a lighter band with an edge mark, and each
 * sandbox a segment sized by its reservation, filled by what it used in its
 * latest minute.
 */
function Lane({
  label,
  unit,
  total,
  quota,
  list,
  reserve,
  used,
  format,
  onOpen,
  fill,
}: {
  label: string;
  fill: string;
  unit: string;
  total: number | null;
  quota: number | null;
  list: Shown[];
  reserve: (s: LiveSandbox) => number;
  used: (s: LiveSandbox) => number | null;
  format: (v: number) => string;
  onOpen: (s: LiveSandbox) => void;
}) {
  const span = total ?? quota ?? 0;
  const reserved = list.filter((s) => s.phase !== 'leaving').reduce((a, s) => a + reserve(s), 0);
  const pct = (v: number) => (span > 0 ? `${(100 * v) / span}%` : '0%');
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
        <Typography sx={{ ...text.caption, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ ...text.caption, fontVariantNumeric: 'tabular-nums' }}>
          <b style={{ color: color.text }}>{format(reserved)}</b>
          {quota != null
            ? ` of ${format(quota)} ${unit} quota reserved (${Math.round((100 * reserved) / (quota || 1))}%)`
            : ` ${unit} reserved · quota not reported`}
          {total != null ? ` · machine ${format(total)} ${unit}` : ''}
        </Typography>
      </Stack>
      <Box
        sx={{
          position: 'relative',
          height: 12,
          marginTop: '5px',
          borderRadius: '3px',
          backgroundColor: total != null ? color.grid : 'transparent',
        }}
      >
        {quota != null && (
          <Box
            title={`Sandbox quota ${format(quota)} ${unit}`}
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: pct(quota),
              backgroundColor: QUOTA,
              borderRadius: '3px 0 0 3px',
              // The quota's edge is marked only when it sits inside a known machine total.
              boxShadow: total != null && quota < total ? `inset -2px 0 0 ${color.primary}` : 'none',
            }}
          />
        )}
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex' }}>
          {list.map((s) => {
            const r = reserve(s);
            const u = used(s);
            return (
              <Tooltip key={s.id} title={<span style={{ whiteSpace: 'pre-line' }}>{blockTitle(s)}</span>}>
                <Box
                  component="button"
                  onClick={() => onOpen(s)}
                  aria-label={`${s.id}: reserved ${format(r)} ${unit}${u != null ? `, used ${format(u)}` : ''}`}
                  sx={{
                    position: 'relative',
                    width: pct(r),
                    flexShrink: 0,
                    padding: 0,
                    border: 0,
                    borderRight: `2px solid ${color.surface}`,
                    backgroundColor: s.status === 'starting' ? 'transparent' : RESERVED,
                    outline: s.status === 'starting' ? `1px dashed ${SERIES.one}` : 'none',
                    outlineOffset: '-1px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    ...motion(s.phase),
                    '&:hover, &:focus-visible': { filter: 'brightness(0.93)' },
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${100 * share(u, r)}%`,
                      backgroundColor: fill,
                    }}
                  />
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

/** A sandbox as a labelled block, sized by its CPU reservation within the quota. */
function Block({ s, quotaCpu, onOpen }: { s: Shown; quotaCpu: number; onOpen: (s: LiveSandbox) => void }) {
  const widthPct = quotaCpu > 0 ? (100 * s.resources.cpu) / quotaCpu : 0;
  const cpuShare = share(s.live?.cpu, s.resources.cpu);
  const memShare = share(s.live?.memory_mib, s.resources.memory_mib);
  return (
    <Box
      component="button"
      onClick={() => onOpen(s)}
      title={blockTitle(s)}
      sx={{
        flex: `0 0 calc(${widthPct}% - 4px)`,
        minWidth: 0,
        height: 88,
        margin: '0 4px 0 0',
        padding: '7px 8px',
        textAlign: 'left',
        border: s.status === 'starting' ? `1px dashed ${SERIES.one}` : `1px solid ${RESERVED}`,
        borderRadius: '6px',
        backgroundColor: s.status === 'starting' ? color.surface : '#F3F0FC',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        font: 'inherit',
        ...motion(s.phase),
        '&:hover': { borderColor: SERIES.one },
        '&:focus-visible': { outline: `2px solid ${color.primary}`, outlineOffset: '1px' },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700, lineHeight: '16px', color: color.text }}>
          {s.status === 'starting' ? 'Starting' : tail(s.id)}
        </Typography>
        <Typography noWrap sx={{ fontSize: 11.5, lineHeight: '15px', color: color.textSecondary }}>
          {s.bucket} · {num(s.resources.cpu, 2)} vCPU · {mib(s.resources.memory_mib)}
        </Typography>
        {s.billed_cpu_s != null && (
          <Typography noWrap sx={{ fontSize: 11.5, lineHeight: '15px', color: color.textSecondary }}>
            billed {vcpuTime(s.billed_cpu_s)}
          </Typography>
        )}
      </Box>
      <Stack spacing="3px">
        {[
          [cpuShare, SERIES.one, 'vCPU'],
          [memShare, SERIES.measured, 'memory'],
        ].map(([v, c, l]) => (
          <Box
            key={l as string}
            aria-hidden
            sx={{ height: 4, borderRadius: '2px', backgroundColor: RESERVED, overflow: 'hidden' }}
          >
            <Box
              sx={{
                height: '100%',
                width: `${100 * (v as number)}%`,
                minWidth: (v as number) > 0 ? 2 : 0,
                backgroundColor: c as string,
              }}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function NodeRow({
  node,
  list,
  machine,
  onOpen,
  open,
  onToggle,
}: {
  node: LiveNode;
  list: Shown[];
  machine?: MachineTotal;
  onOpen: (s: LiveSandbox) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const running = list.filter((s) => s.phase !== 'leaving' && s.status === 'running').length;
  const starting = list.filter((s) => s.phase !== 'leaving' && s.status === 'starting').length;
  const quotaCpu = node.allocatable?.cpu ?? null;
  const quotaMem = node.allocatable?.memory_mib ?? null;
  const health =
    node.healthy == null ? (
      <Status tone="neutral">No report</Status>
    ) : node.healthy ? (
      <Status tone="success">Healthy</Status>
    ) : (
      <Status tone="danger">Not healthy</Status>
    );
  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        borderTop: hairline,
        padding: '14px 22px 16px',
        '&:first-of-type': { borderTop: 'none' },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ marginBottom: 1.25 }}>
        <IconButton
          size="small"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? 'Collapse' : 'Expand'}
          sx={{ marginLeft: '-8px' }}
        >
          {open ? <KeyboardArrowDown sx={{ fontSize: 18 }} /> : <KeyboardArrowRight sx={{ fontSize: 18 }} />}
        </IconButton>
        <Typography sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {node.host || node.id.slice(0, 12)}
        </Typography>
        {health}
        <Typography sx={{ ...text.secondary, marginLeft: 'auto !important' }}>
          {running || starting
            ? [running ? `${running} running` : '', starting ? `${starting} starting` : ''].filter(Boolean).join(' · ')
            : 'Idle'}
        </Typography>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 1.5, md: 3 } }}>
        <Lane
          label="vCPU"
          fill={SERIES.one}
          unit="vCPU"
          total={machine?.cpu ?? null}
          quota={quotaCpu}
          list={list}
          reserve={(s) => s.resources.cpu}
          used={(s) => s.live?.cpu ?? null}
          format={(v) => num(v, 2)}
          onOpen={onOpen}
        />
        <Lane
          label="Memory"
          fill={SERIES.measured}
          unit="GiB"
          total={machine?.memoryMiB != null ? machine.memoryMiB / 1024 : null}
          quota={quotaMem != null ? quotaMem / 1024 : null}
          list={list}
          reserve={(s) => s.resources.memory_mib / 1024}
          used={(s) => (s.live ? s.live.memory_mib / 1024 : null)}
          format={(v) => num(v, v < 1 ? 2 : 1)}
          onOpen={onOpen}
        />
      </Box>
      {open && (
        <Box sx={{ marginTop: 1.5 }}>
          {list.length === 0 ? (
            <Typography sx={{ ...text.caption, color: color.textTertiary }}>No sandbox on this node now.</Typography>
          ) : (
            <Box sx={{ display: 'flex', width: '100%' }}>
              {list.map((s) => (
                <Block key={s.id} s={s} quotaCpu={quotaCpu ?? 1} onOpen={onOpen} />
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

/** Seconds since a time, said simply. */
function useSince(iso: string | null | undefined): string {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 2 ? 'just now' : `${s} s ago`;
}

export function LiveStatus({
  readAt,
  paused,
  onPause,
}: {
  readAt: string | null | undefined;
  paused: boolean;
  onPause: () => void;
}) {
  const since = useSince(readAt);
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        aria-hidden
        sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: paused ? color.textTertiary : color.success }}
      />
      <Typography sx={{ ...text.secondary }} aria-live="off">
        {paused ? 'Paused' : 'Live'}
        {readAt ? ` · read ${since}` : ''}
      </Typography>
      <Box
        component="button"
        onClick={onPause}
        sx={{
          border: 0,
          background: 'none',
          padding: '2px 4px',
          font: 'inherit',
          fontSize: 13,
          color: color.primaryDark,
          cursor: 'pointer',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        {paused ? 'Resume' : 'Pause'}
      </Box>
    </Stack>
  );
}

/**
 * Every sandbox node, live: a row per node with its CPU and memory lanes, and
 * when open, a block per sandbox. Sandboxes appear and go as they start and
 * stop; their use is their latest per-minute record.
 */
export function LiveNodes({
  nodes,
  machines,
  onOpen,
  legend,
}: {
  nodes: LiveNode[] | undefined;
  machines: Map<string, MachineTotal>;
  onOpen: (s: LiveSandbox) => void;
  legend?: ReactNode;
}) {
  const shown = useArrivals(nodes);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (n: LiveNode) => open[n.id] ?? (shown.get(n.id)?.length ?? 0) > 0;
  if (!nodes) return null;
  if (nodes.length === 0)
    return <Typography sx={{ ...text.secondary, padding: '20px 22px' }}>No node runs a sandbox runtime.</Typography>;
  const running = nodes.reduce((a, n) => a + n.sandboxes.length, 0);
  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ padding: '0 22px 10px' }}
      >
        <Typography sx={text.secondary}>
          {plural(nodes.length, 'node')} · {plural(running, 'sandbox', 'sandboxes')} now
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {[
            [SERIES.one, 'vCPU used, last minute'],
            [SERIES.measured, 'Memory used, last minute'],
            [RESERVED, 'Reserved'],
            [QUOTA, 'Sandbox quota'],
          ].map(([c, l]) => (
            <Stack key={l} direction="row" spacing={0.75} alignItems="center">
              <Box
                aria-hidden
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '2px',
                  backgroundColor: c,
                  boxShadow: c === QUOTA ? `inset -2px 0 0 ${color.primary}` : 'none',
                }}
              />
              <Typography sx={{ fontSize: 12.5, color: color.textSecondary }}>{l}</Typography>
            </Stack>
          ))}
          {legend}
        </Stack>
      </Stack>
      <Box component="ul" sx={{ margin: 0, padding: 0, borderTop: hairline }}>
        {nodes.map((n) => (
          <NodeRow
            key={n.id}
            node={n}
            list={shown.get(n.id) ?? []}
            machine={machines.get(n.host)}
            onOpen={onOpen}
            open={isOpen(n)}
            onToggle={() => setOpen((o) => ({ ...o, [n.id]: !isOpen(n) }))}
          />
        ))}
      </Box>
    </Box>
  );
}
