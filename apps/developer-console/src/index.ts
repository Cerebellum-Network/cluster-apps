import express from 'express';
import path from 'path';
import cors from 'cors';
// import paymentRoutes from '../../api/src/PaymentService/routes/payment.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Mock API Routes for matrix-demo.html
app.post('/api/payments/connect-wallet', (req, res) => {
  res.json({
    success: true,
    wallet: {
      address: req.body.walletAddress || '0x7A2F8E98C0dE9C4F8B43011813d0F62A15D926F9B3',
      network: req.body.network || 'Ethereum',
      balance: {
        USDT: '125.00',
        USDC: '75.50',
        ETH: '0.45'
      }
    }
  });
});

app.post('/api/payments/swap-tokens', (_req, res) => {
  res.json({
    success: true,
    payment: {
      id: 'payment-' + Date.now(),
      status: 'TOKENS_SWAPPED'
    },
    swapDetails: {
      cereAmount: '95.5',
      txHash: '0x' + Math.random().toString(16).substring(2, 10) + '...'
    }
  });
});

app.post('/api/payments/teleport', (_req, res) => {
  res.json({
    success: true,
    teleportDetails: {
      cereAmount: '95.5',
      teleportTxId: '0x' + Math.random().toString(16).substring(2, 10) + '...',
      status: 'COMPLETED'
    }
  });
});

app.post('/api/payments/verify-ddc', (_req, res) => {
  res.json({
    success: true,
    ddcDetails: {
      accountId: 'DDC_123456',
      network: 'Cere Mainnet',
      previousBalance: '50.25',
      newTokens: '95.5',
      currentBalance: '145.75'
    }
  });
});

// Serve the matrix-demo.html for specific route
app.get('/ddc-payment', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/matrix-demo.html'));
});

// Serve matrix-demo.html directly on both routes
app.get('/matrix-demo', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/matrix-demo.html'));
});

app.get('/matrix-demo.html', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/matrix-demo.html'));
});

// Main route
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Fallback route for SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`DDC Payment Interface available at: http://localhost:${PORT}/ddc-payment`);
  console.log(`Matrix Demo available at: http://localhost:${PORT}/matrix-demo`);
});

export default app; 