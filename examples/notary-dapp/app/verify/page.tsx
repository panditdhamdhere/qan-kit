'use client';

import { qanTestnet } from '@qan-kit/chains';
import { useState } from 'react';
import { createPublicClient, http } from 'viem';
import { anchorAbi } from '../../lib/anchor';

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [root, setRoot] = useState('');
  const [proof, setProof] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [message, setMessage] = useState('');

  async function verify() {
    if (!file) return;
    setMessage('');
    try {
      await verifyFile(file);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Verify failed.');
    }
  }

  async function verifyFile(selected: File) {
    const bytes = new Uint8Array(await selected.arrayBuffer());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = `0x${[...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
    const proofList = proof
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter((part) => part.startsWith('0x'));

    const response = await fetch('/api/merkle/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ root, leaf: hash, proof: proofList }),
    });
    const body = (await response.json()) as { ok?: boolean };
    if (!body.ok) {
      setMessage(`Proof does not match this file. Leaf ${hash}.`);
      return;
    }

    const client = createPublicClient({
      chain: qanTestnet,
      transport: http(qanTestnet.rpcUrls.default.http[0]),
    });
    const stamped = await client.readContract({
      abi: anchorAbi,
      address: contractAddress as `0x${string}`,
      functionName: 'rootTimestamp',
      args: [root as `0x${string}`],
    });
    if (stamped === 0n) {
      setMessage('The proof is valid for that root, but the root is not anchored.');
      return;
    }
    setMessage(`File was in a tree anchored at unix ${stamped.toString()}. Leaf ${hash}.`);
  }

  return (
    <>
      <p className="stamp">check the stamp</p>
      <h1>Verify</h1>
      <p>Re-hash the file, check the Merkle proof, then read `rootTimestamp` on chain 1121.</p>
      <label>
        File
        <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </label>
      <label>
        Root
        <input value={root} onChange={(event) => setRoot(event.target.value)} />
      </label>
      <label>
        Proof (hex hashes, spaces or commas)
        <textarea rows={4} value={proof} onChange={(event) => setProof(event.target.value)} />
      </label>
      <label>
        Anchor contract
        <input
          value={contractAddress}
          onChange={(event) => setContractAddress(event.target.value)}
        />
      </label>
      <button type="button" disabled={!file} onClick={() => void verify()}>
        Verify
      </button>
      {message ? <p>{message}</p> : null}
    </>
  );
}
