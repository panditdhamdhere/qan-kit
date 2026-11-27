import { MerkleTree } from 'merkletreejs';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

interface IncomingFile {
  name: string;
  dataBase64: string;
}

function sha256(bytes: Buffer): Buffer {
  return createHash('sha256').update(bytes).digest();
}

export async function POST(request: Request) {
  const body = (await request.json()) as { files?: IncomingFile[] };
  const files = body.files ?? [];
  if (files.length === 0) {
    return NextResponse.json({ error: 'Add at least one file.' }, { status: 400 });
  }

  const leaves = files.map((file) => {
    const bytes = Buffer.from(file.dataBase64, 'base64');
    const hash = sha256(bytes);
    return { name: file.name, hash, hex: `0x${hash.toString('hex')}` };
  });

  const tree = new MerkleTree(
    leaves.map((leaf) => leaf.hash),
    sha256,
    { sortPairs: true, hashLeaves: false },
  );
  const root = `0x${tree.getRoot().toString('hex')}`;

  return NextResponse.json({
    root,
    leaves: leaves.map((leaf) => ({
      name: leaf.name,
      hash: leaf.hex,
      proof: tree.getHexProof(leaf.hash),
    })),
  });
}
