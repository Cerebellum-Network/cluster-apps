import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { IconButton, Tooltip } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { KeyboardArrowDown, KeyboardArrowRight } from '@mui/icons-material';

import type { LiveNode, LiveSandbox } from '~/api/types';
import { SERIES } from '~/components/charts';
import { color, hairline, Pill, Status, text } from '~/components/ui';
import { gibTime, mib, num, plural, vcpuTime } from '~/format';

import { laneOf, limitsOf, type ResourceUse, resourceUse, sayBurst } from './limits';

/** A machine's whole CPU and memory, from node metrics, when known. */
export interface MachineTotal {
  cpu: number | null;
  memoryMiB: number | null;
}

/** A sandbox's request, the part it has not used: a light step of slot 1. */
export const REQUEST = '#D3C8F3';
/** Room between a sandbox's request and its limit: it may use it, and pays for it only if it does. */
export const HEADROOM = '#F1EEF8';
/** Use above the request: one colour wherever burst shows. */
export const BURST = SERIES.burst;
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
const pctOf = (v: number, span: number) => (span > 0 ? `${(100 * Math.max(0, v)) / span}%` : '0%');
const gib = (v: number) => num(v, v < 1 ? 2 : 1);

function blockTitle(s: LiveSandbox): string {
  const l = limitsOf(s.resources);
  const cpu = resourceUse(s, 'cpu');
  const mem = resourceUse(s, 'memory');
  const limit =
    l.cpuLimit > l.cpu || l.memoryLimitMiB > l.memoryMiB
      ? `limit ${num(l.cpuLimit, 2)} vCPU · ${mib(l.memoryLimitMiB)}`
      : 'limited at its request';
  const parts = [
    `${s.id} · bucket ${s.bucket} · ${s.image.ref}`,
    `request ${num(l.cpu, 2)} vCPU · ${mib(l.memoryMiB)}; ${limit}`,
    s.live
      ? [
          `using ${num(s.live.cpu, 2)} vCPU${cpu.burst > 0 ? ` (${num(cpu.burst, 2)} above its request)` : ''}`,
          `${mib(s.live.memory)}${mem.burst > 0 ? ` (${mib(mem.burst)} above its request)` : ''}`,
          'last minute',
        ].join(' · ')
      : s.status === 'starting'
        ? 'starting'
        : 'no reading yet',
  ];
  if (s.billed_cpu_s != null)
    parts.push(
      `billed so far ${vcpuTime(s.billed_cpu_s)}${sayBurst(s.burst_cpu_s) ? ` (${vcpuTime(s.burst_cpu_s)} of it burst)` : ''}${s.billed_ram_gib_s != null ? ` · ${gibTime(s.billed_ram_gib_s)}` : ''}`,
    );
  return parts.join('\n');
}

const motion = (phase: Shown['phase']) =>
  phase === 'new'
    ? { animation: `${arrive} 160ms ease-out, ${glow} ${ARRIVAL_MS}ms ease-out` }
    : phase === 'leaving'
      ? { animation: `${leave} ${LEAVE_MS}ms ease-in forwards`, pointerEvents: 'none' as const }
      : {};

/** A small swatch that keys a colour in running text; the words carry the meaning. */
export function Key({ fill, tick }: { fill: string; tick?: boolean }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: 'inline-block',
        width: tick ? 2 : 10,
        height: tick ? 12 : 10,
        borderRadius: tick ? 0 : '2px',
        backgroundColor: fill,
        verticalAlign: '-1px',
        marginRight: '5px',
      }}
    />
  );
}

/**
 * One resource of a node as a lane: the machine's total (when known) is the
 * track, the sandbox quota a lighter band with an edge mark. Each sandbox is a
 * block sized by its request (what the quota counts), filled by what it uses
 * within it; a sandbox using more than its request runs past its block into a
 * burst extension, so the lane's length is what is being billed now.
 */
