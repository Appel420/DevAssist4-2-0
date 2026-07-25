# Local Shortcut bridge and safety contract

The local route is a governed transition, not a direct model pass-through:

```text
voice / Shortcut
  -> local DevAssist router
  -> Behavioral Safety Governor
  -> capability registry
  -> circuit breaker
  -> local execution
  -> evidence
  -> spoken_text
```

Persistent memory, policy changes, command execution, and external requests are
not silently authorized. The route returns `blocked` or `alert` with options
when consent, scope, circuit, or administrator authority is missing.

The model council is exposed in `routing.council`; it describes local model
choices and does not claim that every model is available. Hallucination or
unsupported-authority signals must produce a user-visible alert and an audit
event rather than being hidden.

PQC verdict metadata is ML-DSA-87 only. No signature is fabricated when a real
local signer is unavailable.
