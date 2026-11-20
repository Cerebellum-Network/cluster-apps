import { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Stack, Typography } from '@cluster-apps/ui';

import type { AppGroup, Application } from '~/applications';
import { color } from '~/theme/tokens';
import NavigationItem from './NavigationItem';

export type NavigationProps = {
  items: Application[];
  footer?: ReactNode;
};

const GROUPS: { id: AppGroup; label: string }[] = [
  { id: 'services', label: 'Services' },
  { id: 'account', label: 'Account' },
];

// 13px sentence-case group heading (#192 review): not uppercase, no divider.
const GroupLabel = ({ children }: { children: ReactNode }) => (
  <Typography sx={{ fontSize: 13, color: color.textTertiary, paddingLeft: 1.5, marginBottom: 0.5 }}>{children}</Typography>
);

const Navigation = ({ items, footer }: NavigationProps) => (
  <Stack spacing={2.5} height="100%">
    {GROUPS.map(({ id, label }) => {
      const groupItems = items.filter((app) => app.group === id);
      if (groupItems.length === 0) return null;
      return (
        <Stack key={id} spacing={0.25}>
          <GroupLabel>{label}</GroupLabel>
          {groupItems.map((app) => (
            <NavigationItem key={app.rootPath} {...app} />
          ))}
        </Stack>
      );
    })}

    {footer && <Box marginTop="auto">{footer}</Box>}
  </Stack>
);

export default observer(Navigation);
