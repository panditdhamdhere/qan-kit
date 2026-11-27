# CI

The composite action lives in `action/action.yml`.

```yaml
- uses: panditdhamdhere/qan-kit/action@main
  with:
    contract: contracts/Counter.sol
    name: Counter
    private-key: ${{ secrets.QAN_PRIVATE_KEY }}
```

It runs on `ubuntu-latest`, pulls `qanplatform/qvmctl:latest` for `linux/amd64`, and caches the image tarball with `actions/cache`. Outputs are `address` and `tx-hash`.

The private key is an input so it stays in the Actions secret. `qan` redacts it if you turn on `--verbose`.
