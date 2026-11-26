import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';

import type { SandboxSecret } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { KeyGlyph, sbColor } from '../ui';
import { boundTo } from './CredentialPicker';

/**
 * Credentials as a short list for a side panel: name, the header it is sent
 * as, and the only hosts it is sent to; never a value. `actions` renders each
 * one's buttons.
 */
const CredentialList = ({
  items,
  actions,
  empty,
}: {
  items: Pick<SandboxSecret, 'name' | 'header' | 'hosts'>[];
  actions?: (name: string) => ReactNode;
  empty?: ReactNode;
}) =>
  items.length ? (
    <Stack>
      {items.map((s) => (
        <Stack
          key={s.name}
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap="10px"
          sx={{ padding: '8px 0', borderBottom: `1px solid ${color.grid}`, '&:last-of-type': { borderBottom: 'none' } }}
        >
          <Box minWidth={0}>
            <Stack direction="row" alignItems="center" gap="6px" sx={{ color: sbColor.credential }}>
              <KeyGlyph />
              <Box component="span" sx={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: color.text }}>
                {s.name}
              </Box>
            </Stack>
            <Typography
              sx={{
                ...text.caption,
                fontFamily: mono,
                overflowWrap: 'anywhere',
                color: !s.hosts.length ? color.warning : undefined,
              }}
            >
              {s.header}, {boundTo(s)}
            </Typography>
          </Box>
          {actions && (
            <Stack direction="row" gap="2px" flexShrink={0}>
              {actions(s.name)}
            </Stack>
          )}
        </Stack>
      ))}
    </Stack>
  ) : (
    <>{empty ?? null}</>
  );

export default CredentialList;
