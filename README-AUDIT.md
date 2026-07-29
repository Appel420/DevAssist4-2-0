# DevAssist420 Local Audit Playground

This repository includes bounded, local-only audit guard rails. They reduce accidental scope expansion and fail closed when the selected repository boundary is invalid.

## Workspace model

For stronger isolation, create an external workspace:

```text
DevAssist420-Playground/
├── repo/              # read-only clone or source mount
├── reports/           # generated findings
├── scripts/           # copied or mounted audit tools
├── playground-config/ # policy files
└── scratch/           # temporary files
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

See `playground-config/audit-policy.json` for the machine-readable policy. These files provide application-level guard rails and fail-closed behavior. They do not claim to enforce operating-system isolation, read-only mounts, process privileges, network isolation, or credential denial.

## Local-only operating rules

- Network access is disabled by policy.
- Cloud agents and remote scanners are not part of the audit workflow.
- Source mutation is disabled by default.
- Generated reports and scratch data must remain outside the source boundary where possible.
- Any future mutating operation requires a separate, explicit owner authorization and a local audit event.
