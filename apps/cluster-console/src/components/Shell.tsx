import { NavLink, Outlet } from 'react-router-dom';
import { Box, Logo, Stack, Typography } from '@cluster-apps/ui';
import { Button, Tooltip } from '@mui/material';

import type { ChainSnapshot } from '~/api/types';
import { shortKey } from '~/format';
import { useView } from '~/hooks/useView';
import { nodeCounts } from '~/pages/nodeModel';
import { useSession } from '~/session/SessionProvider';

import { color, hairline } from './ui';

interface NavItem {
  to: string;
  label: string;
}

/** The screens with data, in the canvas's order (Side, n1). Screens with no source are listed on Data sources. */
const MANAGE: NavItem[] = [
  { to: '/', label: 'Overview' },
  { to: '/nodes', label: 'Nodes' },
  { to: '/customers', label: 'Customers' },
  { to: '/revenue', label: 'Revenue' },
];

/** One entry per service the cluster runs; each page shows its use of each node. */
const SERVICES: NavItem[] = [
  { to: '/storage', label: 'Storage' },
  { to: '/delivery', label: 'Delivery' },
  { to: '/inference', label: 'Inference' },
  { to: '/sandboxes', label: 'Sandboxes' },
];

function Item({ to, label }: NavItem) {
  return (
    <Box
      component={NavLink}
      to={to}
      end={to === '/'}
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: 34,
        padding: '0 12px',
        borderRadius: '8px',
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: 500,
        color: color.text,
        '&:hover': { backgroundColor: color.grid },
        '&.active': { backgroundColor: color.surface, fontWeight: 700, boxShadow: `inset 0 0 0 1px ${color.border}` },
        '&:focus-visible': { outline: `2px solid ${color.primary}`, outlineOffset: '-2px' },
      }}
    >
      {label}
    </Box>
  );
}

function Group({ label, items }: { label?: string; items: NavItem[] }) {
  return (
    <Stack spacing={0.25}>
      {label && (
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: color.textTertiary, padding: '4px 12px 2px' }}>
          {label}
        </Typography>
      )}
      {items.map((i) => (
        <Item key={i.to} {...i} />
      ))}
    </Stack>
  );
}

/** The cluster, and its nodes counted the way they are: machines and compute identities, never one total. */
function ClusterCard() {
  const { info } = useSession();
  const chain = useView<ChainSnapshot>('/chain', undefined, 60_000);
  const c = chain.data ? nodeCounts(chain.data.nodes) : null;
  return (
    <Tooltip title={info?.cluster.id ? `Cluster ${info.cluster.id}` : ''} placement="right">
      <Box sx={{ padding: '12px 14px', border: hairline, borderRadius: '12px', backgroundColor: color.surface }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
          {info?.cluster.name || shortKey(info?.cluster.id)}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ marginTop: '4px' }}>
          <Box
            aria-hidden
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: chain.error ? color.warning : color.success,
            }}
          />
          <Typography sx={{ fontSize: 12.5, color: color.textSecondary }}>
            {chain.error
              ? 'Couldn’t read the blockchain'
              : c
                ? `${c.machines} nodes · ${c.compute} compute identities`
                : 'Reading the blockchain…'}
          </Typography>
        </Stack>
      </Box>
    </Tooltip>
  );
}

export function Shell() {
  const { info, signOut } = useSession();
  const manager = !!info?.roles.includes('manager');
  const byConfig = info?.manager_source === 'backend_config';
  const role = manager ? (byConfig ? 'Manager · set by backend config' : 'Manager') : 'Provider';
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: color.page }}>
      <Box
        component="header"
        sx={{
          height: 56,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px 0 24px',
          backgroundColor: color.surface,
          borderBottom: hairline,
        }}
      >
        <Logo>
          <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.15 }}>Cluster Console</Typography>
          <Typography sx={{ fontSize: 12, color: color.textTertiary, lineHeight: 1.2 }}>
            Powered by Cere Network
          </Typography>
        </Logo>
        <Stack direction="row" spacing={2} alignItems="center">
          <Tooltip
            title={
              byConfig
                ? `${info?.account ?? ''} — devnet only: a manager because the console backend's EXTRA_MANAGERS lists this account, not because the blockchain says so.`
                : (info?.account ?? '')
            }
          >
            <Stack alignItems="flex-end" sx={{ lineHeight: '16px' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{shortKey(info?.account)}</Typography>
              <Typography sx={{ fontSize: 12, color: byConfig ? color.warning : color.textSecondary }}>
                {role}
              </Typography>
            </Stack>
          </Tooltip>
          <Button size="small" variant="text" color="secondary" onClick={signOut}>
            Sign out
          </Button>
        </Stack>
      </Box>
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Box
          component="nav"
          aria-label="Main"
          sx={{
            width: 228,
            flexShrink: 0,
            backgroundColor: color.inset,
            borderRight: hairline,
            padding: '16px 12px',
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            gap: 2.5,
          }}
        >
          <ClusterCard />
          <Group items={MANAGE} />
          <Group label="Services" items={SERVICES} />
          <Box sx={{ marginTop: 'auto', paddingTop: 1, borderTop: hairline }}>
            <Group items={[{ to: '/sources', label: 'Data sources' }]} />
          </Box>
        </Box>
        <Box component="main" sx={{ flex: 1, minWidth: 0, padding: { xs: '20px 16px 32px', md: '26px 32px 40px' } }}>
          <Box sx={{ maxWidth: 1440, margin: '0 auto' }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
