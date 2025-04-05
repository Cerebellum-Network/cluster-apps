import { jest } from '@jest/globals';

// Mock env before importing the service
const mockContractObj = {
  getExpectedAmountOut: jest.fn().mockResolvedValue(BigInt(10 * 10**18)),
  checkTeleportStatus: jest.fn().mockResolvedValue(2),
  processPayment: jest.fn().mockResolvedValue({
    hash: '0xtransactionhash_payment',
    wait: jest.fn().mockResolvedValue({
      status: 1,
      logs: [{
        topics: ['0xPaymentProcessedTopic'], // Simula el topic del evento
        data: '0xdata_payment'
      }]
    })
  }),
  swapExactTokensForTokens: jest.fn().mockResolvedValue({
    hash: '0xtransactionhash_swap',
    wait: jest.fn().mockResolvedValue({
      status: 1,
      logs: [{
        args: { amounts: [BigInt(100 * 10**6), BigInt(10 * 10**18)] }
      }]
    })
  }),
  teleportTokens: jest.fn().mockResolvedValue({
    hash: '0xtransactionhash_teleport',
    wait: jest.fn().mockResolvedValue({
      status: 1,
      logs: [{
        topics: ['0xTokensTeleportedTopic'], // Simula el topic del evento
        data: '0xdata_teleport'
      }]
    })
  }),
  balanceOf: jest.fn().mockResolvedValue(BigInt(1000 * 10**6)),
  approve: jest.fn().mockResolvedValue({
    hash: '0xtransactionhash_approve',
    wait: jest.fn().mockResolvedValue({ status: 1 })
  }),
  connect: jest.fn().mockReturnThis(),
  // Interface mock necesita ser más dinámico para devolver diferentes eventos
  interface: {
    parseLog: jest.fn()
  }
};

// Mock environment variables
process.env.WALLET_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

// Mock modules before importing service
jest.mock('../../config/env', () => ({
  CONTRACT_PAYMENT_HANDLER_ADDRESS: '0xMockPaymentHandler',
  CONTRACT_TOKEN_SWAPPER_ADDRESS: '0xMockTokenSwapper',
  CONTRACT_HYPERBRIDGE_ADDRESS: '0xMockHyperbridge',
  CERE_TOKEN_ADDRESS: '0xCereTokenAddress',
  CONTRACT_NETWORK_RPC_URL: 'https://mock-rpc-url.com',
  WALLET_PRIVATE_KEY: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  SUPPORTED_STABLECOINS: {
    'USDC': '0xUSDCAddress',
    'USDT': '0xUSDTAddress'
  }
}));

jest.mock('ethers', () => ({
  ethers: {
    Contract: jest.fn().mockImplementation(() => mockContractObj),
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
      getGasPrice: jest.fn().mockResolvedValue('20000000000'),
    })),
    Wallet: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockReturnThis(),
      getAddress: jest.fn().mockResolvedValue('0xwalletaddress'),
      sendTransaction: jest.fn().mockResolvedValue({ hash: '0x123' }),
    })),
    parseUnits: jest.fn().mockImplementation((value, decimals) => 
      BigInt(Number(value) * Math.pow(10, Number(decimals)))
    ),
    formatUnits: jest.fn().mockImplementation((value, decimals) => 
      (Number(value) / Math.pow(10, Number(decimals))).toString()
    )
  }
}));

// Now import the service
import contractService from '../../services/ContractService';
import * as env from '../../config/env';

