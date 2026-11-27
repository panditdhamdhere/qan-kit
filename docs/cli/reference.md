# CLI

Global flags, before the command: `--json`, `--verbose`, `--network qan-testnet`.

`--json` prints one object. Errors are `{ "error": { "code", "message", "hint" } }`. `--verbose` prints the docker command with secrets replaced by `[redacted]`.

## init

Write `qan.config.ts`, `.env.example`, and a sample contract.

```bash
qan init --template solidity
qan init --template go
qan init --template python
qan init --force
```

## doctor

Check Docker, the daemon, arm64 emulation, the qvmctl image, the RPC chain id, the account balance, and XLINK.

```bash
qan doctor
```

A failed check exits 1. Warnings (no key, arm64 emulation, XLINK not implemented) do not.

## flatten

Resolve imports, including `remappings.txt` and `node_modules`. One SPDX line, one pragma, a warning if several contracts are left.

```bash
qan flatten contracts/Counter.sol -o flat.sol
```

## slots

Scan Go, Python, or TypeScript for `DB_*` reads and `DBW=` writes.

```bash
qan slots contracts/main.go --declare COUNTER
```

## deploy

Flatten Solidity when needed, run `qvmctl deploy`, wait for the receipt, write `deployments/qan-testnet/<Name>.json`.

```bash
qan deploy contracts/Counter.sol --name Counter
qan deploy contracts/main.go --language go
```

`--args` is forwarded. qvmctl 0.1.0 documents those positional args as unused, and the CLI says so.

## call

Read. Solidity uses `eth_call` through viem and the ABI in the deployment file. QVM uses `qvmctl query`.

```bash
qan call Counter count
```

## send

Write. Solidity sends a transaction with viem. QVM uses `qvmctl tx` and adds scanned slots to `-r`.

```bash
qan send Counter increment
qan send Users register --slots QVM_INIT_MAXUSER,TOTALUSERS ada
```
