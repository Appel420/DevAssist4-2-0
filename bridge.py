#!/usr/bin/env python3
"""
Sovereignty One Brain v2.3 — Port 9898
Serves SGHv119.html AND all API endpoints on ONE port.
Same-origin = ATS never blocks dashboard → API calls.

Usage in iSH:
  export ANTHROPIC_API_KEY="sk-ant-..."
  export OPENAI_API_KEY="sk-..."
  export XAI_API_KEY="xai-..."
  python3 bridge.py
  Open: http://192.168.1.252:9898/
"""

import hashlib, json, os, secrets, signal, socket, subprocess, sys, time
import urllib.error, urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List, Optional

PORT  = int(os.environ.get('BRIDGE_PORT', 9898))
def _get_host():
    import socket as _s
    try:
        sock = _s.socket(_s.AF_INET, _s.SOCK_DGRAM)
        sock.connect(('8.8.8.8', 80))
        ip = sock.getsockname()[0]
        sock.close()
        return ip
    except Exception:
        return '127.0.0.1'

HOST  = os.environ.get('SG_HOST', _get_host())
KEYS: Dict[str, str] = {}
SCAR: List[dict] = []
_root = None

MODELS = {
    'claude': os.environ.get('CLAUDE_MODEL', 'claude-opus-4-7'),
    'gpt':    os.environ.get('GPT_MODEL',    'gpt-4.1'),
    'grok':   os.environ.get('GROK_MODEL',   'grok-4.3'),
}

# ── Crypto backend (Ed25519 + X25519 via crypto_backends.py) ─────────────
_CRYPTO_STATUS = {"platform": __import__("sys").platform, "engine": "stub", "ed25519": False}
try:
    from crypto_backends import platform_sign, get_platform_signer, _HAS_CRYPTO
    _SIGNER = platform_sign
    _CRYPTO_STATUS.update({"engine": "cryptography" if _HAS_CRYPTO else "hashlib-stub",
                            "ed25519": _HAS_CRYPTO, "x25519": _HAS_CRYPTO})
    print(f"[Crypto] Ed25519/X25519 active — engine: {_CRYPTO_STATUS['engine']}")
except Exception as e:
    print(f"[Crypto] crypto_backends.py not found — using hashlib ({e})")
    def _SIGNER(payload):
        import hmac as _h
        seed = __import__("hashlib").sha512(payload).digest()
        return seed[:32], seed[32:64], seed[64:96]

# Legacy PQC flag (kept for dashboard compatibility)
PQC = _CRYPTO_STATUS["ed25519"]
_sig = _pub = None

try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from repmhl import REPMHL
    _repmhl = REPMHL()
    _repmhl.start_session()
except Exception:
    _repmhl = None

# ── SimpleMerkle + SimpleRatchet (stdlib, no deps) ───────────────────────
class _Merkle:
    def __init__(self): self.leaves = []
    def append(self, data):
        self.leaves.append(hashlib.sha256(data if isinstance(data,bytes) else data.encode()).digest())
    @property
    def root(self):
        if not self.leaves: return b"\x00"*32
        h = self.leaves[0]
        for leaf in self.leaves[1:]: h = hashlib.sha256(h+leaf).digest()
        return h

class _Ratchet:
    def __init__(self): self.key = secrets.token_bytes(32)
    def encrypt(self, data):
        self.key = hashlib.sha256(self.key + b"evolve").digest()
        return data if isinstance(data,bytes) else data.encode()
    def rotate(self): self.key = hashlib.sha256(self.key + b"rotate").digest()

_merkle  = _Merkle()
_ratchet = _Ratchet()


try:
    from ai_guardian import Guardian
    _guardian = Guardian(key_store=KEYS)
    _guardian.start()
except Exception:
    _guardian = None

CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
}

# ── Real SSE streaming via urllib (no deps) ──────────────────────────────
def _sse_delta(line):
    if not line.startswith("data: "): return None
    d = line[6:].strip()
    if d == "[DONE]": return None
    try:
        obj = json.loads(d)
        if "choices" in obj:
            return obj["choices"][0].get("delta",{}).get("content","")
        if "delta" in obj:
            return obj["delta"].get("text","")
    except: pass
    return None

def _stream_openai_compat(url, key, model, prompt):
    if not key: yield f"[no key for {url}]"; return
    body = json.dumps({"model":model,"stream":True,
                        "messages":[{"role":"user","content":prompt}]}).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            for raw in r:
                c = _sse_delta(raw.decode("utf-8","ignore").strip())
                if c: yield c
    except urllib.error.HTTPError as e: yield f"[HTTP {e.code}]"
    except Exception as e: yield f"[error: {e}]"

