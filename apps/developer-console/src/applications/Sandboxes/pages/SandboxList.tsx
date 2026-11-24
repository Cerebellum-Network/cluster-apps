import { ReactNode, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@cluster-apps/ui';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PageHeader, Pill, Section } from '~/components';
import { useCompute } from '~/compute/ComputeProvider';
import { useNow, useSandboxes } from '~/compute/hooks';
import { fmtCpu, fmtDuration, fmtMib, fmtQty, shortImage, shortNode } from '~/compute/format';
import { isLive, type Sandbox, type SandboxStatus } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { NewSandboxDialog } from '../components/NewSandboxDialog';
import { BucketChip, Meter, Mono, ReadError, SandboxStatusLabel, sbColor } from '../components/ui';

type Filter = 'all' | 'live' | 'finished' | 'failed';

const FILTERS: { id: Filter; label: string; match: (s: SandboxStatus) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'live', label: 'Running', match: (s) => isLive(s) },
  { id: 'finished', label: 'Finished', match: (s) => s === 'terminated' },
  { id: 'failed', label: 'Failed', match: (s) => s === 'failed' },
];

/** Running time: now minus start, or end minus start. */
export function runSeconds(s: Sandbox, now: number): number {
  if (!s.started_at) return 0;
  const end = s.ended_at ? Date.parse(s.ended_at) : now;
  return Math.max(0, (end - Date.parse(s.started_at)) / 1000);
}

export const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <Box
    component="button"
    onClick={onClick}
    aria-pressed={active}
    sx={{
      appearance: 'none',
      cursor: 'pointer',
      height: 32,
      padding: '0 12px',
      borderRadius: '8px',
      fontSize: 13,
      fontWeight: 600,
      fontFamily: 'inherit',
      border: `1px solid ${active ? color.primary : color.border}`,
      color: active ? color.primaryDark : color.textSecondary,
      backgroundColor: active ? color.primaryTint : color.surface,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      '&:focus-visible': { outline: `2px solid ${color.primary}`, outlineOffset: 2 },
    }}
  >
    {children}
  </Box>
);

const SandboxList = () => {
  const { bucketId } = useCompute();
  const { data, loading, error } = useSandboxes();
  const now = useNow(1000);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [params, setParams] = useSearchParams();
  const newOpen = params.get('new') === '1';

  const all = useMemo(() => data?.items ?? [], [data]);
  const rows = all.filter((s) => FILTERS.find((f) => f.id === filter)!.match(s.status));
  const count = (f: Filter) => all.filter((s) => FILTERS.find((x) => x.id === f)!.match(s.status)).length;

  return (
    <Box>
      <Box marginBottom="20px">
        <PageHeader
          title="Sandboxes"
          actions={
            <>
              <BucketChip bucketId={bucketId} />
              <Button variant="contained" onClick={() => setParams({ new: '1' })}>
                New sandbox
              </Button>
            </>
          }
        />
      </Box>

      <Stack direction="row" spacing={1} marginBottom="14px" alignItems="center">
        {FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
            <Box component="span" sx={{ fontWeight: 500, color: color.textTertiary }}>
              {count(f.id)}
            </Box>
          </Chip>
        ))}
        <Box flex={1} />
        {error && data && (
          <Typography sx={{ ...text.caption, color: color.danger }} title={error}>
            Refresh failed; showing the last list.
          </Typography>
        )}
        {data?.truncated && <Typography sx={text.caption}>Newest {all.length} shown.</Typography>}
      </Stack>

      {loading && !data ? (
        <Box display="flex" justifyContent="center" padding="40px">
          <CircularProgress size={24} />
        </Box>
      ) : error && !data ? (
        <ReadError what="your sandboxes" error={error} />
      ) : (
        <Section flush>
          <TableContainer sx={{ '& td': { paddingTop: '10px', paddingBottom: '10px', whiteSpace: 'nowrap' } }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Sandbox</TableCell>
                  <TableCell>Image</TableCell>
                  <TableCell>Node</TableCell>
                  <TableCell>Running for</TableCell>
                  <TableCell sx={{ minWidth: 130 }}>CPU</TableCell>
                  <TableCell sx={{ minWidth: 130 }}>Memory</TableCell>
                  <TableCell align="right">Measured</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((s) => {
                  const live = isLive(s.status);
                  const util =
                    s.usage.wall_s > 0 && s.resources.cpu > 0 ? s.usage.cpu_s / (s.usage.wall_s * s.resources.cpu) : 0;
                  const agent = s.labels['cere.agent'];
                  return (
                    <TableRow
                      key={s.id}
                      hover
                      onClick={() => navigate(`/sandboxes/list/${s.id}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <SandboxStatusLabel status={s.status} />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontFamily: mono, fontSize: 13, fontWeight: 600 }}>{s.id}</Typography>
                        <Stack direction="row" spacing={1} marginTop="2px">
                          {agent && <Pill tone="primary">agent {agent}</Pill>}
                          {Object.entries(s.labels)
                            .filter(([k]) => !k.startsWith('cere.'))
                            .slice(0, 2)
                            .map(([k, v]) => (
                              <Box key={k} component="span" sx={{ ...text.caption, color: color.textTertiary }}>
                                {k}={v}
                              </Box>
                            ))}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Mono title={s.image}>{shortImage(s.image)}</Mono>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Mono title={s.node}>{shortNode(s.node)}</Mono>
                      </TableCell>
                      <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {s.status === 'starting' ? 'starting…' : s.started_at ? fmtDuration(runSeconds(s, now)) : '—'}
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', marginBottom: '4px' }}>
                          {fmtCpu(s.resources.cpu)}
                          {s.usage.wall_s > 0 && (
                            <Box component="span" sx={{ color: color.textTertiary }}>
                              {' '}
                              · {Math.round(util * 100)}% avg
                            </Box>
                          )}
                        </Typography>
                        <Meter value={util} max={1} tone={live ? color.primary : color.border} height={4} />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', marginBottom: '4px' }}>
                          {fmtMib(s.usage.memory_peak_mib)}
                          <Box component="span" sx={{ color: color.textTertiary }}>
                            {' '}
                            peak of {fmtMib(s.resources.memory_mib)}
                          </Box>
                        </Typography>
                        <Meter
                          value={s.usage.memory_peak_mib}
                          max={s.resources.memory_mib}
                          tone={live ? sbColor.running : color.border}
                          height={4}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{fmtQty(s.usage.cpu_s)} CPU-s</Typography>
                        <Typography sx={text.caption}>{fmtQty(s.usage.ram_gib_s)} GiB-s</Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', padding: '36px' }}>
                      <Typography sx={text.secondary}>
                        No sandboxes here. Create one, or run the quickstart from the overview.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Section>
      )}

      <NewSandboxDialog
        open={newOpen}
        onClose={() => {
          params.delete('new');
          setParams(params, { replace: true });
        }}
      />
    </Box>
  );
};

export default SandboxList;
