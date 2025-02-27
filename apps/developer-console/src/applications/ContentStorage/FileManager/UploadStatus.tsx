import { CircularProgress, IconButton, Typography, Alert, AlertProps, styled } from '@mui/material';
import { Close as CloseIcon, Warning as WarningIcon, Check as CheckIcon } from '@mui/icons-material';
import { useMemo } from 'react';

type Status = 'uploading' | 'success' | 'error';

interface UploadStatusProps {
  status: Status;
  type: 'file' | 'folder' | 'emptyFolder';
  onClose: () => void;
}

const StyledAlert = styled(Alert)<AlertProps>(({ theme }) => ({
  margin: theme.spacing(2.5),
  display: 'flex',
  alignItems: 'center',
  marginBottom: theme.spacing(2),
}));

export const UploadStatus = ({ status, type, onClose }: UploadStatusProps) => {
  const entity = useMemo(() => {
    if (type === 'emptyFolder') {
      return 'folder';
    }
    return type;
  }, [type]);

  const getMessage = () => {
    switch (status) {
      case 'uploading':
        return `Please wait while we ${type !== 'emptyFolder' ? 'upload' : 'create'} your ${entity}...`;
      case 'success':
        return `Your ${entity} has been ${type !== 'emptyFolder' ? 'uploaded' : 'created'} successfully!`;
      case 'error':
        return `An error occurred while ${type !== 'emptyFolder' ? 'uploading' : 'creating'} your ${entity}. Please try again.`;
      default:
        return '';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'uploading':
        return <CircularProgress size="20px" />;
      case 'error':
        return <WarningIcon />;
      case 'success':
        return <CheckIcon />;
      default:
        return null;
    }
  };

  const getAlertSeverity = (): AlertProps['severity'] => {
    switch (status) {
      case 'uploading':
        return 'info';
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  };

  return (
    <StyledAlert
      severity={getAlertSeverity()}
      icon={getIcon()}
      action={
        status !== 'uploading' && (
          <IconButton aria-label="close" color="inherit" size="small" onClick={onClose}>
            <CloseIcon fontSize="inherit" />
          </IconButton>
        )
      }
      sx={{ mb: 2 }}
    >
      <Typography>{getMessage()}</Typography>
    </StyledAlert>
  );
};