def _stream_anthropic(prompt):
    k = os.environ.get("ANTHROPIC_API_KEY") or get_key("claude")
    if not k: yield "[no ANTHROPIC_API_KEY]"; return
    body = json.dumps({"model":MODELS["claude"],"max_tokens":4096,"stream":True,
                        "messages":[{"role":"user","content":prompt}]}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages",data=body,method="POST")
    req.add_header("x-api-key", k)
    req.add_header("anthropic-version","2023-06-01")
    req.add_header("Content-Type","application/json")
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            for raw in r:
                c = _sse_delta(raw.decode("utf-8","ignore").strip())
                if c: yield c
    except urllib.error.HTTPError as e: yield f"[Anthropic HTTP {e.code}]"
    except Exception as e: yield f"[Anthropic error: {e}]"

def _get_stream(model, prompt):
    if model == "claude": return _stream_anthropic(prompt)
    if model == "gpt":    return _stream_openai_compat(
        "https://api.openai.com/v1/chat/completions",
        os.environ.get("OPENAI_API_KEY") or get_key("gpt"), MODELS["gpt"], prompt)
    return _stream_openai_compat(
        "https://api.x.ai/v1/chat/completions",
        os.environ.get("XAI_API_KEY") or get_key("grok"), MODELS["grok"], prompt)


def _sha(s): return hashlib.sha512(s.encode()).hexdigest()

def scarlog(event, data, severity='INFO'):
    global _root
    entry = {'ts': datetime.now(timezone.utc).isoformat(), 'type': event,
             'severity': severity, 'data': data, 'node': 'SGH-9898'}
    SCAR.append(entry)
    if len(SCAR) > 5000: SCAR.pop(0)
    # Merkle chain
    layer = [_sha(json.dumps(e, sort_keys=True, default=str)) for e in SCAR[-100:]]
    while len(layer) > 1:
        layer = [_sha(layer[i]+(layer[i+1] if i+1<len(layer) else layer[i]))
                 for i in range(0, len(layer), 2)]
    _root = layer[0] if layer else _sha('genesis')
    entry['merkle_root'] = _root
    # Ed25519 sign the entry
    try:
        payload = json.dumps(entry, sort_keys=True, default=str).encode()
        sig, ed_pub, _ = _SIGNER(payload)
        import base64 as _b64
        entry['ed25519_sig'] = _b64.b64encode(sig).decode()[:48] + '...'
        entry['ed25519_pub'] = _b64.b64encode(ed_pub).decode()[:32]
    except Exception:
        pass
    return entry

def get_key(agent):
    a = agent.lower()
    m = {'claude':'anthropic','gpt':'openai','chatgpt':'openai','grok':'xai'}
    base = m.get(a, a)
    return (KEYS.get(a) or KEYS.get(base)
            or (os.environ.get('ANTHROPIC_API_KEY') if base=='anthropic' else None)
            or (os.environ.get('OPENAI_API_KEY')    if base=='openai'    else None)
            or (os.environ.get('XAI_API_KEY')       if base=='xai'       else None))

def _http(url, payload, headers, timeout=60):
    req = urllib.request.Request(url, json.dumps(payload).encode(), headers, method='POST')
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

def call_ai(agent, message, system='', history=None):
    if history is None: history = []
    if _guardian:
        r = _guardian.route(message, system, history, preferred=agent)
        return r.get('response', '[no response]')
    k = get_key(agent)
    if not k: return f'[NO KEY] Set {agent} key via POST /api/keys'
    try:
        if agent == 'claude':
            d = _http('https://api.anthropic.com/v1/messages',
                {'model':MODELS['claude'],'max_tokens':4096,
                 'system':system or 'Sovereign AI.',
                 'messages':history+[{'role':'user','content':message}]},
                {'x-api-key':k,'anthropic-version':'2023-06-01','content-type':'application/json'})
            return d['content'][0]['text']
        else:
            ep = ('https://api.openai.com/v1/chat/completions' if agent=='gpt'
                  else 'https://api.x.ai/v1/chat/completions')
            msgs = [{'role':'system','content':system or 'Direct AI.'}]+history
            msgs.append({'role':'user','content':message})
            d = _http(ep, {'model':MODELS[agent],'max_tokens':4096,'messages':msgs},
                      {'Authorization':f'Bearer {k}','Content-Type':'application/json'})
            return d['choices'][0]['message']['content']
    except Exception as e:
        scarlog('ai_error',{'agent':agent,'error':str(e)},'ERROR')
        return f'[{agent.upper()}_ERROR] {e}'

def run_council(question, system=''):
    scarlog('council_start',{'q':question[:120]})
    c = call_ai('claude', question, system)
    g = call_ai('gpt', f"Q: {question}\n[Claude: {c[:400]}]\nYour answer:", system)
    k = call_ai('grok', f"Q: {question}\n[Claude: {c[:300]}]\n[GPT: {g[:300]}]\nYour answer:", system)
    return {'question':question,'claude':{'model':MODELS['claude'],'response':c},
            'gpt':{'model':MODELS['gpt'],'response':g},
            'grok':{'model':MODELS['grok'],'response':k},
            'ts':datetime.now(timezone.utc).isoformat(),
            'merkle_root':_root,'pqc':'ML-DSA-65' if PQC else 'CSPRNG'}

EXEC_ALLOW = {'ls','pwd','echo','date','uptime','df','du','ps','free','uname',
              'python3','python','node','git','cat','head','tail','wc','grep','find'}

HERE = os.path.dirname(os.path.abspath(__file__))

class BrainHandler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def J(self, obj, code=200):
        body = json.dumps(obj, default=str).encode()
        self.send_response(code)
        for k,v in CORS.items(): self.send_header(k,v)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def B(self):
        n = int(self.headers.get('Content-Length',0))
        return json.loads(self.rfile.read(n)) if n else {}

    def do_OPTIONS(self):
        self.send_response(204)
        for k,v in CORS.items(): self.send_header(k,v)
        self.end_headers()

    def _serve_file(self, path, content_type):
        try:
            with open(os.path.join(HERE, path), 'rb') as f: body = f.read()
            self.send_response(200)
            for k,v in CORS.items(): self.send_header(k,v)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except FileNotFoundError:
            self.J({'error': f'{path} not found'}, 404)

    def do_GET(self):
        p = self.path.split('?')[0]

        # ── Serve dashboard HTML (same-origin — no ATS block) ─────────────
        if p in ('/', '/SGHv119.html', '/index.html'):
            self._serve_file('SGHv119.html', 'text/html; charset=utf-8')
            return
        if p == '/test.html':
            self._serve_file('test.html', 'text/html; charset=utf-8')
            return

        # ── API ────────────────────────────────────────────────────────────
        if p == '/api/crypto':
            import base64 as _b64
            test_payload = b'sovereignty-crypto-test'
            try:
                sig, ed_pub, x_pub = _SIGNER(test_payload)
                self.J({**_CRYPTO_STATUS,
                    'ed25519_pub': _b64.b64encode(ed_pub).decode(),
                    'x25519_pub':  _b64.b64encode(x_pub).decode(),
                    'sig_preview': _b64.b64encode(sig).decode()[:32]+'...',
                    'scar_entries': len(SCAR), 'merkle_root': _root})
            except Exception as e:
                self.J({'error': str(e), **_CRYPTO_STATUS}, 500)
            return


        # ── Discovery endpoint — tells any client where the bridge is ──────
        if p in ('/api/discover', '/discover'):
            import socket as _sock
            try:
                _h = _sock.gethostname()
                _ips = [i[4][0] for i in _sock.getaddrinfo(_h, None)
                        if i[0].name == 'AF_INET' and not i[4][0].startswith('127')]
            except Exception:
                _ips = [HOST]
            self.J({
                'host':      HOST,
                'port':      PORT,
                'base_url':  f'http://{HOST}:{PORT}',
                'ws_url':    f'ws://{HOST}:{PORT}',
                'ips':       _ips,
                'hostname':  _sock.gethostname() if hasattr(_sock,'gethostname') else HOST,
                'endpoints': ['/api/health','/api/ai','/api/council','/api/stream',
                              '/api/keys','/api/token','/api/crypto','/api/scarlog',
                              '/api/guardian/health','/api/guardian/kpi',
                              '/api/quadratchet/status'],
                'version':   '2.3+discovery',
                'pqc':       PQC,
            })
            return

        if p in ('/api/health', '/health'):
            self.J({'status':'live','node':'live','port':PORT,'host':HOST,'crypto':_CRYPTO_STATUS,
                    'pqc':PQC,'models':MODELS,'scar':len(SCAR),
                    'merkle_root':_root,'version':'2.3+same-origin',
                    'guardian':_guardian is not None,'repmhl':_repmhl is not None})
            return
        if p == '/api/scarlog':
            self.J({'entries':SCAR[-50:],'total':len(SCAR),'merkle_root':_root})
            return
        if p == '/api/keys':
            self.J({k:v[:8]+'...' for k,v in KEYS.items() if v})
            return
        if p == '/api/repmhl/status' and _repmhl:
            self.J({'active':_repmhl.active,'total_turns':_repmhl.profile.total_turns,'version':'1.6'})
            return
        if p == '/api/guardian/health' and _guardian:
            self.J({'active':True,'provider_health':_guardian.provider_health(),
                    'sla':_guardian.sla_metrics(),'merkle_root':_guardian.merkle_root})
            return
        if p == '/api/guardian/kpi' and _guardian:
            self.J(_guardian.kpi_report())
            return
        self.J({'error':'not found','path':p}, 404)

    def do_POST(self):
        p = self.path.split('?')[0]
        try: d = self.B()
        except: self.J({'error':'invalid JSON'},400); return
        try: self._post(p, d)
        except Exception as e:
            scarlog('handler_error',{'path':p,'error':str(e)},'ERROR')
            self.J({'error':str(e)},500)

    def _post(self, p, d):
        if p in ('/api/ai','/agents/chat','/api/chat'):
            agent   = d.get('agent','claude').lower()
            message = d.get('message') or d.get('prompt') or d.get('text') or ''
            if not message: self.J({'error':'message required'},400); return
            resp = call_ai(agent, message, d.get('system',''), d.get('history',[]))
            self.J({'response':resp,'provider':agent,'model':MODELS.get(agent,agent),
                    'merkle_root':_root})

        elif p == '/api/council':
            q = d.get('question') or d.get('message') or d.get('prompt') or ''
            if not q: self.J({'error':'question required'},400); return
            self.J(run_council(q, d.get('system','')))

        elif p == '/api/keys':
            agent = d.get('agent','').lower()
            key   = d.get('key','')
            if not (agent and key): self.J({'error':'agent and key required'},400); return
            KEYS[agent] = key
            if agent=='claude': KEYS['anthropic']=key
            if agent=='gpt':    KEYS['openai']=key
            if agent=='grok':   KEYS['xai']=key
            if _guardian: _guardian._keys.update(KEYS)
            scarlog('key_stored',{'agent':agent})
            self.J({'status':'ok','agent':agent})

        elif p == '/api/exec':
            parts = d.get('cmd','').strip().split()
            if not parts or parts[0] not in EXEC_ALLOW:
                self.J({'error':'not in allowlist'},403); return
            r = subprocess.run(parts,capture_output=True,text=True,timeout=30)
            self.J({'stdout':r.stdout,'stderr':r.stderr,'rc':r.returncode})

        elif p == '/api/turn' and _repmhl:
            res = _repmhl.process_turn(tokens=d.get('tokens',0),
                                       text=d.get('text',''),role=d.get('role','user'))
            self.J({**res,'merkle_root':_root})

        elif p == '/api/dns/generate':
            dom = d.get('domain','sovereignty.local')
            self.J({'domain':dom,'records':[
                {'type':'TXT','name':'@','value':'v=spf1 mx -all'},
                {'type':'MX', 'name':'@','value':'10 mail.'+dom+'.'},
                {'type':'CAA','name':'@','value':'0 issue "letsencrypt.org"'},
            ],'merkle_root':_root})

        elif p == '/api/stream':
            model  = d.get('model','grok')
            prompt = d.get('prompt') or d.get('message') or ''
            if not prompt: self.J({'error':'prompt required'},400); return

            # REPMHL context hydration
            full_prompt = prompt
            if _repmhl:
                try:
                    ctx = _repmhl.get_context(max_turns=8) if hasattr(_repmhl,'get_context') else ''
                    if ctx: full_prompt = ctx + "\n\nUser: " + prompt
                except: pass

            gen = _get_stream(model, full_prompt)

            self.send_response(200)
            for k,v in CORS.items(): self.send_header(k,v)
            self.send_header('Content-Type','text/plain; charset=utf-8')
            self.send_header('Transfer-Encoding','chunked')
            self.send_header('Cache-Control','no-cache')
            self.end_headers()

            chunk_n = 0
            try:
                for text in gen:
                    if not text: continue
                    data = _ratchet.encrypt(text)
                    _merkle.append(data)
                    chunk_n += 1
                    if chunk_n % 8 == 0: _ratchet.rotate()
                    sz = hex(len(data))[2:].encode()
                    self.wfile.write(sz + b"\r\n" + data + b"\r\n")
                    self.wfile.flush()
            except Exception as e:
                err = f"[stream error: {e}]".encode()
                sz  = hex(len(err))[2:].encode()
                self.wfile.write(sz + b"\r\n" + err + b"\r\n")
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()
            scarlog('stream_complete',{'chunks':chunk_n,'model':model,'merkle':_merkle.root.hex()[:16]})

        elif p == '/api/quadratchet/status':
            # QuadRatchet JS state mirror — returns current epoch info from SCAR
            scarlog('qr_status_query',{})
            import base64 as _b64
            sig, ed_pub, _ = _SIGNER(b'qr-status')
            self.J({
                'epoch':                len(SCAR),
                'lastRotation':         SCAR[-1]['ts'] if SCAR else None,
                'rootFingerprint':      _sha('root-'+str(len(SCAR)))[:16],
                'memoryEpochFingerprint': _sha('mem-'+str(len(SCAR)))[:16],
                'deps':                 _CRYPTO_STATUS.get('engine','hmac-fallback'),
                'merkle_root':          _root,
                'ed25519_pub':          _b64.b64encode(ed_pub).decode()[:32],
                'recommendedPorts':     {'rotationAndCrypto':9899,'brainHydration':9898,'orchestration':9897}
            })

        elif p == '/api/quadratchet/rotate':
            consent = d.get('consent','')
            reason  = d.get('reason','manual')
            if not consent:
                self.J({'error':'consent required'},400); return
            # Perform a SCAR-logged ratchet rotation
            import base64 as _b64
            payload = ('qr-rotate-'+str(len(SCAR))+'-'+consent).encode()
            sig, ed_pub, x_pub = _SIGNER(payload)
            entry = scarlog('quadratchet_rotation',{
                'epoch':    len(SCAR),
                'reason':   reason,
                'consent':  consent,
                'deps':     _CRYPTO_STATUS.get('engine','hmac-fallback'),
                'rootKeyFingerprint': _sha('root-'+str(len(SCAR)))[:16],
            }, severity='INFO')
            self.J({
                'epoch':            len(SCAR),
                'reason':           reason,
                'rootKeyFingerprint': entry['data']['rootKeyFingerprint'],
                'merkle_root':      _root,
                'signature':        'ed25519:'+_b64.b64encode(sig).decode()[:32]+'...',
            })

        elif p == '/api/token':
            # Issue a PQC-signed rate-limit token for this session
            agent  = d.get('agent','anon')
            import base64 as _b64
            sig, ed_pub, _ = _SIGNER(agent.encode())
            session_id = ed_pub[:16].hex()
            token = _pqc_sign_token(session_id)
            bucket = _TOKEN_BUCKETS.get(session_id, {'tokens': _BUCKET_LIMIT})
            self.J({
                'token':        token,
                'session_id':   session_id,
                'tokens_remaining': bucket.get('tokens', _BUCKET_LIMIT),
                'limit':        _BUCKET_LIMIT,
                'window_s':     _BUCKET_WINDOW,
                'pqc_algo':     _CRYPTO_STATUS.get('engine','stub'),
                'merkle_root':  _root,
            })

        elif p == '/api/token/status':
            buckets = {k: {
                'tokens': v['tokens'], 'total_calls': v['total_calls'],
                'throttled': v['throttled'],
                'healthy': v['tokens'] > 0,
            } for k,v in _TOKEN_BUCKETS.items()}
            self.J({
                'active_sessions': len(buckets),
                'buckets': buckets,
                'throttle_log': _THROTTLE_LOG[-10:],
                'limit': _BUCKET_LIMIT,
                'window_s': _BUCKET_WINDOW,
            })

        else:
            self.J({'error':'not found','path':p},404)

class SovereignServer(ThreadingHTTPServer):
    allow_reuse_address = True
    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        super().server_bind()

if __name__ == '__main__':
    scarlog('boot',{'port':PORT,'host':HOST,'pqc':PQC,'version':'2.3+same-origin'})
    server = SovereignServer((HOST, PORT), BrainHandler)

    def _stop(sig, frame):
        server.shutdown()
        if _guardian: _guardian.stop()
        if _repmhl: _repmhl.shutdown()
        sys.exit(0)
    signal.signal(signal.SIGINT,  _stop)
    signal.signal(signal.SIGTERM, _stop)

    print(f'\n  Sovereignty One — http://{HOST}:{PORT}/')
    print(f'  Open that URL in KODER browser')
    print(f'  API + HTML on same port = no ATS block\n')
    server.serve_forever()
