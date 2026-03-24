import re
import os
import json
import time
import uuid
import hashlib
import hmac
import base64
import html
import socket
import ssl
import smtplib
import subprocess
import random as _random
import string
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from urllib.parse import quote, unquote
from datetime import datetime

_REGISTRY = {}

def register(block_type):
    def decorator(cls):
        _REGISTRY[block_type] = cls()
        return cls
    return decorator

def get_executor(block_type):
    return _REGISTRY.get(block_type)

def get_registered_types():
    return list(_REGISTRY.keys())

def substitute(text, context):
    if not isinstance(text, str):
        return text
    for key, val in context.items():
        if isinstance(val, str):
            text = text.replace(f'<{key.upper()}>', val)
            text = text.replace(f'<{key}>', val)
    return text

OPERATORS = {
    'equals':         lambda l, r: l == r,
    'not_equals':     lambda l, r: l != r,
    'contains':       lambda l, r: r.lower() in l.lower(),
    'not_contains':   lambda l, r: r.lower() not in l.lower(),
    'starts_with':    lambda l, r: l.lower().startswith(r.lower()),
    'ends_with':      lambda l, r: l.lower().endswith(r.lower()),
    'greater_than':   lambda l, r: _safe_float(l) > _safe_float(r),
    'less_than':      lambda l, r: _safe_float(l) < _safe_float(r),
    'exists':         lambda l, r: bool(l),
    'not_exists':     lambda l, r: not bool(l),
    'is_empty':       lambda l, r: len(l.strip()) == 0,
    'is_not_empty':   lambda l, r: len(l.strip()) > 0,
    'matches_regex':  lambda l, r: bool(re.search(r, l)),
    'length_equals':  lambda l, r: len(l) == int(r or 0),
    'length_greater': lambda l, r: len(l) > int(r or 0),
    'length_less':    lambda l, r: len(l) < int(r or 0),
}

def _safe_float(v):
    try:
        return float(v)
    except (ValueError, TypeError):
        return 0.0

def evaluate_condition(cfg, context):
    left = substitute(cfg.get('left', ''), context)
    op = cfg.get('operator', 'equals')
    right = substitute(cfg.get('right', ''), context)
    fn = OPERATORS.get(op)
    if fn:
        try:
            return fn(left, right)
        except Exception:
            return False
    return False

def _do_request_standard(method, url, headers, body, follow, timeout, proxy):
    proxies = {'http': proxy, 'https': proxy} if proxy else None
    try:
        resp = requests.request(
            method, url, headers=headers,
            data=body if method not in ('GET', 'HEAD') else None,
            allow_redirects=follow, timeout=timeout,
            proxies=proxies, verify=False,
        )
        return resp.text, str(resp.status_code), dict(resp.headers), None
    except requests.exceptions.Timeout:
        return None, None, None, 'timeout'
    except requests.exceptions.ConnectionError:
        return None, None, None, 'connection_error'
    except Exception as e:
        return None, None, None, str(e)

def _apply_context_headers(headers, context):
    auth = context.get('_auth_header')
    if auth and isinstance(auth, dict):
        headers.update(auth)
    jar = context.get('_cookie_jar')
    if jar and isinstance(jar, dict) and jar:
        existing = headers.get('Cookie', '')
        cookie_str = '; '.join(f'{k}={v}' for k, v in jar.items())
        headers['Cookie'] = f'{existing}; {cookie_str}'.strip('; ') if existing else cookie_str
    return headers


@register('request')
class RequestBlock:
    def execute(self, cfg, context):
        method = cfg.get('method', 'GET').upper()
        url = substitute(cfg.get('url', ''), context)
        raw_headers = cfg.get('headers', {})
        headers = _apply_context_headers(
            {k: substitute(v, context) for k, v in raw_headers.items()}, context)
        body = substitute(cfg.get('body', ''), context)
        timeout = int(cfg.get('timeout', 10))
        follow = cfg.get('follow_redirects', True)
        proxy = context.get('_proxy')
        lib = cfg.get('http_lib', 'requests')

        if lib == 'httpx':
            from modules.httpx_request import make_request
            text, status, resp_headers, err = make_request(method, url, headers, body, follow, timeout, proxy)
        else:
            text, status, resp_headers, err = _do_request_standard(method, url, headers, body, follow, timeout, proxy)

        if err:
            return False, err
        context['response'] = text or ''
        context['status'] = status or ''
        context['response_headers'] = resp_headers or {}
        return True, None

