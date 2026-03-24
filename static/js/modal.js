const NB = {

    _overlay: null,

    _getOverlay() {
        if (!this._overlay) {
            this._overlay = document.createElement('div');
            this._overlay.className = 'nb-overlay';
            document.body.appendChild(this._overlay);
        }
        return this._overlay;
    },

    _show(html) {
        const ov = this._getOverlay();
        ov.innerHTML = html;
        ov.classList.add('open');
        return ov.querySelector('.nb-modal');
    },

    close() {
        const ov = this._getOverlay();
        ov.classList.remove('open');
        ov.innerHTML = '';
    },

    alert(msg, title) {
        return new Promise(resolve => {
            const m = this._show(`<div class="nb-modal" style="max-width:380px">
                <div class="nb-modal-head">${title || 'Info'}</div>
                <div class="nb-modal-body"><p style="color:var(--text-dim)">${esc(msg)}</p></div>
                <div class="nb-modal-foot"><button class="btn btn-primary btn-sm" id="nb-ok">OK</button></div>
            </div>`);
            m.querySelector('#nb-ok').onclick = () => { this.close(); resolve(); };
        });
    },

    confirm(msg, detail) {
        return new Promise(resolve => {
            const m = this._show(`<div class="nb-modal" style="max-width:400px">
                <div class="nb-modal-head">Confirm</div>
                <div class="nb-modal-body">
                    <p style="color:var(--text)">${esc(msg)}</p>
                    ${detail ? `<p style="color:var(--text-muted);font-size:12px;margin-top:6px">${esc(detail)}</p>` : ''}
                </div>
                <div class="nb-modal-foot">
                    <button class="btn btn-ghost btn-sm" id="nb-no">Cancel</button>
                    <button class="btn btn-danger btn-sm" id="nb-yes">Confirm</button>
                </div>
            </div>`);
            m.querySelector('#nb-no').onclick = () => { this.close(); resolve(false); };
            m.querySelector('#nb-yes').onclick = () => { this.close(); resolve(true); };
        });
    },

    toast(msg, color) {
        const t = document.createElement('div');
        t.className = 'nb-toast';
        t.textContent = msg;
        if (color) t.style.background = color;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 200); }, 2000);
    },
};

function openNewBlockModal(onAdd) {
    const cats = Object.entries(BLOCK_CATEGORIES);
    const allItems = [];
    const catHtml = cats.map(([catId, cat]) => {
        const items = cat.types.map(type => {
            const def = BLOCK_REGISTRY[type];
            if (!def) return '';
            allItems.push({ type, label: def.label, desc: def.desc || '', catId });
            return `<div class="nbm-item" data-type="${type}" data-search="${type} ${(def.label||'').toLowerCase()} ${(def.desc||'').toLowerCase()} ${catId}">
                <span class="badge block-type-badge ${def.colorClass}" style="font-size:9px;min-width:70px;justify-content:center">${type}</span>
                <span class="nbm-item-label">${esc(def.label)}</span>
                <span class="nbm-item-desc">${esc(def.desc || '')}</span>
            </div>`;
        }).join('');
        return `<div class="nbm-cat" data-cat="${catId}">
            <div class="nbm-cat-label"><i class="fas ${cat.icon}"></i> ${cat.label}</div>
            ${items}
        </div>`;
    }).join('');

    const m = NB._show(`<div class="nb-modal" style="max-width:520px">
        <div class="nb-modal-head">
            Add Block
            <button class="btn-icon" onclick="NB.close()" style="margin-left:auto"><i class="fas fa-times"></i></button>
        </div>
        <div style="padding:8px 18px;border-bottom:1px solid var(--border)">
            <input id="nbm-search" class="input" placeholder="Search blocks..." style="font-size:13px" autocomplete="off">
        </div>
        <div class="nb-modal-body" id="nbm-body" style="padding:0;max-height:55vh;overflow-y:auto">
            ${catHtml}
        </div>
    </div>`);

    const searchInput = m.querySelector('#nbm-search');
    searchInput.focus();

    searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        const items = m.querySelectorAll('.nbm-item');
        const cats = m.querySelectorAll('.nbm-cat');

        if (!q) {
            items.forEach(el => el.style.display = '');
            cats.forEach(el => el.style.display = '');
            return;
        }

        items.forEach(el => {
            const match = el.dataset.search.includes(q);
            el.style.display = match ? '' : 'none';
        });

        cats.forEach(el => {
            const visible = [...el.querySelectorAll('.nbm-item')].some(i => i.style.display !== 'none');
            el.style.display = visible ? '' : 'none';
        });
    });

    searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const first = m.querySelector('.nbm-item:not([style*="display: none"])');
            if (first) { NB.close(); onAdd(first.dataset.type); }
        }
        if (e.key === 'Escape') NB.close();
    });

    m.querySelectorAll('.nbm-item').forEach(el => {
        el.onclick = () => {
            NB.close();
            onAdd(el.dataset.type);
        };
    });
}
