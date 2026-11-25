import { Stack, Typography } from '@cluster-apps/ui';

import { Pill, type PillTone } from '~/components';
import { OUTCOME_LABEL, type OutcomeState, type RunOutcome } from '~/compute/agentOutcome';
import { color, text } from '~/theme/tokens';

const FG: Record<OutcomeState, string> = {
  running: color.primary,
  succeeded: color.success,
  failed: color.danger,
  stopped: color.warning,
  ended: color.textSecondary,
  unknown: color.textSecondary,
};

const TONE: Record<OutcomeState, PillTone> = {
  running: 'primary',
  succeeded: 'success',
  failed: 'warning',
  stopped: 'warning',
  ended: 'neutral',
  unknown: 'neutral',
};

/** A run's result in a table: the state, and the error or reason under it. */
export const RunOutcomeLabel = ({ outcome, maxDetail = 90 }: { outcome: RunOutcome; maxDetail?: number }) => {
  const detail = outcome.detail ?? '';
  return (
    <Stack component="span" title={detail || undefined}>
      <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: FG[outcome.state] }}>
        {OUTCOME_LABEL[outcome.state]}
      </Typography>
      {detail && (
        <Typography
          component="span"
          sx={{ ...text.caption, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {detail.length > maxDetail ? `${detail.slice(0, maxDetail - 1)}…` : detail}
        </Typography>
      )}
    </Stack>
  );
};

/** A run's result as a pill (the run page's header). */
export const RunOutcomePill = ({ outcome }: { outcome: RunOutcome }) => (
  <Pill tone={TONE[outcome.state]}>{OUTCOME_LABEL[outcome.state]}</Pill>
);
