'use client';

import { useState } from 'react';

interface Leaf {
  name: string;
  hash: string;
  proof: string[];
}

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [root, setRoot] = useState('');
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const [error, setError] = useState('');

  async function hashFiles() {
    setError('');
    const payload = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        dataBase64: bufferToBase64(await file.arrayBuffer()),
      })),
    );
    const response = await fetch('/api/merkle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ files: payload }),
    });
    const body = (await response.json()) as { root?: string; leaves?: Leaf[]; error?: string };
    if (!response.ok || !body.root || !body.leaves) {
      setError(body.error ?? 'Could not build the tree.');
      return;
    }
    setRoot(body.root);
    setLeaves(body.leaves);
    sessionStorage.setItem('qan-notary-root', body.root);
    sessionStorage.setItem('qan-notary-leaves', JSON.stringify(body.leaves));
  }

  return (
    <>
      <p className="stamp">hash, then anchor</p>
      <h1>Upload</h1>
      <p>
        Files stay in the browser. The server only sees them long enough to hash and build the tree.
      </p>
      <label>
        Files
        <input
          type="file"
          multiple
          onChange={(event) => setFiles([...(event.target.files ?? [])])}
        />
      </label>
      <button type="button" disabled={files.length === 0} onClick={() => void hashFiles()}>
        Build Merkle root
      </button>
      {error ? <p>{error}</p> : null}
      {root ? (
        <>
          <h2>Root</h2>
          <pre className="mono">{root}</pre>
          <p>
            <a href="/anchor">Anchor this root</a>
          </p>
          <pre className="mono">{JSON.stringify(leaves, null, 2)}</pre>
        </>
      ) : null}
    </>
  );
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
