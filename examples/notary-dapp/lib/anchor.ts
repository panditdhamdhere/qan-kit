export const anchorAbi = [
  {
    type: 'function',
    name: 'anchor',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'root', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'rootTimestamp',
    stateMutability: 'view',
    inputs: [{ name: 'root', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'Anchored',
    inputs: [
      { name: 'root', type: 'bytes32', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
      { name: 'sender', type: 'address', indexed: true },
    ],
  },
] as const;
