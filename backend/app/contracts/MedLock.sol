// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * MedLock — on-chain audit trail for medical record events.
 * Each call to logEvent emits a RecordLogged event permanently stored on Ethereum Sepolia.
 */
contract MedLock {
    event RecordLogged(
        bytes32 indexed reportId,
        bytes32 fileHash,
        string  eventType,
        address indexed caller,
        uint256 timestamp
    );

    function logEvent(
        bytes32 reportId,
        bytes32 fileHash,
        string calldata eventType
    ) external {
        emit RecordLogged(reportId, fileHash, eventType, msg.sender, block.timestamp);
    }
}
