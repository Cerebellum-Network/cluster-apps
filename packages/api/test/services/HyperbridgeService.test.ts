// Ensure devDependencies include: @types/sinon, @types/sinon-chai
import { expect } from 'chai';
import { ethers, Contract, Wallet, Provider, Signer, ContractTransactionResponse, TransactionReceipt, Log } from 'ethers';
import sinon, { SinonStubbedInstance } from 'sinon';
import chai from 'chai';
import sinonChai from 'sinon-chai';
import { HyperbridgeService } from '../../src/services/HyperbridgeService'; // Adjust path if needed
import logger from '../../src/utils/logger'; // Adjust path if needed
import { TeleportTransactionStatus } from '../../src/models/TeleportTransaction'; // Adjust path if needed
import { 
  CONTRACT_HYPERBRIDGE_ADDRESS, 
  CERE_TOKEN_ADDRESS, 
  CONTRACT_NETWORK_RPC_URL // Used if provider is not passed
} from '../../src/config/env'; // Adjust path if needed

chai.use(sinonChai);

// Mock logger
sinon.stub(logger, 'info');
sinon.stub(logger, 'error');
sinon.stub(logger, 'warn');

const MOCK_SIGNER_ADDRESS = '0xSignerAddress123';
const MOCK_TX_HASH = '0xMockTxHash123';
const MOCK_TELEPORT_ID = '0xMockTeleportId1234567890';
const CERE_NETWORK_ADDRESS = 'cere123abc';

