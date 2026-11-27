# Why your QVM storage reads return empty

Solidity reads storage whenever it wants. A QVM contract (Go, Python, TypeScript, …) runs in a sandbox. The node only injects the slots you listed, as environment variables named `DB_<SLOT>`.

If `-r` does not include the slot, the read does not revert. It comes back empty. The call still looks successful.

```bash
qan slots contracts/main.go
# -r COUNTER
qan send Counter bump --slots COUNTER
```

`qan send` scans the source and adds those slots for you. It still warns. Dynamic keys (`DBW=USER_%d=`) cannot be known statically, so you pass those by hand.

`DB_QVM_INITIALIZED` shows up in the official samples and is treated as a runtime flag, not something you put on `-r`. That choice is written down in [Assumptions](/ASSUMPTIONS).

Writes are stdout lines:

```text
DBW=COUNTER=1
DBP=OLD_KEY
OUT=count: 1
```
