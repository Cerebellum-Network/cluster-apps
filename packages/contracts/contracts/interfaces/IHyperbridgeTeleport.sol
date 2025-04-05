// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IHyperbridgeTeleport
 * @dev Interface for the contract that handles token teleportation across Hyperbridge
 */
interface IHyperbridgeTeleport {
    /// @notice Initiates the teleportation process of CERE tokens from EVM to Cere Network
    /// @param amount Amount of CERE tokens to teleport
    /// @param cereNetworkAddress Destination address on the Cere network
    /// @return txId Unique identifier for the teleportation transaction
    function teleportToCereNetwork(
        uint256 amount,
        string calldata cereNetworkAddress
    ) external returns (bytes32 txId);
    
    /// @notice Checks the status of a teleportation
    /// @param txId Teleportation transaction identifier
    /// @return status Teleportation status (0: Pending, 1: Completed, 2: Failed, 3: Does not exist)
    function checkTeleportStatus(bytes32 txId) external view returns (uint8 status);
    
    /// @notice Gets the address of the CERE token on the EVM network
    /// @return Address of the CERE token
    function getCereTokenAddress() external view returns (address);
    
    /// @notice Event emitted when a teleportation is initiated
    event TeleportInitiated(
        address indexed sender,
        string indexed cereNetworkAddress,
        uint256 amount,
        bytes32 txId
    );
    
    /// @notice Event emitted when a teleportation status changes
    event TeleportStatusChanged(
        bytes32 indexed txId,
        uint8 status
    );
} 