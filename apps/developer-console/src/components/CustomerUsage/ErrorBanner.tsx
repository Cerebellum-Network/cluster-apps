import { Alert, Button, Box } from '@cluster-apps/ui';

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

export const ErrorBanner = ({ message, onRetry }: ErrorBannerProps) => (
  <Box marginBottom={2}>
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      {message}
    </Alert>
  </Box>
);
