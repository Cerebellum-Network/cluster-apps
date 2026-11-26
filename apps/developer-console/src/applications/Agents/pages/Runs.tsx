import { observer } from 'mobx-react-lite';
import { Box, Typography } from '@cluster-apps/ui';

import { ExperimentalPill, PageHeader, Section } from '~/components';
import { AGENT_RUN_KIND, LABEL } from '~/compute/agentRun';
import { useCompute } from '~/compute/ComputeProvider';
import { useSandboxes } from '~/compute/hooks';
import { text } from '~/theme/tokens';
import { BucketChip, ReadError } from '../../Sandboxes/components/ui';
import RunsTable, { liveRuns, runRows } from '../components/RunsTable';

/** Every agent run of this bucket: the sandboxes labelled `cere.kind=agent-run`, from the console, the CLI or the SDK. */
const Runs = () => {
  const { bucketId } = useCompute();
  const runs = useSandboxes({ label: [`${LABEL.kind}:${AGENT_RUN_KIND}`] });
  const rows = runRows(runs.data?.items ?? [], liveRuns());
  return (
    <Box>
      <Box marginBottom="20px">
        <PageHeader
          title="Runs"
          badge={<ExperimentalPill />}
          subtitle="Each run is one sandbox. Runs started from a terminal show here as well."
          actions={<BucketChip bucketId={bucketId} />}
        />
      </Box>
      <Section flush>
        {runs.error && !runs.data ? (
          <Box padding="18px 22px">
            <ReadError what="runs" error={runs.error} />
          </Box>
        ) : (
          <RunsTable rows={rows} empty={runs.data ? 'No runs yet. Run an agent from its page.' : 'Reading…'} />
        )}
      </Section>
      {runs.data?.truncated && (
        <Typography sx={{ ...text.caption, marginTop: '8px' }}>The newest {runs.data.items.length} shown.</Typography>
      )}
    </Box>
  );
};

export default observer(Runs);
