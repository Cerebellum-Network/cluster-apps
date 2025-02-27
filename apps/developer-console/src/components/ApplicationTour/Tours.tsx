import { Typography } from '@cluster-apps/ui';
import { NamedSteps } from './TourController';

export const initialTourSteps: NamedSteps = [
  {
    selector: '[data-tour="account"]',
    content: (
      <>
        <Typography variant="subtitle1">Let’s get started!</Typography>
        <Typography variant="body2">
          Top up your Cere Wallet and transfer tokens to your DDC account to keep your buckets running.
          <br />
          To get <b>free CERE tokens</b>, please request them in our discord channel.
        </Typography>
      </>
    ),
  },
  {
    selector: '[data-tour="bucket"]',
    content: (
      <>
        <Typography variant="subtitle1">Start with creation of your first bucket</Typography>
        <Typography variant="body2">Create the bucket to store your data</Typography>
      </>
    ),
  },
];

initialTourSteps.name = 'initialTourSteps';

export const createBucketTourSteps: NamedSteps = [...initialTourSteps];

createBucketTourSteps.name = 'createBucketTourSteps';

export const uploadTourSteps: NamedSteps = [
  ...initialTourSteps,
  {
    selector: '[data-tour="upload"]',
    content: (
      <>
        <Typography variant="subtitle1">Upload file or folder</Typography>
        <Typography variant="body2">
          As soon as you create you bucket you will be able to upload your first file/folder
        </Typography>
      </>
    ),
  },
];

uploadTourSteps.name = 'uploadTourSteps';
