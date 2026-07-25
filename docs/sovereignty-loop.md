# Sovereignty MCP policy loop

The local control plane now has explicit boundaries for the next integration
step:

```text
User / voice
  -> sovereign state + permission gate
  -> router
  -> council verifier
  -> hallucination guard
  -> policy engine / MCP adapter
  -> bounded evidence provider
  -> SCAR
  -> judge / release boundary
  -> spoken_text or visible authorization denial
```

Policy decisions are `ALLOW`, `DENY`, or `ESCALATE`. MCP evidence cannot grant
authority. Persistent memory requires both stateful mode and request-level
permission. ML-DSA-87 remains the only PQC verdict algorithm; unavailable
signing is reported honestly.

The new modules are intentionally isolated from provider SDKs and network
clients so they can be mounted behind the existing `/api/v1/shortcut/route`
handler without adding cloud behavior.
