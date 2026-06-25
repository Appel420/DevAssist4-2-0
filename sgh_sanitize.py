#!/usr/bin/env python3
"""
sgh_sanitize.py — SGHv119 Conflict Resolver + Deduplicator + Bug Hunter
Root Admin tool: run before every deploy to keep the dashboard lean.

Usage:
    python3 sgh_sanitize.py                    # report only
    python3 sgh_sanitize.py --fix              # auto-fix and overwrite
    python3 sgh_sanitize.py --fix --backup     # fix with .bak backup
    python3 sgh_sanitize.py --json             # CI/CD JSON output
    python3 sgh_sanitize.py path/to/file.html  # specific file

Detects and fixes:
    CONFLICT  Git conflict markers (<<<<<<<, =======, >>>>>>>)
    DEDUP     Duplicate IIFE function names
    DEDUP     Duplicate BRIDGE.send / BRIDGE.base definitions
    DEDUP     Duplicate _candidates blocks
    DEDUP     Duplicate setInterval(reprobe) calls
    DEDUP     Empty/noise script blocks
    SCAR      Google Fonts / CDN references
    CSS       Duplicate CSS rule IDs
    BUG       await fetch() calls (WKWebView unsafe)
"""

import sys, re, json, argparse, shutil, subprocess
from pathlib import Path
from collections import Counter, defaultdict

R='\033[91m'; Y='\033[93m'; G='\033[92m'; B='\033[94m'; Z='\033[0m'
def c(t,col): return f"{col}{t}{Z}" if sys.stdout.isatty() else t

# ════════════════════════════════════════════════════════════════════
# DETECTORS
# ════════════════════════════════════════════════════════════════════

def detect_conflicts(src):
    """Git merge conflict markers."""
    hits = []
    for m in re.finditer(r'^(<{7}[^\n]+|={7}\s*$|>{7}[^\n]+)', src, re.MULTILINE):
        ln = src[:m.start()].count('\n') + 1
        hits.append({'line': ln, 'marker': m.group(1), 'text': m.group(0)[:60]})
    return hits

def detect_duplicate_iifes(scripts):
    """Same-named IIFEs defined more than once."""
    names = defaultdict(list)
    for i, (start, end, src) in enumerate(scripts):
        for n in re.findall(r'\(function\s+(\w+)\s*\(', src):
            names[n].append(i)
    return {k: v for k, v in names.items() if len(v) > 1}

def detect_bridge_dups(scripts):
    """Multiple BRIDGE.send / BRIDGE.base definitions."""
    send_blocks  = [i for i,(s,e,src) in enumerate(scripts) if 'window.BRIDGE.send' in src]
    base_blocks  = [i for i,(s,e,src) in enumerate(scripts)
                    if "BRIDGE.base=''" in src or "BRIDGE.base = ''" in src]
    cand_blocks  = [i for i,(s,e,src) in enumerate(scripts) if 'var _candidates' in src]
    reprobe_count= sum(src.count('setInterval(reprobe') for _,_,src in scripts)
    return {
        'BRIDGE.send':       send_blocks  if len(send_blocks) > 1  else [],
        'BRIDGE.base':       base_blocks  if len(base_blocks) > 1  else [],
        '_candidates':       cand_blocks  if len(cand_blocks) > 1  else [],
        'setInterval-reprobe': reprobe_count if reprobe_count > 1  else 0,
    }

def detect_empty_blocks(scripts):
    return [i for i,(s,e,src) in enumerate(scripts) if len(src.strip()) < 50]

def detect_scar_violations(src):
    hits = []
    for pattern, msg in [
        (r'fonts\.googleapis\.com',         'Google Fonts CDN'),
        (r'cdnjs\.cloudflare\.com',         'cdnjs CDN'),
        (r'ajax\.googleapis\.com',           'Google AJAX CDN'),
        (r'cdn\.jsdelivr\.net',              'jsDelivr CDN'),
    ]:
        for m in re.finditer(pattern, src, re.IGNORECASE):
            ln = src[:m.start()].count('\n') + 1
            hits.append({'line': ln, 'type': msg, 'text': m.group(0)})
    return hits

def detect_css_dups(src):
    styles = re.findall(r'<style[^>]*>([\s\S]*?)</style>', src, re.IGNORECASE)
    ids = re.findall(r'#([\w-]+)\s*\{', '\n'.join(styles))
    return {k: v for k, v in Counter(ids).items() if v > 1}

def detect_await_fetch(src):
    hits = []
    for m in re.finditer(r'\bawait fetch\(', src):
        ln = src[:m.start()].count('\n') + 1
        hits.append({'line': ln, 'text': src[m.start():m.start()+80].replace('\n',' ')})
    return hits

