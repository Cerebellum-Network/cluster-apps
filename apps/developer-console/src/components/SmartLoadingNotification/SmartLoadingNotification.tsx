import { useState, useEffect } from 'react';
import { 
  Paper, 
  Typography, 
  CircularProgress, 
  styled, 
  Box,
  Collapse
} from '@cluster-apps/ui';
import { Fade, LinearProgress } from '@mui/material';

const LoadingContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  borderRadius: theme.shape.borderRadius * 2,
  backgroundColor: theme.palette.mode === 'dark' 
    ? 'rgba(255, 255, 255, 0.05)' 
    : 'rgba(0, 0, 0, 0.02)',
  border: `1px solid ${theme.palette.divider}`,
  maxWidth: 600,
  margin: '0 auto',
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(4),
  position: 'relative',
  overflow: 'hidden',
}));

const ProgressWrapper = styled(Box)({
  width: '100%',
  marginTop: 16,
  marginBottom: 16,
});

const TipContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.mode === 'dark' 
    ? 'rgba(255, 255, 255, 0.03)' 
    : 'rgba(0, 0, 0, 0.01)',
  borderRadius: theme.shape.borderRadius,
  width: '100%',
}));

interface SmartLoadingNotificationProps {
  isLoading: boolean;
  loadingTime?: number; // in milliseconds
  showAfterDelay?: number; // in milliseconds
}

const loadingMessages = [
  "Loading your buckets...",
  "Fetching data from the decentralized network...",
  "Retrieving your files from the blockchain...",
  "Connecting to the Cere Network..."
];

const tips = [
  "Tip: Buckets are stored on the blockchain and may take a moment to load.",
  "Tip: You can create multiple buckets to organize your files.",
  "Tip: Files in public buckets can be accessed without authentication.",
  "Tip: The Cere Network ensures your data is stored securely across multiple nodes."
];

export const SmartLoadingNotification = ({ 
  isLoading, 
  loadingTime = 5000, 
  showAfterDelay = 1000 
}: SmartLoadingNotificationProps) => {
  const [visible, setVisible] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showTip, setShowTip] = useState(false);

  // Show the notification after a delay if still loading
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (isLoading) {
      timeout = setTimeout(() => {
        setVisible(true);
      }, showAfterDelay);
    } else {
      setVisible(false);
    }
    
    return () => {
      clearTimeout(timeout);
    };
  }, [isLoading, showAfterDelay]);

  // Rotate through messages
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (visible) {
      interval = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 3000);
    }
    
    return () => {
      clearInterval(interval);
    };
  }, [visible]);

  // Show tip after 3 seconds of loading
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (visible) {
      timeout = setTimeout(() => {
        setShowTip(true);
        
        // Rotate tips every 5 seconds
        const tipInterval = setInterval(() => {
          setTipIndex((prev) => (prev + 1) % tips.length);
        }, 5000);
        
        return () => {
          clearInterval(tipInterval);
        };
      }, 3000);
    } else {
      setShowTip(false);
    }
    
    return () => {
      clearTimeout(timeout);
    };
  }, [visible]);

  // Simulate progress
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (visible) {
      const incrementAmount = 100 / (loadingTime / 100); // Update every 100ms
      
      interval = setInterval(() => {
        setProgress((prev) => {
          // Slow down progress as it approaches 90%
          const remaining = 100 - prev;
          const increment = prev > 70 ? incrementAmount * 0.3 : incrementAmount;
          const newProgress = prev + increment;
          
          return newProgress > 90 ? 90 : newProgress;
        });
      }, 100);
    } else {
      setProgress(0);
    }
    
    return () => {
      clearInterval(interval);
    };
  }, [visible, loadingTime]);

  // Complete progress when loading finishes
  useEffect(() => {
    if (!isLoading && progress > 0) {
      setProgress(100);
      
      // Hide after animation completes
      const timeout = setTimeout(() => {
        setVisible(false);
      }, 1000);
      
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [isLoading, progress]);

  if (!visible) {
    return null;
  }

  return (
    <Fade in={visible} timeout={500}>
      <LoadingContainer elevation={2}>
        <CircularProgress size={40} thickness={4} />
        <Typography variant="subtitle1" align="center" sx={{ mt: 2 }}>
          {loadingMessages[messageIndex]}
        </Typography>
        
        <ProgressWrapper>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 6, borderRadius: 3 }}
          />
          <Typography 
            variant="caption" 
            color="text.secondary" 
            align="center" 
            display="block" 
            sx={{ mt: 1 }}
          >
            {Math.round(progress)}%
          </Typography>
        </ProgressWrapper>
        
        <Collapse in={showTip}>
          <TipContainer>
            <Typography 
              variant="body2" 
              color="text.secondary"
              align="center"
            >
              {tips[tipIndex]}
            </Typography>
          </TipContainer>
        </Collapse>
      </LoadingContainer>
    </Fade>
  );
};

export default SmartLoadingNotification; 