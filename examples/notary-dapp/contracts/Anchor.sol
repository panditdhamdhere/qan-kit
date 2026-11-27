// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Anchors a Merkle root. The timestamp is the chain's clock, not a signature over the file.
contract Anchor {
    mapping(bytes32 => uint256) public rootTimestamp;

    event Anchored(bytes32 indexed root, uint256 timestamp, address indexed sender);

    function anchor(bytes32 root) external {
        require(rootTimestamp[root] == 0, "already anchored");
        rootTimestamp[root] = block.timestamp;
        emit Anchored(root, block.timestamp, msg.sender);
    }
}
