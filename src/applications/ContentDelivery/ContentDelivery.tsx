import {
  Paper,
  Docs,
  DocsGroup,
  DocsSection,
  Stack,
  Typography,
  BucketSelect,
  BucketAccess,
  BucketAccessProps,
  Button,
} from '@developer-console/ui';
import { observer } from 'mobx-react-lite';

import { CdnDocsIcon } from './icons';
import { DDC_CLUSTER_NAME } from '~/constants';
import { StartGuideDoc, UploadWithCliDoc, StreamDoc, SuccessDoc } from './docs';
import { useState } from 'react';

const ContentDelivery = () => {
  const [bucketId, setBucketId] = useState<bigint>(1n);
  const [access, setAccess] = useState<BucketAccessProps['value']>('private');

  return (
    <Stack spacing={2}>
      <Paper component={Stack} direction="row" alignItems="center" justifyContent="space-between" padding={2}>
        <Typography variant="subtitle1">Please select one of your buckets</Typography>
        <BucketSelect
          value={bucketId}
          label="Bucket"
          options={[
            { id: 1n, access: 'private', storedBytes: 100 },
            { id: 2n, access: 'public', storedBytes: 20000 },
            { id: 3n, access: 'public', storedBytes: 30000000 },
          ]}
          onChange={(bucketId) => setBucketId(bucketId)}
        />
      </Paper>

      <Paper component={Stack} padding={2} spacing={2}>
        <Typography variant="subtitle1">File access control</Typography>
        <BucketAccess value={access} onChange={(value) => setAccess(value)} />
        <Button size="large" sx={{ width: 150, alignSelf: 'flex-start' }}>
          Save
        </Button>
      </Paper>

      <Docs
        icon={<CdnDocsIcon />}
        title="Start streaming now with Cere!"
        description="Enjoy unparalleled speed, reliability and censorship-resistant content streaming"
      >
        <DocsGroup title="Upload your content using DDC SDK">
          <DocsSection title="Upload your content using DDC CLI">
            <UploadWithCliDoc />
          </DocsSection>

          <DocsSection title="Quick start guide in Github">
            <StartGuideDoc />
          </DocsSection>
        </DocsGroup>

        <DocsGroup title={`Stream from ${DDC_CLUSTER_NAME}`}>
          <DocsSection title="Step-by-step guide">
            <StreamDoc />
          </DocsSection>

          <DocsSection title="Success user stories">
            <SuccessDoc />
          </DocsSection>
        </DocsGroup>
      </Docs>
    </Stack>
  );
};

export default observer(ContentDelivery);