@register('tls_request')
class TlsRequestBlock:
    def execute(self, cfg, context):
        method = cfg.get('method', 'GET').upper()
        url = substitute(cfg.get('url', ''), context)
        raw_headers = cfg.get('headers', {})
        headers = _apply_context_headers(
            {k: substitute(v, context) for k, v in raw_headers.items()}, context)
        body = substitute(cfg.get('body', ''), context)
        timeout = int(cfg.get('timeout', 10))
        follow = cfg.get('follow_redirects', True)
        proxy = context.get('_proxy')
        tls_lib = cfg.get('tls_lib', 'tls_client')
        client_id = cfg.get('client_id', 'chrome_120')

        from modules.tls_request import make_request
        text, status, resp_headers, err = make_request(
            method, url, headers, body, follow, timeout, proxy,
            tls_lib=tls_lib, client_id=client_id)

        if err:
            return False, err
        context['response'] = text or ''
        context['status'] = status or ''
        context['response_headers'] = resp_headers or {}
        return True, None

@register('tcp')
class TcpBlock:
    def execute(self, cfg, context):
        host = substitute(cfg.get('host', ''), context)
        port = int(cfg.get('port', 80))
        send_data = substitute(cfg.get('send_data', ''), context)
        read_bytes = int(cfg.get('read_bytes', 4096))
        timeout = int(cfg.get('timeout', 10))
        use_ssl = cfg.get('use_ssl', False)
        output_var = cfg.get('output', 'tcp_response')

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            if use_ssl:
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                sock = ctx.wrap_socket(sock, server_hostname=host)
            sock.connect((host, port))
            if send_data:
                sock.sendall(send_data.encode('utf-8', errors='ignore'))
            data = sock.recv(read_bytes)
            sock.close()
            context[output_var] = data.decode('utf-8', errors='ignore')
            return True, None
        except Exception as e:
            return False, str(e)

@register('keycheck')
class KeycheckBlock:
    def execute(self, cfg, context):
        body = context.get('response', '')
        for key in cfg.get('ban', []):
            if key and key.lower() in body.lower():
                context['_result'] = 'BAN'
                return True, None
        for key in cfg.get('retry', []):
            if key and key.lower() in body.lower():
                context['_result'] = 'RETRY'
                return True, None
        for key in cfg.get('success', []):
            if key and key.lower() in body.lower():
                context['_result'] = 'SUCCESS'
                return True, None
        for key in cfg.get('fail', []):
            if key and key.lower() in body.lower():
                context['_result'] = 'FAIL'
                return True, None
        context['_result'] = 'FAIL'
        return True, None

@register('keycheck_custom')
class KeycheckCustomBlock:
    def execute(self, cfg, context):
        for rule in cfg.get('rules', []):
            source = rule.get('source', 'body')
            mode = rule.get('mode', 'contains')
            value = substitute(rule.get('value', ''), context)
            result = rule.get('result', 'SUCCESS')

            if source == 'body':
                text = context.get('response', '')
            elif source == 'status':
                text = context.get('status', '')
            elif source == 'header':
                text = json.dumps(context.get('response_headers', {}))
            else:
                text = context.get('response', '')

            fn = OPERATORS.get(mode)
            if fn:
                try:
                    matched = fn(text, value)
                except Exception:
                    matched = False
            else:
                matched = False

            if matched:
                context['_result'] = result
                return True, None

        context['_result'] = cfg.get('default_result', 'FAIL')
        return True, None

@register('parse')
class ParseBlock:
    def execute(self, cfg, context):
        variable = cfg.get('variable', 'parsed')
        source = cfg.get('source', 'body')
        mode = cfg.get('mode', 'between')

        if source == 'body':
            text = context.get('response', '')
        elif source == 'header':
            text = context.get('response_headers', {}).get(cfg.get('field', ''), '')
        else:
            text = context.get('response', '')

        value = ''
        try:
            if mode == 'between':
                left, right = cfg.get('left', ''), cfg.get('right', '')
                if left and right:
                    s = text.index(left) + len(left)
                    value = text[s:text.index(right, s)]
            elif mode == 'regex':
                m = re.search(cfg.get('pattern', ''), text)
                if m:
                    value = m.group(1) if m.lastindex else m.group(0)
            elif mode == 'json_field':
                data = json.loads(text)
                for k in cfg.get('field', '').split('.'):
                    if isinstance(data, list):
                        data = data[int(k)]
                    else:
                        data = data[k]
                value = str(data)
        except Exception:
            pass

        context[variable] = value
        if cfg.get('is_capture'):
            captures = context.setdefault('_captures', {})
            captures[variable] = value
        return True, None

@register('set_variable')
class SetVariableBlock:
    def execute(self, cfg, context):
        var = cfg.get('variable', 'var')
        val = substitute(cfg.get('value', ''), context)
        context[var] = val
        if cfg.get('is_capture'):
            captures = context.setdefault('_captures', {})
            captures[var] = val
        return True, None

@register('constant')
class ConstantBlock:
    def execute(self, cfg, context):
        name = cfg.get('name', 'CONST')
        value = cfg.get('value', '')
        context[name] = value
        return True, None

