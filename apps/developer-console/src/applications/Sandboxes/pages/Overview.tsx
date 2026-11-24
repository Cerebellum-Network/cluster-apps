import { useMemo } from 'react';
import { Box, Button, Stack, Typography } from '@cluster-apps/ui';
import { NavLink, useSearchParams } from 'react-router-dom';

import { PageHeader, Section } from '~/components';
import { useCompute } from '~/compute/ComputeProvider';
import { useNow, useSandboxes } from '~/compute/hooks';
import { fmtAgo, fmtCpu, fmtMib, shortImage } from '~/compute/format';
import { isLive } from '~/compute/types';
import { color, text } from '~/theme/tokens';
import { CodeBlock, StepTitle } from '../components/bits';
import ComputeGate from '../components/ComputeGate';
import { FirstRunDialog } from '../components/FirstRunDialog';
import { QUICKSTART_PYTHON, QUICKSTART_SHELL } from '../components/quickstart';
import { BucketChip, Mono, ReadError, StatusDot } from '../components/ui';

/** The parts a sandbox passes through, as the cluster names them. */
const PARTS: { name: string; body: string }[] = [
  {
    name: 'Compute gateway',
    body: 'The public API. It checks your token for the bucket and its balance on every call.',
  },
  {
    name: 'Resource manager',
    body: 'Places each sandbox on the node with the most free memory left, from the capacity nodes report.',
  },
  {
    name: 'Sandbox runtime',
    body: 'Runs it in gVisor on that node and measures CPU and memory from the host, minute by minute.',
  },
  {
    name: 'Egress proxy',
    body: 'The only way out. It allows the hosts and methods you list, adds your secrets, and logs each request.',
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
          <Typography sx={text.secondary}>running</Typography>
        </Box>
        <Box>
          <Typography sx={{ ...text.value, lineHeight: '34px' }}>{fmtCpu(cpu)}</Typography>
          <Typography sx={text.secondary}>{fmtMib(mem)} memory reserved</Typography>
        </Box>
      </Stack>
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
              <Typography className="sb-id" sx={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
            <Box>
              <StepTitle no={1} title="From a terminal" />
              <CodeBlock code={QUICKSTART_SHELL} />
            </Box>
            <Box>
              <StepTitle no={2} title="From Python" />
              <CodeBlock code={QUICKSTART_PYTHON} />
            </Box>
            <Box>
              <StepTitle no={3} title="Try it here" />
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
        {compute.status === 'ready' ? <RightNow /> : <ComputeGate>{null}</ComputeGate>}
      </Box>

      <Section title="How a sandbox runs">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' } }}>
          {PARTS.map((p, i) => (
            <Box
              key={p.name}
              sx={{
                padding: { xs: '12px 0', md: '4px 22px 4px 0' },
                marginRight: { md: i < PARTS.length - 1 ? '22px' : 0 },
                borderRight: { md: i < PARTS.length - 1 ? `1px solid ${color.grid}` : 'none' },
              }}
            >
              <Typography sx={{ fontSize: 15, fontWeight: 700, marginBottom: '4px' }}>{p.name}</Typography>
              <Typography sx={text.secondary}>{p.body}</Typography>
            </Box>
          ))}
        </Box>
        <Typography sx={{ ...text.secondary, marginTop: '14px' }}>
          Usage is billed as measured: CPU-seconds and GiB-seconds of memory, in signed records each node sends to its
          DAC agent once a minute and when the sandbox ends.
        </Typography>
      </Section>

      <FirstRunDialog open={firstRunOpen} onClose={closeFirstRun} />
    </Box>
  );
};

export default Overview;
