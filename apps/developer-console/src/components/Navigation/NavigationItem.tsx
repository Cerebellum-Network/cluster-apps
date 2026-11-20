import { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, NavLink, useMatch } from 'react-router-dom';
import { KeyboardArrowDown } from '@mui/icons-material';

import { Box, Stack, styled, Typography } from '@cluster-apps/ui';

import { color } from '~/theme/tokens';
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

// Mockup nav item (#192 review): 36px tall, 14.5px / weight 500, #1D1B20 text with
// grey icons. Active: weight 700 on #ECEDF3. One hover grey, not two.
const ACTIVE_BG = color.neutralFill;
const HOVER_BG = color.grid;

type ItemStyle = { active: boolean; filled: boolean };

const Item = styled(Link, { shouldForwardProp: (p) => p !== 'active' && p !== 'filled' })<ItemStyle>(
  ({ theme, active, filled }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    height: 36,
    padding: theme.spacing(0, 1.5),
    borderRadius: 8,
    textDecoration: 'none',
    color: color.text,
    backgroundColor: filled ? ACTIVE_BG : 'transparent',
    fontWeight: active ? 700 : 500,

    '&:hover': {
      backgroundColor: filled ? ACTIVE_BG : HOVER_BG,
    },

    '& .MuiSvgIcon-root': {
      fontSize: 20,
      color: active ? color.text : color.textTertiary,
    },
  }),
);

const Chevron = styled(KeyboardArrowDown, { shouldForwardProp: (p) => p !== 'open' })<{ open: boolean }>(
  ({ open }) => ({
    marginLeft: 'auto',
    fontSize: 18,
    transition: 'transform 120ms ease',
    transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
  }),
);

const SubLink = styled(NavLink)(() => ({
  display: 'block',
  height: 32,
  lineHeight: '32px',
  padding: '0 12px',
  borderRadius: 8,
  textDecoration: 'none',
  fontSize: 13,
  color: color.textSecondary,

  '&:hover': { backgroundColor: HOVER_BG },
  '&.active': {
    color: color.text,
    fontWeight: 700,
    backgroundColor: ACTIVE_BG,
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
        <Typography sx={{ fontSize: 14.5, fontWeight: 'inherit', color: 'inherit' }}>{label}</Typography>
        {hasSub && <Chevron open={active} />}
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
