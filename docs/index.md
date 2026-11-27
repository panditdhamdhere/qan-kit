# Deploy to QAN in 5 minutes

QAN testnet is chain id **1121**. Gas token is **QANX**. `qan` wraps the Docker CLI `qvmctl` so you do not have to remember the mount flags.

## 1. Install

```bash
npm i -g qan-kit
# or, from this repo:
pnpm install && pnpm --filter qan-kit build
```

Docker has to be running. On Apple Silicon, compilation only works under `linux/amd64`. `qan doctor` will tell you.

## 2. Scaffold

```bash
qan init --template solidity
cp .env.example .env
# put a test key in QAN_PRIVATE_KEY, then fund it
# https://faucet.qanplatform.com
```

## 3. Check, then deploy

```bash
qan doctor
qan deploy contracts/Counter.sol --name Counter
```

You get an address, a tx hash, an explorer link, and `deployments/qan-testnet/Counter.json`.

```bash
qan send Counter increment
qan call Counter count
```

Mainnet is not wired up. Asking for it fails on purpose.
