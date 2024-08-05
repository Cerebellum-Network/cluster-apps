import { useMediaQuery, useTheme } from '@mui/material';

const useIsDesktop = () => {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.up('md'));
};

const useIsTablet = () => {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.between('sm', 'md'));
};

const useIsMobile = () => {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
};

export { useIsDesktop, useIsTablet, useIsMobile };
