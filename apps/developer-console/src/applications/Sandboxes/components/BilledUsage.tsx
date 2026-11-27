import { Box, Typography } from '@cluster-apps/ui';

import { basisOf, billedShort, billingLine } from '~/compute/billing';
import { fmtQty } from '~/compute/format';
import type { Sandbox } from '~/compute/types';
import { text } from '~/theme/tokens';

/** The header of a column of `BilledUsage` cells: "Billed" once any sandbox in it says what it is billed. */
export const billedHeader = (sandboxes: Pick<Sandbox, 'usage'>[]): string =>
  sandboxes.some((s) => basisOf(s.usage) !== '') ? 'Billed' : 'Measured';

/**
 * A sandbox's usage for a line of text: the CLI's "billed 1.0 vCPU × 54.0 s =
 * 54.0 CPU-s (measured 9.4), 1.0 GiB × …", or what was measured
 * ("9.40 CPU-s · 15.0 GiB-s") until the node reports billing.
 */
export function billedText(sandbox: Pick<Sandbox, 'usage' | 'resources'>): string {
  const u = sandbox.usage;
  const line = billingLine(u, sandbox.resources.cpu, sandbox.resources.memory);
  return line ? `billed ${line}` : `${fmtQty(u.cpu_s)} CPU-s · ${fmtQty(u.ram_gib_s)} GiB-s`;
}

/**
 * A sandbox's CPU-seconds and GiB-seconds for a table cell: what it is billed,
 * with what was measured beside it ("54.0 CPU-s (measured 9.4)"), and the
 * CLI's whole line in the tooltip. A sandbox whose node has not reported yet
 * shows what was measured.
 */
const BilledUsage = ({ sandbox }: { sandbox: Pick<Sandbox, 'usage' | 'resources'> }) => {
  const u = sandbox.usage;
  const short = billedShort(u);
  const line = billingLine(u, sandbox.resources.cpu, sandbox.resources.memory);
  return (
    <Box title={line ? `billed ${line}` : undefined}>
      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{short ? short.cpu : `${fmtQty(u.cpu_s)} CPU-s`}</Typography>
      <Typography sx={text.caption}>{short ? short.memory : `${fmtQty(u.ram_gib_s)} GiB-s`}</Typography>
    </Box>
  );
};

export default BilledUsage;