function Lane({
  label,
  unit,
  total,
  quota,
  list,
  resource,
  scale,
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
  resource: 'cpu' | 'memory';
  /** Divides the resource's own unit (MiB) into the lane's (GiB). */
  scale: number;
  format: (v: number) => string;
  onOpen: (s: LiveSandbox) => void;
}) {
  const lane = laneOf(list, resource, scale);
  const here = laneOf(
    list.filter((s) => s.phase !== 'leaving'),
    resource,
    scale,
  );
  const withUse = list.some((s) => s.phase !== 'leaving' && s.live);
  const span = Math.max(total ?? quota ?? 0, lane.end);
  const pct = (v: number) => pctOf(v, span);
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
        <Typography sx={{ ...text.caption, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ ...text.caption, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
          <b style={{ color: color.text }}>{format(here.requested)}</b>
          {quota != null
            ? ` of ${format(quota)} ${unit} quota requested (${Math.round((100 * here.requested) / (quota || 1))}%)`
            : ` ${unit} requested · quota not reported`}
          {withUse && ` · ${format(here.used)} in use`}
          {here.burst > 0 && (
            <>
              {' · '}
              <Key fill={BURST} />
              <b style={{ color: color.text }}>{format(here.burst)}</b> above requests
            </>
          )}
          {total != null ? ` · machine ${format(total)}` : ''}
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
              // The quota's edge is marked when something lies beyond it: the machine, or burst past the quota.
              boxShadow: span > quota ? `inset -2px 0 0 ${color.primary}` : 'none',
            }}
          />
        )}
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex' }}>
          {list.map((s, i) => {
            const p = lane.parts[i];
            const width = p.request + p.burst;
            const starting = s.status === 'starting';
            return (
              <Tooltip key={s.id} title={<span style={{ whiteSpace: 'pre-line' }}>{blockTitle(s)}</span>}>
                <Box
                  component="button"
                  onClick={() => onOpen(s)}
                  aria-label={`${s.id}: requests ${format(p.request)} ${unit}${p.used != null ? `, uses ${format(p.used)}` : ''}${p.burst > 0 ? `, ${format(p.burst)} above its request` : ''}`}
                  sx={{
                    display: 'flex',
                    width: pct(width),
                    flexShrink: 0,
                    padding: 0,
                    border: 0,
                    borderRight: `2px solid ${color.surface}`,
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    ...motion(s.phase),
                    '&:hover, &:focus-visible': { filter: 'brightness(0.93)' },
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      width: `${(100 * p.request) / (width || 1)}%`,
                      height: '100%',
                      backgroundColor: starting ? 'transparent' : REQUEST,
                      outline: starting ? `1px dashed ${SERIES.one}` : 'none',
                      outlineOffset: '-1px',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${p.request > 0 ? (100 * Math.min(p.within, p.request)) / p.request : 0}%`,
                        backgroundColor: fill,
                      }}
                    />
                  </Box>
                  {p.burst > 0 && (
                    <Box
                      sx={{
                        flex: 1,
                        height: '100%',
                        minWidth: 2,
                        borderLeft: `2px solid ${color.surface}`,
                        backgroundColor: BURST,
                      }}
                    />
                  )}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * One resource of one sandbox against a scale: its request as a block, its
 * use filling it and running on past it as burst, the room it may still use
 * up to its limit, and the limit as a tick.
 */
export function RequestGauge({
  u,
  scale,
  fill,
  format,
  unit,
  what,
  noReading = 'no reading yet',
}: {
  u: ResourceUse;
  /** The span of the bar, in the resource's unit: the node's quota, or the sandbox's limit. */
  scale: number;
  fill: string;
  format: (v: number) => string;
  /** After a figure, when `format` does not say it ("vCPU"). */
  unit?: string;
  /** What the resource is, for the accessible name: "vCPU", "memory". */
  what: string;
  /** What to say when there is no reading: "no reading yet", or "not running" for a sandbox that ended. */
  noReading?: string;
}) {
  const span = Math.max(scale, u.limit, u.used ?? 0) || 1;
  const pct = (v: number) => pctOf(v, span);
  const said = [
    u.used != null ? `uses ${format(u.used)}${unit ? ` ${unit}` : ''}` : noReading,
    `requests ${format(u.request)}`,
    u.canBurst ? `limit ${format(u.limit)}` : 'limited at its request',
    u.burst > 0 ? `${format(u.burst)} above its request` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Box>
      <Box role="img" aria-label={`${what}: ${said}`} sx={{ position: 'relative', height: 10, marginTop: '5px' }}>
        {u.canBurst && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: pct(u.request),
              width: pct(u.limit - u.request),
              backgroundColor: HEADROOM,
              borderRadius: '0 3px 3px 0',
            }}
          />
        )}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: pct(u.request),
            minWidth: 3,
            backgroundColor: REQUEST,
            borderRadius: u.canBurst ? '3px 0 0 3px' : '3px',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${u.request > 0 ? (100 * u.within) / u.request : 0}%`,
              backgroundColor: fill,
            }}
          />
        </Box>
        {u.burst > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `calc(${pct(u.request)} + 2px)`,
              width: `max(2px, calc(${pct(u.burst)} - 2px))`,
              backgroundColor: BURST,
            }}
          />
        )}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: -3,
            height: 16,
            width: 2,
            left: `calc(${pct(u.limit)} - 1px)`,
            backgroundColor: color.text,
          }}
        />
      </Box>
      <Typography
        component="div"
        sx={{ ...text.caption, marginTop: '6px', fontVariantNumeric: 'tabular-nums', lineHeight: '17px' }}
      >
        {u.used != null ? (
          <>
            <b style={{ color: color.text }}>{format(u.used)}</b>
            {unit ? ` ${unit}` : ''}
          </>
        ) : (
          noReading
        )}
        {' · '}request {format(u.request)}
        {' · '}
        {u.canBurst ? `limit ${format(u.limit)}` : 'limited at its request'}
        {u.burst > 0 && (
          <>
            {' · '}
            <Key fill={BURST} />
            {format(u.burst)} above the request
          </>
        )}
      </Typography>
    </Box>
  );
}

