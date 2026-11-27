# Hardhat

```bash
npm i -D hardhat @qan-kit/hardhat
```

```js
require('@qan-kit/hardhat');
```

Importing the plugin adds a `qan` network (chain id 1121, the public testnet RPC). Accounts come from `QAN_PRIVATE_KEY`. If you already defined `networks.qan`, yours wins.

```bash
npx hardhat qan:deploy --contract Counter
```

That reads the Hardhat artifact's source path, flattens it, and deploys through the same core `qan deploy` uses. Solidity imports are flattened first because qvmctl wants one file.
