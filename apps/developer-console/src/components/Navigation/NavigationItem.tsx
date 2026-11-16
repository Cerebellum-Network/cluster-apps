import { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, NavLink, useMatch } from 'react-router-dom';

import { Box, Stack, styled, Typography } from '@cluster-apps/ui';

import type { SubNavItem } from '~/applications';

export type NavigationItemProps = {
  title: string;
  navLabel?: string;
  rootPath: string;
  description: string;
  icon: ReactNode;
  subNav?: SubNavItem[];
  widget?: ReactNode;
};

type ItemStyle = { active: boolean; filled: boolean };

const Item = styled(Link, { shouldForwardProp: (p) => p !== 'active' && p !== 'filled' })<ItemStyle>(
  ({ theme, active, filled }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    textDecoration: 'none',
    color: active ? theme.palette.text.primary : theme.palette.text.secondary,
    backgroundColor: filled ? theme.palette.action.selected : 'transparent',
    fontWeight: active ? 600 : 500,

    '&:hover': {
      backgroundColor: filled ? theme.palette.action.selected : theme.palette.action.hover,
    },

    '& .MuiSvgIcon-root': {
      fontSize: 20,
      color: active ? theme.palette.text.primary : theme.palette.text.secondary,
    },
  }),
);

const SubLink = styled(NavLink)(({ theme }) => ({
  display: 'block',
  padding: theme.spacing(0.75, 1.5),
  borderRadius: theme.shape.borderRadius,
  textDecoration: 'none',
  fontSize: '0.8125rem',
  color: theme.palette.text.secondary,

  '&:hover': { backgroundColor: theme.palette.action.hover },
  '&.active': {
    color: theme.palette.text.primary,
    fontWeight: 600,
    backgroundColor: theme.palette.action.selected,
  },
}));

const NavigationItem = ({ rootPath, title, navLabel, icon, subNav }: NavigationItemProps) => {
  const hasSub = !!subNav?.length;
  // Active for the item (and its sub-pages): matches `rootPath` and anything under it.
  const active = !!useMatch(`${rootPath}/*`);
  const label = navLabel ?? title;

  return (
    <Box>
      {/* A parent with sub-nav highlights by weight only; its sub-items carry the fill.
          A leaf item carries the fill itself. */}
      <Item active={active} filled={active && !hasSub} to={rootPath}>
        {icon}
        <Typography variant="body2" sx={{ fontWeight: 'inherit', color: 'inherit' }}>
          {label}
        </Typography>
      </Item>

      {active && hasSub && (
        <Stack spacing={0.25} marginTop={0.25} paddingLeft={4.5}>
          {subNav!.map((s) => (
            <SubLink key={s.path || 'index'} to={s.path ? `${rootPath}/${s.path}` : rootPath} end>
              {s.label}
            </SubLink>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default observer(NavigationItem);
