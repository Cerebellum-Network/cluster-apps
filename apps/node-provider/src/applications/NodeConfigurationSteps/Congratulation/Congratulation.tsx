import { Box, Button, Docs, DocsGroup, DocsSection, Typography } from '@cluster-apps/ui';
import { DataStorageDocsIcon } from '@cluster-apps/developer-console/src/applications/ContentStorage/icons';
import { AnalyticsId } from '@cluster-apps/analytics';
import { useNavigate } from 'react-router-dom';
import ReactConfetti from 'react-confetti';
import { useEffect, useState } from 'react';

const Congratulation = () => {
  const [isConfetti, showConfetti] = useState(false);

  useEffect(() => {
    setTimeout(() => showConfetti(false), 6000);
  }, []);

  const navigate = useNavigate();
  return (
    <>
      <Typography variant="h1" textAlign="center" marginTop="80px" marginBottom="50px">
        Congratulations! Your node is ready!
      </Typography>
      <Box
        display="flex"
        flexDirection="column"
        border={(theme) => `1px solid ${theme.palette.divider}`}
        borderRadius="12px"
        marginBottom="20px"
      >
        <Docs
          icon={<DataStorageDocsIcon />}
          title="Your new node has been successfully created, verified and added to the cluster"
          description="Now that your node is ready, explore:"
        >
          <DocsGroup title="">
            <DocsSection
              analyticId={AnalyticsId.starterGuideStorage}
              title="How to monitor usage to optimize costs and performance"
            >
              Will be soon
            </DocsSection>
            <DocsSection analyticId={AnalyticsId.starterGuideStorage} title="How to Get assistance or ask questions">
              Will be soon
            </DocsSection>
            <DocsSection
              analyticId={AnalyticsId.starterGuideStorage}
              title="How to return your staking deposit after node removal"
            >
              Will be soon
            </DocsSection>
          </DocsGroup>
        </Docs>
      </Box>
      <Box textAlign="center">
        <Button
          onClick={() => {
            navigate('/network-topology');
          }}
        >
          Open Nodes List →
        </Button>
      </Box>
      {isConfetti && <ReactConfetti />}
    </>
  );
};

export default Congratulation;
