'use client';

import { qanTestnet } from '@qan-kit/chains';
import { useState } from 'react';
import { useAccount, useConnect, useSwitchChain, useWriteContract } from 'wagmi';
import { anchorAbi } from '../../lib/anchor';

export default function AnchorPage() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const [root, setRoot] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [tx, setTx] = useState('');
  const [error, setError] = useState('');

  function loadSaved() {
    setRoot(sessionStorage.getItem('qan-notary-root') ?? '');
  }

  async function send() {
    setError('');
    setTx('');
    try {
      if (chainId !== qanTestnet.id) {
        await switchChain({ chainId: qanTestnet.id });
      }
      const hash = await writeContractAsync({
        abi: anchorAbi,
        address: contractAddress as `0x${string}`,
        functionName: 'anchor',
        args: [root as `0x${string}`],
        chainId: qanTestnet.id,
      });
      setTx(hash);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Anchor failed.');
    }
  }

  return (
    <>
      <p className="stamp">chain 1121</p>
      <h1>Anchor</h1>
      <p>MetaMask needs the QAN testnet. The plugin only lists that chain.</p>
      {isConnected ? (
        <p className="mono">
          {address} on {chainId}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => {
            const connector = connectors[0];
            if (!connector) {
              setError('MetaMask connector is missing.');
              return;
            }
            connect({ connector });
          }}
        >
          Connect MetaMask
        </button>
      )}
      <label>
        Anchor contract
        <input
          value={contractAddress}
          onChange={(event) => setContractAddress(event.target.value)}
          placeholder="0x..."
        />
      </label>
      <label>
        Merkle root
        <input value={root} onChange={(event) => setRoot(event.target.value)} placeholder="0x..." />
      </label>
      <button type="button" className="ghost" onClick={loadSaved}>
        Use root from upload
      </button>{' '}
      <button type="button" disabled={!isConnected || isPending} onClick={() => void send()}>
        {isPending ? 'Waiting for wallet' : 'Anchor root'}
      </button>
      {tx ? (
        <p>
          <a href={`https://testnet.qanscan.com/tx/${tx}`}>{tx}</a>
        </p>
      ) : null}
      {error || connectError ? <p>{error || connectError?.message}</p> : null}
    </>
  );
}
