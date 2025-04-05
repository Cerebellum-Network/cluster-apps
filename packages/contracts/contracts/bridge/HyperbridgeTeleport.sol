// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IERC20Extended.sol";
import "../interfaces/ITokenSwapper.sol";
import "../interfaces/IHyperbridgeTeleport.sol";

/**
 * @title HyperbridgeTeleport
 * @notice Contract that handles teleportation of CERE tokens from EVM to the Cere Network
 * @dev This contract acts as an interface for the bridge system (Hyperbridge) between networks
 */
contract HyperbridgeTeleport is IHyperbridgeTeleport, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20Extended;
    
    // Address of the CERE token on the EVM network
    address public immutable cereToken;
    
    // Address of the token swapper (if token swaps are needed)
    ITokenSwapper public tokenSwapper;
    
    // Authorized relayers who can provide status updates
    mapping(address => bool) public authorizedRelayers;
    
    // Mapping of transaction IDs to their teleportation status
    // 0: Not Exists, 1: Pending, 2: Completed, 3: Failed
    mapping(bytes32 => uint8) public teleportStatus;
    
    // Mapping of transaction IDs to teleport details
    mapping(bytes32 => TeleportDetails) public teleports;
    
    // Transaction count for sequential IDs
    uint256 private _txCounter;
    
    // Teleport details struct - optimized with appropriate data types
    struct TeleportDetails {
        address fromAddress;
        string cereNetworkAddress;
        uint128 amount;  // Optimized from uint256 to uint128
        uint64 timestamp; // Optimized from uint256 to uint64 (sufficient for timestamps until year 292277026596)
    }
    
    // Fee settings
    uint256 public teleportFeePercentage; // Fee as a percentage (100 = 1%)
    uint256 public constant MAX_FEE_PERCENTAGE = 500; // Maximum fee: 5%
    
    // Constants for states
    uint8 private constant STATUS_NOT_EXISTS = 0;
    uint8 private constant STATUS_PENDING = 1;
    uint8 private constant STATUS_COMPLETED = 2;
    uint8 private constant STATUS_FAILED = 3;
    
    // Base for percentage calculations
    uint256 private constant FEE_BASIS_POINTS = 10000;
    
    // Mock mode for testing
    bool public mockMode;
    
    // Events
    event TeleportInitiated(
        bytes32 indexed txId,
        address indexed fromAddress,
        string cereNetworkAddress,
        uint256 amount,
        uint256 timestamp
    );
    
    event TeleportStatusUpdated(
        bytes32 indexed txId,
        uint8 status
    );
    
    event RelayerStatusUpdated(
        address indexed relayer,
        bool authorized
    );
    
    event TeleportFeeUpdated(
        uint256 oldFee,
        uint256 newFee
    );
    
    event MockModeUpdated(
        bool enabled
    );
    
    /**
     * @notice Constructor
     * @param _tokenSwapper Address of the token swapper
     * @param _cereToken Address of the CERE token
     */
    constructor(address _tokenSwapper, address _cereToken) {
        require(_cereToken != address(0), "Invalid CERE token address");
        cereToken = _cereToken;
        
        if (_tokenSwapper != address(0)) {
            tokenSwapper = ITokenSwapper(_tokenSwapper);
        }
        
        teleportFeePercentage = 100; // Default fee: 1%
        mockMode = false;
        _txCounter = 0;
    }
    
    /**
     * @notice Gets the CERE token address
     * @return Address of the CERE token
     */
    function getCereTokenAddress() external view override returns (address) {
        return cereToken;
    }
    
    /**
     * @notice Sets the token swapper
     * @param _tokenSwapper Address of the token swapper
     */
    function setTokenSwapper(address _tokenSwapper) external onlyOwner {
        require(_tokenSwapper != address(0), "Invalid token swapper address");
        tokenSwapper = ITokenSwapper(_tokenSwapper);
    }
    
    /**
     * @notice Sets the teleport fee percentage
     * @param _feePercentage Fee percentage (100 = 1%)
     */
    function setTeleportFee(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= MAX_FEE_PERCENTAGE, "Fee exceeds maximum allowed");
        
        uint256 oldFee = teleportFeePercentage;
        teleportFeePercentage = _feePercentage;
        
        emit TeleportFeeUpdated(oldFee, _feePercentage);
    }
    
    /**
     * @notice Sets the mock mode for testing
     * @param _enabled Whether mock mode is enabled
     */
    function setMockMode(bool _enabled) external onlyOwner {
        mockMode = _enabled;
        emit MockModeUpdated(_enabled);
    }
    
    /**
     * @notice Adds or removes a relayer
     * @param relayer Address of the relayer
     * @param authorized Whether the relayer is authorized
     */
    function setRelayerAuthorization(address relayer, bool authorized) external onlyOwner {
        require(relayer != address(0), "Invalid relayer address");
        authorizedRelayers[relayer] = authorized;
        emit RelayerStatusUpdated(relayer, authorized);
    }
    
    /**
     * @notice Teleports CERE tokens to the Cere Network
     * @param amount Amount of CERE tokens to teleport
     * @param cereNetworkAddress Destination address on the Cere network
     * @return txId Unique identifier for the teleportation transaction
     */
    function teleportToCereNetwork(
        uint256 amount,
        string calldata cereNetworkAddress
    ) external override nonReentrant returns (bytes32 txId) {
        require(amount > 0, "Amount must be greater than 0");
        require(bytes(cereNetworkAddress).length > 0, "Invalid Cere network address");
        
        // Optimization: Cache values to avoid multiple storage reads
        address tokenAddress = cereToken;
        address ownerAddress = owner();
        uint256 feePercentage = teleportFeePercentage;
        bool isMockMode = mockMode;
        
        // Calculate the fee
        uint256 fee = (amount * feePercentage) / FEE_BASIS_POINTS;
        uint256 amountAfterFee = amount - fee;
        
        // Optimization: Increment counter in a separate operation to reduce costs
        uint256 currentTx = _txCounter;
        unchecked { _txCounter = currentTx + 1; } // Unchecked is safe because it's very unlikely that _txCounter will reach its limit
        
        // Generate a unique transaction ID
        txId = keccak256(abi.encodePacked(
            msg.sender,
            cereNetworkAddress,
            amount,
            currentTx,
            block.timestamp
        ));
        
        // Store teleport details - ensuring values fit within their types
        teleports[txId] = TeleportDetails({
            fromAddress: msg.sender,
            cereNetworkAddress: cereNetworkAddress,
            amount: amount <= type(uint128).max ? uint128(amountAfterFee) : type(uint128).max,
            timestamp: uint64(block.timestamp)
        });
        
        // Update status to Pending
        teleportStatus[txId] = STATUS_PENDING;
        
        // Optimization: Use token as a local variable to avoid multiple lookups
        IERC20Extended token = IERC20Extended(tokenAddress);
        
        // Transfer tokens from user to this contract
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        // If fee is collected, transfer to the owner
        if (fee > 0) {
            token.safeTransfer(ownerAddress, fee);
        }
        
        // Emit event
        emit TeleportInitiated(
            txId,
            msg.sender,
            cereNetworkAddress,
            amountAfterFee,
            block.timestamp
        );
        
        // For mock mode, automatically complete the teleport
        if (isMockMode) {
            teleportStatus[txId] = STATUS_COMPLETED; // Completed
            emit TeleportStatusUpdated(txId, STATUS_COMPLETED);
        }
        
        return txId;
    }
    
    /**
     * @notice Updates the status of a teleportation transaction
     * @param txId Teleportation transaction identifier
     * @param status New status (2: Completed, 3: Failed)
     */
    function updateTeleportStatus(bytes32 txId, uint8 status) external {
        require(authorizedRelayers[msg.sender] || owner() == msg.sender, "Not authorized");
        require(teleportStatus[txId] == STATUS_PENDING, "Teleport not in Pending state");
        require(status == STATUS_COMPLETED || status == STATUS_FAILED, "Invalid status");
        
        teleportStatus[txId] = status;
        emit TeleportStatusUpdated(txId, status);
    }
    
    /**
     * @notice Checks the status of a teleportation
     * @param txId Teleportation transaction identifier
     * @return Status of the teleportation
     */
    function checkTeleportStatus(bytes32 txId) external view override returns (uint8) {
        return teleportStatus[txId];
    }
    
    /**
     * @notice Gets the details of a teleportation
     * @param txId Teleportation transaction identifier
     * @return fromAddress Sender address
     * @return cereNetworkAddress Destination address on Cere network
     * @return amount Amount of tokens teleported
     * @return timestamp Time when the teleportation was initiated
     */
    function getTeleportDetails(bytes32 txId) external view returns (
        address fromAddress,
        string memory cereNetworkAddress,
        uint256 amount,
        uint256 timestamp
    ) {
        TeleportDetails memory details = teleports[txId];
        return (
            details.fromAddress,
            details.cereNetworkAddress,
            details.amount,
            details.timestamp
        );
    }
    
    /**
     * @notice Recovers ERC20 tokens sent by error to the contract
     * @param token Address of the token to recover
     * @return Success of the operation
     */
    function recoverERC20(address token) external onlyOwner returns (bool) {
        require(token != cereToken, "Cannot recover CERE tokens");
        uint256 balance = IERC20Extended(token).balanceOf(address(this));
        IERC20Extended(token).safeTransfer(owner(), balance);
        return true;
    }
} 