FUNCTIONS = {
    'base64_encode':  lambda v, _: base64.b64encode(v.encode()).decode(),
    'base64_decode':  lambda v, _: base64.b64decode(v).decode(errors='ignore'),
    'url_encode':     lambda v, _: quote(v),
    'url_decode':     lambda v, _: unquote(v),
    'html_encode':    lambda v, _: html.escape(v),
    'html_decode':    lambda v, _: html.unescape(v),
    'hex_encode':     lambda v, _: v.encode().hex(),
    'hex_decode':     lambda v, _: bytes.fromhex(v).decode(errors='ignore'),
    'md5':            lambda v, _: hashlib.md5(v.encode()).hexdigest(),
    'sha1':           lambda v, _: hashlib.sha1(v.encode()).hexdigest(),
    'sha256':         lambda v, _: hashlib.sha256(v.encode()).hexdigest(),
    'sha512':         lambda v, _: hashlib.sha512(v.encode()).hexdigest(),
    'hmac_sha256':    lambda v, e: hmac.new(e.encode(), v.encode(), hashlib.sha256).hexdigest(),
    'hmac_sha512':    lambda v, e: hmac.new(e.encode(), v.encode(), hashlib.sha512).hexdigest(),
    'uppercase':      lambda v, _: v.upper(),
    'lowercase':      lambda v, _: v.lower(),
    'reverse':        lambda v, _: v[::-1],
    'trim':           lambda v, _: v.strip(),
    'length':         lambda v, _: str(len(v)),
    'replace':        lambda v, e: v.replace(e.split('|')[0], e.split('|')[1]) if '|' in e else v,
    'regex_replace':  lambda v, e: re.sub(e.split('|')[0], e.split('|')[1], v) if '|' in e else v,
    'substring':      lambda v, e: v[int(e.split(':')[0]):int(e.split(':')[1])] if ':' in e else v[:int(e or 0)],
    'to_int':         lambda v, _: str(int(float(v))),
    'to_float':       lambda v, _: str(float(v)),
    'json_encode':    lambda v, _: json.dumps(v),
    'json_decode':    lambda v, _: str(json.loads(v)),
    'timestamp':      lambda v, _: str(int(time.time())),
    'timestamp_ms':   lambda v, _: str(int(time.time() * 1000)),
    'date_now':       lambda v, _: datetime.now().strftime(v or '%Y-%m-%d %H:%M:%S'),
    'count_chars':    lambda v, _: str(len(v)),
    'count_words':    lambda v, _: str(len(v.split())),
    'count_lines':    lambda v, _: str(len(v.splitlines())),
    'split':          lambda v, e: v.split(e or ',')[0],
    'join':           lambda v, e: (e or ',').join(v.split('\n')),
    'char_at':        lambda v, e: v[int(e)] if int(e) < len(v) else '',
    'index_of':       lambda v, e: str(v.find(e)),
    'regex_match':    lambda v, e: (re.search(e, v).group(0) if re.search(e, v) else ''),
}

@register('function')
class FunctionBlock:
    def execute(self, cfg, context):
        func = cfg.get('func', 'uppercase')
        input_val = substitute(cfg.get('input', ''), context)
        extra = substitute(cfg.get('extra', ''), context)
        output_var = cfg.get('output', 'result')

        fn = FUNCTIONS.get(func)
        if fn:
            try:
                result = fn(input_val, extra)
                context[output_var] = result
                if cfg.get('is_capture'):
                    context.setdefault('_captures', {})[output_var] = result
            except Exception as e:
                context[output_var] = f'ERROR: {e}'
        else:
            context[output_var] = f'Unknown function: {func}'
        return True, None