def detect_syntax_errors(scripts):
    errs = []
    for i, (s, e, src) in enumerate(scripts):
        p = Path(f'/tmp/_sghsanit_{i}.js')
        p.write_text(src)
        r = subprocess.run(['node','--check',str(p)], capture_output=True, text=True)
        if r.returncode != 0:
            errs.append({'block': i, 'error': r.stderr.strip()[:120]})
    return errs

# ════════════════════════════════════════════════════════════════════
# FIXERS
# ════════════════════════════════════════════════════════════════════

def fix_conflicts(src):
    """Auto-resolve: take OURS (first branch) for HEAD conflicts."""
    fixed, count = src, 0
    pattern = re.compile(
        r'<{7}[^\n]*\n([\s\S]*?)={7}\n[\s\S]*?>{7}[^\n]*\n',
        re.MULTILINE
    )
    def take_ours(m):
        nonlocal count; count += 1
        return m.group(1)
    fixed = pattern.sub(take_ours, fixed)
    # Remove any remaining bare markers
    for marker in (r'^<{7}[^\n]*\n', r'^={7}\n', r'^>{7}[^\n]*\n'):
        fixed = re.sub(marker, '', fixed, flags=re.MULTILINE)
    return fixed, count

def fix_empty_blocks(src, empty_indices, scripts):
    """Remove script blocks that are empty or pure whitespace/comments."""
    result = src
    # Remove in reverse order to preserve positions
    for i in sorted(empty_indices, reverse=True):
        start, end, _ = scripts[i]
        result = result[:start] + result[end:]
    return result, len(empty_indices)

def fix_duplicate_candidates(src):
    """Keep only the first _candidates definition, collapse rest to location.host."""
    count = 0
    matches = list(re.finditer(r'var _candidates\s*=\s*_override\s*\?[^;]+;', src, re.DOTALL))
    if len(matches) > 1:
        for m in reversed(matches[1:]):
            src = src[:m.start()] + 'var _candidates=[location.host]' + src[m.end():]
            count += 1
    return src, count

def fix_duplicate_reprobe(src):
    """Keep only the first setInterval(reprobe,...) call."""
    count = 0
    matches = list(re.finditer(r'setInterval\(reprobe,\s*\d+\)', src))
    if len(matches) > 1:
        for m in reversed(matches[1:]):
            src = src[:m.start()] + '/* duplicate reprobe removed */' + src[m.end():]
            count += 1
    return src, count

def fix_scar_violations(src):
    """Remove known CDN/Google references."""
    count = 0
    for pattern in [
        r"['\"]https?://fonts\.googleapis\.com[^'\"]*['\"]",
        r"s\.src\s*=\s*['\"]https://cdnjs\.cloudflare\.com[^'\"]*['\"];",
    ]:
        new, n = re.subn(pattern, "'/* SCAR: CDN removed */'", src)
        src, count = new, count + n
    return src, count

# ════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════

def parse_scripts(src):
    """Return list of (start, end, content) for all inline scripts."""
    results = []
    for m in re.finditer(
        r'<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)</script>', src, re.IGNORECASE):
        results.append((m.start(), m.end(), m.group(1)))
    return results

