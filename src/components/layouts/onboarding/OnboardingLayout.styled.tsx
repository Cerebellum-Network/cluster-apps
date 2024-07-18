import styled from '@emotion/styled';
import { Stack } from '@mui/material';

export const OnboardingContainer = styled(Stack)({
  height: 'calc(100vh - 256px)',
  boxSizing: 'border-box',
  flexGrow: 1,
  background: '#F5F7FA',
  alignItems: 'center',
});

export const OnboardingContent = styled(Stack)({
  maxWidth: '1560px',
  flexDirection: 'row',
  height: '100%',
});

export const RightColumn = styled(Stack)({
  flex: 1,
  overflow: 'hidden',
  // padding: '40px',
  boxSizing: 'border-box',
  minWidth: '500px',
  height: '100%',
  borderRadius: '20px',
});

export const LeftColumn = styled(Stack)({
  maxWidth: '1000px',
  minWidth: '600px',
  height: '100%',
  boxSizing: 'border-box',
  padding: '48px 40px',
  borderRadius: '20px',
  background: '#fff',
  border: '1px solid #E6E6E6',
  alignItems: 'center',
  justifyContent: 'center',
});