@register('random')
class RandomBlock:
    def execute(self, cfg, context):
        mode = cfg.get('mode', 'string')
        output_var = cfg.get('output', 'rand')
        length = int(cfg.get('length', 10))

        if mode == 'string':
            chars = cfg.get('chars', string.ascii_lowercase + string.digits)
            context[output_var] = ''.join(_random.choice(chars) for _ in range(length))
        elif mode == 'int':
            lo = int(cfg.get('min', 0))
            hi = int(cfg.get('max', 9999))
            context[output_var] = str(_random.randint(lo, hi))
        elif mode == 'float':
            lo = float(cfg.get('min', 0))
            hi = float(cfg.get('max', 1))
            context[output_var] = str(round(_random.uniform(lo, hi), 6))
        elif mode == 'uuid':
            context[output_var] = str(uuid.uuid4())
        elif mode == 'hex':
            context[output_var] = os.urandom(length).hex()[:length*2]
        elif mode == 'choice':
            choices = substitute(cfg.get('choices', ''), context).split('\n')
            choices = [c.strip() for c in choices if c.strip()]
            context[output_var] = _random.choice(choices) if choices else ''
        elif mode == 'useragent':
            ua_browser = cfg.get('ua_browser', 'any')
            ua_platform = cfg.get('ua_platform', 'any')
            try:
                from fake_useragent import UserAgent
                ua = UserAgent()
                if ua_browser == 'chrome': context[output_var] = ua.chrome
                elif ua_browser == 'firefox': context[output_var] = ua.firefox
                elif ua_browser == 'safari': context[output_var] = ua.safari
                elif ua_browser == 'edge': context[output_var] = ua.edge
                else: context[output_var] = ua.random
                if ua_platform == 'mobile' and 'Mobile' not in context[output_var]:
                    for _ in range(20):
                        context[output_var] = ua.random
                        if 'Mobile' in context[output_var] or 'iPhone' in context[output_var] or 'Android' in context[output_var]:
                            break
                elif ua_platform == 'desktop' and ('Mobile' in context[output_var] or 'iPhone' in context[output_var]):
                    for _ in range(20):
                        context[output_var] = ua.random
                        if 'Mobile' not in context[output_var] and 'iPhone' not in context[output_var]:
                            break
            except ImportError:
                _UA_DESKTOP = [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/125.0.0.0 Safari/537.36',
                ]
                _UA_MOBILE = [
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
                    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125.0.0.0 Mobile Safari/537.36',
                    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
                ]
                pool = _UA_MOBILE if ua_platform == 'mobile' else _UA_DESKTOP if ua_platform == 'desktop' else _UA_DESKTOP + _UA_MOBILE
                context[output_var] = _random.choice(pool)
        else:
            context[output_var] = ''

        return True, None

@register('wait')
class WaitBlock:
    def execute(self, cfg, context):
        ms = int(substitute(str(cfg.get('ms', 1000)), context))
        time.sleep(ms / 1000.0)
        return True, None

@register('log')
class LogBlock:
    def execute(self, cfg, context):
        msg = substitute(cfg.get('message', ''), context)
        level = cfg.get('level', 'info')
        logs = context.get('_logs', [])
        logs.append({'level': level, 'message': msg, 'time': datetime.now().strftime('%H:%M:%S')})
        context['_logs'] = logs
        return True, None

@register('script')
class ScriptBlock:
    def execute(self, cfg, context):
        code = substitute(cfg.get('code', ''), context)
        output_var = cfg.get('output', 'script_result')
        safe_globals = {
            '__builtins__': {
                'len': len, 'str': str, 'int': int, 'float': float,
                'list': list, 'dict': dict, 'tuple': tuple,
                'range': range, 'enumerate': enumerate,
                'min': min, 'max': max, 'abs': abs, 'round': round,
                'sorted': sorted, 'reversed': reversed,
                'True': True, 'False': False, 'None': None,
                'isinstance': isinstance, 'type': type,
                'sum': sum, 'any': any, 'all': all,
                'zip': zip, 'map': map, 'filter': filter,
            },
            're': re, 'json': json, 'base64': base64,
            'hashlib': hashlib, 'time': time,
        }
        safe_locals = dict(context)
        try:
            result = eval(code, safe_globals, safe_locals)
            context[output_var] = str(result) if result is not None else ''
        except SyntaxError:
            exec(code, safe_globals, safe_locals)
            context[output_var] = safe_locals.get(output_var, '')
        except Exception as e:
            context[output_var] = f'ERROR: {e}'
        return True, None

@register('captcha')
class CaptchaBlock:
    def execute(self, cfg, context):
        provider = cfg.get('provider', '2captcha')
        api_key = substitute(cfg.get('api_key', ''), context)
        site_key = substitute(cfg.get('site_key', ''), context)
        page_url = substitute(cfg.get('page_url', ''), context)
        captcha_type = cfg.get('captcha_type', 'recaptcha_v2')
        output_var = cfg.get('output', 'captcha_token')

        if not api_key:
            context[output_var] = ''
            return False, 'No API key provided'

        try:
            if provider == '2captcha':
                submit = requests.post('http://2captcha.com/in.php', data={
                    'key': api_key, 'method': 'userrecaptcha',
                    'googlekey': site_key, 'pageurl': page_url,
                    'json': 1,
                }, timeout=30).json()

                if submit.get('status') != 1:
                    return False, submit.get('request', 'Submit failed')

                task_id = submit['request']
                for _ in range(60):
                    time.sleep(5)
                    result = requests.get('http://2captcha.com/res.php', params={
                        'key': api_key, 'action': 'get', 'id': task_id, 'json': 1,
                    }, timeout=15).json()
                    if result.get('status') == 1:
                        context[output_var] = result['request']
                        return True, None
                    if result.get('request') != 'CAPCHA_NOT_READY':
                        return False, result.get('request', 'Unknown error')

                return False, 'Captcha timeout'
            else:
                return False, f'Unknown provider: {provider}'
        except Exception as e:
            return False, str(e)

@register('if')
class IfBlock:
    def execute(self, cfg, context):
        return True, None

