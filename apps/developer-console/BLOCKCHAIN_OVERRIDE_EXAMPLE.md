# Blockchain Endpoint Override for Testing

## Overview
This application now supports overriding the default blockchain endpoint for testing purposes. This allows you to connect to a local blockchain node instead of the default Cere network endpoints.

## Configuration

### Method 1: Environment Variable (Recommended)
Create a `.env.local` file in the `apps/developer-console/` directory and add:

```bash
# Override blockchain endpoint to local node
VITE_BLOCKCHAIN_ENDPOINT_OVERRIDE=ws://127.0.0.1:9944

# Billing service configuration
VITE_BILLING_SERVICE_ENDPOINT=http://localhost:8080

# Other blockchain settings
VITE_DDC_NETWORK=testnet
VITE_DDC_CLUSTER_ID=0x0
VITE_DDC_SDK_LOG_LEVEL=info
```

### Method 2: Direct Environment Variable
Set the environment variable before starting the application:

```bash
export VITE_BLOCKCHAIN_ENDPOINT_OVERRIDE=ws://127.0.0.1:9944
export VITE_BILLING_SERVICE_ENDPOINT=http://localhost:8080
npm run start
```

## Verification

When the application starts, check the browser console for one of these messages:

- **Override Active**: `🔗 Blockchain endpoint OVERRIDE active: ws://127.0.0.1:9944`
- **Default Endpoint**: `🔗 Using default blockchain endpoint: wss://testnet.cere.network`

## Billing Service Integration

The application automatically sends user data to the billing service when onboarding is completed:

- **Endpoint**: `http://localhost:8080/api/register-account`
- **Method**: POST
- **Payload**: 
  ```json
  {
    "accountId": "wallet_address_here",
    "email": "user_email_here"
  }
  ```
- **Trigger**: After successful completion of all onboarding steps

## Supported Endpoint Formats

- **WebSocket**: `ws://127.0.0.1:9944` (local testing)
- **Secure WebSocket**: `wss://your-node.com:9944` (remote testing)
- **HTTP**: `http://127.0.0.1:9933` (if your node supports HTTP)

## Fallback Behavior

- If `VITE_BLOCKCHAIN_ENDPOINT_OVERRIDE` is not set or empty, the application will use the default endpoint from `DDC_PRESET.blockchain`
- The override takes precedence over the network preset (testnet/devnet/mainnet)

## Testing Scenarios

1. **Local Development**: Connect to a local Substrate node
2. **Custom Networks**: Connect to your own blockchain network
3. **Testing**: Use different endpoints for different environments
4. **Debugging**: Isolate blockchain issues by testing against known good endpoints

## Security Note

⚠️ **Warning**: Only use this override for testing and development. Never override the blockchain endpoint in production environments.
