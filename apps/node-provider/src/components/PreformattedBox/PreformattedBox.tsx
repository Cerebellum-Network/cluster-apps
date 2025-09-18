import { Box } from '@mui/material';
import { PropsWithChildren } from 'react';

export const PreFormattedBox = ({ children }: PropsWithChildren<{}>) => (
  <Box
    component="pre"
    style={{
      width: '100%',
      backgroundColor: 'black',
      color: '#F9F9F9',
      fontSize: '12px',
      fontWeight: '700',
      lineHeight: '18px',
      padding: '16px 32px 16px 32px',
      borderRadius: 8,
      fontFamily: 'monospace',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      boxSizing: 'border-box',
      marginBottom: 0,
    }}
  >
    {children}
  </Box>
);
