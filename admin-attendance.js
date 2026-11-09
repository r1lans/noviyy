/* TheStarth — Admin panel → «Посещаемость» (admins, Куратор TheStarth, partner curator).
 * Pick a group → its school-style journal (attendance-journal.js) in curator mode: any day can be marked or fixed.
 * A partner curator (ADM_SCOPE = his uid) sees only the groups that carry his curatorUid.
 *   AdmAttendance.load() — called by admin.html when the tab opens.
 */
(function () {
    'use strict';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let groups = [], picked = '', loaded = false;

    function css() {
        if (document.getElementById('aat-css')) return;
        const st = document.createElement('style'); st.id = 'aat-css';
        st.textContent = '.aat-bar{display:flex;flex-wrap:wrap;gap:.6rem;align-items:flex-end;margin-bottom:1rem}.aat-bar label{display:flex;flex-direction:column;gap:.25rem;font-size:.78rem;color:var(--ink-soft);font-weight:600}' +
            '.aat-bar select,.aat-bar input{padding:.5rem .65rem;border:1px solid var(--rule);border-radius:9px;background:var(--paper);color:var(--ink);font:inherit;font-size:16px;min-width:240px;max-width:100%}' +
            '.aat-info{font-size:.86rem;color:var(--ink-soft);margin:-.3rem 0 .9rem}';
        document.head.appendChild(st);
    }
    async function load() {
        const root = document.getElementById('attendance-root'); if (!root) return;
        css();
        if (!loaded) root.innerHTML = '<div class="empty-state">Загрузка…</div>';
        try {
            const SC = window.ADM_SCOPE || '';
            const snap = await (SC ? db.collection('groups').where('curatorUid', '==', SC) : db.collection('groups')).get();
            groups = []; snap.forEach((d) => { const g = Object.assign({ id: d.id, members: [], memberUids: [] }, d.data()); if (!g.archived) groups.push(g); });
            groups.sort((a, b) => (a.teacherName || '').localeCompare(b.teacherName || '', 'ru') || (a.name || '').localeCompare(b.name || '', 'ru'));
            loaded = true;
        } catch (e) { root.innerHTML = '<div class="empty-state">Не удалось загрузить группы: ' + esc(e.message) + '</div>'; return; }
        if (!groups.length) { root.innerHTML = '<div class="empty-state">Групп пока нет.</div>'; return; }
        if (!picked || !groups.some((g) => g.id === picked)) { try { picked = sessionStorage.getItem('aatGroup') || ''; } catch (e) {} }
        if (!groups.some((g) => g.id === picked)) picked = groups[0].id;
        root.innerHTML = '<div class="aat-bar"><label>Поиск<input id="aatQ" placeholder="учитель или группа" autocomplete="off"></label>' +
            '<label>Группа<select id="aatSel"></select></label></div><div class="aat-info" id="aatInfo"></div><div id="aatJ"></div>';
        const sel = root.querySelector('#aatSel'), q = root.querySelector('#aatQ');
        const fill = () => {
            const t = q.value.trim().toLowerCase();
            const list = groups.filter((g) => !t || ((g.name || '') + ' ' + (g.teacherName || '') + ' ' + (g.subject || '')).toLowerCase().indexOf(t) !== -1);
            sel.innerHTML = list.map((g) => '<option value="' + esc(g.id) + '"' + (g.id === picked ? ' selected' : '') + '>' + esc((g.teacherName || '—') + ' · ' + (g.name || 'Группа')) + ' (' + (g.members || []).length + ')</option>').join('') || '<option value="">Ничего не найдено</option>';
        };
        fill();
        q.oninput = () => { fill(); if (sel.value && sel.value !== picked) { picked = sel.value; show(); } };
        sel.onchange = () => { picked = sel.value; try { sessionStorage.setItem('aatGroup', picked); } catch (e) {} show(); };
        show();
    }
    function show() {
        const g = groups.find((x) => x.id === picked), box = document.getElementById('aatJ'), info = document.getElementById('aatInfo');
        if (!g || !box) return;
        info.textContent = 'Преподаватель: ' + (g.teacherName || '—') + (g.scheduleText ? ' · ' + g.scheduleText : '') + ' · учеников: ' + (g.members || []).length +
            '. Вы куратор — можно отметить или исправить любой день. Учитель сам отмечает только сегодняшний урок.';
        if (!window.StarthAttJournal) { box.innerHTML = '<div class="empty-state">Обновите страницу.</div>'; return; }
        StarthAttJournal.mount(box, { group: g, mode: 'curator' });
    }
    window.AdmAttendance = { load };
})();
