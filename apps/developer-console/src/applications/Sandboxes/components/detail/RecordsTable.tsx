import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@cluster-apps/ui';
import { NavLink } from 'react-router-dom';

import { recordBilling } from '~/compute/billing';
import type { DacStatus, UsageRecord } from '~/compute/types';
import { fmtBytes, fmtClock, fmtQty, fmtUnits, fmtUtc, localZone, shortId, shortNode } from '~/compute/format';
import { color, mono, text } from '~/theme/tokens';

const DAC: Record<DacStatus, { label: string; fg: string; bg: string; title: string }> = {
  pushed: {
    label: 'Pushed',
    fg: color.success,
    bg: color.successTint,
    title: 'The node’s DAC agent accepted the signed record.',
  },
  pending: {
    label: 'Pending',
    fg: color.primaryDark,
    bg: color.primaryTint,
    title: 'Spooled on the node, not yet accepted by its DAC agent.',
  },
  failed: { label: 'Failed', fg: color.danger, bg: '#FDECEC', title: 'The node’s DAC agent refused the record.' },
};

export const DacPill = ({ status, error }: { status: DacStatus; error?: string | null }) => {
  const d = DAC[status] ?? DAC.pending;
  return (
    <Box
      component="span"
      title={error ? `${d.title} ${error}` : d.title}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 8px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 600,
        color: d.fg,
        backgroundColor: d.bg,
      }}
    >
      {d.label}
    </Box>
  );
};

/**
 * Usage records as nodes wrote them: one per wall-clock minute of a sandbox's
 * life plus a final one at exit, each signed and pushed to the node's DAC
 * agent. The columns are `cere usage`'s: the basis, the reservation, and the
 * billed CPU-seconds and GiB-seconds beside the measured ones (a record from a
 * gateway without the billing fields bills its units). CPU and RAM units are
 * the DAC record's own fields: the billed amounts × 1e11.
 */
const RecordsTable = ({
  records,
  showSandbox,
  empty,
}: {
  records: UsageRecord[];
  showSandbox?: boolean;
  empty?: string;
}) => {
  const head = { backgroundColor: color.inset };
  return (
    <Box sx={{ border: `1px solid ${color.border}`, borderRadius: '12px', overflow: 'auto', maxHeight: 560 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={head}>Period ({localZone()})</TableCell>
            {showSandbox && <TableCell sx={head}>Sandbox</TableCell>}
            <TableCell
              sx={head}
              title="reserved: billed the reservation × seconds running, or what was measured where that is more. measured: billed what was measured."
            >
              Basis
            </TableCell>
            <TableCell sx={head}>Reserved</TableCell>
            <TableCell sx={head} align="right">
              Billed CPU-s
            </TableCell>
            <TableCell sx={head} align="right">
              Measured CPU-s
            </TableCell>
            <TableCell sx={head} align="right">
              Billed GiB-s
            </TableCell>
            <TableCell sx={head} align="right">
              Measured GiB-s
            </TableCell>
            <TableCell sx={head} align="right">
              Peak memory
            </TableCell>
            <TableCell sx={head} align="right">
              Network out / in
            </TableCell>
            <TableCell sx={head}>DAC record</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {records.map((r) => {
            const billed = recordBilling(r);
            return (
              <TableRow key={r.record_id}>
                <TableCell
                  sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}
                  title={`${fmtUtc(r.period_start)} – ${fmtUtc(r.period_end)} (UTC, as the CLI prints it)`}
                >
                  {fmtClock(r.period_start)}–{fmtClock(r.period_end)}
                  {r.final && (
                    <Typography
                      sx={{ ...text.caption, color: color.text }}
                      title="The record written when the sandbox ended."
                    >
                      final{r.exit_reason ? ` · ${r.exit_reason}` : ''}
                    </Typography>
                  )}
                </TableCell>
                {showSandbox && (
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Box
                      component={NavLink}
                      to={`/sandboxes/list/${r.sandbox_id}`}
                      sx={{ fontFamily: mono, fontSize: 12.5, color: color.primary, textDecoration: 'none' }}
                    >
                      {shortId(r.sandbox_id)}
                    </Box>
                  </TableCell>
                )}
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{billed.basis}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {billed.reserved}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {fmtQty(billed.cpu)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: color.textSecondary }}>
                  {fmtQty(r.cpu_s)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {fmtQty(billed.ram)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: color.textSecondary }}>
                  {fmtQty(r.ram_gib_s)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {Math.round(r.memory_peak_mib)} MiB
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: color.textSecondary }}
                >
                  {fmtBytes(r.net_egress_bytes)} / {fmtBytes(r.net_ingress_bytes)}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <DacPill status={r.dac_status} error={r.dac_error} />
                  <Typography
                    sx={{ ...text.caption, fontFamily: mono, marginTop: '3px' }}
                    title={`record ${r.record_id}\nnode ${r.node}\ncpuUnits ${fmtUnits(r.cpu_units)} (billed × 1e11)\nramUnits ${fmtUnits(r.ram_units)} (billed × 1e11)`}
                  >
                    TCA {r.tca_id} · node {shortNode(r.node)}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
          {records.length === 0 && (
            <TableRow>
              <TableCell colSpan={showSandbox ? 11 : 10} sx={{ textAlign: 'center', padding: '28px' }}>
                <Typography sx={text.secondary}>
                  {empty ?? 'No usage records yet. Nodes write one per minute.'}
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
};

export default RecordsTable;
