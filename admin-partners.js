/* TheStarth — Admin panel -> «Партнёры»: outside schools / teachers who pay to run their lessons on our platform.
 *
 * PARTNER ORGANISATIONS (button «Создать партнёра»): partners/{id}
 *   { name, curatorUid, curatorNick, curatorName, teachers:[{uid,nick,name,prevRole}], teacherUids:[], until, status, note, createdAt }
 *   The curator gets users.role 'partner_curator' (he also teaches, and has a limited admin panel with only his people),
 *   every teacher gets users.role 'partner' + curatorUid = the curator (no TheStarth pay panel, no Writing check).
 *   partnerUntil of all of them follows the organisation's «оплачено до».
 *
 * SINGLE PARTNER TEACHERS (applications from the cabinet) — below, as before:
 *
 * users/{uid} fields:
 *   role: 'partner'                     — set here on approval (works like a teacher: own groups, video lessons, board,
 *                                         attendance, grades; no TheStarth pay, Writing check or students' tests)
 *   partnerStatus: 'pending' | 'active' | 'rejected' | 'blocked'   ('pending' is set by the teacher's application)
 *   partnerUntil: ms                    — paid until; after that lessons and new groups stop (Firestore rules)
 *   partnerApply: { about, phone, at }  — the application text
 *   partnerNote: string                 — admin's note (price, how they paid)
 * Lessons and groups are counted from groups / lessonSessions (teacherUid == partner uid).
 */
