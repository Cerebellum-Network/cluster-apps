import { useState, useEffect } from 'react';
import { Box, Button, Typography, IconButton, styled, Paper } from '@cluster-apps/ui';
import { Close as CloseIcon } from '@mui/icons-material';

const StyledInfoBar = styled(Paper)(({ theme }) => ({
  position: 'relative',
  padding: theme.spacing(2, 3),
  marginBottom: theme.spacing(3),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: theme.palette.mode === 'dark' 
    ? 'rgba(88, 101, 242, 0.1)' 
    : 'rgba(88, 101, 242, 0.05)',
  border: `1px solid ${theme.palette.primary.main}`,
  borderRadius: theme.shape.borderRadius,
}));

const InfoBar = () => {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    const hidden = localStorage.getItem('hideInfoBar') === 'true';
    setIsVisible(!hidden);
  }, []);

  const handleDismiss = (permanent: boolean) => {
    setIsVisible(false);
    if (permanent) {
      localStorage.setItem('hideInfoBar', 'true');
    }
  };

  if (!isVisible) return null;

  return (
    <StyledInfoBar elevation={0}>
      <Box flex={1}>
        <Typography variant="subtitle1">
          Welcome to the Cere Developer Console
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Get started by exploring our documentation and creating your first bucket.
        </Typography>
      </Box>
      <Box display="flex" alignItems="center" gap={2}>
        <Button
          variant="text"
          size="small"
          onClick={() => handleDismiss(true)}
        >
          Don't show again
        </Button>
        <IconButton
          size="small"
          onClick={() => handleDismiss(false)}
          sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </StyledInfoBar>
  );
};

export default InfoBar; 