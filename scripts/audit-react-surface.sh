#!/usr/bin/env bash
set -euo pipefail

# Read-only audit. Does not install, execute, or contact external services.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
cd "$ROOT"

echo '== tracked React/package artifacts =='
git ls-files | grep -Ei '(^|/)(node_modules|package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|vite\.config|webpack\.config|next\.config|react|react-dom)(/|\.|$)' || true

echo
echo '== React references outside generated dependencies =='
git grep -nEi '(^|[^[:alnum:]_-])(react|react-dom|react-scripts|vite|next)([^[:alnum:]_-]|$)' -- ':!node_modules/**' ':!package-lock.json' ':!yarn.lock' ':!pnpm-lock.yaml' || true

echo
echo '== network/service references =='
git grep -nEi '(https?://|fetch\(|axios|socket\.io|websocket|firebase|supabase|cloudflare)' -- ':!node_modules/**' || true

echo
echo '== repository status =='
git status --short
