import { ReactNode, useMemo } from 'react';
import { Box, Button, Stack, Typography } from '@cluster-apps/ui';
import { NavLink, useSearchParams } from 'react-router-dom';

import { PageHeader, Section } from '~/components';
import { useCompute } from '~/compute/ComputeProvider';
import { useNow, useSandboxes } from '~/compute/hooks';
import { fmtAgo, fmtCpu, fmtMib, shortImage } from '~/compute/format';
import { isLive } from '~/compute/types';
import { color, text } from '~/theme/tokens';
import { CodeBlock } from '../components/bits';
import ComputeGate from '../components/ComputeGate';
import { FirstRunDialog } from '../components/FirstRunDialog';
import RecentDenials from '../components/egress/RecentDenials';
import QuickstartTabs from '../components/QuickstartTabs';
import { QUICKSTART_CLI, QUICKSTART_PYTHON, QUICKSTART_PYTHON_SETUP } from '../components/quickstart';
import { BucketChip, Mono, ReadError, StatusDot } from '../components/ui';

const Subhead = ({ children }: { children: string }) => (
  <Typography component="h3" sx={{ fontSize: 15, fontWeight: 700, marginBottom: '10px' }}>
    {children}
  </Typography>
);

/** What a developer needs to know about a sandbox, in three facts. */
const FACTS: { name: string; body: ReactNode }[] = [
  {
    name: 'Isolated',
    body: 'Any public image runs in gVisor on a DDC node, with the CPU and memory you reserve and a time limit. Exec commands, read and write files, and stream its logs while it runs.',
  },
  {
    name: 'Closed network',
    body: 'It reaches only the hosts you allow, and you can allow more while it runs. A credential a rule names is added to its requests on the way out; the sandbox never sees it.',
  },
  {
    name: 'Billed while it runs',
    body: 'Your compute bucket pays for the CPU and memory the sandbox reserves, from start to stop, or for what it used where that is more. There is no price list yet.',
  },
];

