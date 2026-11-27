# Apple Silicon

`qanplatform/qvmctl:latest` has no arm64 manifest. Pulled on an M-series Mac without a platform flag, Docker says:

```text
no matching manifest for linux/arm64/v8
```

QAN's own docs also say contract compilation does not support ARM64 yet.

`qan init` writes `docker.platform: linux/amd64`. That makes Docker emulate amd64. It is slower, and it is the path that actually works today. An x86_64 machine or GitHub-hosted `ubuntu-latest` also works.

`qan doctor` prints this instead of failing halfway through a deploy. If you set the platform back to `linux/arm64`, deploy refuses with `UNSUPPORTED_ARCH`.
