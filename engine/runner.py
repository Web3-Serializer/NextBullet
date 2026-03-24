import os
import uuid
import time
import queue
import threading
import collections
import urllib3
from datetime import datetime

import engine.blocks as block_registry

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

FLOW_TYPES = frozenset(('if', 'elif', 'else', 'endif', 'loop', 'endloop', 'break'))

def _find_matching_endloop(blocks, start):
    depth = 0
    for i in range(start + 1, len(blocks)):
        t = blocks[i].get('type', '')
        if t == 'loop':
            depth += 1
        elif t == 'endloop':
            if depth == 0:
                return i
            depth -= 1
    return len(blocks)

def run_pipeline(blocks, context):
    skip_depth = 0
    branch_taken = False
    loop_stack = []
    result = 'NONE'

    i = 0
    while i < len(blocks):
        block_cfg = blocks[i]
        btype = block_cfg.get('type', '')

        if btype == 'if':
            if skip_depth > 0:
                skip_depth += 1
            else:
                cond = block_registry.evaluate_condition(block_cfg, context)
                branch_taken = cond
                if not cond:
                    skip_depth = 1
            i += 1
            continue

        if btype == 'elif':
            if skip_depth > 1:
                i += 1
                continue
            if branch_taken:
                skip_depth = 1
            else:
                skip_depth = 0
                cond = block_registry.evaluate_condition(block_cfg, context)
                if cond:
                    branch_taken = True
                else:
                    skip_depth = 1
            i += 1
            continue

        if btype == 'else':
            if skip_depth > 1:
                i += 1
                continue
            if branch_taken:
                skip_depth = 1
            else:
                skip_depth = 0
                branch_taken = True
            i += 1
            continue

        if btype == 'endif':
            if skip_depth > 0:
                skip_depth -= 1
            branch_taken = False
            i += 1
            continue

        if btype == 'loop':
            if skip_depth > 0:
                skip_depth += 1
                i += 1
                continue
            mode = block_cfg.get('mode', 'count')
            if mode == 'count':
                count = int(block_registry.substitute(str(block_cfg.get('count', 1)), context))
                items = None
                total = count
            else:
                list_var = block_cfg.get('list_var', '')
                raw = context.get(list_var, '')
                items = [x for x in raw.split('\n') if x.strip()]
                total = len(items)

            iter_var = block_cfg.get('iter_var', 'i')

            if total <= 0:
                end_idx = _find_matching_endloop(blocks, i)
                i = end_idx + 1
                continue

            loop_stack.append({
                'start': i, 'iter': 0, 'max': total,
                'iter_var': iter_var, 'items': items,
            })
            context[iter_var] = items[0] if items else '0'
            context[iter_var + '_index'] = '0'
            i += 1
            continue

        if btype == 'endloop':
            if skip_depth > 0:
                skip_depth -= 1
                i += 1
                continue
            if loop_stack:
                loop = loop_stack[-1]
                loop['iter'] += 1
                if loop['iter'] < loop['max']:
                    idx = loop['iter']
                    context[loop['iter_var']] = loop['items'][idx] if loop['items'] else str(idx)
                    context[loop['iter_var'] + '_index'] = str(idx)
                    i = loop['start'] + 1
                    continue
                else:
                    loop_stack.pop()
            i += 1
            continue

        if btype == 'break':
            if skip_depth > 0:
                i += 1
                continue
            if loop_stack:
                loop = loop_stack.pop()
                end_idx = _find_matching_endloop(blocks, loop['start'])
                i = end_idx + 1
                continue
            i += 1
            continue

        if skip_depth > 0:
            i += 1
            continue

        executor = block_registry.get_executor(btype)
        if executor:
            ok, err = executor.execute(block_cfg, context)
            if not ok:
                return 'ERROR', i, err
            r = context.get('_result', 'NONE')
            if r in ('SUCCESS', 'FAIL', 'RETRY', 'BAN'):
                return r, i, None

        i += 1

    return context.get('_result', 'FAIL'), len(blocks), None

