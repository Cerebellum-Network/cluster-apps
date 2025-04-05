import React from 'react';
import { MatrixSwapDemo } from '../components/MatrixSwapDemo';
import { styled, Box } from '@mui/material';

const PageContainer = styled(Box)({
  minHeight: '100vh',
  width: '100%',
  background: '#000',
  padding: 0,
  margin: 0,
  overflow: 'hidden',
});

const MatrixSwapDemoPage: React.FC = () => {
  return (
    <PageContainer>
      <MatrixSwapDemo />
    </PageContainer>
  );
};

export default MatrixSwapDemoPage; 