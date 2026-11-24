import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Box, Logo, Stack, Typography } from '@cluster-apps/ui';
import { Button, Tooltip } from '@mui/material';

import type { ChainSnapshot } from '~/api/types';
import { shortKey } from '~/format';
import { useView } from '~/hooks/useView';
import { useSession } from '~/session/SessionProvider';

import { color, Pill } from './ui';

interface NavItem {
  to: string;
  label: string;
  /** No source this backend can read yet: the page says why. */
  missing?: boolean;
}

const MAIN: NavItem[] = [
  { to: '/', label: 'Overview' },
  { to: '/nodes', label: 'Nodes' },
  { to: '/sandboxes', label: 'Sandboxes' },
  { to: '/placements', label: 'Placements' },
  { to: '/egress', label: 'Egress log' },
  { to: '/usage', label: 'Usage records' },
];

const SERVICES: NavItem[] = [
  { to: '/inference', label: 'Inference' },
  { to: '/missing/storage', label: 'Storage', missing: true },
  { to: '/missing/delivery', label: 'Delivery', missing: true },
];

const BUSINESS: NavItem[] = [
  { to: '/missing/requests', label: 'Requests', missing: true },
  { to: '/missing/customers', label: 'Customers', missing: true },
  { to: '/missing/plans', label: 'Plans', missing: true },
  { to: '/missing/revenue', label: 'Revenue', missing: true },
];

function Item({ to, label, missing }: NavItem) {
  return (
    <Box
      component={NavLink}
      to={to}
      end={to === '/'}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 34,
        padding: '0 12px',
        borderRadius: '8px',
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: 500,
        color: missing ? color.textTertiary : color.text,
        '&:hover': { backgroundColor: color.grid },
        '&.active': { backgroundColor: color.neutralFill, fontWeight: 700 },
      }}
    >
      <span>{label}</span>
      {missing && (
        <Box component="span" sx={{ fontSize: 11, color: color.textTertiary }}>
          no source
        </Box>
      )}
    </Box>
  );
}

function Group({ label, items }: { label?: string; items: NavItem[] }) {
  return (
    <Stack spacing={0.25}>
      {label && (
        <Typography sx={{ fontSize: 13, color: color.textSecondary, paddingLeft: 1.5, marginBottom: 0.5 }}>
          {label}
        </Typography>
      )}
      {items.map((i) => (
        <Item key={i.to} {...i} />
      ))}
    </Stack>
  );
}

function ClusterCard() {
  const { info } = useSession();
  const chain = useView<ChainSnapshot>('/chain', undefined, 60_000);
  const nodes = chain.data?.nodes.length;
  return (
    <Box
      sx={{
        padding: '10px 12px',
        border: `1px solid ${color.border}`,
        borderRadius: '10px',
        backgroundColor: color.surface,
      }}
    >
      <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{info?.cluster.name || 'Cluster'}</Typography>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ marginTop: '2px' }}>
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: chain.error ? color.warning : color.success,
          }}
        />
        <Typography sx={{ fontSize: 11.5, color: color.textSecondary }}>
          {chain.error
            ? 'blockchain read failed'
            : nodes === undefined
              ? 'reading the blockchain…'
              : `${nodes} nodes on the blockchain`}
        </Typography>
      </Stack>
      <Tooltip title={info?.cluster.id ?? ''}>
        <Typography
          sx={{
            fontSize: 11,
            color: color.textTertiary,
            marginTop: '2px',
            fontFamily: 'ui-monospace, Menlo, monospace',
          }}
        >
          {shortKey(info?.cluster.id, 8, 6)}
        </Typography>
      </Tooltip>
    </Box>
  );
}

function Header({ right }: { right: ReactNode }) {
  return (
    <Box
      component="header"
      sx={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        backgroundColor: color.surface,
        borderBottom: `1px solid ${color.border}`,
      }}
    >
      <Logo>
        <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.15, color: 'text.primary' }}>
          Cluster Console
        </Typography>
        <Typography sx={{ fontSize: 12, color: color.textTertiary, lineHeight: 1.2 }}>
          Powered by Cere Network
        </Typography>
      </Logo>
      {right}
    </Box>
  );
}

/** How the signed-in account holds its role, in words. */
export function roleLine(manager: boolean, source?: string): string {
  if (!manager) return 'Provider';
  return source === 'backend_config' ? 'Manager by backend config' : 'Manager on the blockchain';
}

export function Shell() {
  const { info, signOut } = useSession();
  const manager = !!info?.roles.includes('manager');
  const byConfig = info?.manager_source === 'backend_config';
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: color.page }}>
      <Header
        right={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography sx={{ fontSize: 12.5, color: color.textSecondary }}>Role</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{manager ? 'Manager' : 'Provider'}</Typography>
              {byConfig && (
                <Pill
                  tone="warning"
                  title="Devnet only: this account is a manager because the console backend's EXTRA_MANAGERS lists it, not because the blockchain says so."
                >
                  by backend config
                </Pill>
              )}
            </Stack>
            <Tooltip title={info?.account ?? ''}>
              <Stack sx={{ lineHeight: '15px' }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>SSCP wallet</Typography>
                <Typography
                  sx={{ fontSize: 11, color: color.textSecondary, fontFamily: 'ui-monospace, Menlo, monospace' }}
                >
                  {shortKey(info?.account)}
                </Typography>
              </Stack>
            </Tooltip>
            <Button size="small" variant="text" color="secondary" onClick={signOut}>
              Sign out
            </Button>
          </Stack>
        }
      />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Box
          component="nav"
          aria-label="Main"
          sx={{
            width: 232,
            flexShrink: 0,
            backgroundColor: color.inset,
            borderRight: `1px solid ${color.border}`,
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <ClusterCard />
          <Group items={MAIN} />
          <Group label="Services" items={SERVICES} />
          <Group label="Business" items={BUSINESS} />
          <Box sx={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Group items={[{ to: '/sources', label: 'What backs each number' }]} />
            <Typography
              sx={{
                fontSize: 11.5,
                color: color.textSecondary,
                padding: '8px 12px 0',
                borderTop: `1px solid ${color.border}`,
              }}
            >
              {roleLine(manager, info?.manager_source)}
            </Typography>
          </Box>
        </Box>
        <Box component="main" sx={{ flex: 1, minWidth: 0, padding: '22px 28px 32px' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
