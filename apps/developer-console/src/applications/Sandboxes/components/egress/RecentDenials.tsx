import { useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { NavLink } from 'react-router-dom';

import { Section } from '~/components';
import { denials } from '~/compute/egressRules';
import { fmtAgo, plural, shortId } from '~/compute/format';
import { useEgressLog, useNow, useSandboxes } from '~/compute/hooks';
import { isLive } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { ReadError } from '../ui';

const DAY_MS = 86_400_000;

/**
 * The hosts sandboxes of this bucket were refused in the last 24 hours, by
 * sandbox, newest first, leaving out hosts a running sandbox has been allowed
 * since. Each links to the sandbox's Egress tab, where it can be allowed.
 */
const RecentDenials = ({ max = 5 }: { max?: number }) => {
  const [since] = useState(() => new Date(Date.now() - DAY_MS).toISOString());
  const log = useEgressLog({ decision: 'denied', since }, { max: 200 });
  const sandboxes = useSandboxes();
  const now = useNow(10_000);
  const byId = useMemo(() => new Map((sandboxes.data?.items ?? []).map((s) => [s.id, s])), [sandboxes.data]);
  const list = useMemo(
    () => denials(log.data?.items ?? [], (id) => (id ? (byId.get(id)?.egress.allow ?? null) : null)),
    [log.data, byId],
  );

  return (
    <Section title="Refused in the last 24 hours">
      {log.error && !log.data ? (
        <ReadError what="the egress log" error={log.error} />
      ) : !log.data ? (
        <Typography sx={text.secondary}>Reading the egress log…</Typography>
      ) : list.length === 0 ? (
        <Typography sx={text.secondary}>
          Nothing refused. A sandbox reaches only the hosts its rules allow; a refused request shows here and on the
          sandbox’s Egress tab, where you can allow it.
        </Typography>
      ) : (
        <Stack sx={{ borderTop: `1px solid ${color.grid}` }}>
          {list.slice(0, max).map((d) => {
            const sb = d.sandboxId ? byId.get(d.sandboxId) : undefined;
            const live = !!sb && isLive(sb.status);
            return (
              <Stack
                key={`${d.sandboxId} ${d.host}`}
                component={d.sandboxId ? NavLink : 'div'}
                to={d.sandboxId ? `/sandboxes/list/${d.sandboxId}?tab=egress` : undefined}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap="10px"
                sx={{
                  padding: '9px 0',
                  borderBottom: `1px solid ${color.grid}`,
                  textDecoration: 'none',
                  color: 'inherit',
                  '&:hover .host': { color: color.primary },
                }}
              >
                <Box minWidth={0}>
                  <Typography className="host" sx={{ fontFamily: mono, fontSize: 13, fontWeight: 600 }}>
                    {d.host}
                  </Typography>
                  <Typography
                    sx={{ ...text.caption, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {d.methods.join(', ')} · {plural(d.count, 'request')} ·{' '}
                    {d.sandboxId ? (
                      <>
                        {sb?.labels['cere.agent'] ? `agent ${sb.labels['cere.agent']}, ` : ''}
                        <Box component="span" sx={{ fontFamily: mono }}>
                          {shortId(d.sandboxId)}
                        </Box>
                        {live ? ' (running: allow it there)' : ''}
                      </>
                    ) : (
                      'no sandbox'
                    )}
                  </Typography>
                </Box>
                <Typography sx={{ ...text.caption, whiteSpace: 'nowrap' }}>{fmtAgo(d.last, now)}</Typography>
              </Stack>
            );
          })}
          {list.length > max && (
            <Typography sx={{ ...text.caption, paddingTop: '8px' }}>and {list.length - max} more</Typography>
          )}
        </Stack>
      )}
    </Section>
  );
};

export default RecentDenials;