/** A sandbox on its node, opened: who it is, then its vCPU and memory against the node's quota. */
function SandboxRow({
  s,
  cpuScale,
  memScaleMiB,
  onOpen,
}: {
  s: Shown;
  cpuScale: number;
  memScaleMiB: number;
  onOpen: (s: LiveSandbox) => void;
}) {
  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(150px, 210px) 1fr 1fr' },
        gap: { xs: 1, md: 3 },
        alignItems: 'start',
        padding: '10px 0',
        borderTop: hairline,
        ...motion(s.phase),
      }}
    >
      <Box
        component="button"
        onClick={() => onOpen(s)}
        title={blockTitle(s)}
        sx={{
          minWidth: 0,
          padding: 0,
          border: 0,
          background: 'none',
          textAlign: 'left',
          font: 'inherit',
          cursor: 'pointer',
          '&:hover .name, &:focus-visible .name': { textDecoration: 'underline' },
          '&:focus-visible': { outline: `2px solid ${color.primary}`, outlineOffset: '2px', borderRadius: '4px' },
        }}
      >
        <Typography
          className="name"
          noWrap
          sx={{ fontSize: 13, fontWeight: 700, lineHeight: '18px', color: color.text }}
        >
          {s.status === 'starting' ? `Starting ${tail(s.id)}` : tail(s.id)}
        </Typography>
        <Typography noWrap sx={{ ...text.caption }}>
          Bucket {s.bucket} · {s.image.ref}
        </Typography>
        {s.billed_cpu_s != null && (
          <Typography noWrap sx={{ ...text.caption }}>
            billed {vcpuTime(s.billed_cpu_s)}
            {sayBurst(s.burst_cpu_s) ? `, ${vcpuTime(s.burst_cpu_s)} burst` : ''}
          </Typography>
        )}
      </Box>
      <RequestGauge
        u={resourceUse(s, 'cpu')}
        scale={cpuScale}
        fill={SERIES.one}
        format={(v) => num(v, 2)}
        unit="vCPU"
        what="vCPU"
      />
      <RequestGauge
        u={resourceUse(s, 'memory')}
        scale={memScaleMiB}
        fill={SERIES.measured}
        format={mib}
        what="memory"
      />
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
  const here = list.filter((s) => s.phase !== 'leaving');
  const running = here.filter((s) => s.status === 'running').length;
  const starting = here.filter((s) => s.status === 'starting').length;
  const quotaCpu = node.allocatable?.cpu ?? null;
  const quotaMem = node.allocatable?.memory ?? null;
  const cpu = laneOf(here, 'cpu');
  const mem = laneOf(here, 'memory');
  // Sandboxes together over the node's sandbox memory quota: the one most above its request is reclaimed first.
  const memoryShort = quotaMem != null && here.some((s) => s.live) && mem.used > quotaMem;
  const health =
    node.healthy == null ? (
      <Status tone="neutral">No report</Status>
    ) : node.healthy ? (
      <Status tone="success">Healthy</Status>
    ) : (
      <Status tone="danger">Not healthy</Status>
    );
  const bursting = [cpu.burst > 0 ? `${num(cpu.burst, 2)} vCPU` : '', mem.burst > 0 ? mib(mem.burst) : '']
    .filter(Boolean)
    .join(' · ');
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
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ marginBottom: 1.25 }} flexWrap="wrap" useFlexGap>
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
        {memoryShort && (
          <Pill
            tone="warning"
            title="The sandboxes on this node use more memory together than its sandbox quota. A sandbox above its memory request may be stopped to reclaim memory, the one most above it first."
          >
            Memory use over the quota
          </Pill>
        )}
        <Typography sx={{ ...text.secondary, marginLeft: 'auto !important' }}>
          {bursting && (
            <>
              <Key fill={BURST} />
              {bursting} above requests
              {' · '}
            </>
          )}
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
          resource="cpu"
          scale={1}
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
          resource="memory"
          scale={1024}
          format={gib}
          onOpen={onOpen}
        />
      </Box>
      {open && (
        <Box sx={{ marginTop: 1.5 }}>
          {list.length === 0 ? (
            <Typography sx={{ ...text.caption, color: color.textTertiary }}>No sandbox on this node now.</Typography>
          ) : (
            <Box component="ul" sx={{ margin: 0, padding: 0 }}>
              {list.map((s) => (
                <SandboxRow key={s.id} s={s} cpuScale={quotaCpu ?? 0} memScaleMiB={quotaMem ?? 0} onOpen={onOpen} />
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
 * when open, a row per sandbox with its request, use and limit. Sandboxes
 * appear and go as they start and stop; their use is their latest reading.
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
            [SERIES.one, 'vCPU used'],
            [SERIES.measured, 'Memory used'],
            [REQUEST, 'Request, not used'],
            [BURST, 'Burst: use above the request'],
            [color.text, 'Limit'],
            [QUOTA, 'Sandbox quota'],
          ].map(([c, l]) => (
            <Stack key={l} direction="row" spacing={0.75} alignItems="center">
              <Box
                aria-hidden
                sx={{
                  width: l === 'Limit' ? 2 : 10,
                  height: l === 'Limit' ? 12 : 10,
                  borderRadius: l === 'Limit' ? 0 : '2px',
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
