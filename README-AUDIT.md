# DevAssist420 Local Audit Playground

This repository now includes bounded, local-only audit guardrails. They reduce accidental scope expansion, but they are not an operating-system sandbox.

## Workspace model

For stronger isolation, create an external workspace:

```text
DevAssist420-Audit/
├── repo/            # read-only clone or source mount
├── reports/         # generated findings
├── scripts/         # copied or mounted audit tools
├── sandbox-config/  # policy files
└── scratch/         # temporary files
```

When auditing this checkout directly, run tools from the repository root and pass the root explicitly. Do not run scans from an unknown working directory.

## Bounded inventory

```bash
python3 scripts/audit_inventory.py --repo-root .
```

The inventory:

- resolves and validates the selected repository root;
- scans only that root;
- excludes `.git`, `node_modules`, build products, `DerivedData`, caches, and generated audit output;
- writes only to `reports/` unless an explicit report path is supplied;
- makes no network calls;
- does not read credential directories, SSH keys, or environment secrets;
- never modifies source files.

## Policy

See `sandbox-config/audit-policy.json` for the machine-readable policy. These files provide application-level guardrails and fail-closed behavior. They cannot enforce read-only mounts, process privileges, network isolation, or credential denial. Use a read-only container/VM or OS-level sandbox when those guarantees are required.

## Local-only operating rules

- Network access is disabled by policy.
- Cloud agents and remote scanners are not part of the audit workflow.
- Source mutation is disabled by default.
- Generated reports and scratch data must remain outside the source boundary where possible.
- Any future mutating operation requires a separate, explicit owner authorization and a local SCAR event.
