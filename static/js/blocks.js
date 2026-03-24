const BLOCK_CATEGORIES = {
    network:  { label: 'Network',  icon: 'fa-globe',       types: ['request', 'tls_request', 'tcp', 'http_auth', 'cookie_jar'] },
    browser:  { label: 'Browser',  icon: 'fa-window-maximize', types: ['browser_open', 'browser_navigate', 'browser_click', 'browser_type', 'browser_get_text', 'browser_get_source', 'browser_eval_js', 'browser_wait', 'browser_close'] },
    logic:    { label: 'Logic',    icon: 'fa-code-branch', types: ['keycheck', 'keycheck_custom', 'if', 'elif', 'else', 'endif', 'conditional_set', 'loop', 'endloop', 'break'] },
    data:     { label: 'Data',     icon: 'fa-database',    types: ['parse', 'set_variable', 'constant', 'function', 'random', 'regex_replace', 'math', 'string_builder', 'counter'] },
    exec:     { label: 'Execute',  icon: 'fa-terminal',    types: ['script', 'exec_python', 'exec_js'] },
    notify:   { label: 'Notify',   icon: 'fa-bell',        types: ['discord_webhook', 'telegram_message', 'email_send'] },
    ai:       { label: 'AI',       icon: 'fa-brain',       types: ['ai_completion'] },
    utility:  { label: 'Utility',  icon: 'fa-wrench',      types: ['wait', 'sleep_random', 'log', 'captcha', 'file_write', 'proxy_check'] },
};

const OPERATORS = [
    { value: 'equals',        label: 'Equals' },
    { value: 'not_equals',    label: 'Not Equals' },
    { value: 'contains',      label: 'Contains' },
    { value: 'not_contains',  label: 'Not Contains' },
    { value: 'starts_with',   label: 'Starts With' },
    { value: 'ends_with',     label: 'Ends With' },
    { value: 'greater_than',  label: 'Greater Than' },
    { value: 'less_than',     label: 'Less Than' },
    { value: 'exists',        label: 'Exists' },
    { value: 'not_exists',    label: 'Not Exists' },
    { value: 'is_empty',      label: 'Is Empty' },
    { value: 'is_not_empty',  label: 'Is Not Empty' },
    { value: 'matches_regex', label: 'Matches Regex' },
    { value: 'length_equals', label: 'Length Equals' },
    { value: 'length_greater',label: 'Length Greater' },
    { value: 'length_less',   label: 'Length Less' },
];

const FUNCTION_LIST = {
    'Encoding': ['base64_encode','base64_decode','url_encode','url_decode','html_encode','html_decode','hex_encode','hex_decode'],
    'Hash':     ['md5','sha1','sha256','sha512','hmac_sha256','hmac_sha512'],
    'String':   ['uppercase','lowercase','reverse','trim','length','replace','regex_replace','substring','split','join','char_at','index_of','regex_match','count_chars','count_words','count_lines'],
    'Convert':  ['to_int','to_float','json_encode','json_decode'],
    'Time':     ['timestamp','timestamp_ms','date_now'],
};

