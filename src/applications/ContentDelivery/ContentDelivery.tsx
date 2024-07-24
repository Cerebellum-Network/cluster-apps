import { Docs, DocsGroup, DocsSection } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';

import { CdnDocsIcon } from './icons';
import { StartGuideDoc, UploadWithCliDoc, StreamDoc, SuccessDoc } from './docs';

const ContentDelivery = () => {
  return (
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

      <DocsGroup title="Stream from [Cluster Name]">
        <DocsSection title="Step-by-step guide">
          <StreamDoc />
        </DocsSection>

        <DocsSection title="Success user stories">
          <SuccessDoc />
        </DocsSection>
      </DocsGroup>
    </Docs>
  );
};

export default observer(ContentDelivery);
