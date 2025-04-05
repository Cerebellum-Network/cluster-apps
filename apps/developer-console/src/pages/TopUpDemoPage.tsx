import React from 'react';
import { TopUpDemo } from '../components/TopUpDemo';
import { Box, Typography, styled } from '@mui/material';

// Estilos de Cere
const cereBackground = 'linear-gradient(135deg, #6c2ee3 0%, #3b1b68 100%)';

const PageContainer = styled(Box)({
  minHeight: '100vh',
  width: '100%',
  background: cereBackground,
  backgroundAttachment: 'fixed',
  padding: '20px 0',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
});

const TopUpDemoPage: React.FC = () => {
  return (
    <PageContainer>
      <Box sx={{ width: '100%', maxWidth: 'md', px: 2 }}>
        <TopUpDemo />
      </Box>
    </PageContainer>
  );
};

export default TopUpDemoPage; 