(function () {
    'use strict';
    const DAY = 86400000, TRIAL_DAYS = 14;
    let TRIAL = TRIAL_DAYS;
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtD = (ms) => (ms ? new Date(ms).toLocaleDateString('ru-RU') : '—');
    const nameOf = (u) => [u.name, u.surname].filter(Boolean).join(' ') || (u.nickname ? '@' + u.nickname : 'Без имени');
    let list = [], filter = 'all', orgs = [], formOpen = false;

    function css() {
        if (document.getElementById('ptn-css')) return;
        const st = document.createElement('style'); st.id = 'ptn-css';
        st.textContent = '.ptn-tabs{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem}.ptn-tabs button{border:1px solid var(--rule);background:var(--paper);color:var(--ink);border-radius:999px;padding:.4rem .9rem;font:inherit;font-size:.88rem;cursor:pointer}' +
            '.ptn-tabs button.on{background:var(--accent);border-color:var(--accent);color:var(--on-accent,#fff)}.ptn-tabs b{margin-left:.3rem}' +
            '.ptn-card{border:1px solid var(--rule);border-radius:14px;padding:1rem;margin-bottom:.8rem;background:var(--paper)}.ptn-top{display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap;align-items:flex-start}' +
            '.ptn-card h3{margin:0;font-size:1.05rem}.ptn-meta{color:var(--ink-soft);font-size:.86rem;margin-top:.2rem;overflow-wrap:break-word}.ptn-chip{display:inline-block;border-radius:999px;padding:.15rem .6rem;font-size:.78rem;font-weight:700}' +
            '.ptn-chip.pending{background:#fff3d6;color:#8a5a00}.ptn-chip.active{background:#e3f6e8;color:#1e7a3a}.ptn-chip.expired,.ptn-chip.blocked{background:#fde8e6;color:#a1271b}.ptn-chip.rejected{background:var(--paper-alt);color:var(--ink-soft)}' +
            '.ptn-about{margin:.6rem 0 0;padding:.6rem .8rem;background:var(--paper-alt);border-radius:10px;font-size:.9rem;white-space:pre-wrap;overflow-wrap:break-word}' +
            '.ptn-stats{display:flex;gap:1rem;flex-wrap:wrap;margin-top:.6rem;font-size:.88rem}.ptn-stats span b{font-size:1.05rem}' +
            '.ptn-acts{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.7rem}.ptn-note{width:100%;margin-top:.5rem;padding:.45rem .6rem;border:1px solid var(--rule);border-radius:8px;background:var(--paper);color:var(--ink);font:inherit;font-size:16px;box-sizing:border-box}' +
            '.ptn-help{color:var(--ink-soft);font-size:.9rem;margin:0 0 1rem}.ptn-h{margin:1.6rem 0 .5rem;font-size:1.1rem}' +
            '.ptn-form{border:1px solid var(--accent);border-radius:14px;padding:1rem;margin-bottom:1rem;background:var(--paper)}.ptn-form label{display:flex;flex-direction:column;gap:.3rem;font-size:.82rem;color:var(--ink-soft);margin-bottom:.7rem}' +
            '.ptn-form input,.ptn-form textarea{padding:.55rem .65rem;border:1px solid var(--rule);border-radius:8px;background:var(--paper);color:var(--ink);font:inherit;font-size:16px}.ptn-form textarea{min-height:84px;resize:vertical}' +
            '.ptn-form small{color:var(--ink-soft)}.ptn-err{color:#c0392b;font-size:.88rem;margin-top:.4rem;white-space:pre-wrap}.ptn-ok{color:#1e7a3a;font-size:.88rem;margin-top:.4rem}' +
            '.ptn-people{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.6rem}.ptn-person{display:inline-flex;align-items:center;gap:.35rem;border:1px solid var(--rule);border-radius:999px;padding:.2rem .3rem .2rem .7rem;font-size:.85rem;background:var(--paper-alt)}' +
            '.ptn-person.cur{border-color:var(--accent);font-weight:700}.ptn-person button{border:0;background:transparent;color:var(--ink-soft);cursor:pointer;font-size:1rem;line-height:1;padding:0 .25rem}.ptn-person button:hover{color:#c0392b}' +
            '.ptn-add{display:flex;gap:.4rem;margin-top:.6rem;flex-wrap:wrap}.ptn-add input{flex:1 1 180px;padding:.45rem .6rem;border:1px solid var(--rule);border-radius:8px;background:var(--paper);color:var(--ink);font:inherit;font-size:16px}' +
            '.ptn-tf{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.6rem;margin:.8rem 0}.ptn-tf label{display:flex;flex-direction:column;gap:.25rem;font-size:.8rem;color:var(--ink-soft)}.ptn-tf input{padding:.5rem .6rem;border:1px solid var(--rule);border-radius:8px;background:var(--paper);color:var(--ink);font:inherit;font-size:16px}.ptn-tfmsg{font-size:.85rem;color:var(--ink-soft)}';
        document.head.appendChild(st);
    }
    function state(u) {
        if (u.role === 'partner') return (u.partnerUntil || 0) > Date.now() ? 'active' : (u.partnerStatus === 'blocked' ? 'blocked' : 'expired');
        return u.partnerStatus || '';
    }
    const LABEL = { pending: 'Заявка', active: 'Активен', expired: 'Оплата закончилась', blocked: 'Заблокирован', rejected: 'Отклонён' };

    async function load() {
        const root = document.getElementById('partners-root'); if (!root) return;
        css(); root.innerHTML = '<div class="empty-state">Загрузка…</div>';
        try {
            try { const t = await db.collection('settings').doc('partners').get(); tariff = t.exists ? t.data() : {}; TRIAL = tariff.trialDays || TRIAL_DAYS; } catch (e) {}
            const [a, b] = await Promise.all([
                db.collection('users').where('role', '==', 'partner').get(),
                db.collection('users').where('partnerStatus', 'in', ['pending', 'rejected', 'blocked']).get(),
            ]);
            const map = {};
            [a, b].forEach((s) => s.forEach((d) => { map[d.id] = Object.assign({ id: d.id }, d.data()); }));
            list = Object.values(map).filter((u) => !u.partnerId);      // members of an organisation are shown in its card
            orgs = [];
            try { const ps = await db.collection('partners').get(); ps.forEach((d) => orgs.push(Object.assign({ id: d.id }, d.data()))); } catch (e) { console.warn('partners', e); }
            orgs.sort((x, y) => (x.name || '').localeCompare(y.name || '', 'ru'));
            // groups and lessons of the last 30 days, per partner
            const since = Date.now() - 30 * DAY;
            await Promise.all(list.filter((u) => u.role === 'partner').map(async (u) => {
                try {
                    const [g, l] = await Promise.all([
                        db.collection('groups').where('teacherUid', '==', u.id).get(),
                        db.collection('lessonSessions').where('teacherUid', '==', u.id).get(),
                    ]);
                    let groups = 0, students = new Set(); g.forEach((d) => { const x = d.data(); if (!x.archived) { groups++; (x.memberUids || []).forEach((m) => students.add(m)); } });
                    let lessons = 0, minutes = 0; l.forEach((d) => { const x = d.data(); if ((x.startedAt || 0) >= since) { lessons++; minutes += Math.round((x.durationMs || 0) / 60000); } });
                    u._st = { groups, students: students.size, lessons, minutes };
                } catch (e) { u._st = null; }
            }));
        } catch (e) { root.innerHTML = '<div class="empty-state">Не удалось загрузить: ' + esc(e.message) + '</div>'; return; }
        render();
    }

    function render() {
        const root = document.getElementById('partners-root'); if (!root) return;
        const order = { pending: 0, expired: 1, active: 2, blocked: 3, rejected: 4 };
        const cnt = (k) => list.filter((u) => k === 'all' ? state(u) !== 'rejected' : state(u) === k).length;
        const shown = list.filter((u) => filter === 'all' ? state(u) !== 'rejected' : state(u) === filter)
            .sort((x, y) => (order[state(x)] - order[state(y)]) || ((x.partnerUntil || 0) - (y.partnerUntil || 0)));
        root.innerHTML = orgsHtml() + tariffHtml() +
            '<h3 class="ptn-h">Отдельные учителя-партнёры</h3><p class="ptn-help">Партнёр видит только свои группы и уроки. Заявку учитель отправляет в личном кабинете → «Профиль» → «Подать заявку» (или со страницы «Вакансии»). Пробный период — ' + TRIAL + ' дн.</p>' +
            '<div class="ptn-tabs">' + [['all', 'Все'], ['pending', 'Заявки'], ['active', 'Активные'], ['expired', 'Не оплачено'], ['blocked', 'Заблокированы'], ['rejected', 'Отклонённые']]
                .map(([k, t]) => '<button type="button" data-f="' + k + '" class="' + (filter === k ? 'on' : '') + '">' + t + '<b>' + cnt(k) + '</b></button>').join('') + '</div>' +
            (shown.length ? shown.map(card).join('') : '<div class="empty-state">Пока никого нет.</div>');
        root.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => { filter = b.getAttribute('data-f'); render(); }; });
        const ts = root.querySelector('#ptnTariffSave'); if (ts) ts.onclick = saveTariff;
        root.querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => act(b.getAttribute('data-id'), b.getAttribute('data-act')); });
        root.querySelectorAll('.ptn-note').forEach((i) => { i.onchange = () => save(i.getAttribute('data-id'), { partnerNote: i.value.slice(0, 300) }, true); });
        bindOrgs(root);
    }
    // public terms on thestarth.com/partners (settings/partners)
    let tariff = {};
    function tariffHtml() {
        const v = (k, d) => esc(tariff[k] != null ? tariff[k] : d);
        return '<details class="ptn-card" style="margin-bottom:1rem"><summary style="cursor:pointer;font-weight:700">Тариф на странице «Партнёрам» (thestarth.com/partners)</summary>' +
            '<div class="ptn-tf"><label>Цена<input id="tfPrice" maxlength="40" value="' + v('price', '') + '" placeholder="например: 99 000 сум"></label>' +
            '<label>За период<input id="tfPer" maxlength="30" value="' + v('per', 'в месяц') + '"></label>' +
            '<label>Бесплатных дней<input id="tfTrial" type="number" min="0" max="90" value="' + v('trialDays', 14) + '"></label>' +
            '<label>Человек на уроке<input id="tfMax" type="number" min="2" max="50" value="' + v('maxPeople', 6) + '"></label>' +
            '<label>Контакт в Telegram<input id="tfContact" maxlength="40" value="' + v('contact', '@TheStarth') + '"></label></div>' +
            '<button type="button" class="btn-small primary" id="ptnTariffSave">Сохранить тариф</button> <span class="ptn-tfmsg" id="tfMsg"></span></details>';
    }
    async function saveTariff() {
        const g = (id) => document.getElementById(id).value.trim();
        const data = { price: g('tfPrice').slice(0, 40), per: g('tfPer').slice(0, 30), trialDays: Math.max(0, Math.min(90, +g('tfTrial') || 0)), maxPeople: Math.max(2, Math.min(50, +g('tfMax') || 6)), contact: g('tfContact').slice(0, 40), updatedAt: Date.now() };
        try { await db.collection('settings').doc('partners').set(data); tariff = data; TRIAL = data.trialDays || TRIAL_DAYS; document.getElementById('tfMsg').textContent = 'Сохранено'; }
        catch (e) { document.getElementById('tfMsg').textContent = 'Ошибка: ' + e.message; }
    }
    function card(u) {
        const st = state(u), ap = u.partnerApply || {}, s = u._st;
        const btn = (a, t, cls) => '<button type="button" class="btn-small ' + (cls || '') + '" data-act="' + a + '" data-id="' + esc(u.id) + '">' + t + '</button>';
        let acts = '';
        if (st === 'pending' || st === 'rejected') acts = btn('approve', 'Одобрить · ' + TRIAL + ' дн. бесплатно', 'primary') + (st === 'pending' ? btn('reject', 'Отклонить') : '');
        else acts = btn('m1', '+1 месяц', 'primary') + btn('m3', '+3 месяца') + btn('d7', '+7 дней') +
            (st === 'blocked' ? '' : btn('block', 'Заблокировать', 'danger')) + btn('demote', 'Сделать учеником');
        return '<div class="ptn-card"><div class="ptn-top"><div><h3>' + esc(nameOf(u)) + ' <span class="ptn-chip ' + st + '">' + esc(LABEL[st] || st) + '</span></h3>' +
            '<div class="ptn-meta">@' + esc(u.nickname || '—') + ' · ' + esc(ap.phone || u.phone || 'нет телефона') + (u.telegram ? ' · Telegram @' + esc(u.telegram) : '') + ' · ' + esc(u.email || '') + '</div>' +
            (u.role === 'partner' ? '<div class="ptn-meta">Оплачено до <b>' + esc(fmtD(u.partnerUntil)) + '</b></div>' : (ap.at ? '<div class="ptn-meta">Заявка от ' + esc(fmtD(ap.at)) + '</div>' : '')) +
            '</div></div>' +
            (ap.about ? '<div class="ptn-about">' + esc(ap.about) + '</div>' : '') +
            (s ? '<div class="ptn-stats"><span>Групп <b>' + s.groups + '</b></span><span>Учеников <b>' + s.students + '</b></span><span>Уроков за 30 дней <b>' + s.lessons + '</b></span><span>Минут <b>' + s.minutes + '</b></span></div>' : '') +
            '<input class="ptn-note" data-id="' + esc(u.id) + '" maxlength="300" placeholder="Заметка: цена, как оплатил…" value="' + esc(u.partnerNote || '') + '">' +
            '<div class="ptn-acts">' + acts + '</div></div>';
    }
    async function save(id, data, quiet) {
        try {
            await db.collection('users').doc(id).update(data);
            const u = list.find((x) => x.id === id); if (u) Object.assign(u, data);
            if (data.role) db.collection('directory').doc(id).set({ role: ['teacher', 'partner', 'curator', 'partner_curator'].indexOf(data.role) !== -1 ? 'teacher' : 'student' }, { merge: true }).catch(() => {});
            if (!quiet) render();
        } catch (e) { alert('Ошибка: ' + e.message); }
    }
    async function act(id, a) {
        const u = list.find((x) => x.id === id); if (!u) return;
        const from = Math.max(Date.now(), u.partnerUntil || 0);
        if (a === 'approve') return save(id, { role: 'partner', partnerStatus: 'active', partnerUntil: Date.now() + TRIAL * DAY, partnerSince: Date.now() });
        if (a === 'reject') { if (await StarthUI.confirm('Отклонить заявку ' + nameOf(u) + '?')) save(id, { partnerStatus: 'rejected' }); return; }
        if (a === 'm1' || a === 'm3' || a === 'd7') {
            const until = a === 'd7' ? from + 7 * DAY : (() => { const d = new Date(from); d.setMonth(d.getMonth() + (a === 'm3' ? 3 : 1)); return d.getTime(); })();
            return save(id, { role: 'partner', partnerStatus: 'active', partnerUntil: until });
        }
        if (a === 'block') { if (await StarthUI.confirm('Заблокировать ' + nameOf(u) + '? Уроки и группы перестанут работать сразу.')) save(id, { partnerStatus: 'blocked', partnerUntil: 0 }); return; }
        if (a === 'demote') { if (await StarthUI.confirm('Сделать ' + nameOf(u) + ' обычным учеником? Его группы останутся, но вести уроки он не сможет.')) save(id, { role: 'student', partnerStatus: '', partnerUntil: 0 }); return; }
    }

    // ───────────────────────── partner organisations ─────────────────────────
    const cleanNick = (s) => String(s || '').trim().replace(/^@+/, '').toLowerCase();
    const nickList = (s) => String(s || '').split(/[\s,;]+/).map(cleanNick).filter(Boolean).filter((n, i, a) => a.indexOf(n) === i);
    const fullAdmin = () => !window.ADM_ROLE || window.ADM_ROLE === 'admin';
    function orgState(o) { return o.status === 'blocked' ? 'blocked' : (o.until || 0) > Date.now() ? 'active' : 'expired'; }
    function orgsHtml() {
        const form = !formOpen ? '' : '<form class="ptn-form" id="ptnOrgForm"><h3 style="margin:0 0 .8rem">Новый партнёр</h3>' +
            '<label>Название партнёра<input id="poName" maxlength="80" required placeholder="например: Учебный центр «Ilm»"></label>' +
            '<label>Никнейм куратора<input id="poCur" maxlength="40" required placeholder="@nickname" autocomplete="off"><small>Куратор тоже ведёт уроки и получает свою админ-панель — только со своими учителями.</small></label>' +
            '<label>Никнеймы учителей партнёра<textarea id="poTeachers" placeholder="@teacher1, @teacher2 — через запятую или с новой строки"></textarea><small>У учителей-партнёров нет раздела «Зарплата» — им платит сам партнёр.</small></label>' +
            '<label>Бесплатных дней на старт<input id="poDays" type="number" min="0" max="365" value="' + TRIAL + '"></label>' +
            '<button type="submit" class="btn-small primary" id="poSave">Создать партнёра</button> <button type="button" class="btn-small" id="poCancel">Отмена</button>' +
            '<div class="ptn-err" id="poErr"></div></form>';
        const cards = orgs.length ? orgs.map(orgCard).join('') : (formOpen ? '' : '<div class="empty-state">Партнёров-организаций пока нет. Нажмите «Создать партнёра».</div>');
        return '<div class="ptn-top" style="align-items:center;margin-bottom:.8rem"><h3 class="ptn-h" style="margin:0">Партнёры-организации</h3>' +
            (fullAdmin() && !formOpen ? '<button type="button" class="btn-small primary" id="ptnNewOrg">+ Создать партнёра</button>' : '') + '</div>' +
            (fullAdmin() ? '' : '<p class="ptn-help">Создавать партнёров и менять кураторов может только администратор.</p>') + form + cards;
    }
    function orgCard(o) {
        const st = orgState(o), ts = o.teachers || [];
        const b = (a, t, cls) => fullAdmin() ? '<button type="button" class="btn-small ' + (cls || '') + '" data-oact="' + a + '" data-oid="' + esc(o.id) + '">' + t + '</button>' : '';
        return '<div class="ptn-card"><div class="ptn-top"><div><h3>' + esc(o.name || 'Без названия') + ' <span class="ptn-chip ' + st + '">' + esc(LABEL[st]) + '</span></h3>' +
            '<div class="ptn-meta">Оплачено до <b>' + esc(fmtD(o.until)) + '</b> · учителей: ' + ts.length + '</div></div></div>' +
            '<div class="ptn-people"><span class="ptn-person cur" title="Куратор">Куратор: ' + esc(o.curatorName || '') + ' @' + esc(o.curatorNick || '—') + '</span>' +
            ts.map((t) => '<span class="ptn-person">' + esc(t.name || '') + ' @' + esc(t.nick) + (fullAdmin() ? '<button type="button" title="Убрать из партнёра" data-orm="' + esc(t.uid) + '" data-oid="' + esc(o.id) + '">×</button>' : '') + '</span>').join('') + '</div>' +
            (fullAdmin() ? '<div class="ptn-add"><input data-oaddin="' + esc(o.id) + '" placeholder="@никнейм учителя (можно несколько через запятую)" autocomplete="off">' + b('add', 'Добавить учителя') + '</div>' +
                '<div class="ptn-add"><input data-ocurin="' + esc(o.id) + '" placeholder="@никнейм нового куратора" autocomplete="off">' + b('cur', 'Сменить куратора') + '</div>' : '') +
            '<input class="ptn-note" data-onote="' + esc(o.id) + '" maxlength="300" placeholder="Заметка: цена, как оплатил…" value="' + esc(o.note || '') + '"' + (fullAdmin() ? '' : ' disabled') + '>' +
            '<div class="ptn-acts">' + b('m1', '+1 месяц', 'primary') + b('m3', '+3 месяца') + b('d7', '+7 дней') + (st === 'blocked' ? b('unblock', 'Разблокировать') : b('block', 'Заблокировать', 'danger')) + b('rename', 'Переименовать') + b('del', 'Удалить партнёра', 'danger') + '</div>' +
            '<div class="ptn-err" data-oerr="' + esc(o.id) + '"></div></div>';
    }
    function bindOrgs(root) {
        const nb = root.querySelector('#ptnNewOrg'); if (nb) nb.onclick = () => { formOpen = true; render(); const i = document.getElementById('poName'); if (i) i.focus(); };
        const f = root.querySelector('#ptnOrgForm');
        if (f) { f.onsubmit = (e) => { e.preventDefault(); createOrg(); }; root.querySelector('#poCancel').onclick = () => { formOpen = false; render(); }; }
        root.querySelectorAll('[data-oact]').forEach((x) => { x.onclick = () => orgAct(x.getAttribute('data-oid'), x.getAttribute('data-oact'), x); });
        root.querySelectorAll('[data-orm]').forEach((x) => { x.onclick = () => removeTeacher(x.getAttribute('data-oid'), x.getAttribute('data-orm')); });
        root.querySelectorAll('[data-onote]').forEach((i) => { i.onchange = () => db.collection('partners').doc(i.getAttribute('data-onote')).update({ note: i.value.slice(0, 300) }).catch((e) => alert('Ошибка: ' + e.message)); });
    }
    // nickname -> { uid, nick, name, role, partnerId, curatorUid }
    async function resolveNick(nick) {
        const nd = await db.collection('nicknames').doc(nick).get();
        if (!nd.exists || !nd.data().uid) throw new Error('@' + nick + ' — такого никнейма нет');
        const uid = nd.data().uid, ud = await db.collection('users').doc(uid).get();
        if (!ud.exists) throw new Error('@' + nick + ' — аккаунт не найден');
        const u = ud.data() || {};
        return { uid, nick, name: [u.name, u.surname].filter(Boolean).join(' ') || '', role: u.role || 'student', partnerId: u.partnerId || '', curatorUid: u.curatorUid || '' };
    }
    async function resolveAll(nicks) {
        const out = [], errs = [];
        for (const n of nicks) { try { out.push(await resolveNick(n)); } catch (e) { errs.push(e.message); } }
        return { out, errs };
    }
    // the teacher's groups, attendance, grades and lessons get the curator, so he sees the whole history
    async function retag(uid, curatorUid) {
        const snaps = await Promise.all(['groups', 'attendance', 'grades', 'lessonSessions'].map((n) => db.collection(n).where('teacherUid', '==', uid).get().catch(() => null)));
        const refs = []; snaps.forEach((sn) => { if (sn) sn.forEach((d) => { if ((d.data().curatorUid || '') !== curatorUid) refs.push(d.ref); }); });
        for (let i = 0; i < refs.length; i += 400) { const b = db.batch(); refs.slice(i, i + 400).forEach((r) => b.update(r, { curatorUid })); await b.commit(); }
        return refs.length;
    }
    async function setMember(uid, patch, dirRole) {
        await db.collection('users').doc(uid).update(patch);
        db.collection('directory').doc(uid).set({ role: dirRole }, { merge: true }).catch(() => {});
    }
    const busyCheck = (p) => (p.partnerId ? '@' + p.nick + ' уже в другом партнёре' : (p.role === 'curator' ? '@' + p.nick + ' — куратор TheStarth, его нельзя сделать партнёром' : ''));
    async function createOrg() {
        const err = document.getElementById('poErr'), btn = document.getElementById('poSave');
        const name = document.getElementById('poName').value.trim().slice(0, 80), curNick = cleanNick(document.getElementById('poCur').value);
        const days = Math.max(0, Math.min(365, +document.getElementById('poDays').value || 0));
        let tNicks = nickList(document.getElementById('poTeachers').value).filter((n) => n !== curNick);
        err.className = 'ptn-err'; err.textContent = '';
        if (!name || !curNick) { err.textContent = 'Укажите название и никнейм куратора.'; return; }
        btn.disabled = true; err.className = 'ptn-ok'; err.textContent = 'Проверяю никнеймы…';
        try {
            const cur = await resolveNick(curNick).catch((e) => { throw e; });
            const { out: teachers, errs } = await resolveAll(tNicks);
            const busy = [cur].concat(teachers).map(busyCheck).filter(Boolean);
            if (errs.length || busy.length) { err.className = 'ptn-err'; err.textContent = errs.concat(busy).join('\n'); btn.disabled = false; return; }
            if (cur.uid === auth.currentUser.uid) { err.className = 'ptn-err'; err.textContent = 'Нельзя сделать куратором партнёра самого себя.'; btn.disabled = false; return; }
            const until = Date.now() + days * DAY, ref = db.collection('partners').doc();
            const tlist = teachers.map((t) => ({ uid: t.uid, nick: t.nick, name: t.name, prevRole: t.role === 'partner' ? 'student' : t.role }));
            await ref.set({ name, curatorUid: cur.uid, curatorNick: cur.nick, curatorName: cur.name, curatorPrevRole: cur.role, teachers: tlist, teacherUids: tlist.map((t) => t.uid),
                until, status: 'active', note: '', createdAt: Date.now(), createdBy: auth.currentUser.uid });
            err.textContent = 'Назначаю куратора и учителей…';
            // the curator is also a teacher: his own groups carry curatorUid = himself, so he sees them in his panel
            await setMember(cur.uid, { role: 'partner_curator', partnerId: ref.id, partnerUntil: until, partnerStatus: 'active', curatorUid: cur.uid, roleChangedAt: Date.now() }, 'teacher');
            await retag(cur.uid, cur.uid);
            for (const t of teachers) {
                await setMember(t.uid, { role: 'partner', partnerId: ref.id, partnerUntil: until, partnerStatus: 'active', curatorUid: cur.uid, partnerSince: Date.now(), roleChangedAt: Date.now() }, 'teacher');
                await retag(t.uid, cur.uid);
            }
            formOpen = false;
            if (window.StarthUI && StarthUI.toast) StarthUI.toast('Партнёр «' + name + '» создан.', 'ok');
            load();
        } catch (e) { err.className = 'ptn-err'; err.textContent = 'Ошибка: ' + e.message; btn.disabled = false; }
    }
    async function syncUntil(o, until, status) {
        const uids = [o.curatorUid].concat(o.teacherUids || []);
        await db.collection('partners').doc(o.id).update({ until, status });
        for (const uid of uids) await db.collection('users').doc(uid).update({ partnerUntil: status === 'blocked' ? 0 : until, partnerStatus: status }).catch((e) => console.warn(uid, e));
    }
    async function orgAct(id, a, btn) {
        const o = orgs.find((x) => x.id === id); if (!o) return;
        const errEl = document.querySelector('[data-oerr="' + id + '"]'); const say = (t, ok) => { if (errEl) { errEl.className = ok ? 'ptn-ok' : 'ptn-err'; errEl.textContent = t; } };
        const from = Math.max(Date.now(), o.until || 0);
        try {
            if (a === 'm1' || a === 'm3' || a === 'd7') {
                const until = a === 'd7' ? from + 7 * DAY : (() => { const d = new Date(from); d.setMonth(d.getMonth() + (a === 'm3' ? 3 : 1)); return d.getTime(); })();
                btn.disabled = true; await syncUntil(o, until, 'active'); return load();
            }
            if (a === 'block') { if (!await StarthUI.confirm('Заблокировать «' + o.name + '»? Уроки и группы его учителей перестанут работать сразу.')) return; btn.disabled = true; await syncUntil(o, o.until || 0, 'blocked'); return load(); }
            if (a === 'unblock') { btn.disabled = true; await syncUntil(o, o.until || 0, 'active'); return load(); }
            if (a === 'rename') { const n = window.prompt('Новое название партнёра', o.name || ''); if (!n || !n.trim()) return; await db.collection('partners').doc(id).update({ name: n.trim().slice(0, 80) }); return load(); }
            if (a === 'add') {
                const inp = document.querySelector('[data-oaddin="' + id + '"]'); const nicks = nickList(inp && inp.value).filter((n) => n !== o.curatorNick && !(o.teachers || []).some((t) => t.nick === n));
                if (!nicks.length) return say('Введите никнейм учителя.');
                btn.disabled = true; say('Проверяю…', true);
                const { out, errs } = await resolveAll(nicks); const busy = out.map(busyCheck).filter(Boolean);
                if (errs.length || busy.length) { btn.disabled = false; return say(errs.concat(busy).join('\n')); }
                const add = out.map((t) => ({ uid: t.uid, nick: t.nick, name: t.name, prevRole: t.role === 'partner' ? 'student' : t.role }));
                const teachers = (o.teachers || []).concat(add);
                await db.collection('partners').doc(id).update({ teachers, teacherUids: teachers.map((t) => t.uid) });
                const st = orgState(o);
                for (const t of add) { await setMember(t.uid, { role: 'partner', partnerId: id, partnerUntil: st === 'blocked' ? 0 : (o.until || 0), partnerStatus: st === 'blocked' ? 'blocked' : 'active', curatorUid: o.curatorUid, partnerSince: Date.now(), roleChangedAt: Date.now() }, 'teacher'); await retag(t.uid, o.curatorUid); }
                return load();
            }
            if (a === 'cur') {
                const inp = document.querySelector('[data-ocurin="' + id + '"]'); const nick = cleanNick(inp && inp.value); if (!nick) return say('Введите никнейм нового куратора.');
                btn.disabled = true; const nc = await resolveNick(nick);
                const inOrg = (o.teacherUids || []).indexOf(nc.uid) !== -1;
                if (!inOrg && busyCheck(nc)) { btn.disabled = false; return say(busyCheck(nc)); }
                if (!await StarthUI.confirm('Сделать @' + nick + ' куратором «' + o.name + '»? Прежний куратор @' + o.curatorNick + ' станет обычным учителем этого партнёра.')) { btn.disabled = false; return; }
                const old = { uid: o.curatorUid, nick: o.curatorNick, name: o.curatorName, prevRole: o.curatorPrevRole || 'student' };
                const teachers = (o.teachers || []).filter((t) => t.uid !== nc.uid).concat([old]);
                await db.collection('partners').doc(id).update({ curatorUid: nc.uid, curatorNick: nc.nick, curatorName: nc.name, curatorPrevRole: inOrg ? ((o.teachers || []).find((t) => t.uid === nc.uid) || {}).prevRole || 'student' : nc.role, teachers, teacherUids: teachers.map((t) => t.uid) });
                const pu = orgState(o) === 'blocked' ? 0 : (o.until || 0);
                await setMember(nc.uid, { role: 'partner_curator', partnerId: id, partnerUntil: pu, partnerStatus: 'active', curatorUid: nc.uid, roleChangedAt: Date.now() }, 'teacher');
                for (const t of teachers) { await db.collection('users').doc(t.uid).update({ role: 'partner', curatorUid: nc.uid, roleChangedAt: Date.now() }).catch((e) => console.warn(e)); await retag(t.uid, nc.uid); }
                await retag(nc.uid, nc.uid);
                return load();
            }
            if (a === 'del') {
                if (!await StarthUI.confirm('Удалить партнёра «' + o.name + '»?\n\nКуратор и учителя вернутся к прежним ролям (обычно «Ученик»), их группы и история останутся.')) return;
                btn.disabled = true;
                const all = [{ uid: o.curatorUid, prevRole: o.curatorPrevRole || 'student' }].concat(o.teachers || []);
                for (const t of all) { await setMember(t.uid, { role: t.prevRole || 'student', partnerId: '', partnerUntil: 0, partnerStatus: '', curatorUid: '', roleChangedAt: Date.now() }, ['teacher', 'curator'].indexOf(t.prevRole) !== -1 ? 'teacher' : 'student').catch((e) => console.warn(e)); await retag(t.uid, '').catch(() => {}); }
                await db.collection('partners').doc(id).delete();
                return load();
            }
        } catch (e) { btn.disabled = false; say('Ошибка: ' + e.message); }
    }
    async function removeTeacher(id, uid) {
        const o = orgs.find((x) => x.id === id); if (!o) return; const t = (o.teachers || []).find((x) => x.uid === uid); if (!t) return;
        if (!await StarthUI.confirm('Убрать @' + t.nick + ' из партнёра «' + o.name + '»? Его группы и история останутся, но вести уроки как партнёр он больше не сможет.')) return;
        try {
            const teachers = (o.teachers || []).filter((x) => x.uid !== uid);
            await db.collection('partners').doc(id).update({ teachers, teacherUids: teachers.map((x) => x.uid) });
            await setMember(uid, { role: t.prevRole || 'student', partnerId: '', partnerUntil: 0, partnerStatus: '', curatorUid: '', roleChangedAt: Date.now() }, ['teacher', 'curator'].indexOf(t.prevRole) !== -1 ? 'teacher' : 'student');
            await retag(uid, '');
            load();
        } catch (e) { alert('Ошибка: ' + e.message); }
    }
    window.loadPartners = load;
})();