@register('elif')
class ElifBlock:
    def execute(self, cfg, context):
        return True, None

@register('else')
class ElseBlock:
    def execute(self, cfg, context):
        return True, None

@register('endif')
class EndifBlock:
    def execute(self, cfg, context):
        return True, None

@register('loop')
class LoopBlock:
    def execute(self, cfg, context):
        return True, None

@register('endloop')
class EndloopBlock:
    def execute(self, cfg, context):
        return True, None

@register('break')
class BreakBlock:
    def execute(self, cfg, context):
        return True, None


@register('browser_open')
class BrowserOpenBlock:
    def execute(self, cfg, context):
        driver_type = cfg.get('driver', 'undetected')
        headless = cfg.get('headless', True)
        try:
            if driver_type == 'undetected':
                import undetected_chromedriver as uc
                options = uc.ChromeOptions()
                if headless:
                    options.add_argument('--headless=new')
                options.add_argument('--no-sandbox')
                options.add_argument('--disable-dev-shm-usage')
                context['_browser'] = uc.Chrome(options=options)
            else:
                from selenium import webdriver
                from selenium.webdriver.chrome.options import Options
                options = Options()
                if headless:
                    options.add_argument('--headless=new')
                options.add_argument('--no-sandbox')
                options.add_argument('--disable-dev-shm-usage')
                context['_browser'] = webdriver.Chrome(options=options)
            return True, None
        except Exception as e:
            return False, str(e)


@register('browser_navigate')
class BrowserNavigateBlock:
    def execute(self, cfg, context):
        browser = context.get('_browser')
        if not browser:
            return False, 'No browser open'
        url = substitute(cfg.get('url', ''), context)
        try:
            browser.get(url)
            context['response'] = browser.page_source
            context['browser_url'] = browser.current_url
            context['browser_title'] = browser.title
            return True, None
        except Exception as e:
            return False, str(e)


@register('browser_click')
class BrowserClickBlock:
    def execute(self, cfg, context):
        browser = context.get('_browser')
        if not browser:
            return False, 'No browser open'
        selector = substitute(cfg.get('selector', ''), context)
        by = cfg.get('by', 'css')
        try:
            from selenium.webdriver.common.by import By
            by_map = {'css': By.CSS_SELECTOR, 'xpath': By.XPATH, 'id': By.ID, 'name': By.NAME, 'tag': By.TAG_NAME, 'class': By.CLASS_NAME}
            el = browser.find_element(by_map.get(by, By.CSS_SELECTOR), selector)
            el.click()
            return True, None
        except Exception as e:
            return False, str(e)


@register('browser_type')
class BrowserTypeBlock:
    def execute(self, cfg, context):
        browser = context.get('_browser')
        if not browser:
            return False, 'No browser open'
        selector = substitute(cfg.get('selector', ''), context)
        text = substitute(cfg.get('text', ''), context)
        by = cfg.get('by', 'css')
        clear = cfg.get('clear', True)
        try:
            from selenium.webdriver.common.by import By
            by_map = {'css': By.CSS_SELECTOR, 'xpath': By.XPATH, 'id': By.ID, 'name': By.NAME}
            el = browser.find_element(by_map.get(by, By.CSS_SELECTOR), selector)
            if clear:
                el.clear()
            el.send_keys(text)
            return True, None
        except Exception as e:
            return False, str(e)


@register('browser_get_text')
class BrowserGetTextBlock:
    def execute(self, cfg, context):
        browser = context.get('_browser')
        if not browser:
            return False, 'No browser open'
        selector = substitute(cfg.get('selector', ''), context)
        by = cfg.get('by', 'css')
        output = cfg.get('output', 'element_text')
        try:
            from selenium.webdriver.common.by import By
            by_map = {'css': By.CSS_SELECTOR, 'xpath': By.XPATH, 'id': By.ID, 'name': By.NAME}
            el = browser.find_element(by_map.get(by, By.CSS_SELECTOR), selector)
            context[output] = el.text
            if cfg.get('is_capture'):
                context.setdefault('_captures', {})[output] = el.text
            return True, None
        except Exception as e:
            return False, str(e)


@register('browser_get_source')
class BrowserGetSourceBlock:
    def execute(self, cfg, context):
        browser = context.get('_browser')
        if not browser:
            return False, 'No browser open'
        context['response'] = browser.page_source
        context['browser_url'] = browser.current_url
        return True, None


@register('browser_eval_js')
class BrowserEvalJsBlock:
    def execute(self, cfg, context):
        browser = context.get('_browser')
        if not browser:
            return False, 'No browser open'
        code = substitute(cfg.get('code', ''), context)
        output = cfg.get('output', 'js_result')
        try:
            result = browser.execute_script(code)
            context[output] = str(result) if result is not None else ''
            if cfg.get('is_capture'):
                context.setdefault('_captures', {})[output] = context[output]
            return True, None
        except Exception as e:
            return False, str(e)


