# NextBullet

<br>
<img width="1918" height="914" alt="image" src="https://github.com/user-attachments/assets/e314a9d6-196a-4a6f-9173-077ec6603e6c" />
<img width="1920" height="913" alt="image" src="https://github.com/user-attachments/assets/8c5db83e-727f-43a6-b02e-661944550d90" />
<br>

NextBullet is a modern webtesting suite that allows to perform requests towards a target webapp and offers a lot of tools to work with the results. This software can be used for scraping and parsing data, automated pentesting, unit testing through selenium and much more.

Built with Python and Flask, NextBullet provides a clean dark-themed web UI with a visual block-based config editor, multi-threaded runners, live logging, and a full REST API.

**IMPORTANT!** Performing (D)DoS attacks or credential stuffing on sites you do not own (or you do not have permission to test) is illegal! The developer will not be held responsible for improper use of this software.

## Features

**Config Editor**
- Visual block-based pipeline editor with 46 block types
- 3 view modes: Pipeline, List, Code
- Quick Test with inline pass/fail indicators per block
- Console-style live logs with search
- Browser tab for rendered response preview
- Auto-save on every modification
- Export/Import configs as `.nbcfg` files
- Keyboard shortcuts (Ctrl+S save, Ctrl+Enter run test)

**Runners**
- Multi-threaded execution with configurable thread count
- Proxy rotation (rotate / random / sticky)
- Max retries with automatic failover
- Live log with combo results, captures, and errors
- Pause / Resume / Stop controls
- CPM (Checks Per Minute) tracking
- Hit export with captures

**Blocks (46 types across 8 categories)**

| Category | Blocks |
|----------|--------|
| Network | HTTP Request, TLS Request (tls_client / curl_cffi), TCP, HTTP Auth, Cookie Jar |
| Browser | Open (selenium / undetected_chromedriver), Navigate, Click, Type, Get Text, Get Source, Eval JS, Wait Element, Close |
| Logic | Key Check, Custom Key Check, IF / ELIF / ELSE / ENDIF, Conditional Set, Loop / End Loop, Break |
| Data | Parse (between / regex / JSON), Set Variable, Constant, Function (35+ transforms), Random, Regex Replace, Math, String Builder, Counter |
| Execute | Script, Exec Python, Exec JS (Node.js) |
| Notify | Discord Webhook, Telegram Message, Email (SMTP) |
| AI | AI Completion (OpenAI / Anthropic / Grok) |
| Utility | Wait, Sleep Random, Log, Captcha (2captcha), File Write, Proxy Check |

**Capture System**
- Mark any Parse, Set Variable, or Function block as a capture
- Captures stored with hits and exported alongside combos
- Format: `user:pass | token=abc123 | email=test@mail.com`

**Tools**
- Config Converter (LoliScript / OpenBullet 2 JSON to NextBullet)
- Proxy Checker with live results and export alive/dead
- Encoder/Decoder (Base64, URL, Hex, MD5, SHA256)

**Hits Database**
- SQLite-backed persistent hit storage
- Search, filter by config, paginate
- Export formats: combo, user:pass, capture, full

**Settings**
- Live system monitoring (CPU, RAM, Disk, Network)
- Real-time charts with 60-point history

**REST API**
- Full API with built-in documentation at `/api/docs`
- Endpoints for configs, wordlists, runners, hits, debugger, converter, system stats, proxy checking

## Installation

```bash
git clone https://github.com/Web3-Serializer/NextBullet.git
cd NextBullet
pip install -r requirements.txt
python main.py
```

Open `http://localhost:5000` in your browser.

### Optional dependencies

```bash
pip install fake-useragent       # Better random User-Agent generation
pip install tls-client curl_cffi # TLS fingerprint requests
pip install selenium undetected-chromedriver  # Browser automation
pip install psutil               # System monitoring in Settings
```

## Requirements

- Python 3.9+
- Flask 3.0
- requests
- Node.js (optional, for Exec JS block)
- Chrome/Chromium (optional, for Browser blocks)

## Project Structure

```
NextBullet/
  main.py              Flask app + API routes
  engine/
    blocks.py          46 block executors
    runner.py           Multi-threaded runner engine
    hitsdb.py           SQLite hits database
  modules/
    tls_request.py      TLS client wrapper
    httpx_request.py    HTTPX wrapper
  static/
    css/style.css       Dark theme
    js/blocks.js        Block registry + forms
    js/modal.js         Modal system
  templates/            Jinja2 templates
  data/
    configs/            Config JSON files
    wordlists/          Uploaded wordlists
    hits.db             Hits database
```

## Config File Format

Configs are stored as JSON with the `.nbcfg` extension:

```json
{
  "name": "My Config",
  "author": "anon",
  "description": "Login checker",
  "settings": {
    "max_threads": 10,
    "timeout": 10,
    "data_separator": ":",
    "proxy_mode": "rotate",
    "max_retries": 3,
    "use_proxies": false,
    "stop_on_hit": false
  },
  "blocks": [
    {
      "type": "request",
      "method": "POST",
      "url": "https://example.com/login",
      "headers": { "Content-Type": "application/json" },
      "body": "{\"user\":\"<USER>\",\"pass\":\"<PASS>\"}",
      "http_lib": "requests"
    },
    {
      "type": "keycheck",
      "success": ["welcome", "dashboard"],
      "fail": ["invalid", "error"]
    }
  ]
}
```

## License

MIT License. See [LICENSE](LICENSE) for details.

This software is provided for educational and authorized testing purposes only.
