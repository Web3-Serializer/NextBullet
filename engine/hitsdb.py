import os
import json
import sqlite3
import threading
from datetime import datetime

DB_PATH = os.path.join('data', 'hits.db')


class HitsDB:
    def __init__(self, db_path=None):
        self._path = db_path or DB_PATH
        self._local = threading.local()
        self._init_db()

    def _conn(self):
        if not hasattr(self._local, 'conn') or self._local.conn is None:
            self._local.conn = sqlite3.connect(self._path)
            self._local.conn.row_factory = sqlite3.Row
        return self._local.conn

    def _init_db(self):
        conn = sqlite3.connect(self._path)
        conn.execute('''CREATE TABLE IF NOT EXISTS hits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            runner_id TEXT,
            config_name TEXT,
            combo TEXT,
            username TEXT,
            password TEXT,
            extra TEXT DEFAULT '{}',
            created_at TEXT
        )''')
        conn.commit()
        conn.close()

    def add(self, runner_id, config_name, combo, username, password, extra=None):
        self._conn().execute(
            'INSERT INTO hits (runner_id, config_name, combo, username, password, extra, created_at) VALUES (?,?,?,?,?,?,?)',
            (runner_id, config_name, combo, username, password,
             json.dumps(extra or {}), datetime.now().isoformat())
        )
        self._conn().commit()

    def list(self, limit=500, offset=0, search=None, config_name=None):
        q = 'SELECT * FROM hits WHERE 1=1'
        params = []
        if search:
            q += ' AND (combo LIKE ? OR username LIKE ? OR extra LIKE ?)'
            s = f'%{search}%'
            params.extend([s, s, s])
        if config_name:
            q += ' AND config_name = ?'
            params.append(config_name)
        q += ' ORDER BY id DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        return [dict(r) for r in self._conn().execute(q, params).fetchall()]

    def count(self, config_name=None):
        q = 'SELECT COUNT(*) FROM hits'
        params = []
        if config_name:
            q += ' WHERE config_name = ?'
            params.append(config_name)
        return self._conn().execute(q, params).fetchone()[0]

    def delete(self, hit_id):
        self._conn().execute('DELETE FROM hits WHERE id = ?', (hit_id,))
        self._conn().commit()

    def clear(self, config_name=None):
        if config_name:
            self._conn().execute('DELETE FROM hits WHERE config_name = ?', (config_name,))
        else:
            self._conn().execute('DELETE FROM hits')
        self._conn().commit()

    def export(self, config_name=None, fmt='combo'):
        rows = self.list(limit=100000, config_name=config_name)
        if fmt == 'combo':
            return '\n'.join(r['combo'] for r in rows)
        elif fmt == 'user_pass':
            return '\n'.join(f"{r['username']}:{r['password']}" for r in rows)
        elif fmt == 'capture':
            lines = []
            for r in rows:
                extra = json.loads(r.get('extra', '{}')) if isinstance(r.get('extra'), str) else r.get('extra', {})
                caps = extra.pop('_captures', {})
                parts = [r['combo']]
                for k, v in caps.items():
                    parts.append(f'{k}={v}')
                lines.append(' | '.join(parts))
            return '\n'.join(lines)
        elif fmt == 'full':
            lines = []
            for r in rows:
                extra = json.loads(r.get('extra', '{}')) if isinstance(r.get('extra'), str) else r.get('extra', {})
                caps = extra.pop('_captures', {})
                parts = [r['combo']]
                for k, v in caps.items():
                    parts.append(f'{k}={v}')
                for k, v in extra.items():
                    parts.append(f'{k}={v}')
                lines.append(' | '.join(parts))
            return '\n'.join(lines)
        return ''
