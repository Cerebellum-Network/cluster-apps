// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IERC20Extended.sol";
import "../interfaces/ITokenSwapper.sol";
import "../interfaces/IHyperbridgeTeleport.sol";
import "../interfaces/ISecurityManager.sol";

/**
 * @title StablecoinPaymentHandler
 * @notice Contract that handles the processing of stablecoin payments to load DDC Credits
 * @dev This contract implements the Checks-Effects-Interactions pattern and is protected against reentrancy
 */
contract StablecoinPaymentHandler is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20Extended;
    
    // Supported stablecoins (USDC, USDT, etc.)
    mapping(address => bool) public supportedStablecoins;
    
    // Integration with other contracts
    ITokenSwapper public tokenSwapper;
    IHyperbridgeTeleport public hyperbridgeTeleport;
    ISecurityManager public securityManager;
    
    // CERE token address
    address public cereToken;
    
    // Processed payments record
    struct Payment {
        address from;
        string cereNetworkAddress;
        address stablecoin;
        uint128 stablecoinAmount;
        uint128 cereAmount;
        bytes32 teleportTxId;
        uint8 status; // 0: Initiated, 1: Swapped, 2: Teleported, 3: Failed
    }
    
    // Mapping of payment IDs to payment details
    mapping(bytes32 => Payment) public payments;
    
    // List of payment IDs for a user
    mapping(address => bytes32[]) public userPayments;
    
    // Security pause flag - additional to securityManager pause
    bool private _paused;
    
    // Events
    event StablecoinSupported(address indexed stablecoin, bool supported);
    event PaymentProcessed(bytes32 indexed paymentId, address indexed from, string cereNetworkAddress, address stablecoin, uint256 stablecoinAmount);
    event PaymentSwapped(bytes32 indexed paymentId, uint256 cereAmount);
    event PaymentTeleported(bytes32 indexed paymentId, bytes32 teleportTxId);
    event PaymentFailed(bytes32 indexed paymentId, string reason);
    event ContractPaused(address indexed by);
    event ContractUnpaused(address indexed by);
    event SecurityManagerUpdated(address indexed oldSecurityManager, address indexed newSecurityManager);
    
    // Constants to optimize gas
    uint256 private constant STATUS_INITIATED = 0;
    uint256 private constant STATUS_SWAPPED = 1;
    uint256 private constant STATUS_TELEPORTED = 2;
    uint256 private constant STATUS_FAILED = 3;
    
    /**
     * @notice Modifier to check if the system is paused by either this contract or the security manager
     */
    modifier whenNotPaused() {
        require(!_paused, "Contract is paused");
        if (address(securityManager) != address(0)) {
            require(!securityManager.isPaused(), "System is paused by security manager");
        }
        _;
    }
    
    /**
     * @notice Modifier to check if the sender is blacklisted
     */
    modifier notBlacklisted() {
        if (address(securityManager) != address(0)) {
            require(!securityManager.isBlacklisted(msg.sender), "Sender is blacklisted");
        }
        _;
    }

    /**
     * @notice Constructor
     * @dev Initializes the contract with default supported stablecoins
     */
    constructor() {
        // Initially there are no supported stablecoins, they must be added later
        _paused = false;
    }
    
    /**
     * @notice Pauses the contract operations
     * @dev Can only be called by the owner
     */
    function pause() external onlyOwner {
        _paused = true;
        emit ContractPaused(msg.sender);
    }
    
    /**
     * @notice Unpauses the contract operations
     * @dev Can only be called by the owner
     */
    function unpause() external onlyOwner {
        _paused = false;
        emit ContractUnpaused(msg.sender);
    }
    
    /**
     * @notice Returns the paused state of the contract
     * @return True if the contract is paused
     */
    function paused() external view returns (bool) {
        return _paused;
    }
    
    /**
     * @notice Configures the token swap contract
     * @param _tokenSwapper Address of the TokenSwapper contract
     */
    function setTokenSwapper(address _tokenSwapper) external onlyOwner {
        require(_tokenSwapper != address(0), "Invalid token swapper address");
        tokenSwapper = ITokenSwapper(_tokenSwapper);
    }
    
    /**
     * @notice Configures the Hyperbridge teleportation contract
     * @param _hyperbridgeTeleport Address of the HyperbridgeTeleport contract
     */
    function setHyperbridgeTeleport(address _hyperbridgeTeleport) external onlyOwner {
        require(_hyperbridgeTeleport != address(0), "Invalid teleport address");
        hyperbridgeTeleport = IHyperbridgeTeleport(_hyperbridgeTeleport);
        cereToken = hyperbridgeTeleport.getCereTokenAddress();
    }
    
    /**
     * @notice Configures the security manager contract
     * @param _securityManager Address of the SecurityManager contract
     */
    function setSecurityManager(address _securityManager) external onlyOwner {
        address oldSecurityManager = address(securityManager);
        securityManager = ISecurityManager(_securityManager);
        emit SecurityManagerUpdated(oldSecurityManager, _securityManager);
    }
    
    /**
     * @notice Adds or removes a stablecoin from the supported list
     * @param stablecoin Address of the stablecoin token
     * @param supported true to support, false to remove support
     */
    function setStablecoinSupport(address stablecoin, bool supported) external onlyOwner {
        require(stablecoin != address(0), "Invalid stablecoin address");
        supportedStablecoins[stablecoin] = supported;
        emit StablecoinSupported(stablecoin, supported);
    }
    
    /**
     * @notice Processes a stablecoin payment to load DDC Credits
     * @param stablecoin Address of the stablecoin token to use
     * @param amount Amount of stablecoin to pay
     * @param cereNetworkAddress Address on the Cere Network where DDC Credits will be loaded
     * @param minCereAmount Minimum amount of CERE tokens expected (slippage protection)
     * @param deadline Time limit for the transaction
     * @return paymentId Unique identifier for the payment
     */
    function processPayment(
        address stablecoin,
        uint256 amount,
        string calldata cereNetworkAddress,
        uint256 minCereAmount,
        uint256 deadline
    ) external nonReentrant whenNotPaused notBlacklisted returns (bytes32 paymentId) {
        // Validations
        require(supportedStablecoins[stablecoin], "Stablecoin not supported");
        require(amount > 0, "Amount must be greater than 0");
        require(bytes(cereNetworkAddress).length > 0, "Invalid Cere network address");
        require(address(tokenSwapper) != address(0), "Token swapper not set");
        require(address(hyperbridgeTeleport) != address(0), "Hyperbridge teleport not set");
        require(block.timestamp <= deadline, "Transaction deadline expired");
        
        // Optimization: Cache values to reduce storage reads
        address securityManagerAddr = address(securityManager);
        
        // Check transaction limits if security manager is set
        if (securityManagerAddr != address(0)) {
            require(securityManager.canTransact(msg.sender, amount), "Transaction exceeds limits");
        }
        
        // Generate unique ID for the payment
        paymentId = keccak256(abi.encodePacked(
            msg.sender,
            stablecoin,
            amount,
            cereNetworkAddress,
            block.timestamp
        ));
        
        // Verify that the ID is not already in use
        require(payments[paymentId].from == address(0), "Payment ID collision");
        
        // Register the payment in state (Effects)
        payments[paymentId] = Payment({
            from: msg.sender,
            cereNetworkAddress: cereNetworkAddress,
            stablecoin: stablecoin,
            stablecoinAmount: amount <= type(uint128).max ? uint128(amount) : type(uint128).max,
            cereAmount: 0,
            teleportTxId: bytes32(0),
            status: 0
        });
        
        // Add to the user's payment list
        userPayments[msg.sender].push(paymentId);
        
        // Emit event
        emit PaymentProcessed(paymentId, msg.sender, cereNetworkAddress, stablecoin, amount);
        
        // Transfer stablecoins from user to this contract (Interactions)
        IERC20Extended stablecoinToken = IERC20Extended(stablecoin);
        stablecoinToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Record the transaction in security manager if it's set
        if (securityManagerAddr != address(0)) {
            securityManager.recordTransaction(msg.sender, amount);
        }
        
        // Cache token swapper and hyperbridge to reduce storage reads
        ITokenSwapper swapper = tokenSwapper;
        IHyperbridgeTeleport teleport = hyperbridgeTeleport;
        address cere = cereToken;
        
        // Approve the swapper to use the stablecoins
        stablecoinToken.safeApprove(address(swapper), amount);
        
        // Perform the swap from stablecoin to CERE
        try swapper.swapExactTokensForTokens(
            stablecoin,
            cere,
            amount,
            minCereAmount,
            address(this),
            deadline
        ) returns (uint256 cereAmount) {
            // Update the payment state with the amount of CERE received
            // Optimization: Update only necessary fields to save gas
            Payment storage payment = payments[paymentId];
            payment.cereAmount = cereAmount <= type(uint128).max ? uint128(cereAmount) : type(uint128).max;
            payment.status = 1; // Swapped
            
            // Emit event
            emit PaymentSwapped(paymentId, cereAmount);
            
            // Approve the teleport to use the CERE tokens
            IERC20Extended(cere).safeApprove(address(teleport), cereAmount);
            
            // Initiate teleportation to the Cere network
            try teleport.teleportToCereNetwork(
                cereAmount,
                cereNetworkAddress
            ) returns (bytes32 teleportTxId) {
                // Update the payment state with the teleportation ID
                payment.teleportTxId = teleportTxId;
                payment.status = 2; // Teleported
                
                // Emit event
                emit PaymentTeleported(paymentId, teleportTxId);
            } catch Error(string memory reason) {
                // Teleportation failure
                payment.status = 3; // Failed
                emit PaymentFailed(paymentId, reason);
            }
        } catch Error(string memory reason) {
            // Swap failure
            payments[paymentId].status = 3; // Failed
            emit PaymentFailed(paymentId, reason);
        }
        
        return paymentId;
    }
    
    /**
     * @notice Gets the current status of a payment
     * @param paymentId Payment identifier
     * @return status Payment status in the contract
     * @return teleportStatus Teleportation status in Hyperbridge
     */
    function getPaymentStatus(bytes32 paymentId) external view returns (uint8 status, uint8 teleportStatus) {
        Payment storage payment = payments[paymentId];
        require(payment.from != address(0), "Payment does not exist");
        
        status = payment.status;
        
        // If the payment was teleported, check its status in Hyperbridge
        if (payment.status == 2 && payment.teleportTxId != bytes32(0)) {
            teleportStatus = hyperbridgeTeleport.checkTeleportStatus(payment.teleportTxId);
        } else {
            teleportStatus = 3; // Does not exist in Hyperbridge
        }
    }
    
    /**
     * @notice Gets the payment IDs of a user
     * @param user User's address
     * @return List of payment IDs
     */
    function getUserPayments(address user) external view returns (bytes32[] memory) {
        return userPayments[user];
    }
    
    /**
     * @notice Gets the estimated amount of CERE tokens that would be obtained by swapping
     * @param stablecoin Address of the stablecoin
     * @param amount Amount of stablecoin
     * @return Estimated amount of CERE tokens
     */
    function getEstimatedCereAmount(address stablecoin, uint256 amount) external view returns (uint256) {
        require(supportedStablecoins[stablecoin], "Stablecoin not supported");
        require(address(tokenSwapper) != address(0), "Token swapper not set");
        
        return tokenSwapper.getExpectedAmountOut(stablecoin, cereToken, amount);
    }
    
    /**
     * @notice Checks if an address can make a transaction
     * @param account Address to check
     * @param amount Amount to transfer
     * @return True if the address can transact
     */
    function canTransact(address account, uint256 amount) external view returns (bool) {
        if (_paused) {
            return false;
        }
        
        address securityManagerAddr = address(securityManager);
        if (securityManagerAddr != address(0)) {
            if (securityManager.isPaused() || 
                securityManager.isBlacklisted(account) || 
                !securityManager.canTransact(account, amount)) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * @notice Recovers ERC20 tokens sent by error to the contract
     * @param token Address of the token to recover
     * @return Success of the operation
     */
    function recoverERC20(address token) external onlyOwner returns (bool) {
        uint256 balance = IERC20Extended(token).balanceOf(address(this));
        IERC20Extended(token).safeTransfer(owner(), balance);
        return true;
    }
    
    /**
     * @notice Executes emergency stop of all contract operations via the security manager
     * @dev Can only be called by the owner
     */
    function emergencyStop() external onlyOwner {
        _paused = true;
        emit ContractPaused(msg.sender);
        
        address securityManagerAddr = address(securityManager);
        if (securityManagerAddr != address(0)) {
            // Attempt to pause the security manager as well
            try securityManager.pauseSystem() {
                // Successfully paused security manager
            } catch {
                // Failed to pause security manager, but our contract is still paused
            }
        }
    }
    
    /**
     * @notice Resumes contract operations after emergency stop
     * @dev Can only be called by the owner
     */
    function resumeOperations() external onlyOwner {
        _paused = false;
        emit ContractUnpaused(msg.sender);
        
        address securityManagerAddr = address(securityManager);
        if (securityManagerAddr != address(0)) {
            // Attempt to unpause the security manager as well
            try securityManager.unpauseSystem() {
                // Successfully unpaused security manager
            } catch {
                // Failed to unpause security manager, but our contract is still unpaused
            }
        }
    }
} 