@register('browser_wait')
class BrowserWaitBlock:
    def execute(self, cfg, context):
        browser = context.get('_browser')
        if not browser:
            return False, 'No browser open'
        selector = substitute(cfg.get('selector', ''), context)
        by = cfg.get('by', 'css')
        timeout_s = int(cfg.get('timeout', 10))
        try:
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            by_map = {'css': By.CSS_SELECTOR, 'xpath': By.XPATH, 'id': By.ID, 'name': By.NAME}
            WebDriverWait(browser, timeout_s).until(
                EC.presence_of_element_located((by_map.get(by, By.CSS_SELECTOR), selector))
            )
            return True, None
        except Exception as e:
            return False, str(e)


@register('browser_close')
class BrowserCloseBlock:
    def execute(self, cfg, context):
        browser = context.get('_browser')
        if browser:
            try:
                browser.quit()
            except Exception:
                pass
            context.pop('_browser', None)
        return True, None


@register('exec_js')
class ExecJsBlock:
    def execute(self, cfg, context):
        code = substitute(cfg.get('code', ''), context)
        output_var = cfg.get('output', 'js_result')
        try:
            import subprocess
            result = subprocess.run(
                ['node', '-e', code],
                capture_output=True, text=True, timeout=10
            )
            context[output_var] = result.stdout.strip()
            if cfg.get('is_capture'):
                context.setdefault('_captures', {})[output_var] = context[output_var]
            if result.returncode != 0:
                return False, result.stderr.strip()
            return True, None
        except FileNotFoundError:
            return False, 'Node.js not found'
        except Exception as e:
            return False, str(e)


@register('exec_python')
class ExecPythonBlock:
    def execute(self, cfg, context):
        code = substitute(cfg.get('code', ''), context)
        output_var = cfg.get('output', 'py_result')
        safe_globals = {
            '__builtins__': {
                'len': len, 'str': str, 'int': int, 'float': float,
                'list': list, 'dict': dict, 'tuple': tuple,
                'range': range, 'enumerate': enumerate,
                'min': min, 'max': max, 'abs': abs, 'round': round,
                'sorted': sorted, 'reversed': reversed,
                'True': True, 'False': False, 'None': None,
                'isinstance': isinstance, 'type': type,
                'sum': sum, 'any': any, 'all': all,
                'zip': zip, 'map': map, 'filter': filter,
                'print': lambda *a: None,
            },
            're': re, 'json': json, 'base64': base64,
            'hashlib': hashlib, 'time': time,
        }
        safe_locals = {k: v for k, v in context.items() if not k.startswith('_')}
        try:
            result = eval(code, safe_globals, safe_locals)
            context[output_var] = str(result) if result is not None else ''
        except SyntaxError:
            exec(code, safe_globals, safe_locals)
            context[output_var] = safe_locals.get(output_var, '')
        except Exception as e:
            context[output_var] = f'ERROR: {e}'
        if cfg.get('is_capture'):
            context.setdefault('_captures', {})[output_var] = context.get(output_var, '')
        return True, None


@register('discord_webhook')
class DiscordWebhookBlock:
    def execute(self, cfg, context):
        url = substitute(cfg.get('webhook_url', ''), context)
        message = substitute(cfg.get('message', ''), context)
        username = cfg.get('username', 'NextBullet')
        embed_title = substitute(cfg.get('embed_title', ''), context)
        embed_color = cfg.get('embed_color', '#22c55e')

        payload = {'username': username}
        if embed_title:
            color_int = int(embed_color.lstrip('#'), 16) if embed_color.startswith('#') else 0
            payload['embeds'] = [{'title': embed_title, 'description': message, 'color': color_int}]
        else:
            payload['content'] = message

        try:
            resp = requests.post(url, json=payload, timeout=10)
            return resp.status_code in (200, 204), f'HTTP {resp.status_code}' if resp.status_code not in (200, 204) else None
        except Exception as e:
            return False, str(e)


@register('telegram_message')
class TelegramMessageBlock:
    def execute(self, cfg, context):
        token = substitute(cfg.get('bot_token', ''), context)
        chat_id = substitute(cfg.get('chat_id', ''), context)
        message = substitute(cfg.get('message', ''), context)
        parse_mode = cfg.get('parse_mode', 'HTML')

        if not token or not chat_id:
            return False, 'Missing bot_token or chat_id'

        data = {'chat_id': chat_id, 'text': message}
        if parse_mode:
            data['parse_mode'] = parse_mode

        try:
            resp = requests.post(f'https://api.telegram.org/bot{token}/sendMessage', json=data, timeout=10)
            return resp.status_code == 200, None if resp.status_code == 200 else resp.text[:200]
        except Exception as e:
            return False, str(e)


