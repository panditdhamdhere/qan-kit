# Foundry

`qan-forge.sh` is a thin wrapper. Foundry compiles and flattens. `qan` deploys the flat file with `qvmctl`, because QAN's compiler does not follow imports on its own.

```bash
export QAN_PRIVATE_KEY=0x...
./foundry/qan-forge.sh src/Counter.sol Counter
```

What it runs:

1. `forge build`
2. `forge flatten src/Counter.sol`
3. `qan deploy <flat file> --name Counter`

Extra flags after the name are passed through to `qan deploy` (`--json`, `--verbose`).

You still need Docker, and on Apple Silicon `docker.platform` has to be `linux/amd64`. `qan doctor` will say so if it isn't.
