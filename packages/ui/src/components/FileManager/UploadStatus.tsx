import { Box, CircularProgress, IconButton, styled, Typography } from '@mui/material';
import { CloseIcon, WarningIcon, CheckIcon } from '@developer-console/ui';

type Status = 'uploading' | 'success' | 'error';

interface UploadStatusProps {
  status: Status;
  type: 'file' | 'folder';
  onClose: () => void;
}

const StatusBox = styled(Box)(({ theme, status }: { theme?: any; status?: Status }) => {
  let backgroundColor;
  let borderColor;
  let textColor;
  switch (status) {
    case 'uploading':
      backgroundColor = '#F5F6FF'; // @TODO replace with theme color
      borderColor = theme.palette.info.main;
      textColor = '#5865F2'; // @TODO replace with theme color
      break;
    case 'success':
      backgroundColor = '#EDF9EF'; // @TODO replace with theme color
      borderColor = theme.palette.success.main;
      textColor = '#1F502A'; // @TODO replace with theme color
      break;
    case 'error':
      backgroundColor = '#FFF0EF'; // @TODO replace with theme color
      borderColor = theme.palette.error.main;
      textColor = '#6B2B2A'; // @TODO replace with theme color
      break;
    default:
      backgroundColor = theme.palette.background.paper;
      borderColor = theme.palette.divider;
      textColor = theme.palette.divider;
  }
  return {
    backgroundColor,
    color: textColor,
    border: `1px solid ${borderColor}`,
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    display: 'flex',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: '20px',
  };
});

export const UploadStatus = ({ status, type, onClose }: UploadStatusProps) => {
  const getMessage = () => {
    switch (status) {
      case 'uploading':
        return `Please wait while we upload your ${type}...`;
      case 'success':
        return `Your ${type} has been uploaded successfully!`;
      case 'error':
        return `An error occurred while uploading your ${type}. Please try again.`;
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

  return (
    <StatusBox status={status}>
      <Box display="flex" alignItems="center">
        {getIcon()}
        <Typography marginLeft="16px">{getMessage()}</Typography>
      </Box>
      {status !== 'uploading' && (
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      )}
    </StatusBox>
  );
};
