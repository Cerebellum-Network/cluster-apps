import { Stack, styled } from '@cluster-apps/ui';

export const OnboardingContainer = styled(Stack)({
  height: '100vh',
  width: '100vw',
  margin: 0,
  padding: 0,
  boxSizing: 'border-box',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
});

export const VideoBackground = styled('video')({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  zIndex: -1,
});

export const LogoContainer = styled(Stack)({
  position: 'absolute',
  top: '24px',
  left: '24px',
  zIndex: 2,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ContentContainer = styled(Stack)(({ theme }: { theme: any }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 1,
  width: '90%',
  maxWidth: '480px',
  padding: theme.spacing(4),
  borderRadius: '16px',
  background: 'rgba(255, 255, 255, 0.15)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}));
