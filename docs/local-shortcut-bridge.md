# Local Shortcut execution bridge

DevAssist exposes a loopback-first endpoint for an iPhone Shortcut:

```text
POST http://127.0.0.1:<port>/api/v1/shortcut/route
```

The endpoint performs local execution only. It rejects remote URLs, records a
local evidence event, returns `final_output` and `spoken_text`, and reports
`network_accessed: false`. The Shortcut can pass `spoken_text` to **Make Spoken
Audio from Text** and then play the result.

PQC verdict metadata is **ML-DSA-87 only**. This route does not fake a
signature: when no real local ML-DSA-87 signer is configured it returns
`signature_status: unavailable`.