def run(filepath, fix=False, backup=False, as_json=False):
    src = Path(filepath).read_text(encoding='utf-8', errors='ignore')
    scripts = parse_scripts(src)

    report = {
        'file':         str(filepath),
        'size_kb':      len(src) // 1024,
        'blocks':       len(scripts),
        'issues':       [],
        'total_issues': 0,
        'auto_fixable': 0,
        'fixed':        [],
    }

    # ── Detect ───────────────────────────────────────────────────────
    conflicts    = detect_conflicts(src)
    dup_iifes    = detect_duplicate_iifes(scripts)
    bridge_dups  = detect_bridge_dups(scripts)
    empty_blocks = detect_empty_blocks(scripts)
    scar         = detect_scar_violations(src)
    css_dups     = detect_css_dups(src)
    await_fetch  = detect_await_fetch(src)
    syntax_errs  = detect_syntax_errors(scripts)

    def issue(severity, type_, msg, count=1, fixable=False, detail=None):
        obj = {'severity': severity, 'type': type_, 'msg': msg,
               'count': count, 'fixable': fixable}
        if detail: obj['detail'] = detail
        report['issues'].append(obj)
        report['total_issues'] += count
        if fixable: report['auto_fixable'] += count

    if conflicts:
        issue('CRITICAL', 'CONFLICT', f'{len(conflicts)} git conflict marker(s)', len(conflicts), True,
              [f"L{h['line']}: {h['text']}" for h in conflicts])
    if dup_iifes:
        for name, blocks in dup_iifes.items():
            issue('HIGH', 'DEDUP', f"IIFE '{name}' defined {len(blocks)}x in blocks {blocks}", 1, False)
    for key, val in bridge_dups.items():
        if val:
            cnt = val if isinstance(val, int) else len(val)
            issue('HIGH', 'DEDUP', f'{key} defined {cnt}x', 1, key in ('_candidates','setInterval-reprobe'))
    if empty_blocks:
        issue('LOW', 'NOISE', f'{len(empty_blocks)} empty script block(s): {empty_blocks}', len(empty_blocks), True)
    if scar:
        issue('CRITICAL', 'SCAR', f'{len(scar)} CDN/external dependency violation(s)', len(scar), True,
              [f"L{h['line']}: {h['type']}" for h in scar])
    if css_dups:
        issue('MEDIUM', 'CSS', f"Duplicate CSS IDs: {list(css_dups.keys())[:8]}", len(css_dups), False)
    if await_fetch:
        issue('HIGH', 'BUG', f'{len(await_fetch)} await fetch() call(s) — WKWebView unsafe', len(await_fetch), False,
              [f"L{h['line']}" for h in await_fetch])
    if syntax_errs:
        issue('CRITICAL', 'SYNTAX', f'{len(syntax_errs)} JS syntax error(s)', len(syntax_errs), False,
              [f"Block {e['block']}: {e['error']}" for e in syntax_errs])

    # ── Output ───────────────────────────────────────────────────────
    if as_json:
        print(json.dumps(report, indent=2))
        return report

    col = {'CRITICAL':R,'HIGH':Y,'MEDIUM':B,'LOW':Z}
    print(f"\n{c('SGH SANITIZER',B)} — {filepath}")
    print(f"  {len(src)//1024}KB | {len(scripts)} blocks | {report['total_issues']} issues | {report['auto_fixable']} auto-fixable\n")

    if not report['issues']:
        print(c('  ✓ All clean', G)); return report

    for iss in report['issues']:
        sev = iss['severity']
        print(f"  {c(sev,''):8s} {c('['+iss['type']+']',col.get(sev,Z)):14s} {iss['msg']}")
        for d in (iss.get('detail') or [])[:3]:
            print(f"           {c(d,Z)}")

    # ── Fix ──────────────────────────────────────────────────────────
    if fix:
        if backup:
            import time
            bak = str(filepath) + '.' + str(int(time.time())) + '.bak'
            shutil.copy(filepath, bak)
            print(f"\n  Backup → {bak}")

        fixed_src = src
        fix_log   = []

        fixed_src, n = fix_conflicts(fixed_src)
        if n: fix_log.append(f"Resolved {n} conflict marker(s)")

        # Re-parse after conflict fix
        fixed_scripts = parse_scripts(fixed_src)
        empty_now = detect_empty_blocks(fixed_scripts)
        fixed_src, n = fix_empty_blocks(fixed_src, empty_now, fixed_scripts)
        if n: fix_log.append(f"Removed {n} empty script block(s)")

        fixed_src, n = fix_duplicate_candidates(fixed_src)
        if n: fix_log.append(f"Collapsed {n} duplicate _candidates block(s)")

        fixed_src, n = fix_duplicate_reprobe(fixed_src)
        if n: fix_log.append(f"Removed {n} duplicate setInterval(reprobe)")

        fixed_src, n = fix_scar_violations(fixed_src)
        if n: fix_log.append(f"Removed {n} SCAR CDN violation(s)")

        Path(filepath).write_text(fixed_src, encoding='utf-8')
        report['fixed'] = fix_log

        print(f"\n  {c('FIXED:',G)}")
        for f in fix_log: print(f"    ✓ {f}")
        new_size = len(fixed_src) // 1024
        print(f"  Size: {len(src)//1024}KB → {new_size}KB (saved {len(src)//1024-new_size}KB)")

    return report

def main():
    ap = argparse.ArgumentParser(description='SGH Sanitizer')
    ap.add_argument('file', nargs='?', default='SGHv119.html')
    ap.add_argument('--fix',    action='store_true', help='auto-fix all fixable issues')
    ap.add_argument('--backup', action='store_true', help='create .bak before fixing')
    ap.add_argument('--json',   action='store_true', help='JSON output for CI/CD')
    args = ap.parse_args()

    result = run(args.file, fix=args.fix, backup=args.backup, as_json=args.json)
    sys.exit(0 if result['total_issues'] == 0 else 1)

if __name__ == '__main__':
    main()
