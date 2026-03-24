import os
import sys
import json
import uuid
import platform
from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect

try:
    import psutil
except ImportError:
    psutil = None

from engine.runner import RunnerManager, run_pipeline
from engine.hitsdb import HitsDB
import engine.blocks as block_registry

app = Flask(__name__)
runner_manager = RunnerManager()
hits_db = HitsDB()

DATA_DIR = 'data'
CONFIGS_DIR = os.path.join(DATA_DIR, 'configs')
WORDLISTS_DIR = os.path.join(DATA_DIR, 'wordlists')

for d in [CONFIGS_DIR, WORDLISTS_DIR]:
    os.makedirs(d, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/runners')
def runners():
    return render_template('runners.html')

@app.route('/configs')
def configs():
    return render_template('configs.html')

@app.route('/configs/new')
def new_config():
    return render_template('config_edit.html', config=None, config_json='null')

@app.route('/configs/<config_id>/edit')
def edit_config(config_id):
    config = _load_config(config_id)
    if not config:
        return redirect('/configs')
    return render_template('config_edit.html', config=config,
                           config_json=json.dumps(config))

@app.route('/wordlists')
def wordlists():
    return render_template('wordlists.html')

@app.route('/runners/<runner_id>/view')
def view_runner(runner_id):
    return render_template('runner_view.html', runner_id=runner_id)

@app.route('/hits')
def hits():
    return render_template('hits.html')

@app.route('/tools')
def tools():
    return render_template('tools.html')

@app.route('/api/docs')
def api_docs():
    return render_template('api_docs.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')

def _load_config(config_id):
    path = os.path.join(CONFIGS_DIR, f'{config_id}.json')
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    return None

def _save_config(config):
    path = os.path.join(CONFIGS_DIR, f'{config["id"]}.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2)

def _list_configs():
    result = []
    for fname in os.listdir(CONFIGS_DIR):
        if fname.endswith('.json'):
            try:
                with open(os.path.join(CONFIGS_DIR, fname), encoding='utf-8') as f:
                    result.append(json.load(f))
            except Exception:
                pass
    return sorted(result, key=lambda x: x.get('created_at', ''), reverse=True)

@app.route('/api/configs', methods=['GET'])
def api_configs_list():
    return jsonify(_list_configs())

@app.route('/api/configs', methods=['POST'])
def api_configs_create():
    data = request.get_json() or {}
    config = {
        'id': str(uuid.uuid4()),
        'name': data.get('name', 'New Config'),
        'author': data.get('author', ''),
        'description': data.get('description', ''),
        'created_at': datetime.now().isoformat(),
        'settings': data.get('settings', {'max_threads': 10, 'timeout': 10}),
        'blocks': data.get('blocks', []),
    }
    _save_config(config)
    return jsonify(config), 201

@app.route('/api/configs/<config_id>', methods=['GET'])
def api_configs_get(config_id):
    c = _load_config(config_id)
    if not c:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(c)

@app.route('/api/configs/<config_id>', methods=['PUT'])
def api_configs_update(config_id):
    c = _load_config(config_id)
    if not c:
        return jsonify({'error': 'Not found'}), 404
    data = request.get_json() or {}
    c['name'] = data.get('name', c['name'])
    c['author'] = data.get('author', c.get('author', ''))
    c['description'] = data.get('description', c.get('description', ''))
    c['settings'] = data.get('settings', c.get('settings', {}))
    c['blocks'] = data.get('blocks', c.get('blocks', []))
    c['updated_at'] = datetime.now().isoformat()
    _save_config(c)
    return jsonify(c)

@app.route('/api/configs/<config_id>', methods=['DELETE'])
def api_configs_delete(config_id):
    path = os.path.join(CONFIGS_DIR, f'{config_id}.json')
    if os.path.exists(path):
        os.remove(path)
        return jsonify({'ok': True})
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/wordlists', methods=['GET'])
def api_wordlists_list():
    result = []
    for fname in os.listdir(WORDLISTS_DIR):
        fpath = os.path.join(WORDLISTS_DIR, fname)
        if not os.path.isfile(fpath):
            continue
        stat = os.stat(fpath)
        try:
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                lines = sum(1 for _ in f)
        except Exception:
            lines = 0
        result.append({
            'name': fname,
            'size': stat.st_size,
            'lines': lines,
            'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    return jsonify(result)

@app.route('/api/wordlists', methods=['POST'])
def api_wordlists_upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    f = request.files['file']
    if not f.filename:
        return jsonify({'error': 'No filename'}), 400
    safe_name = os.path.basename(f.filename)
    f.save(os.path.join(WORDLISTS_DIR, safe_name))
    return jsonify({'name': safe_name}), 201

@app.route('/api/wordlists/<name>', methods=['DELETE'])
def api_wordlists_delete(name):
    path = os.path.join(WORDLISTS_DIR, os.path.basename(name))
    if os.path.exists(path):
        os.remove(path)
        return jsonify({'ok': True})
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/runners', methods=['GET'])
def api_runners_list():
    return jsonify(runner_manager.all())

@app.route('/api/runners', methods=['POST'])
def api_runners_create():
    data = request.get_json() or {}
    config_id = data.get('config_id')
    wordlist_name = data.get('wordlist')
    num_threads = int(data.get('threads', 10))
    proxy_text = data.get('proxies', '').strip()
    proxies = [p.strip() for p in proxy_text.splitlines() if p.strip()] if proxy_text else []

    config = _load_config(config_id)
    if not config:
        return jsonify({'error': 'Config not found'}), 404

    wordlist_path = os.path.join(WORDLISTS_DIR, os.path.basename(wordlist_name))
    if not os.path.exists(wordlist_path):
        return jsonify({'error': 'Wordlist not found'}), 404

    runner_id = runner_manager.create(config, wordlist_path, num_threads, proxies,
                                      hits_db=hits_db)
    return jsonify({'id': runner_id}), 201

@app.route('/api/runners/<runner_id>', methods=['GET'])
def api_runners_get(runner_id):
    r = runner_manager.get(runner_id)
    if not r:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(r.to_dict())

@app.route('/api/runners/<runner_id>/stop', methods=['POST'])
def api_runners_stop(runner_id):
    runner_manager.stop(runner_id)
    return jsonify({'ok': True})

@app.route('/api/runners/<runner_id>/pause', methods=['POST'])
def api_runners_pause(runner_id):
    runner_manager.pause(runner_id)
    return jsonify({'ok': True})

@app.route('/api/runners/<runner_id>/resume', methods=['POST'])
def api_runners_resume(runner_id):
    runner_manager.resume(runner_id)
    return jsonify({'ok': True})

@app.route('/api/runners/<runner_id>', methods=['DELETE'])
def api_runners_delete(runner_id):
    runner_manager.remove(runner_id)
    return jsonify({'ok': True})

@app.route('/api/runners/<runner_id>/hits', methods=['GET'])
def api_runners_hits(runner_id):
    r = runner_manager.get(runner_id)
    if not r:
        return jsonify([])
    return jsonify(r.get_hits())

@app.route('/api/runners/<runner_id>/log', methods=['GET'])
def api_runners_log(runner_id):
    r = runner_manager.get(runner_id)
    if not r:
        return jsonify([])
    after_id = int(request.args.get('after', 0))
    return jsonify(r.get_log(after_id))

_dbg_sessions = {}

@app.route('/api/debugger/step', methods=['POST'])
def api_debugger_step():
    data = request.get_json() or {}
    blocks = data.get('blocks', [])
    step = data.get('step', 0)
    context = data.get('context', {})
    session_id = data.get('session_id', 'default')

    if session_id in _dbg_sessions:
        for k, v in _dbg_sessions[session_id].items():
            if k.startswith('_') and k not in context:
                context[k] = v

    if step >= len(blocks):
        _dbg_cleanup(session_id)
        return jsonify({'done': True, 'context': _safe_ctx(context), 'step': step})

    block_cfg = blocks[step]
    btype = block_cfg.get('type', '')

    if btype in ('if', 'elif'):
        cond = block_registry.evaluate_condition(block_cfg, context)
        ns = step + 1 if cond else _find_matching_branch(blocks, step)
        return jsonify({
            'done': False, 'step': step, 'block_type': btype,
            'ok': True, 'condition': cond,
            'context': _safe_ctx(context), 'next_step': ns,
        })

    if btype in ('else', 'endif', 'endloop'):
        return jsonify({
            'done': False, 'step': step, 'block_type': btype,
            'ok': True, 'context': _safe_ctx(context), 'next_step': step + 1,
        })

    executor = block_registry.get_executor(btype)
    if not executor:
        return jsonify({'error': f'Unknown block type: {btype}'}), 400

    ok, err = executor.execute(block_cfg, context)

    persist = {}
    for k, v in context.items():
        if k in ('_browser', '_cookie_jar', '_auth_header', '_captures', '_logs'):
            persist[k] = v
    _dbg_sessions[session_id] = persist

    return jsonify({
        'done': False, 'step': step, 'block_type': btype,
        'ok': ok, 'error': err,
        'context': _safe_ctx(context),
        'next_step': step + 1,
    })

def _dbg_cleanup(session_id):
    sess = _dbg_sessions.pop(session_id, {})
    browser = sess.get('_browser')
    if browser:
        try:
            browser.quit()
        except Exception:
            pass


@app.route('/api/debugger/reset', methods=['POST'])
def api_debugger_reset():
    data = request.get_json() or {}
    session_id = data.get('session_id', 'default')
    _dbg_cleanup(session_id)
    return jsonify({'ok': True})


def _find_matching_branch(blocks, start):
    depth = 0
    for i in range(start + 1, len(blocks)):
        t = blocks[i].get('type', '')
        if t == 'if':
            depth += 1
        elif t == 'endif':
            if depth == 0:
                return i
            depth -= 1
        elif t in ('elif', 'else') and depth == 0:
            return i
    return len(blocks)

_SKIP_CTX = frozenset(('_browser', '_proxy'))

def _safe_ctx(context):
    out = {}
    for k, v in context.items():
        if k in _SKIP_CTX:
            continue
        if k == 'response_headers':
            out[k] = dict(v) if isinstance(v, dict) else {}
        elif k == 'response':
            out[k] = str(v)
        elif isinstance(v, (dict, list)):
            out[k] = v
        elif isinstance(v, (str, int, float, bool, type(None))):
            out[k] = v
    return out

@app.route('/api/hits', methods=['GET'])
def api_hits_list():
    search = request.args.get('search', '')
    config_name = request.args.get('config', '')
    limit = int(request.args.get('limit', 500))
    offset = int(request.args.get('offset', 0))
    rows = hits_db.list(limit=limit, offset=offset,
                        search=search or None,
                        config_name=config_name or None)
    total = hits_db.count(config_name=config_name or None)
    return jsonify({'hits': rows, 'total': total})

@app.route('/api/hits/<int:hit_id>', methods=['DELETE'])
def api_hits_delete(hit_id):
    hits_db.delete(hit_id)
    return jsonify({'ok': True})

@app.route('/api/hits/clear', methods=['POST'])
def api_hits_clear():
    data = request.get_json() or {}
    hits_db.clear(config_name=data.get('config') or None)
    return jsonify({'ok': True})

@app.route('/api/hits/export', methods=['GET'])
def api_hits_export():
    config_name = request.args.get('config', '')
    fmt = request.args.get('format', 'combo')
    text = hits_db.export(config_name=config_name or None, fmt=fmt)
    return text, 200, {'Content-Type': 'text/plain; charset=utf-8'}

@app.route('/api/stats', methods=['GET'])
def api_stats():
    cfgs = _list_configs()
    wls = [f for f in os.listdir(WORDLISTS_DIR)
           if os.path.isfile(os.path.join(WORDLISTS_DIR, f))]
    all_runners = runner_manager.all()
    active = [r for r in all_runners if r['status'] == 'running']
    total_hits = sum(r.get('hits', 0) for r in all_runners)
    return jsonify({
        'configs': len(cfgs),
        'wordlists': len(wls),
        'runners': len(all_runners),
        'active_runners': len(active),
        'total_hits': total_hits,
    })

@app.route('/api/proxy/check', methods=['POST'])
def api_proxy_check():
    data = request.get_json() or {}
    proxy = data.get('proxy', '').strip()
    test_url = data.get('test_url', 'https://httpbin.org/ip')
    timeout = int(data.get('timeout', 5))

    if not proxy:
        return jsonify({'alive': False, 'error': 'No proxy', 'ms': 0})

    proxies = {'http': proxy, 'https': proxy}
    import time as _t
    start = _t.time()
    try:
        resp = requests.get(test_url, proxies=proxies, timeout=timeout, verify=False)
        ms = round((_t.time() - start) * 1000)
        ip = ''
        try:
            ip = resp.json().get('origin', '')
        except Exception:
            pass
        return jsonify({'alive': resp.status_code == 200, 'status': resp.status_code, 'ms': ms, 'ip': ip})
    except requests.exceptions.Timeout:
        return jsonify({'alive': False, 'error': 'timeout', 'ms': round((_t.time() - start) * 1000)})
    except Exception as e:
        return jsonify({'alive': False, 'error': str(e)[:100], 'ms': round((_t.time() - start) * 1000)})


@app.route('/api/system', methods=['GET'])
def api_system():
    data = {
        'platform': platform.system(),
        'platform_version': platform.version(),
        'python': sys.version.split()[0],
        'machine': platform.machine(),
        'processor': platform.processor() or platform.machine(),
        'hostname': platform.node(),
    }
    if psutil:
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage('.')
        cpu_freq = psutil.cpu_freq()
        net = psutil.net_io_counters()
        data.update({
            'cpu_percent': psutil.cpu_percent(interval=0.3),
            'cpu_count': psutil.cpu_count(),
            'cpu_freq': round(cpu_freq.current) if cpu_freq else 0,
            'ram_total': mem.total,
            'ram_used': mem.used,
            'ram_percent': mem.percent,
            'disk_total': disk.total,
            'disk_used': disk.used,
            'disk_percent': disk.percent,
            'net_sent': net.bytes_sent,
            'net_recv': net.bytes_recv,
        })
    return jsonify(data)


@app.route('/api/convert', methods=['POST'])
def api_convert():
    data = request.get_json() or {}
    source = data.get('source', '')
    fmt = data.get('format', 'loliscript')

    try:
        blocks = _parse_config(source, fmt)
        return jsonify({'blocks': blocks})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


def _parse_config(source, fmt):
    if fmt == 'openbullet2':
        return _parse_ob2_json(source)
    return _parse_loliscript(source)


def _parse_loliscript(source):
    blocks = []
    lines = source.strip().splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line or line.startswith('#'):
            i += 1
            continue

        upper = line.upper()

        if upper.startswith('REQUEST'):
            block = {'type': 'request', 'label': 'HTTP Request', 'method': 'GET', 'url': '',
                     'headers': {}, 'body': '', 'follow_redirects': True, 'timeout': 10, 'http_lib': 'requests'}
            parts = line.split(None, 2)
            if len(parts) >= 2:
                block['method'] = parts[1].upper()
            if len(parts) >= 3:
                block['url'] = parts[2].strip('"\'')
            i += 1
            while i < len(lines):
                sub = lines[i].strip()
                sub_up = sub.upper()
                if sub_up.startswith('HEADER') or sub_up.startswith('CONTENT-') or ': ' in sub:
                    h = sub
                    if sub_up.startswith('HEADER'):
                        h = sub[6:].strip().strip('"\'')
                    if ': ' in h:
                        k, v = h.split(': ', 1)
                        block['headers'][k.strip('"\'').strip()] = v.strip('"\'').strip()
                elif sub_up.startswith('BODY') or sub_up.startswith('DATA') or sub_up.startswith('POSTDATA'):
                    block['body'] = sub.split(None, 1)[1].strip('"\'') if ' ' in sub else ''
                elif sub_up.startswith('TIMEOUT'):
                    block['timeout'] = int(sub.split(None, 1)[1]) if ' ' in sub else 10
                else:
                    break
                i += 1
            blocks.append(block)
            continue

        if upper.startswith('KEYCHECK'):
            block = {'type': 'keycheck', 'label': 'Key Check', 'success': [], 'fail': [], 'retry': [], 'ban': []}
            i += 1
            while i < len(lines):
                sub = lines[i].strip()
                sub_up = sub.upper()
                if sub_up.startswith('SUCCESS') or sub_up.startswith('KEYCHAIN SUCCESS'):
                    keys = _extract_keys(sub)
                    block['success'].extend(keys)
                elif sub_up.startswith('FAIL') or sub_up.startswith('FAILURE') or sub_up.startswith('KEYCHAIN FAIL'):
                    block['fail'].extend(_extract_keys(sub))
                elif sub_up.startswith('RETRY') or sub_up.startswith('KEYCHAIN RETRY'):
                    block['retry'].extend(_extract_keys(sub))
                elif sub_up.startswith('BAN') or sub_up.startswith('KEYCHAIN BAN'):
                    block['ban'].extend(_extract_keys(sub))
                else:
                    break
                i += 1
            blocks.append(block)
            continue

        if upper.startswith('PARSE'):
            block = {'type': 'parse', 'label': 'Parse', 'variable': 'parsed',
                     'source': 'body', 'mode': 'between', 'left': '', 'right': '', 'pattern': '', 'field': ''}
            tokens = _split_quoted(line)
            for j, t in enumerate(tokens):
                tu = t.upper()
                if tu == 'LR' or tu == 'BETWEEN':
                    block['mode'] = 'between'
                    if j + 1 < len(tokens): block['left'] = tokens[j+1].strip('"\'')
                    if j + 2 < len(tokens): block['right'] = tokens[j+2].strip('"\'')
                elif tu == 'REGEX':
                    block['mode'] = 'regex'
                    if j + 1 < len(tokens): block['pattern'] = tokens[j+1].strip('"\'')
                elif tu == 'JSON':
                    block['mode'] = 'json_field'
                    if j + 1 < len(tokens): block['field'] = tokens[j+1].strip('"\'')
            for t in tokens:
                if t.startswith('<') and t.endswith('>'):
                    block['variable'] = t[1:-1].lower()
                    break
            i += 1
            blocks.append(block)
            continue

        if upper.startswith('SET') and not upper.startswith('SET_VARIABLE'):
            tokens = _split_quoted(line)
            block = {'type': 'set_variable', 'label': 'Set Variable', 'variable': '', 'value': ''}
            if len(tokens) >= 2: block['variable'] = tokens[1].strip('"\'').strip('<>').lower()
            if len(tokens) >= 3:
                val = tokens[-1].strip('"\'')
                if val == '=' and len(tokens) >= 4:
                    val = tokens[3].strip('"\'')
                block['value'] = val
            i += 1
            blocks.append(block)
            continue

        if upper.startswith('IF '):
            tokens = _split_quoted(line)
            block = {'type': 'if', 'label': 'IF', 'left': '', 'operator': 'contains', 'right': ''}
            if len(tokens) >= 2: block['left'] = tokens[1].strip('"\'')
            if len(tokens) >= 3: block['operator'] = _map_operator(tokens[2])
            if len(tokens) >= 4: block['right'] = tokens[3].strip('"\'')
            i += 1
            blocks.append(block)
            continue

        if upper.startswith('ELIF'):
            tokens = _split_quoted(line)
            block = {'type': 'elif', 'label': 'ELIF', 'left': '', 'operator': 'contains', 'right': ''}
            if len(tokens) >= 2: block['left'] = tokens[1].strip('"\'')
            if len(tokens) >= 3: block['operator'] = _map_operator(tokens[2])
            if len(tokens) >= 4: block['right'] = tokens[3].strip('"\'')
            i += 1
            blocks.append(block)
            continue

        if upper in ('ELSE', 'ELSE:'):
            blocks.append({'type': 'else', 'label': 'ELSE'})
            i += 1
            continue

        if upper in ('ENDIF', 'END', 'END IF', 'ENDIF:'):
            blocks.append({'type': 'endif', 'label': 'ENDIF'})
            i += 1
            continue

        if upper.startswith('FUNCTION') or upper.startswith('UTILITY'):
            tokens = _split_quoted(line)
            block = {'type': 'function', 'label': 'Function', 'func': 'uppercase', 'input': '', 'output': 'result', 'extra': ''}
            for j, t in enumerate(tokens):
                tu = t.upper()
                if tu in ('BASE64ENCODE', 'BASE64_ENCODE'): block['func'] = 'base64_encode'
                elif tu in ('BASE64DECODE', 'BASE64_DECODE'): block['func'] = 'base64_decode'
                elif tu in ('URLENCODE', 'URL_ENCODE'): block['func'] = 'url_encode'
                elif tu in ('URLDECODE', 'URL_DECODE'): block['func'] = 'url_decode'
                elif tu in ('MD5', 'SHA1', 'SHA256', 'SHA512'): block['func'] = tu.lower()
                elif tu in ('UPPERCASE', 'LOWERCASE', 'REVERSE', 'TRIM', 'LENGTH'):
                    block['func'] = tu.lower()
                elif tu == 'REPLACE':
                    block['func'] = 'replace'
                    if j + 2 < len(tokens):
                        block['extra'] = tokens[j+1].strip('"\'') + '|' + tokens[j+2].strip('"\'')
                if t.startswith('<') and t.endswith('>') and tu != 'INPUT':
                    block['input'] = t
                if tu in ('->', '=>', 'INTO', 'OUTPUT') and j + 1 < len(tokens):
                    block['output'] = tokens[j+1].strip('"\'').strip('<>').lower()
            i += 1
            blocks.append(block)
            continue

        i += 1

    return blocks


def _extract_keys(line):
    import re as _re
    keys = _re.findall(r'"([^"]*)"', line)
    if not keys:
        parts = line.split(None, 1)
        if len(parts) > 1:
            keys = [k.strip() for k in parts[1].split(',') if k.strip()]
    return keys


def _split_quoted(line):
    import shlex
    try:
        return shlex.split(line)
    except ValueError:
        return line.split()


def _map_operator(op):
    mapping = {
        'equalto': 'equals', 'equal': 'equals', 'equals': 'equals', '==': 'equals', 'is': 'equals',
        'notequalto': 'not_equals', 'notequal': 'not_equals', '!=': 'not_equals', 'isnot': 'not_equals',
        'contains': 'contains', 'contain': 'contains',
        'notcontains': 'not_contains', 'doesnotcontain': 'not_contains',
        'startswith': 'starts_with', 'beginswith': 'starts_with',
        'endswith': 'ends_with',
        'greaterthan': 'greater_than', '>': 'greater_than', 'gt': 'greater_than',
        'lessthan': 'less_than', '<': 'less_than', 'lt': 'less_than',
        'exists': 'exists', 'notexists': 'not_exists',
        'isempty': 'is_empty', 'isnotempty': 'is_not_empty',
        'matchesregex': 'matches_regex', 'regex': 'matches_regex',
    }
    return mapping.get(op.lower().replace(' ', '').replace('_', ''), 'contains')


def _parse_ob2_json(source):
    try:
        data = json.loads(source)
    except json.JSONDecodeError:
        raise ValueError('Invalid JSON')

    if isinstance(data, dict) and 'blocks' in data:
        return data['blocks']

    if isinstance(data, list):
        blocks = []
        for item in data:
            btype = item.get('type', item.get('Type', item.get('$type', ''))).lower()
            if 'http' in btype or 'request' in btype:
                blocks.append({
                    'type': 'request', 'label': item.get('label', 'HTTP Request'),
                    'method': item.get('method', 'GET').upper(),
                    'url': item.get('url', ''), 'headers': item.get('headers', {}),
                    'body': item.get('body', item.get('content', '')),
                    'follow_redirects': item.get('followRedirects', True),
                    'timeout': item.get('timeout', 10), 'http_lib': 'requests',
                })
            elif 'keycheck' in btype:
                block = {'type': 'keycheck', 'label': 'Key Check', 'success': [], 'fail': [], 'retry': [], 'ban': []}
                for kc in item.get('keychains', item.get('rules', [])):
                    result = kc.get('result', kc.get('type', 'SUCCESS')).upper()
                    keys = kc.get('keys', kc.get('keywords', []))
                    if isinstance(keys, str):
                        keys = [keys]
                    target = result.lower()
                    if target in block:
                        block[target].extend(keys)
                blocks.append(block)
            elif 'parse' in btype:
                blocks.append({
                    'type': 'parse', 'label': item.get('label', 'Parse'),
                    'variable': item.get('variable', item.get('outputVariable', 'parsed')),
                    'source': item.get('source', 'body'), 'mode': item.get('mode', 'between'),
                    'left': item.get('left', item.get('leftDelim', '')),
                    'right': item.get('right', item.get('rightDelim', '')),
                    'pattern': item.get('pattern', item.get('regex', '')),
                    'field': item.get('field', item.get('jToken', '')),
                })
            else:
                blocks.append(item)
        return blocks

    raise ValueError('Unrecognized OpenBullet 2 format')


if __name__ == '__main__':
    app.run(debug=True, threaded=True)
