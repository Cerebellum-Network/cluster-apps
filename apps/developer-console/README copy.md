# Cere Network DDC Payment Interface

This application provides a user interface for DDC (Decentralized Data Cloud) account top-ups using the Cere Network payment flow. It allows users to:

1. Connect their wallet
2. Swap USDT/USDC for CERE tokens 
3. Teleport CERE tokens to Cere Network
4. Update and verify their DDC account balance

## Features

- Matrix-inspired UI showcasing the payment flow
- Real-time API integration with payment services
- Step-by-step process visualization
- Terminal-style command output

## Technical Implementation

The application implements the full payment flow as described in the requirements:

1. **Token swaps** (USDT/USDC to CERE) through smart contracts
2. **Teleportation** via Hyperbridge to Cere Network  
3. **Fiat-to-stablecoin conversion** using On-Ramp APIs (optional flow)
4. **DDC account updates** on Cere Mainnet

## Getting Started

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```

3. Build the application:
   ```
   npm run build
   ```

4. Start the server:
   ```
   npm start
   ```

5. Access the DDC Payment Interface at:
   ```
   http://localhost:3000/ddc-payment
   ```

## Development

For active development with hot reloading:

```
npm run dev
```

## API Endpoints

The application exposes the following API endpoints:

- `POST /api/payments/connect-wallet`: Connect a wallet
- `POST /api/payments/swap-tokens`: Swap stablecoins for CERE tokens
- `POST /api/payments/teleport`: Teleport CERE tokens to Cere Network
- `POST /api/payments/verify-ddc`: Verify DDC account balance

Additional endpoints for production systems:

- `POST /api/payments/direct`: Initiate a direct stablecoin payment 
- `POST /api/payments/webhook/stablecoin`: Process stablecoin transaction webhook
- `POST /api/payments/fiat`: Initiate a fiat payment via on-ramp provider
- `POST /api/payments/webhook/fiat`: Process fiat payment webhook

## Architecture

The application is built with:

- **Frontend**: HTML, CSS, JavaScript with Matrix-inspired design
- **Backend**: Express.js REST API
- **Services**: Payment, Contract, Teleport, and DDC services
