import { Fragment, ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Divider, Stack, Typography } from '@cluster-apps/ui';

import type { AppGroup, Application } from '~/applications';
import NavigationItem from './NavigationItem';

export type NavigationProps = {
  items: Application[];
  footer?: ReactNode;
};

const GROUPS: { id: AppGroup; label: string }[] = [
  { id: 'services', label: 'Services' },
  { id: 'account', label: 'Account' },
];

const GroupLabel = ({ children }: { children: ReactNode }) => (
  <Typography
    variant="caption"
    color="text.secondary"
    sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 1.5 }}
  >
    {children}
  </Typography>
);

const Navigation = ({ items, footer }: NavigationProps) => (
  <Stack spacing={2} height="100%">
    {GROUPS.map(({ id, label }, groupIndex) => {
      const groupItems = items.filter((app) => app.group === id);
      if (groupItems.length === 0) return null;
      return (
        <Fragment key={id}>
          {groupIndex > 0 && <Divider sx={{ borderColor: 'divider' }} />}
          <Stack spacing={0.5}>
            <GroupLabel>{label}</GroupLabel>
            {groupItems.map((app) => (
              <NavigationItem key={app.rootPath} {...app} />
            ))}
          </Stack>
        </Fragment>
      );
    })}

    {footer && <Box marginTop="auto">{footer}</Box>}
  </Stack>
);

export default observer(Navigation);
