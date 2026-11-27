# XLINK (status: evolving)

XLINK is how QAN binds a normal secp256k1 key to a post-quantum key. The desktop app and the `qanplatform/xlink:testnet` image are documented. The old `xlinkSet` RPC is deprecated, and the contract ABI is not public.

qan-kit does not hardcode either one. `XlinkProvider.getStatus(address)` is the seam. The default implementation throws `XLINK_NOT_IMPLEMENTED`.

`qan doctor` reports XLINK as evolving and points at the docs:

- https://docs.qanplatform.com/testnet/setup/qan-xlink/docker
- https://docs.qanplatform.com/testnet/qan-api-methods/qan_xlinkvalid

`qan_xlinkValid` is a documented HTTP lookup. We have not pinned it in code, because the binding flow is still moving. When the ABI settles, implement `XlinkProvider` and pass it in. Do not add `xlinkSet` back.
