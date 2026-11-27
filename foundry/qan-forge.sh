#!/usr/bin/env bash
# forge build, flatten, then qan deploy.
# Usage: ./foundry/qan-forge.sh src/Counter.sol Counter [extra qan deploy flags]
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: qan-forge.sh <solidity-file> <contract-name> [qan deploy flags...]" >&2
  exit 1
fi

FILE="$1"
NAME="$2"
shift 2

if ! command -v forge >/dev/null 2>&1; then
  echo "forge is not on PATH. Install Foundry: https://book.getfoundry.sh/getting-started/installation" >&2
  exit 1
fi

if ! command -v qan >/dev/null 2>&1; then
  echo "qan is not on PATH. From this repo: pnpm --filter qan-kit build && pnpm --filter qan-kit exec qan" >&2
  exit 1
fi

forge build
FLAT="$(mktemp "${TMPDIR:-/tmp}/qan-flat.XXXXXX.sol")"
trap 'rm -f "$FLAT"' EXIT
forge flatten "$FILE" -o "$FLAT"
qan deploy "$FLAT" --name "$NAME" "$@"