const RightNow = () => {
  const { data, error } = useSandboxes();
  const now = useNow(5000);
  const list = useMemo(() => data?.items ?? [], [data]);
  const live = list.filter((s) => isLive(s.status));
  const cpu = live.reduce((a, s) => a + s.resources.cpu, 0);
  const mem = live.reduce((a, s) => a + s.resources.memory_mib, 0);

  return (
    <Section
      title="Right now"
      fill
      actions={
        <Button component={NavLink} to="/sandboxes/list" variant="text" color="secondary" size="small">
          All sandboxes
        </Button>
      }
    >
      {error && !data && <ReadError what="your sandboxes" error={error} />}
      <Stack direction="row" gap="28px" marginBottom="16px">
        <Box>
          <Typography sx={text.amount}>{data ? live.length : '…'}</Typography>
          <Typography sx={text.secondary}>running now</Typography>
        </Box>
        <Box>
          <Typography sx={{ ...text.value, lineHeight: '34px' }}>{fmtCpu(cpu)}</Typography>
          <Typography sx={text.secondary}>{fmtMib(mem)} memory reserved</Typography>
        </Box>
      </Stack>
      <Typography sx={{ ...text.label, marginBottom: '6px' }}>Newest sandboxes, running or ended</Typography>
      <Stack sx={{ borderTop: `1px solid ${color.grid}` }}>
        {list.slice(0, 6).map((s) => (
          <Stack
            key={s.id}
            component={NavLink}
            to={`/sandboxes/list/${s.id}`}
            direction="row"
            alignItems="center"
            gap="10px"
            sx={{
              padding: '9px 0',
              borderBottom: `1px solid ${color.grid}`,
              textDecoration: 'none',
              color: 'inherit',
              '&:hover .sb-id': { color: color.primary },
            }}
          >
            <StatusDot status={s.status} />
            <Box minWidth={0} flex={1}>
              <Typography
                className="sb-id"
                sx={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <Mono>{s.id}</Mono>
              </Typography>
              <Typography sx={{ ...text.caption, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.labels['cere.agent'] ? `agent ${s.labels['cere.agent']} · ` : ''}
                {shortImage(s.image)}
              </Typography>
            </Box>
            <Typography sx={{ ...text.caption, whiteSpace: 'nowrap' }}>{fmtAgo(s.created_at, now)}</Typography>
          </Stack>
        ))}
        {data && list.length === 0 && (
          <Typography sx={{ ...text.secondary, paddingTop: '12px' }}>No sandboxes yet. Try the quickstart.</Typography>
        )}
      </Stack>
    </Section>
  );
};

const Overview = () => {
  const compute = useCompute();
  const [params, setParams] = useSearchParams();
  const firstRunOpen = params.get('run') === '1' && compute.status === 'ready';
  const openFirstRun = () => {
    params.set('run', '1');
    setParams(params);
  };
  const closeFirstRun = () => {
    params.delete('run');
    setParams(params, { replace: true });
  };

  return (
    <Box>
      <Box marginBottom="20px">
        <PageHeader
          title="Sandboxes"
          subtitle="Isolated containers on DDC nodes, created through an API: any public image, any command, a default-deny network."
          actions={
            <>
              <BucketChip bucketId={compute.bucketId} />
              <Button component={NavLink} to="/sandboxes/list?new=1" variant="outlined" color="secondary">
                New sandbox
              </Button>
            </>
          }
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.65fr) minmax(320px, 1fr)' },
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <Section title="Quickstart">
          <Stack spacing="20px">
            <QuickstartTabs
              cli={<CodeBlock code={QUICKSTART_CLI} />}
              python={
                <Stack spacing="12px">
                  <CodeBlock code={QUICKSTART_PYTHON_SETUP} />
                  <CodeBlock code={QUICKSTART_PYTHON} />
                </Stack>
              }
            />
            <Typography sx={{ ...text.caption, marginTop: '8px' }}>
              Step 1 needs membership of the Cerebellum-Network GitHub organization: the CLI and the SDK are released
              privately for now, so <Mono>gh</Mono> must be signed in with a member’s account (an anonymous download
              answers 404), and there is no public download yet. <Mono>cere login</Mono> opens this console, which asks
              you to approve the CLI for a bucket; your SSCP wallet signs it. In CI, use a token from{' '}
              <NavLink to="/access-tokens">Access tokens</NavLink> with <Mono>cere login --token-stdin</Mono>.
            </Typography>
            <Box>
              <Subhead>Try it here</Subhead>
              <Stack direction="row" alignItems="center" gap="16px" flexWrap="wrap">
                <Button variant="contained" onClick={openFirstRun} disabled={compute.status !== 'ready'}>
                  Run the example
                </Button>
                <Typography sx={text.secondary}>
                  Creates the sandbox above on the cluster, runs the command in it, and shows each step.
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </Section>
        {compute.status === 'ready' ? (
          <Stack gap="16px">
            <RightNow />
            <RecentDenials />
          </Stack>
        ) : (
          <ComputeGate>{null}</ComputeGate>
        )}
      </Box>

      <Section title="How sandboxes work">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
          {FACTS.map((p, i) => (
            <Box
              key={p.name}
              sx={{
                padding: { xs: '12px 0', md: '4px 22px 4px 0' },
                marginRight: { md: i < FACTS.length - 1 ? '22px' : 0 },
                borderRight: { md: i < FACTS.length - 1 ? `1px solid ${color.grid}` : 'none' },
              }}
            >
              <Typography sx={{ fontSize: 15, fontWeight: 700, marginBottom: '4px' }}>{p.name}</Typography>
              <Typography sx={text.secondary}>{p.body}</Typography>
            </Box>
          ))}
        </Box>
      </Section>

      <FirstRunDialog open={firstRunOpen} onClose={closeFirstRun} />
    </Box>
  );
};

export default Overview;
