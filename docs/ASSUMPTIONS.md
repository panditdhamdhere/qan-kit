# Assumptions

Checked on 27 Nov 2026 against the public docs and `qanplatform/qvmctl:latest` (`v0.1.0-d92ee75`), pulled with `docker run --rm --platform linux/amd64`.

Anything still unknown is a config knob. Nothing below is filled in from memory.

## Confirmed

- Testnet chain id is **1121**. Native token is **QANX**, 18 decimals. RPC `https://rpc-testnet.qanplatform.com`. Explorer `https://testnet.qanscan.com`. Faucet `https://faucet.qanplatform.com`.
- Explorer transaction pages respond at `https://testnet.qanscan.com/tx/<hash>`. Address pages respond at `https://testnet.qanscan.com/address/<address>`.
- Image: `qanplatform/qvmctl` (tag `latest`). Digest seen locally: `sha256:7d11bd25741025849795ddaac31703e52087076b7b8b461bd18191d575eab4fc`.
- The image has **no linux/arm64 manifest**. On Apple Silicon, `docker pull` fails with `no matching manifest for linux/arm64/v8` unless you pass `--platform linux/amd64`.
- Docs still show version `v0.0.4-46e19631`. The image we pulled prints `v0.1.0-d92ee75`. The toolkit trusts the image, not the stale doc string.
- Image entrypoint is `/app/qvmctl`, working directory `/ws`. A `docker` client is baked into the image (`/usr/bin/docker`), which matches the docs mounting `/var/run/docker.sock` so qvmctl can pull language toolchains.
- Top-level subcommands: `deploy`, `flags`, `genesis`, `help`, `network`, `query`, `tx`, `version`.
- Deploy flags we will pass:
  - `-language` (`solidity` / `sol`, or `go` / `golang`, `python`, `ts` / `typescript`, `js` / `javascript`, `c`, `cpp` / `cxx`). Default inside qvmctl is `golang`.
  - `-solidity.name` when the language is Solidity.
  - `-privkey` is a **file path inside the container**, hex secp256k1, `0x` optional. The key never goes in `qan.config.*` and is never printed.
  - `-rpc` (default inside qvmctl is `http://localhost:8545`, not the public testnet).
  - `-registry` default `qanplatform` (toolchain images).
- `deploy -precompilerImpl` defaults to **3** and the help text marks the flag deprecated. Docs still say impl 3 is the only one supported on testnet. qan-kit does not send the flag unless `precompilerImpl` is set in config.
- Solidity in qvmctl 0.1.0 also accepts `-solidity.basePath` (default `.`) and `-solidity.includePaths`. The written docs still say the compiler does not support imports and that a single file is the safe option. qan-kit flattens by default. Include paths stay available on `qan deploy` for people who want them.
- `deploy` positional args after the source path are documented as **unused** ("reserved for forward compatibility"). `qan deploy --args` forwards them and prints that warning. It does not pretend the constructor received them.
- QVM calls use `tx` and `query`. Read slots are `-r` / `-read`, a comma-separated list of slot names (or `0x` 32-byte hashes).
- Slot names inside the contract are environment variables prefixed with `DB_`. Writes are stdout lines `DBW=<SLOT>=<VALUE>`. Deletes are `DBP=<SLOT>`. Virtual stdout is `OUT=`. This matches the Go, Python, and TypeScript samples.
- Logs are logrus text: `time="..." level=fatal msg="..."`. A missing deploy argument exits 1 with `expect at least one argument`.
- XLINK Docker image documented today: `qanplatform/xlink:testnet`. Validity lookup documented today: `GET https://rpc-testnet.qanplatform.com/xlinkValid/{address}/` with a string field `Validity` (unix seconds). `xlinkSet` is not called. No XLINK contract ABI is pinned.
- Mainnet is not configured. Asking for it throws "not launched".

## Not confirmed, so configurable

- **Deploy stdout shape.** We did not complete a deploy (no funded key, and the RPC timed out from this network). The success parser looks for a labelled address and tx hash, then falls back to a single `0x` address and a single 32-byte hash. Override with `output.addressPattern` and `output.txHashPattern` if a real run doesn't match. Raw logs are kept next to the deployment file.
- **Public RPC from this machine.** `eth_chainId` to `https://rpc-testnet.qanplatform.com` timed out over both IPv4 and IPv6 (curl exit 28, and qvmctl `context deadline exceeded`). The live test stays behind `QAN_LIVE=1`. `rpcUrl` is config.
- **Whether `DB_QVM_INITIALIZED` must be passed to `-r`.** Samples read it, and the docs' `-r` example does not list it. The slot scanner treats `QVM_INITIALIZED` as runtime-provided and does not warn when it is missing from `-r`. Other `DB_*` reads do warn.
- **Constructor arguments** for Solidity. See the unused-args note above. There is no second code path that ABI-encodes them.
- **WSL volume layout.** Linux and macOS paths are mounted as-is (`-v <abs>:/ws`). Windows paths become `/c/Users/...`. WSL defaults to the Linux path (`/mnt/c/...`), which is what Docker Desktop's WSL2 engine accepts. Set `docker.wslInterop` to `windows` if your daemon expects `/c/...` instead.
- **Docker socket path.** We probe `DOCKER_HOST` (`unix://...`), then `/var/run/docker.sock`, then `~/.docker/run/docker.sock` on macOS. Override with `docker.socketPath`.
- **Gas, confirmations, pretest timeout.** Left at qvmctl defaults (`-gasLimit` unset means estimate, `-blockConfirm` default 1, `-pretest.timeout` default 5) unless config sets them.
- **Toolchain image names** beyond the `qanplatform` registry hostname. qvmctl pulls those itself. We do not hardcode `qanplatform/golang` or similar.
