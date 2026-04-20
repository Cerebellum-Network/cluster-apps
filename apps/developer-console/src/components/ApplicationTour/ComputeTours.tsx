import { Typography, Button, Box } from '@cluster-apps/ui';
import { NamedSteps } from './TourController';

let globalOnCreateBucket: (() => void) | null = null;

export const setGlobalOnCreateBucket = (fn: (() => void) | null) => {
  globalOnCreateBucket = fn;
};

export const createComputeOnboardingTourSteps = (onCreateBucket?: () => void): NamedSteps => [
  {
    selector: '[data-tour="bucket"]',
    content: (
      <Box sx={{ maxWidth: 400 }}>
        <Typography
          variant="subtitle1"
          gutterBottom
          sx={{ fontWeight: 600, color: 'primary.main', fontSize: '1.25rem' }}
        >
          🎉 Welcome to Dragon 1 Compute!
        </Typography>
        <Typography variant="body1" paragraph>
          Thank you for onboarding to the Dragon 1 Compute. While we review your request, you can already prepare the
          buckets for your Agent Service.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Let's get you set up with the essential infrastructure for your compute workload.
        </Typography>
      </Box>
    ),
  },
  {
    selector: '[data-tour="bucket"]',
    content: (
      <Box sx={{ maxWidth: 400 }}>
        <Typography
          variant="subtitle1"
          gutterBottom
          sx={{ fontWeight: 600, color: 'primary.main', fontSize: '1.25rem' }}
        >
          📦 Create Data Persistence Bucket
        </Typography>
        <Typography variant="body1" paragraph>
          First, let's create a bucket for data persistence - that's the one you will use with SDK for data onboarding.
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          This bucket will store your application data and training datasets.
        </Typography>
        <Button
          variant="contained"
          size="small"
          sx={{ mt: 1 }}
          onClick={() => {
            console.log('Create data bucket clicked');
            if (onCreateBucket) {
              onCreateBucket();
            } else if (globalOnCreateBucket) {
              globalOnCreateBucket();
            }
          }}
        >
          Create Data Bucket
        </Button>
      </Box>
    ),
  },
  {
    selector: '[data-tour="bucket"]',
    content: (
      <Box sx={{ maxWidth: 400 }}>
        <Typography
          variant="subtitle1"
          gutterBottom
          sx={{ fontWeight: 600, color: 'primary.main', fontSize: '1.25rem' }}
        >
          🤖 Create Models & Code Bucket
        </Typography>
        <Typography variant="body1" paragraph>
          Now, let's create a separate bucket for your Agents and Models code.
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          This bucket will store your model files, agent configurations, and deployment scripts.
        </Typography>
        <Button
          variant="contained"
          size="small"
          sx={{ mt: 1 }}
          onClick={() => {
            console.log('Create models bucket clicked');
            if (onCreateBucket) {
              onCreateBucket();
            } else if (globalOnCreateBucket) {
              globalOnCreateBucket();
            }
          }}
        >
          Create Models Bucket
        </Button>
      </Box>
    ),
  },
  {
    selector: '[data-tour="bucket"]',
    content: (
      <Box sx={{ maxWidth: 400 }}>
        <Typography
          variant="subtitle1"
          gutterBottom
          sx={{ fontWeight: 600, color: 'success.main', fontSize: '1.25rem' }}
        >
          ✅ You're All Set!
        </Typography>
        <Typography variant="body1" paragraph>
          Perfect! You've created the essential buckets for your compute workload.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          We will notify you as soon as we get your application approved and you can start using our compute
          infrastructure.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          In the meantime, you can upload your models and prepare your data for deployment.
        </Typography>
      </Box>
    ),
  },
];

export const computeOnboardingTourSteps = createComputeOnboardingTourSteps();
computeOnboardingTourSteps.name = 'computeOnboardingTourSteps';
