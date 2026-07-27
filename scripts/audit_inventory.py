#!/usr/bin/env python3
"""Generate a bounded, offline inventory of one repository root.

This tool is intentionally defensive. It never searches from the current
working directory implicitly, follows symlinks, accesses credentials, or makes
network calls. It only reads files below --repo-root and writes a JSON report.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import Counter
from pathlib import Path

EXCLUDED_DIRS = {
    ".git", "node_modules", "DerivedData", "build", "dist", ".build",
    ".pytest_cache", ".mypy_cache", ".venv", "venv", "__pycache__",
    "reports", "scratch",
}
DENIED_NAMES = {".ssh", ".aws", ".azure", ".config"}
MAX_FILE_BYTES = 5 * 1024 * 1024


def fail(message: str) -> int:
    print(json.dumps({"status": "BLOCKED", "reason": message}, indent=2), file=sys.stderr)
    return 2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--report", type=Path, default=Path("reports/audit-inventory.json"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.repo_root.expanduser().resolve()
    if not root.is_dir():
        return fail(f"repository root is not a directory: {root}")
    if root.name in DENIED_NAMES or any(part in DENIED_NAMES for part in root.parts):
        return fail("repository root is within a denied credential/configuration path")
    if not ((root / ".git").exists() or (root / ".gitignore").exists()):
        return fail("repository boundary is ambiguous; expected .git or .gitignore")

    report_path = args.report.expanduser().resolve()
    if report_path == root or root not in report_path.parents:
        return fail("report must be written below the selected repository root")
    report_path.parent.mkdir(parents=True, exist_ok=True)

    files = []
    extensions = Counter()
    total_bytes = 0
    for current, dirs, names in os.walk(root, topdown=True, followlinks=False):
        current_path = Path(current)
        dirs[:] = [
            name for name in dirs
            if name not in EXCLUDED_DIRS
            and not (current_path / name).is_symlink()
        ]
        for name in sorted(names):
            path = current_path / name
            if path.is_symlink() or path == report_path:
                continue
            try:
                size = path.stat().st_size
            except OSError:
                continue
            rel = path.relative_to(root).as_posix()
            digest = None
            if size <= MAX_FILE_BYTES:
                hasher = hashlib.sha256()
                try:
                    with path.open("rb") as handle:
                        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                            hasher.update(chunk)
                    digest = hasher.hexdigest()
                except OSError:
                    digest = None
            suffix = path.suffix.lower() or "[no extension]"
            extensions[suffix] += 1
            total_bytes += size
            files.append({"path": rel, "bytes": size, "sha256": digest})

    report = {
        "status": "PASS",
        "network_accessed": False,
        "source_mutated": False,
        "repo_root": str(root),
        "excluded_directories": sorted(EXCLUDED_DIRS),
        "file_count": len(files),
        "total_bytes": total_bytes,
        "extensions": dict(sorted(extensions.items())),
        "files": files,
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "report": str(report_path), "file_count": len(files)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
