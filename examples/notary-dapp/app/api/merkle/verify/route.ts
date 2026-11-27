import { MerkleTree } from 'merkletreejs';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

function sha256(bytes: Buffer): Buffer {
  return createHash('sha256').update(bytes).digest();
}

export async function POST(request: Request) {
  const body = (await request.json()) as { root?: string; leaf?: string; proof?: string[] };
  if (!body.root || !body.leaf || !body.proof) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const ok = MerkleTree.verify(
    body.proof,
    Buffer.from(body.leaf.replace(/^0x/, ''), 'hex'),
    Buffer.from(body.root.replace(/^0x/, ''), 'hex'),
    sha256,
    { sortPairs: true, hashLeaves: false },
  );
  return NextResponse.json({ ok });
}
