# DevAssist420 Audit Charter

## Scope

This audit is limited to `Appel420/DevAssist420`. It excludes unrelated repositories, parent directories, personal filesystem paths, credentials, and generated dependency trees.

## Operating mode

`OWNER_AUTHORIZED_REVIEW` with source inspection and bounded static analysis only. Network access, cloud agents, remote scanners, credential access, and source mutation are disabled by default.

## Evidence standard

Findings must identify the file, symbol or route, observed behavior, and verification status. Hypotheses must not be presented as confirmed vulnerabilities.

## Required phases

1. Inventory the bounded repository root.
2. Trace the actual runtime path.
3. Map authorization, state, network, and audit boundaries.
4. Propose hardening changes separately from verified findings.

## State policy

Device-local state is authoritative. External state and synchronization are denied by default and require an explicit, scoped, time-limited owner authorization with a local SCAR event.

## Sandbox limitation

Repository scripts can fail closed and avoid unsafe paths, but they cannot enforce kernel-level read-only mounts, process isolation, credential denial, or network blocking. Use an OS/container/VM sandbox for those guarantees.

## Approval record

- Scope approved: pending
- Findings verified: pending
- Mutations approved: none
- External operations authorized: none
