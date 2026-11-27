# Foundry

See [foundry/README.md](https://github.com/panditdhamdhere/qan-kit/blob/main/foundry/README.md).

```bash
export QAN_PRIVATE_KEY=0x...
./foundry/qan-forge.sh src/Counter.sol Counter
```

`forge build`, then `forge flatten`, then `qan deploy`. Foundry's flattener is the one that runs. `qan` still talks to `qvmctl`.
