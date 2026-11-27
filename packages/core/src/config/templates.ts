export type InitTemplate = 'solidity' | 'go' | 'python';

export function exampleContract(template: InitTemplate): { relativePath: string; source: string } {
  if (template === 'go') {
    return { relativePath: 'contracts/main.go', source: GO_COUNTER };
  }
  if (template === 'python') {
    return { relativePath: 'contracts/main.py', source: PYTHON_COUNTER };
  }
  return { relativePath: 'contracts/Counter.sol', source: SOLIDITY_COUNTER };
}

export function configSource(template: InitTemplate): string {
  const contract = exampleContract(template);
  const language = template === 'solidity' ? 'solidity' : template;
  const nameLine = template === 'solidity' ? "\n      name: 'Counter'," : '';
  return `import { defineConfig } from '@qan-kit/core'

export default defineConfig({
  network: 'qan-testnet',
  rpcUrl: 'https://rpc-testnet.qanplatform.com',
  chainId: 1121,
  images: {
    qvmctl: 'qanplatform/qvmctl:latest',
    registry: 'qanplatform',
  },
  docker: {
    // qvmctl publishes an amd64 image only. Harmless on x86, required on Apple Silicon.
    platform: 'linux/amd64',
  },
  contracts: {
    Counter: {
      path: '${contract.relativePath}',
      language: '${language}',${nameLine}
    },
  },
})
`;
}

export const ENV_EXAMPLE = `# Hex secp256k1 key, with or without 0x.
# This file is an example. Put the real value in .env (gitignored) or your shell.
# Never commit a key, and never paste it into qan.config.
QAN_PRIVATE_KEY=

# Optional overrides
# QAN_RPC_URL=https://rpc-testnet.qanplatform.com
# QAN_CHAIN_ID=1121
# QAN_DOCKER_PLATFORM=linux/amd64
`;

const SOLIDITY_COUNTER = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Counter {
    uint256 public count;

    event Incremented(uint256 count, address indexed caller);

    function increment() external {
        count += 1;
        emit Incremented(count, msg.sender);
    }
}
`;

const GO_COUNTER = `package main

import (
	"fmt"
	"os"
	"strconv"
)

// QVM reads come in as DB_<SLOT>. Writes go to stdout as DBW=<SLOT>=<VALUE>.
// Call this with: qan send ... and the slot scanner will add -r COUNTER.
func main() {
	if len(os.Args) == 2 && os.Args[1] == "construct" {
		os.Stdout.WriteString("DBW=COUNTER=0\\n")
		os.Exit(0)
	}

	current, _ := strconv.Atoi(os.Getenv("DB_COUNTER"))
	next := current + 1
	os.Stdout.WriteString(fmt.Sprintf("OUT=count: %d\\n", next))
	os.Stdout.WriteString(fmt.Sprintf("DBW=COUNTER=%d\\n", next))
}
`;

const PYTHON_COUNTER = `import os
import sys

# gpython on QVM is a partial Python 3.4. Keep this boring on purpose.
def main(argv):
    if len(argv) == 2 and argv[1] == "construct":
        sys.stdout.write("DBW=COUNTER=0\\n")
        return 0

    raw = os.getenv("DB_COUNTER") or "0"
    try:
        current = int(raw)
    except Exception:
        current = 0
    nxt = current + 1
    sys.stdout.write("OUT=count: %d\\n" % nxt)
    sys.stdout.write("DBW=COUNTER=%d\\n" % nxt)
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
`;
