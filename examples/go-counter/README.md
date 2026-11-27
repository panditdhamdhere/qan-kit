# Go counter

A QVM contract. `qan slots main.go` should print `-r COUNTER`. If that slot is left off the call, `DB_COUNTER` comes back empty and the counter looks like it reset.

```bash
qan deploy main.go --language go --name Counter
qan send Counter increment
```

`qan send` adds the scanned slots on its own. A raw `qvmctl tx` does not.