describe('HyperbridgeService', () => {
  let hyperbridgeService: HyperbridgeService;
  let sandbox: sinon.SinonSandbox;
  let mockProvider: SinonStubbedInstance<Provider>;
  let mockSigner: SinonStubbedInstance<Wallet>;
  let mockHyperbridgeContract: SinonStubbedInstance<Contract>;
  let mockCereTokenContract: SinonStubbedInstance<Contract>;

  // Keep track of mocked contract instances
  const mockContracts: { [address: string]: SinonStubbedInstance<Contract> } = {};

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock Provider & Signer
    mockProvider = sandbox.createStubInstance(ethers.AbstractProvider) as SinonStubbedInstance<Provider>;
    mockSigner = sandbox.createStubInstance(Wallet);
    sandbox.stub(mockSigner, 'getAddress').resolves(MOCK_SIGNER_ADDRESS);
    mockSigner.connect.returns(mockSigner); // Signer needs connect

    // --- Intercept Contract Instantiation --- 
    const originalContract = ethers.Contract;
    sandbox.stub(ethers, 'Contract').callsFake(
      (address: string, abi: any, providerOrSigner: Provider | Signer | undefined): SinonStubbedInstance<Contract> => {
        if (!mockContracts[address]) {
          const specificMock = sandbox.createStubInstance(originalContract) as SinonStubbedInstance<Contract>;
          specificMock.connect.returns(specificMock); 
          // Mock interface for parsing logs
          const mockInterface = sandbox.createStubInstance(ethers.Interface);
          mockInterface.parseLog.returns(null); // Default mock for parseLog
          (specificMock as any).interface = mockInterface;
          mockContracts[address] = specificMock;

          // Assign to named mocks
          if (address === CONTRACT_HYPERBRIDGE_ADDRESS) mockHyperbridgeContract = specificMock;
          if (address === CERE_TOKEN_ADDRESS) mockCereTokenContract = specificMock;
        }
        // Return the correct mock based on address
        return mockContracts[address];
      }
    );

    // Mock default provider creation if needed (for constructor test without args)
    sandbox.stub(ethers, 'JsonRpcProvider');

    // Instantiate the service WITH provider and signer for most tests
    hyperbridgeService = new HyperbridgeService(mockProvider, mockSigner);
  });

  afterEach(() => {
    sandbox.restore();
    Object.keys(mockContracts).forEach(key => delete mockContracts[key]);
  });

  describe('Constructor & Initialization', () => {
    it('should use provided provider and signer and initialize Hyperbridge contract', () => {
      // Check Contract constructor was called for Hyperbridge
      expect(ethers.Contract).to.have.been.calledWith(CONTRACT_HYPERBRIDGE_ADDRESS, sinon.match.array, mockProvider);
      // Check internal properties
      expect((hyperbridgeService as any).provider).to.equal(mockProvider);
      expect((hyperbridgeService as any).signer).to.equal(mockSigner);
      expect((hyperbridgeService as any).hyperbridgeContract).to.equal(mockHyperbridgeContract);
      // Ensure default provider wasn't created
      expect(ethers.JsonRpcProvider).to.not.have.been.called;
    });

    it('should create default provider if none provided', () => {
       sandbox.restore(); // Reset mocks
       sandbox = sinon.createSandbox();
       const jsonRpcStub = sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider); // Mock the creation
       sandbox.stub(ethers, 'Contract').returns(sandbox.createStubInstance(Contract)); // Basic contract mock
       
       new HyperbridgeService(); // Instantiate without provider

       expect(jsonRpcStub).to.have.been.calledOnceWith(CONTRACT_NETWORK_RPC_URL);
    });
  });

  describe('setSigner', () => {
    it('should update the signer and re-initialize contracts', () => {
      const newMockSigner = sandbox.createStubInstance(Wallet);
      const initializeContractsSpy = sandbox.spy(hyperbridgeService as any, 'initializeContracts');
      
      hyperbridgeService.setSigner(newMockSigner);

      expect((hyperbridgeService as any).signer).to.equal(newMockSigner);
      // initializeContracts is called in constructor AND setSigner
      expect(initializeContractsSpy).to.have.been.calledTwice;
    });
  });

  describe('teleportToCereNetwork', () => {
    const amount = ethers.parseUnits('1000', 18);
    const mockApproveTx = { hash: '0xapproveTx', wait: sandbox.stub().resolves({}) } as unknown as ContractTransactionResponse;
    const mockTeleportTx = { hash: '0xteleportTx', wait: sandbox.stub() } as unknown as ContractTransactionResponse;
    const mockReceipt = { 
        logs: [
            // Mock log for TeleportInitiated event
            { 
                topics: [ethers.id('TeleportInitiated(bytes32,address,string,uint256,uint256)')], // Use actual event signature
                data: '...' // Needs proper encoding if args are checked strictly
            }
        ] 
    } as unknown as TransactionReceipt;

    beforeEach(() => {
      // Mock contract method returns
      mockCereTokenContract.balanceOf.resolves(amount * 2n); // Sufficient balance
      mockCereTokenContract.allowance.resolves(0n); // Needs approval
      mockCereTokenContract.approve.resolves(mockApproveTx);
      mockHyperbridgeContract.teleportToCereNetwork.resolves(mockTeleportTx);
      mockTeleportTx.wait.resolves(mockReceipt); // Mock the wait() call

      // Mock log parsing to find the event
      const mockInterface = mockHyperbridgeContract.interface as SinonStubbedInstance<ethers.Interface>; 
      mockInterface.parseLog
        .withArgs(sinon.match({ topics: mockReceipt.logs[0].topics })) // Match the correct log
        .returns({ name: 'TeleportInitiated', args: [MOCK_TELEPORT_ID] } as any); // Return parsed event with ID
    });

    it('should check balance, approve, teleport, wait for receipt, parse event, and return teleport ID', async () => {
      const result = await hyperbridgeService.teleportToCereNetwork(amount, CERE_NETWORK_ADDRESS);

      expect(result).to.equal(MOCK_TELEPORT_ID);
      expect(mockCereTokenContract.balanceOf).to.have.been.calledOnceWith(MOCK_SIGNER_ADDRESS);
      expect(mockCereTokenContract.allowance).to.have.been.calledOnceWith(MOCK_SIGNER_ADDRESS, CONTRACT_HYPERBRIDGE_ADDRESS);
      expect(mockCereTokenContract.approve).to.have.been.calledOnceWith(CONTRACT_HYPERBRIDGE_ADDRESS, amount);
      expect(mockApproveTx.wait).to.have.been.calledOnce;
      expect(mockHyperbridgeContract.teleportToCereNetwork).to.have.been.calledOnceWith(amount, CERE_NETWORK_ADDRESS);
      expect(mockTeleportTx.wait).to.have.been.calledOnce;
      expect((mockHyperbridgeContract.interface as SinonStubbedInstance<ethers.Interface>).parseLog).to.have.been.called;
    });

    it('should skip approval if allowance is sufficient', async () => {
      mockCereTokenContract.allowance.resolves(amount * 2n); // Sufficient allowance
      
      await hyperbridgeService.teleportToCereNetwork(amount, CERE_NETWORK_ADDRESS);

      expect(mockCereTokenContract.approve).to.not.have.been.called;
      expect(mockHyperbridgeContract.teleportToCereNetwork).to.have.been.calledOnce;
    });

    it('should throw if signer is not set', async () => {
        hyperbridgeService.setSigner(undefined as any); // Remove signer
        await expect(hyperbridgeService.teleportToCereNetwork(amount, CERE_NETWORK_ADDRESS))
              .to.be.rejectedWith('No signer available for transactions');
    });

    it('should throw if hyperbridge contract is not initialized', async () => {
        (hyperbridgeService as any).hyperbridgeContract = null;
        await expect(hyperbridgeService.teleportToCereNetwork(amount, CERE_NETWORK_ADDRESS))
              .to.be.rejectedWith('Hyperbridge contract not initialized');
    });

    it('should throw if insufficient CERE balance', async () => {
        mockCereTokenContract.balanceOf.resolves(amount / 2n); // Insufficient balance
        await expect(hyperbridgeService.teleportToCereNetwork(amount, CERE_NETWORK_ADDRESS))
              .to.be.rejectedWith(/Insufficient CERE token balance/);
    });

    it('should throw if approval fails (wait returns null)', async () => {
        mockCereTokenContract.approve.resolves({ hash: '0xapproveTx', wait: sandbox.stub().resolves(null) } as any);
        await expect(hyperbridgeService.teleportToCereNetwork(amount, CERE_NETWORK_ADDRESS))
              .to.be.rejectedWith('Failed to get approval transaction receipt');
    });

    it('should throw if teleport fails (wait returns null)', async () => {
        mockTeleportTx.wait.resolves(null); // Simulate wait failure
        await expect(hyperbridgeService.teleportToCereNetwork(amount, CERE_NETWORK_ADDRESS))
              .to.be.rejectedWith('Failed to get teleport transaction receipt');
    });
    
    it('should throw if TeleportInitiated event is not found', async () => {
        mockTeleportTx.wait.resolves({ logs: [] } as any); // Simulate receipt with no logs
        await expect(hyperbridgeService.teleportToCereNetwork(amount, CERE_NETWORK_ADDRESS))
              .to.be.rejectedWith('TeleportInitiated event not found in transaction logs');
    });

  });

  describe('checkTeleportStatus', () => {
    const txId = MOCK_TELEPORT_ID;

    it('should return COMPLETED status from contract status 2', async () => {
        mockHyperbridgeContract.checkTeleportStatus.resolves(2);
        const status = await hyperbridgeService.checkTeleportStatus(txId);
        expect(status).to.equal(TeleportTransactionStatus.COMPLETED);
        expect(mockHyperbridgeContract.checkTeleportStatus).to.have.been.calledOnceWith(txId);
    });
    
    it('should return PROCESSING status from contract status 1', async () => {
        mockHyperbridgeContract.checkTeleportStatus.resolves(1);
        const status = await hyperbridgeService.checkTeleportStatus(txId);
        expect(status).to.equal(TeleportTransactionStatus.PROCESSING);
    });

    it('should return FAILED status from contract status 3', async () => {
        mockHyperbridgeContract.checkTeleportStatus.resolves(3);
        const status = await hyperbridgeService.checkTeleportStatus(txId);
        expect(status).to.equal(TeleportTransactionStatus.FAILED);
    });

    it('should return PENDING status from contract status 0 or unknown', async () => {
        mockHyperbridgeContract.checkTeleportStatus.resolves(0);
        let status = await hyperbridgeService.checkTeleportStatus(txId);
        expect(status).to.equal(TeleportTransactionStatus.PENDING);

        mockHyperbridgeContract.checkTeleportStatus.resolves(99); // Unknown status
        status = await hyperbridgeService.checkTeleportStatus(txId);
        expect(status).to.equal(TeleportTransactionStatus.PENDING);
    });

    it('should throw if hyperbridge contract not initialized', async () => {
        (hyperbridgeService as any).hyperbridgeContract = null;
        await expect(hyperbridgeService.checkTeleportStatus(txId))
              .to.be.rejectedWith('Hyperbridge contract not initialized');
    });

    it('should throw and log if contract call fails', async () => {
        const contractError = new Error('CheckStatus reverted');
        mockHyperbridgeContract.checkTeleportStatus.rejects(contractError);
        await expect(hyperbridgeService.checkTeleportStatus(txId))
              .to.be.rejectedWith(contractError);
        expect(logger.error).to.have.been.calledWith('Failed to check teleport status:', contractError);
    });
  });

  describe('getCereTokenAddress', () => {
    it('should return address from contract', async () => {
      mockHyperbridgeContract.getCereTokenAddress.resolves(CERE_TOKEN_ADDRESS);
      const result = await hyperbridgeService.getCereTokenAddress();
      expect(result).to.equal(CERE_TOKEN_ADDRESS);
      expect(mockHyperbridgeContract.getCereTokenAddress).to.have.been.calledOnce;
    });

    it('should throw if hyperbridge contract not initialized', async () => {
        (hyperbridgeService as any).hyperbridgeContract = null;
        await expect(hyperbridgeService.getCereTokenAddress())
              .to.be.rejectedWith('Hyperbridge contract not initialized');
    });
  });
}); 