@register('email_send')
class EmailSendBlock:
    def execute(self, cfg, context):
        host = cfg.get('smtp_host', 'smtp.gmail.com')
        port = int(cfg.get('smtp_port', 587))
        user = substitute(cfg.get('smtp_user', ''), context)
        password = substitute(cfg.get('smtp_pass', ''), context)
        from_addr = substitute(cfg.get('from_addr', ''), context) or user
        to_addr = substitute(cfg.get('to', ''), context)
        subject = substitute(cfg.get('subject', ''), context)
        body = substitute(cfg.get('body', ''), context)
        use_tls = cfg.get('use_tls', True)

        try:
            msg = MIMEMultipart()
            msg['From'] = from_addr
            msg['To'] = to_addr
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))

            server = smtplib.SMTP(host, port, timeout=10)
            if use_tls:
                server.starttls()
            if user and password:
                server.login(user, password)
            server.sendmail(from_addr, to_addr, msg.as_string())
            server.quit()
            return True, None
        except Exception as e:
            return False, str(e)


@register('ai_completion')
class AICompletionBlock:
    def execute(self, cfg, context):
        provider = cfg.get('provider', 'openai')
        api_key = substitute(cfg.get('api_key', ''), context)
        model = cfg.get('model', 'gpt-4o-mini')
        prompt = substitute(cfg.get('prompt', ''), context)
        system_prompt = substitute(cfg.get('system_prompt', ''), context)
        max_tokens = int(cfg.get('max_tokens', 500))
        temperature = float(cfg.get('temperature', 0.7))
        output_var = cfg.get('output', 'ai_response')

        if not api_key:
            return False, 'No API key'

        messages = []
        if system_prompt:
            messages.append({'role': 'system', 'content': system_prompt})
        messages.append({'role': 'user', 'content': prompt})

        try:
            if provider == 'anthropic':
                headers = {'x-api-key': api_key, 'content-type': 'application/json', 'anthropic-version': '2023-06-01'}
                body = {'model': model, 'max_tokens': max_tokens, 'messages': [{'role': 'user', 'content': prompt}]}
                if system_prompt:
                    body['system'] = system_prompt
                resp = requests.post('https://api.anthropic.com/v1/messages', headers=headers, json=body, timeout=60)
                data = resp.json()
                context[output_var] = data.get('content', [{}])[0].get('text', '') if resp.status_code == 200 else data.get('error', {}).get('message', str(data))
            elif provider == 'grok':
                headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
                body = {'model': model, 'messages': messages, 'max_tokens': max_tokens, 'temperature': temperature}
                resp = requests.post('https://api.x.ai/v1/chat/completions', headers=headers, json=body, timeout=60)
                data = resp.json()
                context[output_var] = data.get('choices', [{}])[0].get('message', {}).get('content', '') if resp.status_code == 200 else str(data)
            else:
                headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
                body = {'model': model, 'messages': messages, 'max_tokens': max_tokens, 'temperature': temperature}
                resp = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=body, timeout=60)
                data = resp.json()
                context[output_var] = data.get('choices', [{}])[0].get('message', {}).get('content', '') if resp.status_code == 200 else str(data)

            if cfg.get('is_capture'):
                context.setdefault('_captures', {})[output_var] = context[output_var]
            return resp.status_code == 200, None if resp.status_code == 200 else context[output_var][:200]
        except Exception as e:
            context[output_var] = f'ERROR: {e}'
            return False, str(e)


@register('file_write')
class FileWriteBlock:
    def execute(self, cfg, context):
        filename = substitute(cfg.get('filename', 'output.txt'), context)
        text = substitute(cfg.get('text', ''), context)
        mode = 'a' if cfg.get('mode', 'append') == 'append' else 'w'
        try:
            os.makedirs(os.path.dirname(filename) if os.path.dirname(filename) else '.', exist_ok=True)
            with open(filename, mode, encoding='utf-8') as f:
                f.write(text + '\n')
            return True, None
        except Exception as e:
            return False, str(e)


@register('regex_replace')
class RegexReplaceBlock:
    def execute(self, cfg, context):
        source_var = cfg.get('source_var', 'response')
        text = str(context.get(source_var, ''))
        pattern = cfg.get('pattern', '')
        replacement = substitute(cfg.get('replacement', ''), context)
        output_var = cfg.get('output', 'result')
        try:
            context[output_var] = re.sub(pattern, replacement, text)
            if cfg.get('is_capture'):
                context.setdefault('_captures', {})[output_var] = context[output_var]
            return True, None
        except Exception as e:
            return False, str(e)


