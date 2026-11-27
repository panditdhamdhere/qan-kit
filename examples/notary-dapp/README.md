# Notary

A small Next.js app that hashes files, builds a Merkle root, and anchors that root on QAN testnet (chain id 1121).

```bash
# from the repo root, after pnpm install
pnpm --filter qan-kit build
cd examples/notary-dapp
# fund a key, then
qan deploy contracts/Anchor.sol --name Anchor
pnpm dev
```

Paste the deployed address into the anchor and verify pages. MetaMask has to be on chain 1121. `qan doctor` is the shortest way to see if the RPC and the key are healthy.

## Threat model

Anchoring a hash proves that someone submitted that digest at a chain timestamp. It does not encrypt the file, hide it, or prove who created it. The file never needs to be stored on chain. Anyone with the file can recompute the leaf and check the proof.

Transactions are still signed with secp256k1. QAN's post-quantum story is XLINK, and that binding is not part of this demo. A quantum break of the signing key is a separate problem from "did this hash exist at this block". The anchor is only as trustworthy as the chain's clock and the account that sent the transaction.