describe('ContractService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset dynamic mocks
    mockContractObj.interface.parseLog.mockReset();
  });

  describe('getExpectedCereAmount', () => {
    it('should estimate the amount of CERE tokens to receive for the given stablecoin amount', async () => {
      // Test the function
      const result = await contractService.getExpectedCereAmount('USDC', '100');
      
      // Verify the contract was called correctly
      expect(mockContractObj.getExpectedAmountOut).toHaveBeenCalled();
      expect(mockContractObj.getExpectedAmountOut).toHaveBeenCalledWith(
        '0xUSDCAddress',
        env.CERE_TOKEN_ADDRESS, // Usar la dirección mockeada
        expect.any(BigInt)
      );
      
      // The result should be a string representation of the CERE token amount
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should throw an error if the stablecoin is not supported', async () => {
      // We need to attempt to get an amount for an unsupported coin
      await expect(
        contractService.getExpectedCereAmount('UNSUPPORTED', '100')
      ).rejects.toThrow('Unsupported stablecoin');
    });
  });

  describe('processPayment', () => {
    it('should process a stablecoin payment through the payment handler contract', async () => {
      // Configura el mock de parseLog para este test
      mockContractObj.interface.parseLog.mockImplementation((log) => {
        if(log.topics[0] === '0xPaymentProcessedTopic') {
          return { name: 'PaymentProcessed', args: ['payment-id-from-event'] };
        }
        return null;
      });

      // Test the function
      const result = await contractService.processPayment(
        'USDC', 
        '100', 
        'cere1234567890123456789012345678901234567890'
      );
      
      // Verify the approval was made
      expect(mockContractObj.approve).toHaveBeenCalled();
      
      // Verify the payment was processed
      expect(mockContractObj.processPayment).toHaveBeenCalled();
      // Verifica que wait() fue llamado en el mock de wait devuelto por processPayment
      const paymentTxMock = await mockContractObj.processPayment.mock.results[0].value;
      expect(paymentTxMock.wait).toHaveBeenCalled(); 
      
      // We should get a payment ID back from the event
      expect(result).toBe('payment-id-from-event'); 
    });
  });

  describe('swapTokens', () => {
    it('should swap stablecoins for CERE tokens', async () => {
      // Test the function
      const result = await contractService.swapTokens('USDC', '100');
      
      // Verify approval was made
      expect(mockContractObj.approve).toHaveBeenCalled();
      
      // Verify swap was executed
      expect(mockContractObj.swapExactTokensForTokens).toHaveBeenCalled();
       // Verifica que wait() fue llamado en el mock de wait devuelto por swapExactTokensForTokens
      const swapTxMock = await mockContractObj.swapExactTokensForTokens.mock.results[0].value;
      expect(swapTxMock.wait).toHaveBeenCalled();
      
      // We should get the amount of CERE tokens back
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('teleportTokens', () => {
    it('should teleport CERE tokens to Cere Network', async () => {
      // Configura el mock de parseLog para este test
      mockContractObj.interface.parseLog.mockImplementation((log) => {
        if(log.topics[0] === '0xTokensTeleportedTopic') {
          return { name: 'TokensTeleported', args: ['teleport-id-from-event'] };
        }
        return null;
      });

      // Test the function
      const result = await contractService.teleportTokens(
        '10', 
        'cere1234567890123456789012345678901234567890'
      );
      
      // Verify approval was made
      expect(mockContractObj.approve).toHaveBeenCalled();
      
      // Verify teleport was executed
      expect(mockContractObj.teleportTokens).toHaveBeenCalled();
      // Verifica que wait() fue llamado en el mock de wait devuelto por teleportTokens
      const teleportTxMock = await mockContractObj.teleportTokens.mock.results[0].value;
      expect(teleportTxMock.wait).toHaveBeenCalled(); 
      
      // We should get a teleport transaction ID back from the event
      expect(result).toBe('teleport-id-from-event'); 
    });
  });

  describe('checkTeleportStatus', () => {
    it('should check the status of a teleport transaction', async () => {
      // Test the function
      const result = await contractService.checkTeleportStatus('teleport-tx-id');
      
      // Verify the contract was called correctly
      expect(mockContractObj.checkTeleportStatus).toHaveBeenCalledWith('teleport-tx-id');
      
      // Result should be the status (2 = completed in our mock)
      expect(result).toBe(2);
    });

    it('should handle different teleport statuses', async () => {
      // Reset the mock to return different statuses
      const statuses = [0, 1, 2, 3]; // Non-existent, Pending, Completed, Failed
      
      for (const status of statuses) {
        mockContractObj.checkTeleportStatus.mockResolvedValueOnce(status);
        
        const result = await contractService.checkTeleportStatus('teleport-tx-id');
        expect(result).toBe(status);
      }
    });
  });

  describe('Complete USDC to DDC Account Flow', () => {
    it('should handle the complete flow from USDC payment to DDC account update', async () => {
      // Configura el mock de parseLog de forma más robusta
      mockContractObj.interface.parseLog.mockImplementation((log) => {
        // Simula el parseo basado en el topic o data del log
        if (log.data === '0xdata_payment') { // Asumiendo data único para el evento
          return { name: 'PaymentProcessed', args: ['payment-id-from-event'] };
        }
        if (log.data === '0xdata_teleport') { // Asumiendo data único para el evento
          return { name: 'TokensTeleported', args: ['teleport-id-from-event'] };
        }
        return null; // No coincide con ningún evento esperado
      });

      // 1. Get expected CERE amount
      const expectedCere = await contractService.getExpectedCereAmount('USDC', '100');
      expect(expectedCere).toBeDefined();
      
      // 2. Process payment
      const paymentId = await contractService.processPayment(
        'USDC', '100', 'cere123...'
      );
      expect(paymentId).toBe('payment-id-from-event');
      // Verifica que wait() fue llamado
      const paymentTxMock = await mockContractObj.processPayment.mock.results[0].value;
      expect(paymentTxMock.wait).toHaveBeenCalled();

      // 3. Swap tokens
      const swappedAmount = await contractService.swapTokens('USDC', '100');
      expect(swappedAmount).toBeDefined();
      const swapTxMock = await mockContractObj.swapExactTokensForTokens.mock.results[0].value;
      expect(swapTxMock.wait).toHaveBeenCalled();

      // 4. Teleport tokens
      const teleportTxId = await contractService.teleportTokens(
        swappedAmount, 'cere123...'
      );
      expect(teleportTxId).toBe('teleport-id-from-event');
      const teleportTxMock = await mockContractObj.teleportTokens.mock.results[0].value;
      expect(teleportTxMock.wait).toHaveBeenCalled();

      // 5. Check teleport status
      const teleportStatus = await contractService.checkTeleportStatus(teleportTxId);
      expect(teleportStatus).toBe(2);
      
      // Verify calls
      expect(mockContractObj.getExpectedAmountOut).toHaveBeenCalled();
      expect(mockContractObj.processPayment).toHaveBeenCalled();
      expect(mockContractObj.swapExactTokensForTokens).toHaveBeenCalled();
      expect(mockContractObj.teleportTokens).toHaveBeenCalled();
      expect(mockContractObj.checkTeleportStatus).toHaveBeenCalled();
    });
  });
}); 