import { Stack, styled } from '@developer-console/ui';

export const OnboardingContainer = styled(Stack)({
  height: 'calc(100vh - 128px)',
  boxSizing: 'border-box',
  flexGrow: 1,
  background: '#F5F7FA',
  alignItems: 'center',
});

export const OnboardingContent = styled(Stack)(({ theme }) => ({
  maxWidth: '1560px',
  flexDirection: 'row',
  height: '100%',
  width: '100%',
  gap: theme.spacing(5),
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
}));

export const RightColumn = styled(Stack)({
  flex: 1,
  overflow: 'hidden',
  boxSizing: 'border-box',
  minWidth: '560px',
  height: '100%',
  borderRadius: '20px',
});

export const LeftColumn = styled(Stack)(({ theme }) => ({
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  padding: theme.spacing(6, 5),
  borderRadius: '20px',
  background: '#fff',
  border: '1px solid #E6E6E6',
  alignItems: 'center',
  justifyContent: 'center',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));