const BLOCK_REGISTRY = {

    request: {
        label: 'HTTP Request', desc: 'Standard HTTP request (requests / httpx)',
        category: 'network', colorClass: 'bt-request', borderColor: '#3b82f6',
        summary(b) { return `${b.method||'GET'} ${b.url ? b.url.replace(/https?:\/\/[^/]+/, '') || b.url : '(no url)'}`; },
        codeLine(b) {
            const lib = b.http_lib && b.http_lib !== 'requests' ? ` [${b.http_lib}]` : '';
            let s = `REQUEST${lib} ${b.method||'GET'} "${b.url||''}"`;
            const h = Object.entries(b.headers||{});
            if (h.length) s += '\n  ' + h.map(([k,v]) => `${k}: ${v}`).join('\n  ');
            if (b.body) s += `\n  BODY ${b.body}`;
            return s;
        },
        defaultData: { label: 'HTTP Request', method: 'GET', url: '', http_lib: 'requests', headers: { 'Content-Type': 'application/json' }, body: '', follow_redirects: true, timeout: 10 },
        renderForm(b) {
            const headerRows = Object.entries(b.headers||{}).map(([k,v]) => kvRow(k, v)).join('');
            return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:100px 1fr 120px;gap:8px">
    <div class="form-group"><label class="form-label">Method</label><select class="select" data-field="method">${methods(b.method)}</select></div>
    <div class="form-group"><label class="form-label">URL</label><input class="input mono" data-field="url" placeholder="https://example.com/login" value="${x(b.url||'')}"></div>
    <div class="form-group"><label class="form-label">Library</label><select class="select" data-field="http_lib"><option value="requests" ${b.http_lib==='requests'?'selected':''}>requests</option><option value="httpx" ${b.http_lib==='httpx'?'selected':''}>httpx</option></select></div>
</div>
<div class="form-group">
    <label class="form-label" style="display:flex;justify-content:space-between;align-items:center"><span>Headers</span><div style="display:flex;gap:4px"><button type="button" class="btn btn-ghost btn-sm" onclick="addHeaderRow()">+ Add</button><button type="button" class="btn btn-ghost btn-sm" onclick="addCommonHeader('Content-Type','application/json')">JSON</button><button type="button" class="btn btn-ghost btn-sm" onclick="addCommonHeader('User-Agent','Mozilla/5.0')">UA</button></div></label>
    <div id="headers-kv" style="display:flex;flex-direction:column;gap:4px">${headerRows}</div>
</div>
<div class="form-group"><label class="form-label">Body</label><textarea class="textarea mono" data-field="body" rows="4" placeholder='{"username":"<USER>","password":"<PASS>"}'>${x(b.body||'')}</textarea></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Timeout (s)</label><input class="input" data-field="timeout" type="number" min="1" max="60" value="${b.timeout||10}"></div>
    <div class="form-group" style="justify-content:flex-end;padding-top:18px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" data-field="follow_redirects" ${b.follow_redirects!==false?'checked':''}><span style="font-size:13px">Follow redirects</span></label></div>
</div>`;
        },
        parseForm(raw, area) { return { label: raw.label||'HTTP Request', method: raw.method||'GET', url: raw.url||'', http_lib: raw.http_lib||'requests', headers: readKV(area), body: raw.body||'', follow_redirects: raw.follow_redirects===true||raw.follow_redirects==='true', timeout: parseInt(raw.timeout)||10 }; }
    },

    tls_request: {
        label: 'TLS Request', desc: 'TLS-fingerprinted request (tls_client / curl_cffi)',
        category: 'network', colorClass: 'bt-tls', borderColor: '#06b6d4',
        summary(b) { return `${b.method||'GET'} ${b.url ? b.url.replace(/https?:\/\/[^/]+/, '') || b.url : '(no url)'} [${b.tls_lib||'tls_client'}]`; },
        codeLine(b) { let s = `TLS_REQUEST [${b.tls_lib||'tls_client'}] ${b.method||'GET'} "${b.url||''}"`; if (b.client_id) s += `\n  CLIENT ${b.client_id}`; return s; },
        defaultData: { label: 'TLS Request', method: 'GET', url: '', tls_lib: 'tls_client', client_id: 'chrome_120', headers: { 'Content-Type': 'application/json' }, body: '', follow_redirects: true, timeout: 10 },
        renderForm(b) {
            const headerRows = Object.entries(b.headers||{}).map(([k,v]) => kvRow(k, v)).join('');
            const clients = ['chrome_120','chrome_119','chrome_116','firefox_120','firefox_110','safari_17','safari_16','edge_120','opera_90'];
            const impersonate = ['chrome','chrome110','safari','safari_ios','edge'];
            return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:100px 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Method</label><select class="select" data-field="method">${methods(b.method)}</select></div>
    <div class="form-group"><label class="form-label">URL</label><input class="input mono" data-field="url" placeholder="https://example.com/login" value="${x(b.url||'')}"></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">TLS Library</label><select class="select" data-field="tls_lib"><option value="tls_client" ${b.tls_lib==='tls_client'?'selected':''}>tls_client</option><option value="curl_cffi" ${b.tls_lib==='curl_cffi'?'selected':''}>curl_cffi</option></select></div>
    <div class="form-group"><label class="form-label">Client ID</label><select class="select" data-field="client_id">${(b.tls_lib==='curl_cffi'?impersonate:clients).map(c=>`<option value="${c}" ${b.client_id===c?'selected':''}>${c}</option>`).join('')}</select></div>
</div>
<div class="form-group"><label class="form-label" style="display:flex;justify-content:space-between;align-items:center"><span>Headers</span><div style="display:flex;gap:4px"><button type="button" class="btn btn-ghost btn-sm" onclick="addHeaderRow()">+ Add</button><button type="button" class="btn btn-ghost btn-sm" onclick="addCommonHeader('Content-Type','application/json')">JSON</button></div></label><div id="headers-kv" style="display:flex;flex-direction:column;gap:4px">${headerRows}</div></div>
<div class="form-group"><label class="form-label">Body</label><textarea class="textarea mono" data-field="body" rows="4">${x(b.body||'')}</textarea></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Timeout (s)</label><input class="input" data-field="timeout" type="number" min="1" max="60" value="${b.timeout||10}"></div>
    <div class="form-group" style="justify-content:flex-end;padding-top:18px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" data-field="follow_redirects" ${b.follow_redirects!==false?'checked':''}><span style="font-size:13px">Follow redirects</span></label></div>
</div>`;
        },
        parseForm(raw, area) { return { label: raw.label||'TLS Request', method: raw.method||'GET', url: raw.url||'', tls_lib: raw.tls_lib||'tls_client', client_id: raw.client_id||'chrome_120', headers: readKV(area), body: raw.body||'', follow_redirects: raw.follow_redirects===true||raw.follow_redirects==='true', timeout: parseInt(raw.timeout)||10 }; }
    },

    tcp: {
        label: 'TCP Request', desc: 'Raw TCP/SSL socket connection',
        category: 'network', colorClass: 'bt-tcp', borderColor: '#22d3ee',
        summary(b) { return `${b.host||'?'}:${b.port||80}${b.use_ssl?' (SSL)':''}`; },
        codeLine(b) { return `TCP${b.use_ssl?' SSL':''} "${b.host||''}:${b.port||80}"`; },
        defaultData: { label: 'TCP Request', host: '', port: 80, send_data: '', read_bytes: 4096, timeout: 10, output: 'tcp_response', use_ssl: false },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:1fr 100px;gap:8px">
    <div class="form-group"><label class="form-label">Host</label><input class="input mono" data-field="host" placeholder="example.com" value="${x(b.host||'')}"></div>
    <div class="form-group"><label class="form-label">Port</label><input class="input" data-field="port" type="number" value="${b.port||80}"></div>
</div>
<div class="form-group"><label class="form-label">Send data</label><textarea class="textarea mono" data-field="send_data" rows="3">${x(b.send_data||'')}</textarea></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Read bytes</label><input class="input" data-field="read_bytes" type="number" value="${b.read_bytes||4096}"></div>
    <div class="form-group"><label class="form-label">Timeout (s)</label><input class="input" data-field="timeout" type="number" value="${b.timeout||10}"></div>
    <div class="form-group"><label class="form-label">Output var</label><input class="input mono" data-field="output" value="${x(b.output||'tcp_response')}"></div>
</div>
<div class="form-group" style="padding-top:4px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" data-field="use_ssl" ${b.use_ssl?'checked':''}><span style="font-size:13px">Use SSL/TLS</span></label></div>`; },
        parseForm(raw) { return { label: raw.label||'TCP Request', host: raw.host||'', port: parseInt(raw.port)||80, send_data: raw.send_data||'', read_bytes: parseInt(raw.read_bytes)||4096, timeout: parseInt(raw.timeout)||10, output: raw.output||'tcp_response', use_ssl: raw.use_ssl===true||raw.use_ssl==='true' }; }
    },

    keycheck: {
        label: 'Key Check', desc: 'Check response for keywords',
        category: 'logic', colorClass: 'bt-keycheck', borderColor: '#22c55e',
        summary(b) { const s=(b.success||[]).slice(0,2).join(', '); return s?`success: ${s}`:'(no keys)'; },
        codeLine(b) { let s='KEYCHECK'; if((b.success||[]).length) s+=`\n  SUCCESS ${(b.success||[]).map(k=>'"'+k+'"').join(' ')}`; if((b.fail||[]).length) s+=`\n  FAIL ${(b.fail||[]).map(k=>'"'+k+'"').join(' ')}`; return s; },
        defaultData: { label: 'Key Check', success: [], fail: [], retry: [], ban: [] },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label" style="color:#22c55e">Success keys</label><textarea class="textarea mono" data-field="success" rows="4" placeholder="welcome\nlogged in">${x((b.success||[]).join('\n'))}</textarea></div>
    <div class="form-group"><label class="form-label" style="color:#ef4444">Fail keys</label><textarea class="textarea mono" data-field="fail" rows="4" placeholder="invalid\nwrong">${x((b.fail||[]).join('\n'))}</textarea></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label" style="color:#f59e0b">Retry keys</label><textarea class="textarea mono" data-field="retry" rows="3">${x((b.retry||[]).join('\n'))}</textarea></div>
    <div class="form-group"><label class="form-label" style="color:#a855f7">Ban keys</label><textarea class="textarea mono" data-field="ban" rows="3">${x((b.ban||[]).join('\n'))}</textarea></div>
</div>`; },
        parseForm(raw) { const l=f=>(f||'').split('\n').map(s=>s.trim()).filter(Boolean); return { label: raw.label||'Key Check', success: l(raw.success), fail: l(raw.fail), retry: l(raw.retry), ban: l(raw.ban) }; }
    },

    keycheck_custom: {
        label: 'Custom Key Check', desc: 'Advanced rules (source, mode, result)',
        category: 'logic', colorClass: 'bt-keycheck-custom', borderColor: '#10b981',
        summary(b) { const r=(b.rules||[]); return r.length?`${r.length} rule${r.length>1?'s':''}`:'(no rules)'; },
        codeLine(b) { let s='KEYCHECK_CUSTOM'; (b.rules||[]).forEach(r=>{s+=`\n  ${r.source||'body'} ${(r.mode||'contains').toUpperCase()} "${r.value||''}" => ${r.result||'SUCCESS'}`;}); return s; },
        defaultData: { label: 'Custom Key Check', rules: [{ source: 'body', mode: 'contains', value: '', result: 'SUCCESS' }], default_result: 'FAIL' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label" style="display:flex;justify-content:space-between;align-items:center"><span>Rules (first match wins)</span><button type="button" class="btn btn-ghost btn-sm" onclick="addKCRule()">+ Add Rule</button></label><div id="kc-rules" style="display:flex;flex-direction:column;gap:6px">${(b.rules||[]).map(r=>kcRule(r)).join('')}</div></div>
<div class="form-group" style="max-width:200px"><label class="form-label">Default result</label><select class="select" data-field="default_result">${['FAIL','SUCCESS','RETRY','BAN'].map(r=>`<option value="${r}" ${b.default_result===r?'selected':''}>${r}</option>`).join('')}</select></div>`; },
        parseForm(raw, area) { const rules=[]; (area||document).querySelectorAll('.kc-rule').forEach(el=>{rules.push({source:el.querySelector('[data-kc="source"]')?.value||'body',mode:el.querySelector('[data-kc="mode"]')?.value||'contains',value:el.querySelector('[data-kc="value"]')?.value||'',result:el.querySelector('[data-kc="result"]')?.value||'SUCCESS'});}); return { label: raw.label||'Custom Key Check', rules, default_result: raw.default_result||'FAIL' }; }
    },

    if:    { label: 'IF', desc: 'Start conditional', category: 'logic', colorClass: 'bt-if', borderColor: '#c084fc', summary(b){return `<${(b.left||'?').toUpperCase()}> ${b.operator||'equals'} "${b.right||''}"`}, codeLine(b){return `IF <${(b.left||'?').toUpperCase()}> ${(b.operator||'equals').toUpperCase()} "${b.right||''}"`}, defaultData:{label:'IF',left:'<STATUS>',operator:'equals',right:'200'}, renderForm(b){return conditionForm(b)}, parseForm(raw){return conditionParse(raw,'IF')} },
    elif:  { label: 'ELIF', desc: 'Else if', category: 'logic', colorClass: 'bt-elif', borderColor: '#c084fc', summary(b){return `<${(b.left||'?').toUpperCase()}> ${b.operator||'equals'} "${b.right||''}"`}, codeLine(b){return `ELIF <${(b.left||'?').toUpperCase()}> ${(b.operator||'equals').toUpperCase()} "${b.right||''}"`}, defaultData:{label:'ELIF',left:'<STATUS>',operator:'equals',right:'302'}, renderForm(b){return conditionForm(b)}, parseForm(raw){return conditionParse(raw,'ELIF')} },
    else:  { label: 'ELSE', desc: 'Default branch', category: 'logic', colorClass: 'bt-else', borderColor: '#c084fc', summary(){return 'else branch'}, codeLine(){return 'ELSE'}, defaultData:{label:'ELSE'}, renderForm(b){return `<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div><p style="font-size:12px;color:#8e8e9a;padding:8px 0">Marks the start of the else branch.</p>`}, parseForm(raw){return {label:raw.label||'ELSE'}} },
    endif: { label: 'ENDIF', desc: 'Close IF', category: 'logic', colorClass: 'bt-endif', borderColor: '#c084fc', summary(){return 'end condition'}, codeLine(){return 'ENDIF'}, defaultData:{label:'ENDIF'}, renderForm(b){return `<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div><p style="font-size:12px;color:#8e8e9a;padding:8px 0">Closes an IF/ELIF/ELSE block.</p>`}, parseForm(raw){return {label:raw.label||'ENDIF'}} },

    loop: {
        label: 'Loop', desc: 'Repeat blocks N times or over list',
        category: 'logic', colorClass: 'bt-loop', borderColor: '#60a5fa',
        summary(b) { return b.mode==='list'?`each in <${(b.list_var||'list').toUpperCase()}>`:`${b.count||1}x`; },
        codeLine(b) { return b.mode==='list'?`LOOP EACH <${(b.iter_var||'item').toUpperCase()}> IN <${(b.list_var||'list').toUpperCase()}>`:`LOOP ${b.count||1} TIMES AS <${(b.iter_var||'i').toUpperCase()}>`; },
        defaultData: { label: 'Loop', mode: 'count', count: 5, list_var: '', iter_var: 'i' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
    ${['count','list'].map(m=>`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:7px 10px;background:#202026;border:1px solid ${b.mode===m?'#4f6ef7':'#2a2a32'};border-radius:5px"><input type="radio" name="loop-mode" data-field="mode" value="${m}" ${b.mode===m?'checked':''}><span style="font-size:12px">${m}</span></label>`).join('')}
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Count / List variable</label><input class="input mono" data-field="count" value="${x(b.mode==='list'?b.list_var||'':String(b.count||5))}" placeholder="${b.mode==='list'?'myList':'5'}"></div>
    <div class="form-group"><label class="form-label">Iterator variable</label><input class="input mono" data-field="iter_var" value="${x(b.iter_var||'i')}" placeholder="i"></div>
</div>`; },
        parseForm(raw) { const mode=raw.mode||'count'; return { label: raw.label||'Loop', mode, count: mode==='count'?parseInt(raw.count)||1:0, list_var: mode==='list'?(raw.count||''):'', iter_var: raw.iter_var||'i' }; }
    },

    endloop: { label: 'End Loop', desc: 'Close loop block', category: 'logic', colorClass: 'bt-endloop', borderColor: '#60a5fa', summary(){return 'end loop'}, codeLine(){return 'ENDLOOP'}, defaultData:{label:'End Loop'}, renderForm(b){return `<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div><p style="font-size:12px;color:#8e8e9a;padding:8px 0">Closes a LOOP block. Execution jumps back to the loop start.</p>`}, parseForm(raw){return {label:raw.label||'End Loop'}} },
    break: { label: 'Break', desc: 'Exit current loop', category: 'logic', colorClass: 'bt-break', borderColor: '#ef4444', summary(){return 'break loop'}, codeLine(){return 'BREAK'}, defaultData:{label:'Break'}, renderForm(b){return `<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div><p style="font-size:12px;color:#8e8e9a;padding:8px 0">Exits the current loop immediately.</p>`}, parseForm(raw){return {label:raw.label||'Break'}} },

    parse: {
        label: 'Parse', desc: 'Extract data from response',
        category: 'data', colorClass: 'bt-parse', borderColor: '#f59e0b',
        summary(b) { return `${b.mode||'between'} -> <${(b.variable||'var').toUpperCase()}>${b.is_capture?' [CAP]':''}`; },
        codeLine(b) { const v=(b.variable||'var').toUpperCase(); const cap=b.is_capture?' CAPTURE':''; if(b.mode==='regex') return `PARSE <${v}> REGEX "${b.pattern||''}"${cap}`; if(b.mode==='json_field') return `PARSE <${v}> JSON "${b.field||''}"${cap}`; return `PARSE <${v}> BETWEEN "${b.left||''}" AND "${b.right||''}"${cap}`; },
        defaultData: { label: 'Parse', variable: 'token', source: 'body', mode: 'between', left: '', right: '', pattern: '', field: '', is_capture: false },
        renderForm(b) { const primary=b.left||b.pattern||b.field||''; return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Save to variable</label><input class="input mono" data-field="variable" placeholder="token" value="${x(b.variable||'')}"></div>
    <div class="form-group"><label class="form-label">Source</label><select class="select" data-field="source">${['body','header'].map(s=>`<option value="${s}" ${b.source===s?'selected':''}>${s}</option>`).join('')}</select></div>
</div>
<div class="form-group"><label class="form-label">Mode</label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${['between','regex','json_field'].map(m=>`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:7px 10px;background:#202026;border:1px solid ${b.mode===m?'#4f6ef7':'#2a2a32'};border-radius:5px"><input type="radio" name="parse-mode" data-field="mode" value="${m}" ${b.mode===m?'checked':''}><span style="font-size:12px">${m}</span></label>`).join('')}</div></div>
<div class="form-group"><label class="form-label">Left / Pattern / JSON field</label><input class="input mono" data-field="left" value="${x(primary)}"></div>
<div class="form-group"><label class="form-label">Right boundary</label><input class="input mono" data-field="right" value="${x(b.right||'')}"></div>
<div class="form-group" style="padding-top:4px"><label class="capture-toggle ${b.is_capture?'active':''}"><input type="checkbox" data-field="is_capture" ${b.is_capture?'checked':''}><i class="fas fa-bullseye"></i> Capture</label></div>`; },
        parseForm(raw) { const mode=raw.mode||'between'; return { label:raw.label||'Parse', variable:raw.variable||'parsed', source:raw.source||'body', mode, left:mode==='between'?(raw.left||''):'', right:mode==='between'?(raw.right||''):'', pattern:mode==='regex'?(raw.left||''):'', field:mode==='json_field'?(raw.left||''):'', is_capture:raw.is_capture===true||raw.is_capture==='true' }; }
    },

    set_variable: {
        label: 'Set Variable', desc: 'Assign a value to a variable',
        category: 'data', colorClass: 'bt-set_variable', borderColor: '#505060',
        summary(b) { return `${b.variable||'var'} = "${b.value||''}"${b.is_capture?' [CAP]':''}`; },
        codeLine(b) { return `SET "${b.variable||'var'}" = "${b.value||''}"${b.is_capture?' CAPTURE':''}`; },
        defaultData: { label: 'Set Variable', variable: 'myVar', value: '', is_capture: false },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Variable name</label><input class="input mono" data-field="variable" placeholder="myVar" value="${x(b.variable||'')}"></div>
<div class="form-group"><label class="form-label">Value</label><input class="input mono" data-field="value" placeholder="<USER>_suffix" value="${x(b.value||'')}"></div>
<div class="form-group" style="padding-top:4px"><label class="capture-toggle ${b.is_capture?'active':''}"><input type="checkbox" data-field="is_capture" ${b.is_capture?'checked':''}><i class="fas fa-bullseye"></i> Capture</label></div>`; },
        parseForm(raw) { return { label:raw.label||'Set Variable', variable:raw.variable||'myVar', value:raw.value||'', is_capture:raw.is_capture===true||raw.is_capture==='true' }; }
    },

    constant: {
        label: 'Constant', desc: 'Define a named constant (not substituted)',
        category: 'data', colorClass: 'bt-constant', borderColor: '#94a3b8',
        summary(b) { return `${b.name||'CONST'} = "${b.value||''}"`; },
        codeLine(b) { return `CONST "${b.name||'CONST'}" = "${b.value||''}"`; },
        defaultData: { label: 'Constant', name: 'API_KEY', value: '' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Name</label><input class="input mono" data-field="name" placeholder="API_KEY" value="${x(b.name||'')}"></div>
<div class="form-group"><label class="form-label">Value</label><input class="input mono" data-field="value" value="${x(b.value||'')}"></div>`; },
        parseForm(raw) { return { label:raw.label||'Constant', name:raw.name||'CONST', value:raw.value||'' }; }
    },

    function: {
        label: 'Function', desc: 'Transform data (hash, encode, string ops...)',
        category: 'data', colorClass: 'bt-function', borderColor: '#ec4899',
        summary(b) { return `${b.func||'?'} -> <${(b.output||'result').toUpperCase()}>${b.is_capture?' [CAP]':''}`; },
        codeLine(b) { return `FUNCTION ${(b.func||'?').toUpperCase()} "${b.input||''}" -> <${(b.output||'result').toUpperCase()}>${b.is_capture?' CAPTURE':''}`; },
        defaultData: { label: 'Function', func: 'base64_encode', input: '', output: 'result', extra: '', is_capture: false },
        renderForm(b) {
            let opts = '';
            for (const [cat, fns] of Object.entries(FUNCTION_LIST)) {
                opts += `<optgroup label="${cat}">`;
                fns.forEach(f => { opts += `<option value="${f}" ${b.func===f?'selected':''}>${f}</option>`; });
                opts += '</optgroup>';
            }
            return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Function</label><select class="select" data-field="func">${opts}</select></div>
<div class="form-group"><label class="form-label">Input (value or variable tag)</label><input class="input mono" data-field="input" placeholder="<RESPONSE>" value="${x(b.input||'')}"></div>
<div class="form-group"><label class="form-label">Extra parameter (for replace: old|new, substring: start:end, hmac: key)</label><input class="input mono" data-field="extra" value="${x(b.extra||'')}"></div>
<div class="form-group"><label class="form-label">Output variable</label><input class="input mono" data-field="output" value="${x(b.output||'result')}"></div>
<div class="form-group" style="padding-top:4px"><label class="capture-toggle ${b.is_capture?'active':''}"><input type="checkbox" data-field="is_capture" ${b.is_capture?'checked':''}><i class="fas fa-bullseye"></i> Capture</label></div>`;
        },
        parseForm(raw) { return { label:raw.label||'Function', func:raw.func||'base64_encode', input:raw.input||'', output:raw.output||'result', extra:raw.extra||'', is_capture:raw.is_capture===true||raw.is_capture==='true' }; }
    },

    random: {
        label: 'Random', desc: 'Generate random string, number, uuid, hex',
        category: 'data', colorClass: 'bt-random', borderColor: '#f472b6',
        summary(b) { return `${b.mode||'string'} -> <${(b.output||'rand').toUpperCase()}>`; },
        codeLine(b) { return `RANDOM ${(b.mode||'string').toUpperCase()} -> <${(b.output||'rand').toUpperCase()}>`; },
        defaultData: { label: 'Random', mode: 'string', output: 'rand', length: 10, min: 0, max: 9999, chars: 'abcdefghijklmnopqrstuvwxyz0123456789', choices: '', ua_browser: 'any', ua_platform: 'any' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Mode</label><select class="select" data-field="mode">${['string','int','float','uuid','hex','choice','useragent'].map(m=>`<option value="${m}" ${b.mode===m?'selected':''}>${m}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Output variable</label><input class="input mono" data-field="output" value="${x(b.output||'rand')}"></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Length</label><input class="input" data-field="length" type="number" value="${b.length||10}"></div>
    <div class="form-group"><label class="form-label">Min</label><input class="input" data-field="min" type="number" value="${b.min||0}"></div>
    <div class="form-group"><label class="form-label">Max</label><input class="input" data-field="max" type="number" value="${b.max||9999}"></div>
</div>
<div class="form-group"><label class="form-label">Characters (string mode)</label><input class="input mono" data-field="chars" value="${x(b.chars||'')}"></div>
<div class="form-group"><label class="form-label">Choices (one per line, choice mode)</label><textarea class="textarea mono" data-field="choices" rows="3">${x(b.choices||'')}</textarea></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">UA Browser (useragent mode)</label><select class="select" data-field="ua_browser">${['any','chrome','firefox','safari','edge'].map(v=>`<option value="${v}" ${b.ua_browser===v?'selected':''}>${v}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">UA Platform</label><select class="select" data-field="ua_platform">${['any','desktop','mobile'].map(v=>`<option value="${v}" ${b.ua_platform===v?'selected':''}>${v}</option>`).join('')}</select></div>
</div>`; },
        parseForm(raw) { return { label:raw.label||'Random', mode:raw.mode||'string', output:raw.output||'rand', length:parseInt(raw.length)||10, min:parseInt(raw.min)||0, max:parseInt(raw.max)||9999, chars:raw.chars||'abcdefghijklmnopqrstuvwxyz0123456789', choices:raw.choices||'', ua_browser:raw.ua_browser||'any', ua_platform:raw.ua_platform||'any' }; }
    },

    script: {
        label: 'Script', desc: 'Evaluate Python expression',
        category: 'data', colorClass: 'bt-script', borderColor: '#fb923c',
        summary(b) { return b.code ? b.code.slice(0, 40) : '(empty)'; },
        codeLine(b) { return `SCRIPT "${(b.code||'').slice(0,60)}"`; },
        defaultData: { label: 'Script', code: '', output: 'script_result' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Python expression / code</label><textarea class="textarea mono" data-field="code" rows="6" placeholder="len(response)">${x(b.code||'')}</textarea></div>
<div class="form-group"><label class="form-label">Output variable</label><input class="input mono" data-field="output" value="${x(b.output||'script_result')}"></div>`; },
        parseForm(raw) { return { label:raw.label||'Script', code:raw.code||'', output:raw.output||'script_result' }; }
    },

    wait: {
        label: 'Wait', desc: 'Pause execution for N milliseconds',
        category: 'utility', colorClass: 'bt-wait', borderColor: '#64748b',
        summary(b) { return `${b.ms||1000}ms`; },
        codeLine(b) { return `WAIT ${b.ms||1000}ms`; },
        defaultData: { label: 'Wait', ms: 1000 },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Delay (ms)</label><input class="input" data-field="ms" type="number" min="0" max="60000" value="${b.ms||1000}"></div>`; },
        parseForm(raw) { return { label:raw.label||'Wait', ms:parseInt(raw.ms)||1000 }; }
    },

    log: {
        label: 'Log', desc: 'Log a message to the debugger',
        category: 'utility', colorClass: 'bt-log', borderColor: '#64748b',
        summary(b) { return b.message ? b.message.slice(0, 40) : '(empty)'; },
        codeLine(b) { return `LOG "${b.message||''}"`; },
        defaultData: { label: 'Log', message: '', level: 'info' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Message (supports variable tags)</label><input class="input mono" data-field="message" placeholder="Status: <STATUS>" value="${x(b.message||'')}"></div>
<div class="form-group"><label class="form-label">Level</label><select class="select" data-field="level">${['info','warn','error','debug'].map(l=>`<option value="${l}" ${b.level===l?'selected':''}>${l}</option>`).join('')}</select></div>`; },
        parseForm(raw) { return { label:raw.label||'Log', message:raw.message||'', level:raw.level||'info' }; }
    },

    captcha: {
        label: 'Captcha', desc: 'Solve captcha via 2captcha API',
        category: 'utility', colorClass: 'bt-captcha', borderColor: '#4ade80',
        summary(b) { return `${b.provider||'2captcha'} ${b.captcha_type||'recaptcha_v2'}`; },
        codeLine(b) { return `CAPTCHA ${(b.provider||'2captcha').toUpperCase()} ${b.captcha_type||'recaptcha_v2'}`; },
        defaultData: { label: 'Captcha', provider: '2captcha', api_key: '', site_key: '', page_url: '', captcha_type: 'recaptcha_v2', output: 'captcha_token' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Provider</label><select class="select" data-field="provider"><option value="2captcha" ${b.provider==='2captcha'?'selected':''}>2captcha</option><option value="anticaptcha" ${b.provider==='anticaptcha'?'selected':''}>anticaptcha</option></select></div>
    <div class="form-group"><label class="form-label">Captcha type</label><select class="select" data-field="captcha_type"><option value="recaptcha_v2" ${b.captcha_type==='recaptcha_v2'?'selected':''}>reCAPTCHA v2</option><option value="recaptcha_v3" ${b.captcha_type==='recaptcha_v3'?'selected':''}>reCAPTCHA v3</option><option value="hcaptcha" ${b.captcha_type==='hcaptcha'?'selected':''}>hCaptcha</option></select></div>
</div>
<div class="form-group"><label class="form-label">API Key</label><input class="input mono" data-field="api_key" value="${x(b.api_key||'')}"></div>
<div class="form-group"><label class="form-label">Site Key</label><input class="input mono" data-field="site_key" value="${x(b.site_key||'')}"></div>
<div class="form-group"><label class="form-label">Page URL</label><input class="input mono" data-field="page_url" value="${x(b.page_url||'')}"></div>
<div class="form-group"><label class="form-label">Output variable</label><input class="input mono" data-field="output" value="${x(b.output||'captcha_token')}"></div>`; },
        parseForm(raw) { return { label:raw.label||'Captcha', provider:raw.provider||'2captcha', api_key:raw.api_key||'', site_key:raw.site_key||'', page_url:raw.page_url||'', captcha_type:raw.captcha_type||'recaptcha_v2', output:raw.output||'captcha_token' }; }
    },

    browser_open: {
        label: 'Browser Open', desc: 'Launch Chrome (selenium / undetected)',
        category: 'browser', colorClass: 'bt-browser', borderColor: '#818cf8',
        summary(b) { return `${b.driver||'undetected'}${b.headless?' headless':''}`; },
        codeLine(b) { return `BROWSER_OPEN ${(b.driver||'undetected').toUpperCase()}${b.headless?' HEADLESS':''}`; },
        defaultData: { label: 'Browser Open', driver: 'undetected', headless: true },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Driver</label><select class="select" data-field="driver"><option value="undetected" ${b.driver==='undetected'?'selected':''}>undetected_chromedriver</option><option value="selenium" ${b.driver==='selenium'?'selected':''}>selenium</option></select></div>
    <div class="form-group" style="justify-content:flex-end;padding-top:18px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" data-field="headless" ${b.headless!==false?'checked':''}><span style="font-size:13px">Headless</span></label></div>
</div>`; },
        parseForm(raw) { return { label:raw.label||'Browser Open', driver:raw.driver||'undetected', headless:raw.headless===true||raw.headless==='true' }; }
    },

    browser_navigate: {
        label: 'Navigate', desc: 'Navigate browser to URL',
        category: 'browser', colorClass: 'bt-browser', borderColor: '#818cf8',
        summary(b) { return b.url || '(no url)'; },
        codeLine(b) { return `NAVIGATE "${b.url||''}"`; },
        defaultData: { label: 'Navigate', url: '' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">URL</label><input class="input mono" data-field="url" placeholder="https://example.com" value="${x(b.url||'')}"></div>`; },
        parseForm(raw) { return { label:raw.label||'Navigate', url:raw.url||'' }; }
    },

    browser_click: {
        label: 'Click', desc: 'Click an element',
        category: 'browser', colorClass: 'bt-browser', borderColor: '#818cf8',
        summary(b) { return `${b.by||'css'}: ${b.selector||'?'}`; },
        codeLine(b) { return `CLICK ${(b.by||'css').toUpperCase()} "${b.selector||''}"`; },
        defaultData: { label: 'Click', selector: '', by: 'css' },
        renderForm(b) { return selectorForm(b, 'Click'); },
        parseForm(raw) { return { label:raw.label||'Click', selector:raw.selector||'', by:raw.by||'css' }; }
    },

    browser_type: {
        label: 'Type', desc: 'Type text into an input',
        category: 'browser', colorClass: 'bt-browser', borderColor: '#818cf8',
        summary(b) { return `${b.by||'css'}: ${b.selector||'?'} = "${b.text||''}"`; },
        codeLine(b) { return `TYPE ${(b.by||'css').toUpperCase()} "${b.selector||''}" TEXT "${b.text||''}"`; },
        defaultData: { label: 'Type', selector: '', by: 'css', text: '', clear: true },
        renderForm(b) { return `${selectorForm(b, 'Type')}
<div class="form-group"><label class="form-label">Text</label><input class="input mono" data-field="text" placeholder="<USER>" value="${x(b.text||'')}"></div>
<div class="form-group"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" data-field="clear" ${b.clear!==false?'checked':''}><span style="font-size:13px">Clear field first</span></label></div>`; },
        parseForm(raw) { return { label:raw.label||'Type', selector:raw.selector||'', by:raw.by||'css', text:raw.text||'', clear:raw.clear===true||raw.clear==='true' }; }
    },

    browser_get_text: {
        label: 'Get Text', desc: 'Get text content of an element',
        category: 'browser', colorClass: 'bt-browser', borderColor: '#818cf8',
        summary(b) { return `${b.selector||'?'} -> <${(b.output||'text').toUpperCase()}>`; },
        codeLine(b) { return `GET_TEXT ${(b.by||'css').toUpperCase()} "${b.selector||''}" -> <${(b.output||'text').toUpperCase()}>`; },
        defaultData: { label: 'Get Text', selector: '', by: 'css', output: 'element_text', is_capture: false },
        renderForm(b) { return `${selectorForm(b, 'Get Text')}
<div class="form-group"><label class="form-label">Output variable</label><input class="input mono" data-field="output" value="${x(b.output||'element_text')}"></div>
<div class="form-group"><label class="capture-toggle ${b.is_capture?'active':''}"><input type="checkbox" data-field="is_capture" ${b.is_capture?'checked':''}><i class="fas fa-bullseye"></i> Capture</label></div>`; },
        parseForm(raw) { return { label:raw.label||'Get Text', selector:raw.selector||'', by:raw.by||'css', output:raw.output||'element_text', is_capture:raw.is_capture===true||raw.is_capture==='true' }; }
    },

    browser_get_source: {
        label: 'Get Source', desc: 'Get current page source and URL',
        category: 'browser', colorClass: 'bt-browser', borderColor: '#818cf8',
        summary() { return 'page source -> <RESPONSE>'; },
        codeLine() { return 'GET_SOURCE'; },
        defaultData: { label: 'Get Source' },
        renderForm(b) { return `<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div><p style="font-size:12px;color:#8e8e9a;padding:8px 0">Saves page source to &lt;RESPONSE&gt; and current URL to &lt;BROWSER_URL&gt;.</p>`; },
        parseForm(raw) { return { label:raw.label||'Get Source' }; }
    },

    browser_eval_js: {
        label: 'Browser JS', desc: 'Execute JavaScript in the browser context',
        category: 'browser', colorClass: 'bt-browser', borderColor: '#818cf8',
        summary(b) { return b.code ? b.code.slice(0,40) : '(empty)'; },
        codeLine(b) { return `BROWSER_JS "${(b.code||'').slice(0,60)}"`; },
        defaultData: { label: 'Browser JS', code: 'return document.title;', output: 'js_result', is_capture: false },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">JavaScript code</label><textarea class="textarea mono" data-field="code" rows="5" placeholder="return document.title;">${x(b.code||'')}</textarea></div>
<div class="form-group"><label class="form-label">Output variable</label><input class="input mono" data-field="output" value="${x(b.output||'js_result')}"></div>
<div class="form-group"><label class="capture-toggle ${b.is_capture?'active':''}"><input type="checkbox" data-field="is_capture" ${b.is_capture?'checked':''}><i class="fas fa-bullseye"></i> Capture</label></div>`; },
        parseForm(raw) { return { label:raw.label||'Browser JS', code:raw.code||'', output:raw.output||'js_result', is_capture:raw.is_capture===true||raw.is_capture==='true' }; }
    },

    browser_wait: {
        label: 'Wait Element', desc: 'Wait for an element to appear',
        category: 'browser', colorClass: 'bt-browser', borderColor: '#818cf8',
        summary(b) { return `wait ${b.selector||'?'} (${b.timeout||10}s)`; },
        codeLine(b) { return `WAIT_ELEMENT ${(b.by||'css').toUpperCase()} "${b.selector||''}" ${b.timeout||10}s`; },
        defaultData: { label: 'Wait Element', selector: '', by: 'css', timeout: 10 },
        renderForm(b) { return `${selectorForm(b, 'Wait Element')}
<div class="form-group"><label class="form-label">Timeout (s)</label><input class="input" data-field="timeout" type="number" min="1" max="60" value="${b.timeout||10}"></div>`; },
        parseForm(raw) { return { label:raw.label||'Wait Element', selector:raw.selector||'', by:raw.by||'css', timeout:parseInt(raw.timeout)||10 }; }
    },

    browser_close: {
        label: 'Browser Close', desc: 'Close the browser',
        category: 'browser', colorClass: 'bt-browser', borderColor: '#818cf8',
        summary() { return 'close browser'; },
        codeLine() { return 'BROWSER_CLOSE'; },
        defaultData: { label: 'Browser Close' },
        renderForm(b) { return `<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div><p style="font-size:12px;color:#8e8e9a;padding:8px 0">Closes the browser and frees resources.</p>`; },
        parseForm(raw) { return { label:raw.label||'Browser Close' }; }
    },

    exec_python: {
        label: 'Exec Python', desc: 'Execute Python code (sandboxed eval/exec)',
        category: 'exec', colorClass: 'bt-script', borderColor: '#fb923c',
        summary(b) { return b.code ? b.code.slice(0,40) : '(empty)'; },
        codeLine(b) { return `EXEC_PYTHON "${(b.code||'').slice(0,60)}"`; },
        defaultData: { label: 'Exec Python', code: '', output: 'py_result', is_capture: false },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Python code</label><textarea class="textarea mono" data-field="code" rows="6" placeholder="len(response)">${x(b.code||'')}</textarea></div>
<div class="form-group"><label class="form-label">Output variable</label><input class="input mono" data-field="output" value="${x(b.output||'py_result')}"></div>
<div class="form-group"><label class="capture-toggle ${b.is_capture?'active':''}"><input type="checkbox" data-field="is_capture" ${b.is_capture?'checked':''}><i class="fas fa-bullseye"></i> Capture</label></div>`; },
        parseForm(raw) { return { label:raw.label||'Exec Python', code:raw.code||'', output:raw.output||'py_result', is_capture:raw.is_capture===true||raw.is_capture==='true' }; }
    },

    exec_js: {
        label: 'Exec JS', desc: 'Execute JavaScript via Node.js',
        category: 'exec', colorClass: 'bt-script', borderColor: '#fb923c',
        summary(b) { return b.code ? b.code.slice(0,40) : '(empty)'; },
        codeLine(b) { return `EXEC_JS "${(b.code||'').slice(0,60)}"`; },
        defaultData: { label: 'Exec JS', code: 'console.log("hello")', output: 'js_result', is_capture: false },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">JavaScript code (Node.js)</label><textarea class="textarea mono" data-field="code" rows="6" placeholder="console.log(JSON.stringify({ok:true}))">${x(b.code||'')}</textarea></div>
<div class="form-group"><label class="form-label">Output variable (captures stdout)</label><input class="input mono" data-field="output" value="${x(b.output||'js_result')}"></div>
<div class="form-group"><label class="capture-toggle ${b.is_capture?'active':''}"><input type="checkbox" data-field="is_capture" ${b.is_capture?'checked':''}><i class="fas fa-bullseye"></i> Capture</label></div>`; },
        parseForm(raw) { return { label:raw.label||'Exec JS', code:raw.code||'', output:raw.output||'js_result', is_capture:raw.is_capture===true||raw.is_capture==='true' }; }
    },

    discord_webhook: {
        label: 'Discord Webhook', desc: 'Send a message to a Discord channel',
        category: 'notify', colorClass: 'bt-discord', borderColor: '#5865f2',
        summary(b) { return b.message ? b.message.slice(0,40) : '(empty)'; },
        codeLine(b) { return `DISCORD "${(b.message||'').slice(0,50)}"`; },
        defaultData: { label: 'Discord Webhook', webhook_url: '', message: 'Hit: <COMBO>', username: 'NextBullet', embed_title: '', embed_color: '#22c55e' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Webhook URL</label><input class="input mono" data-field="webhook_url" placeholder="https://discord.com/api/webhooks/..." value="${x(b.webhook_url||'')}"></div>
<div class="form-group"><label class="form-label">Message (supports variables)</label><textarea class="textarea mono" data-field="message" rows="3" placeholder="Hit: <USER>:<PASS>">${x(b.message||'')}</textarea></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Bot username</label><input class="input" data-field="username" value="${x(b.username||'NextBullet')}"></div>
    <div class="form-group"><label class="form-label">Embed color</label><input class="input mono" data-field="embed_color" value="${x(b.embed_color||'#22c55e')}"></div>
</div>
<div class="form-group"><label class="form-label">Embed title (optional)</label><input class="input" data-field="embed_title" value="${x(b.embed_title||'')}"></div>`; },
        parseForm(raw) { return { label:raw.label||'Discord Webhook', webhook_url:raw.webhook_url||'', message:raw.message||'', username:raw.username||'NextBullet', embed_title:raw.embed_title||'', embed_color:raw.embed_color||'#22c55e' }; }
    },

    telegram_message: {
        label: 'Telegram Message', desc: 'Send a message via Telegram bot',
        category: 'notify', colorClass: 'bt-telegram', borderColor: '#26a5e4',
        summary(b) { return b.message ? b.message.slice(0,40) : '(empty)'; },
        codeLine(b) { return `TELEGRAM "${(b.message||'').slice(0,50)}"`; },
        defaultData: { label: 'Telegram Message', bot_token: '', chat_id: '', message: 'Hit: <COMBO>', parse_mode: 'HTML' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Bot Token</label><input class="input mono" data-field="bot_token" placeholder="123456:ABC-DEF..." value="${x(b.bot_token||'')}"></div>
<div class="form-group"><label class="form-label">Chat ID</label><input class="input mono" data-field="chat_id" placeholder="-100123456789" value="${x(b.chat_id||'')}"></div>
<div class="form-group"><label class="form-label">Message</label><textarea class="textarea mono" data-field="message" rows="3" placeholder="Hit: <USER>:<PASS>">${x(b.message||'')}</textarea></div>
<div class="form-group"><label class="form-label">Parse mode</label><select class="select" data-field="parse_mode">${['HTML','Markdown','MarkdownV2',''].map(m=>`<option value="${m}" ${b.parse_mode===m?'selected':''}>${m||'None'}</option>`).join('')}</select></div>`; },
        parseForm(raw) { return { label:raw.label||'Telegram Message', bot_token:raw.bot_token||'', chat_id:raw.chat_id||'', message:raw.message||'', parse_mode:raw.parse_mode||'HTML' }; }
    },

    email_send: {
        label: 'Email Send', desc: 'Send an email via SMTP',
        category: 'notify', colorClass: 'bt-email', borderColor: '#f97316',
        summary(b) { return `${b.to||'?'} via ${b.smtp_host||'?'}`; },
        codeLine(b) { return `EMAIL TO "${b.to||''}" VIA "${b.smtp_host||''}"`; },
        defaultData: { label: 'Email Send', smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_user: '', smtp_pass: '', from_addr: '', to: '', subject: 'Hit notification', body: '<COMBO>', use_tls: true },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:1fr 80px;gap:8px">
    <div class="form-group"><label class="form-label">SMTP Host</label><input class="input mono" data-field="smtp_host" value="${x(b.smtp_host||'')}"></div>
    <div class="form-group"><label class="form-label">Port</label><input class="input" data-field="smtp_port" type="number" value="${b.smtp_port||587}"></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">SMTP User</label><input class="input mono" data-field="smtp_user" value="${x(b.smtp_user||'')}"></div>
    <div class="form-group"><label class="form-label">SMTP Password</label><input class="input mono" data-field="smtp_pass" type="password" value="${x(b.smtp_pass||'')}"></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">From</label><input class="input mono" data-field="from_addr" value="${x(b.from_addr||'')}"></div>
    <div class="form-group"><label class="form-label">To</label><input class="input mono" data-field="to" value="${x(b.to||'')}"></div>
</div>
<div class="form-group"><label class="form-label">Subject</label><input class="input" data-field="subject" value="${x(b.subject||'')}"></div>
<div class="form-group"><label class="form-label">Body</label><textarea class="textarea mono" data-field="body" rows="3">${x(b.body||'')}</textarea></div>
<div class="form-group"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" data-field="use_tls" ${b.use_tls!==false?'checked':''}><span style="font-size:13px">Use TLS</span></label></div>`; },
        parseForm(raw) { return { label:raw.label||'Email Send', smtp_host:raw.smtp_host||'', smtp_port:parseInt(raw.smtp_port)||587, smtp_user:raw.smtp_user||'', smtp_pass:raw.smtp_pass||'', from_addr:raw.from_addr||'', to:raw.to||'', subject:raw.subject||'', body:raw.body||'', use_tls:raw.use_tls===true||raw.use_tls==='true' }; }
    },

    ai_completion: {
        label: 'AI Completion', desc: 'Call OpenAI / Anthropic / Grok API',
        category: 'ai', colorClass: 'bt-ai', borderColor: '#10b981',
        summary(b) { return `${b.provider||'openai'} ${b.model||'gpt-4o-mini'}`; },
        codeLine(b) { return `AI ${(b.provider||'openai').toUpperCase()} "${b.model||''}" -> <${(b.output||'ai_response').toUpperCase()}>`; },
        defaultData: { label: 'AI Completion', provider: 'openai', api_key: '', model: 'gpt-4o-mini', prompt: '', system_prompt: '', max_tokens: 500, temperature: 0.7, output: 'ai_response', is_capture: false },
        renderForm(b) {
            const models = {
                openai: ['gpt-4o-mini','gpt-4o','gpt-4-turbo','gpt-3.5-turbo'],
                anthropic: ['claude-sonnet-4-20250514','claude-haiku-4-5-20251001','claude-opus-4-20250514'],
                grok: ['grok-3','grok-3-mini'],
            };
            const provider = b.provider || 'openai';
            const modelOpts = (models[provider]||[]).map(m => `<option value="${m}" ${b.model===m?'selected':''}>${m}</option>`).join('');
            return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Provider</label><select class="select" data-field="provider">${['openai','anthropic','grok'].map(p=>`<option value="${p}" ${provider===p?'selected':''}>${p}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Model</label><select class="select" data-field="model">${modelOpts}</select></div>
</div>
<div class="form-group"><label class="form-label">API Key</label><input class="input mono" data-field="api_key" type="password" placeholder="sk-..." value="${x(b.api_key||'')}"></div>
<div class="form-group"><label class="form-label">System prompt (optional)</label><textarea class="textarea mono" data-field="system_prompt" rows="2">${x(b.system_prompt||'')}</textarea></div>
<div class="form-group"><label class="form-label">Prompt (supports variables)</label><textarea class="textarea mono" data-field="prompt" rows="3" placeholder="Analyze this: <RESPONSE>">${x(b.prompt||'')}</textarea></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Max tokens</label><input class="input" data-field="max_tokens" type="number" value="${b.max_tokens||500}"></div>
    <div class="form-group"><label class="form-label">Temperature</label><input class="input" data-field="temperature" type="number" step="0.1" min="0" max="2" value="${b.temperature||0.7}"></div>
    <div class="form-group"><label class="form-label">Output var</label><input class="input mono" data-field="output" value="${x(b.output||'ai_response')}"></div>
</div>
<div class="form-group"><label class="capture-toggle ${b.is_capture?'active':''}"><input type="checkbox" data-field="is_capture" ${b.is_capture?'checked':''}><i class="fas fa-bullseye"></i> Capture</label></div>`; },
        parseForm(raw) { return { label:raw.label||'AI Completion', provider:raw.provider||'openai', api_key:raw.api_key||'', model:raw.model||'gpt-4o-mini', prompt:raw.prompt||'', system_prompt:raw.system_prompt||'', max_tokens:parseInt(raw.max_tokens)||500, temperature:parseFloat(raw.temperature)||0.7, output:raw.output||'ai_response', is_capture:raw.is_capture===true||raw.is_capture==='true' }; }
    },

    file_write: {
        label: 'File Write', desc: 'Append text to a file',
        category: 'utility', colorClass: 'bt-log', borderColor: '#64748b',
        summary(b) { return `${b.filename||'?'} << ${b.text?.slice(0,30)||'...'}`; },
        codeLine(b) { return `FILE_WRITE "${b.filename||''}" "${(b.text||'').slice(0,40)}"`; },
        defaultData: { label: 'File Write', filename: 'hits.txt', text: '<COMBO>', mode: 'append' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Filename</label><input class="input mono" data-field="filename" placeholder="hits.txt" value="${x(b.filename||'')}"></div>
<div class="form-group"><label class="form-label">Text (supports variables)</label><textarea class="textarea mono" data-field="text" rows="2" placeholder="<COMBO> | <TOKEN>">${x(b.text||'')}</textarea></div>
<div class="form-group"><label class="form-label">Mode</label><select class="select" data-field="mode">${['append','overwrite'].map(m=>`<option value="${m}" ${b.mode===m?'selected':''}>${m}</option>`).join('')}</select></div>`; },
        parseForm(raw) { return { label:raw.label||'File Write', filename:raw.filename||'hits.txt', text:raw.text||'', mode:raw.mode||'append' }; }
    },

    regex_replace: {
        label: 'Regex Replace', desc: 'Replace text in a variable using regex',
        category: 'data', colorClass: 'bt-parse', borderColor: '#f59e0b',
        summary(b) { return `${b.source_var||'response'}: s/${(b.pattern||'').slice(0,15)}/${(b.replacement||'').slice(0,10)}/`; },
        codeLine(b) { return `REGEX_REPLACE <${(b.source_var||'response').toUpperCase()}> "${b.pattern||''}" "${b.replacement||''}" -> <${(b.output||'result').toUpperCase()}>`; },
        defaultData: { label: 'Regex Replace', source_var: 'response', pattern: '', replacement: '', output: 'result', is_capture: false },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Source variable</label><input class="input mono" data-field="source_var" placeholder="response" value="${x(b.source_var||'')}"></div>
<div class="form-group"><label class="form-label">Regex pattern</label><input class="input mono" data-field="pattern" placeholder="\\d+" value="${x(b.pattern||'')}"></div>
<div class="form-group"><label class="form-label">Replacement</label><input class="input mono" data-field="replacement" placeholder="***" value="${x(b.replacement||'')}"></div>
<div class="form-group"><label class="form-label">Output variable</label><input class="input mono" data-field="output" value="${x(b.output||'result')}"></div>
<div class="form-group"><label class="capture-toggle ${b.is_capture?'active':''}"><input type="checkbox" data-field="is_capture" ${b.is_capture?'checked':''}><i class="fas fa-bullseye"></i> Capture</label></div>`; },
        parseForm(raw) { return { label:raw.label||'Regex Replace', source_var:raw.source_var||'response', pattern:raw.pattern||'', replacement:raw.replacement||'', output:raw.output||'result', is_capture:raw.is_capture===true||raw.is_capture==='true' }; }
    },

    math: {
        label: 'Math', desc: 'Arithmetic operations on variables',
        category: 'data', colorClass: 'bt-function', borderColor: '#ec4899',
        summary(b) { return `${b.left||'?'} ${b.op||'+'} ${b.right||'?'} -> <${(b.output||'result').toUpperCase()}>`; },
        codeLine(b) { return `MATH "${b.left||''}" ${b.op||'+'} "${b.right||''}" -> <${(b.output||'result').toUpperCase()}>`; },
        defaultData: { label: 'Math', left: '', op: '+', right: '', output: 'result', is_capture: false },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:1fr 80px 1fr;gap:8px;align-items:end">
    <div class="form-group"><label class="form-label">Left</label><input class="input mono" data-field="left" placeholder="<STATUS>" value="${x(b.left||'')}"></div>
    <div class="form-group"><label class="form-label">Op</label><select class="select" data-field="op">${['+','-','*','/','%','**','//','min','max','abs','round'].map(o=>`<option value="${o}" ${b.op===o?'selected':''}>${o}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Right</label><input class="input mono" data-field="right" placeholder="100" value="${x(b.right||'')}"></div>
</div>
<div class="form-group"><label class="form-label">Output variable</label><input class="input mono" data-field="output" value="${x(b.output||'result')}"></div>
<div class="form-group"><label class="capture-toggle ${b.is_capture?'active':''}"><input type="checkbox" data-field="is_capture" ${b.is_capture?'checked':''}><i class="fas fa-bullseye"></i> Capture</label></div>`; },
        parseForm(raw) { return { label:raw.label||'Math', left:raw.left||'', op:raw.op||'+', right:raw.right||'', output:raw.output||'result', is_capture:raw.is_capture===true||raw.is_capture==='true' }; }
    },

    string_builder: {
        label: 'String Builder', desc: 'Build a string from template with variables',
        category: 'data', colorClass: 'bt-set_variable', borderColor: '#505060',
        summary(b) { return `-> <${(b.output||'built').toUpperCase()}>`; },
        codeLine(b) { return `STRING_BUILD "${(b.template||'').slice(0,50)}" -> <${(b.output||'built').toUpperCase()}>`; },
        defaultData: { label: 'String Builder', template: '', output: 'built', is_capture: false },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Template (use &lt;VAR&gt; for variables, {0}+{1} for concat)</label><textarea class="textarea mono" data-field="template" rows="3" placeholder="Bearer <TOKEN>">${x(b.template||'')}</textarea></div>
<div class="form-group"><label class="form-label">Output variable</label><input class="input mono" data-field="output" value="${x(b.output||'built')}"></div>
<div class="form-group"><label class="capture-toggle ${b.is_capture?'active':''}"><input type="checkbox" data-field="is_capture" ${b.is_capture?'checked':''}><i class="fas fa-bullseye"></i> Capture</label></div>`; },
        parseForm(raw) { return { label:raw.label||'String Builder', template:raw.template||'', output:raw.output||'built', is_capture:raw.is_capture===true||raw.is_capture==='true' }; }
    },

    counter: {
        label: 'Counter', desc: 'Increment or decrement a counter variable',
        category: 'data', colorClass: 'bt-constant', borderColor: '#94a3b8',
        summary(b) { return `${b.variable||'counter'} ${b.op||'+'}= ${b.step||1}`; },
        codeLine(b) { return `COUNTER "${b.variable||'counter'}" ${b.op||'+'}= ${b.step||1}`; },
        defaultData: { label: 'Counter', variable: 'counter', op: '+', step: 1, initial: 0 },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Variable name</label><input class="input mono" data-field="variable" placeholder="counter" value="${x(b.variable||'')}"></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Operation</label><select class="select" data-field="op">${['+','-','*','reset'].map(o=>`<option value="${o}" ${b.op===o?'selected':''}>${o}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Step</label><input class="input" data-field="step" type="number" value="${b.step||1}"></div>
    <div class="form-group"><label class="form-label">Initial</label><input class="input" data-field="initial" type="number" value="${b.initial||0}"></div>
</div>`; },
        parseForm(raw) { return { label:raw.label||'Counter', variable:raw.variable||'counter', op:raw.op||'+', step:parseInt(raw.step)||1, initial:parseInt(raw.initial)||0 }; }
    },

    conditional_set: {
        label: 'Conditional Set', desc: 'Set variable based on condition (ternary)',
        category: 'logic', colorClass: 'bt-if', borderColor: '#c084fc',
        summary(b) { return `${b.variable||'var'} = ${b.left||'?'} ${b.operator||'?'} ${b.right||'?'} ? ... : ...`; },
        codeLine(b) { return `COND_SET <${(b.variable||'var').toUpperCase()}> IF "${b.left||''}" ${(b.operator||'equals').toUpperCase()} "${b.right||''}" THEN "${(b.true_val||'').slice(0,20)}" ELSE "${(b.false_val||'').slice(0,20)}"`; },
        defaultData: { label: 'Conditional Set', variable: 'result', left: '<STATUS>', operator: 'equals', right: '200', true_val: 'ok', false_val: 'fail', is_capture: false },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Variable to set</label><input class="input mono" data-field="variable" value="${x(b.variable||'')}"></div>
<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:end">
    <div class="form-group"><label class="form-label">Left</label><input class="input mono" data-field="left" value="${x(b.left||'')}"></div>
    <div class="form-group"><label class="form-label">Op</label><select class="select" data-field="operator" style="min-width:120px">${OPERATORS.map(o=>`<option value="${o.value}" ${b.operator===o.value?'selected':''}>${o.label}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Right</label><input class="input mono" data-field="right" value="${x(b.right||'')}"></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label" style="color:#22c55e">Value if TRUE</label><input class="input mono" data-field="true_val" value="${x(b.true_val||'')}"></div>
    <div class="form-group"><label class="form-label" style="color:#ef4444">Value if FALSE</label><input class="input mono" data-field="false_val" value="${x(b.false_val||'')}"></div>
</div>
<div class="form-group"><label class="capture-toggle ${b.is_capture?'active':''}"><input type="checkbox" data-field="is_capture" ${b.is_capture?'checked':''}><i class="fas fa-bullseye"></i> Capture</label></div>`; },
        parseForm(raw) { return { label:raw.label||'Conditional Set', variable:raw.variable||'result', left:raw.left||'', operator:raw.operator||'equals', right:raw.right||'', true_val:raw.true_val||'', false_val:raw.false_val||'', is_capture:raw.is_capture===true||raw.is_capture==='true' }; }
    },

    cookie_jar: {
        label: 'Cookie Jar', desc: 'Manage cookies between requests',
        category: 'network', colorClass: 'bt-request', borderColor: '#3b82f6',
        summary(b) { return b.action || 'save'; },
        codeLine(b) { return `COOKIE_JAR ${(b.action||'save').toUpperCase()}${b.action==='set'?' "'+b.name+'='+b.value+'"':''}`; },
        defaultData: { label: 'Cookie Jar', action: 'save', name: '', value: '', output: 'cookie_val' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Action</label><select class="select" data-field="action">${['save','load','set','get','clear'].map(a=>`<option value="${a}" ${b.action===a?'selected':''}>${a}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Cookie name (for set/get)</label><input class="input mono" data-field="name" placeholder="session_id" value="${x(b.name||'')}"></div>
<div class="form-group"><label class="form-label">Value (for set)</label><input class="input mono" data-field="value" placeholder="abc123" value="${x(b.value||'')}"></div>
<div class="form-group"><label class="form-label">Output variable (for get)</label><input class="input mono" data-field="output" value="${x(b.output||'cookie_val')}"></div>`; },
        parseForm(raw) { return { label:raw.label||'Cookie Jar', action:raw.action||'save', name:raw.name||'', value:raw.value||'', output:raw.output||'cookie_val' }; }
    },

    http_auth: {
        label: 'HTTP Auth', desc: 'Set auth header (Basic / Bearer / Custom)',
        category: 'network', colorClass: 'bt-tls', borderColor: '#06b6d4',
        summary(b) { return `${b.auth_type||'bearer'}: ${(b.token||b.username||'').slice(0,20)}`; },
        codeLine(b) { return `HTTP_AUTH ${(b.auth_type||'bearer').toUpperCase()}`; },
        defaultData: { label: 'HTTP Auth', auth_type: 'bearer', token: '', username: '', password: '', header_name: 'Authorization' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Auth type</label><select class="select" data-field="auth_type">${['bearer','basic','custom'].map(a=>`<option value="${a}" ${b.auth_type===a?'selected':''}>${a}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Token / API Key (Bearer mode)</label><input class="input mono" data-field="token" placeholder="<TOKEN>" value="${x(b.token||'')}"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Username (Basic mode)</label><input class="input mono" data-field="username" value="${x(b.username||'')}"></div>
    <div class="form-group"><label class="form-label">Password (Basic mode)</label><input class="input mono" data-field="password" value="${x(b.password||'')}"></div>
</div>
<div class="form-group"><label class="form-label">Header name</label><input class="input mono" data-field="header_name" value="${x(b.header_name||'Authorization')}"></div>`; },
        parseForm(raw) { return { label:raw.label||'HTTP Auth', auth_type:raw.auth_type||'bearer', token:raw.token||'', username:raw.username||'', password:raw.password||'', header_name:raw.header_name||'Authorization' }; }
    },

    sleep_random: {
        label: 'Sleep Random', desc: 'Wait random ms between min and max',
        category: 'utility', colorClass: 'bt-wait', borderColor: '#64748b',
        summary(b) { return `${b.min||500}-${b.max||2000}ms`; },
        codeLine(b) { return `SLEEP_RANDOM ${b.min||500}-${b.max||2000}ms`; },
        defaultData: { label: 'Sleep Random', min: 500, max: 2000 },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Min (ms)</label><input class="input" data-field="min" type="number" min="0" value="${b.min||500}"></div>
    <div class="form-group"><label class="form-label">Max (ms)</label><input class="input" data-field="max" type="number" min="0" value="${b.max||2000}"></div>
</div>`; },
        parseForm(raw) { return { label:raw.label||'Sleep Random', min:parseInt(raw.min)||500, max:parseInt(raw.max)||2000 }; }
    },

    proxy_check: {
        label: 'Proxy Check', desc: 'Test if current proxy is alive',
        category: 'utility', colorClass: 'bt-tls', borderColor: '#06b6d4',
        summary(b) { return `timeout ${b.timeout||5}s -> <${(b.output||'proxy_ok').toUpperCase()}>`; },
        codeLine(b) { return `PROXY_CHECK timeout=${b.timeout||5}s -> <${(b.output||'proxy_ok').toUpperCase()}>`; },
        defaultData: { label: 'Proxy Check', test_url: 'https://httpbin.org/ip', timeout: 5, output: 'proxy_ok', fail_action: 'skip' },
        renderForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div class="form-group"><label class="form-label">Test URL</label><input class="input mono" data-field="test_url" value="${x(b.test_url||'https://httpbin.org/ip')}"></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
    <div class="form-group"><label class="form-label">Timeout (s)</label><input class="input" data-field="timeout" type="number" min="1" max="30" value="${b.timeout||5}"></div>
    <div class="form-group"><label class="form-label">Output var</label><input class="input mono" data-field="output" value="${x(b.output||'proxy_ok')}"></div>
    <div class="form-group"><label class="form-label">On fail</label><select class="select" data-field="fail_action">${['skip','retry','ban','continue'].map(a=>`<option value="${a}" ${b.fail_action===a?'selected':''}>${a}</option>`).join('')}</select></div>
</div>`; },
        parseForm(raw) { return { label:raw.label||'Proxy Check', test_url:raw.test_url||'https://httpbin.org/ip', timeout:parseInt(raw.timeout)||5, output:raw.output||'proxy_ok', fail_action:raw.fail_action||'skip' }; }
    },
};

function methods(sel) { return ['GET','POST','PUT','PATCH','DELETE','HEAD'].map(m=>`<option value="${m}" ${sel===m?'selected':''}>${m}</option>`).join(''); }

function selectorForm(b) {
    const byOpts = ['css','xpath','id','name','tag','class'].map(v => `<option value="${v}" ${b.by===v?'selected':''}>${v}</option>`).join('');
    return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:100px 1fr;gap:8px">
    <div class="form-group"><label class="form-label">By</label><select class="select" data-field="by">${byOpts}</select></div>
    <div class="form-group"><label class="form-label">Selector</label><input class="input mono" data-field="selector" placeholder="#login-btn" value="${x(b.selector||'')}"></div>
</div>`;
}

function conditionForm(b) { return `
<div class="form-group"><label class="form-label">Label</label><input class="input" data-field="label" value="${x(b.label||'')}"></div>
<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:end">
    <div class="form-group"><label class="form-label">Left operand</label><input class="input mono" data-field="left" placeholder="<STATUS>" value="${x(b.left||'')}"></div>
    <div class="form-group"><label class="form-label">Operator</label><select class="select" data-field="operator" style="min-width:130px">${OPERATORS.map(o=>`<option value="${o.value}" ${b.operator===o.value?'selected':''}>${o.label}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Right operand</label><input class="input mono" data-field="right" placeholder="200" value="${x(b.right||'')}"></div>
</div>`; }
function conditionParse(raw, lbl) { return { label:raw.label||lbl, left:raw.left||'', operator:raw.operator||'equals', right:raw.right||'' }; }

function kcRule(r) { return `<div class="kc-rule" style="display:grid;grid-template-columns:90px 120px 1fr 90px auto;gap:4px;align-items:center;background:#18181c;padding:6px 8px;border-radius:5px;border:1px solid #2a2a32">
    <select class="select" data-kc="source" style="font-size:11px;padding:4px 6px">${['body','status','header'].map(s=>`<option value="${s}" ${r.source===s?'selected':''}>${s}</option>`).join('')}</select>
    <select class="select" data-kc="mode" style="font-size:11px;padding:4px 6px">${['contains','equals','not_contains','not_equals','starts_with','ends_with','matches_regex','greater_than','less_than'].map(m=>`<option value="${m}" ${r.mode===m?'selected':''}>${m}</option>`).join('')}</select>
    <input class="input mono" data-kc="value" value="${x(r.value||'')}" style="font-size:11px;padding:4px 6px">
    <select class="select" data-kc="result" style="font-size:11px;padding:4px 6px">${['SUCCESS','FAIL','RETRY','BAN'].map(re=>`<option value="${re}" ${r.result===re?'selected':''}>${re}</option>`).join('')}</select>
    <button type="button" class="btn-icon" onclick="this.closest('.kc-rule').remove()" style="color:#505060;font-size:11px"><i class="fas fa-times"></i></button>
</div>`; }
function addKCRule() { const c=document.getElementById('kc-rules'); if(c) c.insertAdjacentHTML('beforeend', kcRule({source:'body',mode:'contains',value:'',result:'SUCCESS'})); }

function kvRow(k, v) { return `<div class="kv-row" style="display:grid;grid-template-columns:1fr 1fr auto;gap:4px;align-items:center"><input class="input mono" data-kv-key placeholder="Header-Name" value="${x(k||'')}" style="font-size:12px;padding:5px 8px"><input class="input mono" data-kv-val placeholder="value" value="${x(v||'')}" style="font-size:12px;padding:5px 8px"><button type="button" class="btn-icon" onclick="this.closest('.kv-row').remove()" style="color:#505060"><i class="fas fa-times"></i></button></div>`; }
function readKV(area) { const h={}; (area||document).querySelectorAll('#headers-kv .kv-row').forEach(row=>{const k=row.querySelector('[data-kv-key]')?.value?.trim();const v=row.querySelector('[data-kv-val]')?.value?.trim();if(k)h[k]=v||'';}); return h; }
function addHeaderRow() { const c=document.getElementById('headers-kv'); if(c) c.insertAdjacentHTML('beforeend', kvRow('','')); }
function addCommonHeader(key, val) { const c=document.getElementById('headers-kv'); if(!c) return; const f=[...c.querySelectorAll('[data-kv-key]')].find(el=>el.value.toLowerCase()===key.toLowerCase()); if(f){f.nextElementSibling.value=val;return;} c.insertAdjacentHTML('beforeend',kvRow(key,val)); }

function x(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function esc(s) { return x(s); }