class Runner:
    def __init__(self, runner_id, config, wordlist_path, num_threads=10, proxies=None, hits_db=None):
        self.id = runner_id
        self.name = f"Runner {runner_id[:8]}"
        self.config = config
        self.config_name = config.get('name', 'Unknown')
        self.wordlist_path = wordlist_path
        self.wordlist_name = os.path.basename(wordlist_path)
        self.num_threads = num_threads
        self.proxies = proxies or []
        self._proxy_idx = 0
        self._proxy_lock = threading.Lock()
        self._hits_db = hits_db

        self.status = 'idle'
        self.started_at = None
        self.finished_at = None

        self.tested = 0
        self.hits = 0
        self.fails = 0
        self.retries = 0
        self.errors = 0
        self.bans = 0
        self.total = 0

        self._hits_list = []
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._pause_event.set()

        self._combos = []
        self._index = 0
        self._index_lock = threading.Lock()
        self._retry_queue = queue.Queue()
        self._cpm_times = []
        self._log = collections.deque(maxlen=500)
        self._log_id = 0

        settings = config.get('settings') or {}
        self._separator = settings.get('data_separator', ':')
        self._max_retries = int(settings.get('max_retries', 3))
        self._retry_counts = {}
        self._retry_lock = threading.Lock()

        try:
            with open(wordlist_path, 'r', encoding='utf-8', errors='ignore') as f:
                self._combos = [l.strip() for l in f if l.strip()]
            self.total = len(self._combos)
        except Exception:
            self.status = 'error'

    def _next_combo(self):
        try:
            return self._retry_queue.get_nowait()
        except queue.Empty:
            pass
        with self._index_lock:
            if self._index >= len(self._combos):
                return None
            combo = self._combos[self._index]
            self._index += 1
            return combo

    def _next_proxy(self):
        if not self.proxies:
            return None
        with self._proxy_lock:
            p = self.proxies[self._proxy_idx % len(self.proxies)]
            self._proxy_idx += 1
            return p

    def start(self):
        if self.status != 'idle':
            return
        self.status = 'running'
        self.started_at = datetime.now().isoformat()
        for _ in range(self.num_threads):
            threading.Thread(target=self._worker, daemon=True).start()

    def _worker(self):
        while not self._stop_event.is_set():
            self._pause_event.wait()
            if self._stop_event.is_set():
                break
            combo = self._next_combo()
            if combo is None:
                break
            self._process(combo)
        with self._lock:
            if self.status == 'running' and self.tested >= self.total:
                self.status = 'finished'
                self.finished_at = datetime.now().isoformat()

    def _process(self, combo):
        sep = self._separator
        parts = combo.split(sep, 1)
        user = parts[0] if parts else combo
        password = parts[1] if len(parts) > 1 else ''

        context = {
            'user': user, 'pass': password, 'combo': combo,
            '_proxy': self._next_proxy(), '_result': 'NONE',
        }

        err_msg = None
        try:
            result, _, err_msg = run_pipeline(self.config.get('blocks', []), context)
        except Exception as exc:
            result = 'ERROR'
            err_msg = str(exc)

        with self._lock:
            self.tested += 1
            self._cpm_times.append(time.time())
            ts = datetime.now().strftime('%H:%M:%S')

            captures = context.get('_captures', {})
            extra = {k: str(v) for k, v in context.items()
                     if not k.startswith('_')
                     and k not in ('response', 'response_headers')
                     and isinstance(v, (str, int, float, bool))}

            self._log_id += 1
            log_entry = {
                'id': self._log_id, 'time': ts, 'combo': combo,
                'user': user, 'result': result,
                'status': context.get('status', ''),
                'captures': captures,
                'extra': extra,
            }
            if err_msg:
                log_entry['error'] = err_msg
            self._log.append(log_entry)

            if result == 'SUCCESS':
                self.hits += 1
                self._hits_list.append({
                    'combo': combo, 'user': user, 'pass': password,
                    'time': ts, 'captures': captures, 'extra': extra,
                })
                if self._hits_db:
                    try:
                        hit_data = dict(extra)
                        if captures:
                            hit_data['_captures'] = captures
                        self._hits_db.add(self.id, self.config_name, combo, user, password, hit_data)
                    except Exception:
                        pass
            elif result == 'RETRY':
                self.retries += 1
                with self._retry_lock:
                    count = self._retry_counts.get(combo, 0)
                    if count < self._max_retries:
                        self._retry_counts[combo] = count + 1
                        self._retry_queue.put(combo)
                    else:
                        self.fails += 1
            elif result == 'BAN':
                self.bans += 1
                self.fails += 1
            elif result == 'ERROR':
                self.errors += 1
            else:
                self.fails += 1

    def cpm(self):
        now = time.time()
        cutoff = now - 60
        with self._lock:
            self._cpm_times = [t for t in self._cpm_times if t > cutoff]
            return len(self._cpm_times)

    def progress(self):
        if self.total == 0:
            return 0
        return min(100, round(self.tested / self.total * 100, 1))

    def stop(self):
        self._stop_event.set()
        self._pause_event.set()
        self.status = 'stopped'
        if not self.finished_at:
            self.finished_at = datetime.now().isoformat()

    def pause(self):
        self._pause_event.clear()
        self.status = 'paused'

    def resume(self):
        self._pause_event.set()
        self.status = 'running'

    def get_hits(self):
        with self._lock:
            return list(self._hits_list)

    def get_log(self, after_id=0):
        with self._lock:
            return [e for e in self._log if e['id'] > after_id]

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name,
            'config_name': self.config_name, 'wordlist': self.wordlist_name,
            'status': self.status,
            'started_at': self.started_at, 'finished_at': self.finished_at,
            'total': self.total, 'tested': self.tested,
            'hits': self.hits, 'fails': self.fails,
            'retries': self.retries, 'errors': self.errors, 'bans': self.bans,
            'cpm': self.cpm(), 'progress': self.progress(),
            'threads': self.num_threads,
        }

class RunnerManager:
    def __init__(self):
        self._runners = {}
        self._lock = threading.Lock()

    def create(self, config, wordlist_path, num_threads=10, proxies=None, hits_db=None):
        runner_id = str(uuid.uuid4())
        r = Runner(runner_id, config, wordlist_path, num_threads, proxies, hits_db=hits_db)
        with self._lock:
            self._runners[runner_id] = r
        r.start()
        return runner_id

    def get(self, runner_id):
        with self._lock:
            return self._runners.get(runner_id)

    def all(self):
        with self._lock:
            return [r.to_dict() for r in self._runners.values()]

    def stop(self, runner_id):
        r = self.get(runner_id)
        if r:
            r.stop()

    def pause(self, runner_id):
        r = self.get(runner_id)
        if r:
            r.pause()

    def resume(self, runner_id):
        r = self.get(runner_id)
        if r:
            r.resume()

    def remove(self, runner_id):
        r = self.get(runner_id)
        if r:
            r.stop()
        with self._lock:
            self._runners.pop(runner_id, None)