@register('math')
class MathBlock:
    def execute(self, cfg, context):
        left = substitute(cfg.get('left', '0'), context)
        right = substitute(cfg.get('right', '0'), context)
        op = cfg.get('op', '+')
        output_var = cfg.get('output', 'result')
        try:
            l = float(left)
            r = float(right) if op not in ('abs',) else 0
        except (ValueError, TypeError):
            l, r = 0, 0
        ops = {
            '+': l + r, '-': l - r, '*': l * r,
            '/': l / r if r != 0 else 0,
            '%': l % r if r != 0 else 0,
            '**': l ** r, '//': l // r if r != 0 else 0,
            'min': min(l, r), 'max': max(l, r),
            'abs': abs(l), 'round': round(l, int(r) if r else 0),
        }
        result = ops.get(op, 0)
        context[output_var] = str(int(result)) if result == int(result) else str(result)
        if cfg.get('is_capture'):
            context.setdefault('_captures', {})[output_var] = context[output_var]
        return True, None


@register('string_builder')
class StringBuilderBlock:
    def execute(self, cfg, context):
        template = cfg.get('template', '')
        output_var = cfg.get('output', 'built')
        context[output_var] = substitute(template, context)
        if cfg.get('is_capture'):
            context.setdefault('_captures', {})[output_var] = context[output_var]
        return True, None


@register('counter')
class CounterBlock:
    def execute(self, cfg, context):
        variable = cfg.get('variable', 'counter')
        op = cfg.get('op', '+')
        step = int(cfg.get('step', 1))
        initial = int(cfg.get('initial', 0))
        current = int(context.get(variable, initial))
        if op == '+': current += step
        elif op == '-': current -= step
        elif op == '*': current *= step
        elif op == 'reset': current = initial
        context[variable] = str(current)
        return True, None


@register('conditional_set')
class ConditionalSetBlock:
    def execute(self, cfg, context):
        variable = cfg.get('variable', 'result')
        cond = evaluate_condition(cfg, context)
        val = substitute(cfg.get('true_val', '') if cond else cfg.get('false_val', ''), context)
        context[variable] = val
        if cfg.get('is_capture'):
            context.setdefault('_captures', {})[variable] = val
        return True, None


@register('cookie_jar')
class CookieJarBlock:
    def execute(self, cfg, context):
        action = cfg.get('action', 'save')
        jar = context.setdefault('_cookie_jar', {})
        if action == 'save':
            headers = context.get('response_headers', {})
            for key, val in headers.items():
                if key.lower() == 'set-cookie':
                    parts = val.split(';')[0].split('=', 1)
                    if len(parts) == 2:
                        jar[parts[0].strip()] = parts[1].strip()
        elif action == 'load':
            context['cookie_header'] = '; '.join(f'{k}={v}' for k, v in jar.items())
        elif action == 'set':
            name = substitute(cfg.get('name', ''), context)
            value = substitute(cfg.get('value', ''), context)
            if name: jar[name] = value
        elif action == 'get':
            name = substitute(cfg.get('name', ''), context)
            context[cfg.get('output', 'cookie_val')] = jar.get(name, '')
        elif action == 'clear':
            context['_cookie_jar'] = {}
        return True, None


@register('http_auth')
class HttpAuthBlock:
    def execute(self, cfg, context):
        auth_type = cfg.get('auth_type', 'bearer')
        header_name = cfg.get('header_name', 'Authorization')
        if auth_type == 'bearer':
            token = substitute(cfg.get('token', ''), context)
            context['_auth_header'] = {header_name: f'Bearer {token}'}
        elif auth_type == 'basic':
            user = substitute(cfg.get('username', ''), context)
            pwd = substitute(cfg.get('password', ''), context)
            encoded = base64.b64encode(f'{user}:{pwd}'.encode()).decode()
            context['_auth_header'] = {header_name: f'Basic {encoded}'}
        elif auth_type == 'custom':
            token = substitute(cfg.get('token', ''), context)
            context['_auth_header'] = {header_name: token}
        return True, None


@register('sleep_random')
class SleepRandomBlock:
    def execute(self, cfg, context):
        lo = int(cfg.get('min', 500))
        hi = int(cfg.get('max', 2000))
        time.sleep(_random.randint(lo, hi) / 1000.0)
        return True, None


@register('proxy_check')
class ProxyCheckBlock:
    def execute(self, cfg, context):
        proxy = context.get('_proxy')
        test_url = cfg.get('test_url', 'https://httpbin.org/ip')
        timeout = int(cfg.get('timeout', 5))
        output_var = cfg.get('output', 'proxy_ok')
        fail_action = cfg.get('fail_action', 'skip')
        if not proxy:
            context[output_var] = 'no_proxy'
            return True, None
        proxies = {'http': proxy, 'https': proxy}
        try:
            resp = requests.get(test_url, proxies=proxies, timeout=timeout, verify=False)
            context[output_var] = 'true' if resp.status_code == 200 else 'false'
            return True, None
        except Exception:
            context[output_var] = 'false'
            if fail_action in ('skip', 'retry'):
                context['_result'] = 'RETRY'
            elif fail_action == 'ban':
                context['_result'] = 'BAN'
            return fail_action == 'continue', 'Proxy dead'
