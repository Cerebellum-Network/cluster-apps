import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@cluster-apps/ui';
import { NavLink } from 'react-router-dom';

import type { EgressEntry } from '~/compute/types';
import { fmtBytes, fmtDateTime, fmtUtc, shortId } from '~/compute/format';
import { color, mono, text } from '~/theme/tokens';
import { CredentialChip, DecisionPill, sbColor } from '../ui';

/**
 * Requests as the egress proxy logged them (`GET /v1/egress/log`): allowed,
 * refused or failed upstream, and which secret the proxy added. A host not on
 * the list is refused at CONNECT, before any request, so it has no path.
 */
const EgressTable = ({
  entries,
  showSandbox,
  empty,
}: {
  entries: EgressEntry[];
  showSandbox?: boolean;
  empty?: string;
}) => {
  const head = { backgroundColor: color.inset };
  return (
    <Box sx={{ border: `1px solid ${color.border}`, borderRadius: '12px', overflow: 'auto', maxHeight: 520 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={head}>Time</TableCell>
            <TableCell sx={head}>Decision</TableCell>
            {showSandbox && <TableCell sx={head}>Sandbox</TableCell>}
            <TableCell sx={head}>Request</TableCell>
            <TableCell sx={head}>Status</TableCell>
            <TableCell sx={head}>Credential added</TableCell>
            <TableCell sx={head} align="right">
              Bytes up / down
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((e) => {
            const refused = e.decision === 'denied';
            return (
              <TableRow key={e.id} sx={{ backgroundColor: refused ? sbColor.deniedTint : undefined }}>
                <TableCell
                  sx={{
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                    color: color.textSecondary,
                    fontSize: 13,
                  }}
                >
                  <span title={`${fmtUtc(e.ts)} (UTC, as the CLI prints it)`}>{fmtDateTime(e.ts)}</span>
                </TableCell>
                <TableCell>
                  <DecisionPill decision={e.decision} />
                </TableCell>
                {showSandbox && (
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {e.sandbox_id ? (
                      <Box
                        component={NavLink}
                        to={`/sandboxes/list/${e.sandbox_id}`}
                        sx={{ fontFamily: mono, fontSize: 12.5, color: color.primary, textDecoration: 'none' }}
                      >
                        {shortId(e.sandbox_id)}
                      </Box>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                )}
                <TableCell sx={{ maxWidth: 380 }}>
                  <Stack direction="row" gap="8px" alignItems="baseline" minWidth={0}>
                    <Box
                      component="span"
                      sx={{
                        fontFamily: mono,
                        fontSize: 12,
                        fontWeight: 700,
                        color: color.textSecondary,
                        flexShrink: 0,
                      }}
                    >
                      {e.method}
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        fontFamily: mono,
                        fontSize: 12.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={`${e.host}${e.path ?? ''}`}
                    >
                      <strong>{e.host}</strong>
                      <Box component="span" sx={{ color: color.textSecondary }}>
                        {e.path ?? ''}
                      </Box>
                    </Box>
                  </Stack>
                  {e.reason && (
                    <Typography
                      sx={{ fontSize: 12, color: refused ? sbColor.deniedText : color.warning, marginTop: '2px' }}
                    >
                      {e.reason}
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, whiteSpace: 'nowrap' }}>
                  {e.status ?? '—'}
                  {e.duration_ms != null && (
                    <Box component="span" sx={{ color: color.textTertiary }}>
                      {' '}
                      · {e.duration_ms} ms
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  <CredentialChip name={e.credential} />
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                    color: color.textSecondary,
                  }}
                >
                  {fmtBytes(e.bytes_up)} / {fmtBytes(e.bytes_down)}
                </TableCell>
              </TableRow>
            );
          })}
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={showSandbox ? 7 : 6} sx={{ textAlign: 'center', padding: '28px' }}>
                <Typography sx={text.secondary}>{empty ?? 'No requests yet.'}</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
};

export default EgressTable;
