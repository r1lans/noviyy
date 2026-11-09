/* TheStarth — Admin panel → «Контроль учителей» (for the Curator role and admins).
 *
 * One card per teacher for the chosen period:
 *   - lessons by the group schedule, how many have no attendance marked (the main thing to chase);
 *   - online lessons held (lessonSessions): started late (> 10 min after the scheduled time), shorter than 30 min,
 *     not closed, lessons with no students;
 *   - attendance % of the students, number and average of grades;
 *   - online now / in a lesson right now (presence) — the curator can join a running lesson to observe it;
 *   - curator's notes to the teacher (curatorNotes): note / warning / thanks. The teacher sees them on the
 *     «Главная» of their cabinet and presses «Понятно» — here you see whether it was read.
 * Data: users (role teacher/partner), groups, attendance, grades, lessonSessions, presence, curatorNotes.
 *   CuratorPanel.load()   — called by admin.html when the tab opens.
 */
(function () {
    'use strict';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ic = (n) => (window.Icons ? window.Icons.svg(n) : '');
    const S = () => window.StarthSalary;
    const UI = () => window.StarthUI;
    const $ = (id) => document.getElementById(id);
    const fmtD = (iso) => { const p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '.' + p[1] : iso; };
    const hm = (t) => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' });
    const dayOfMs = (t) => new Date(t + 5 * 3600000).toISOString().slice(0, 10);   // Tashkent date of a timestamp
    const fullName = (u) => [u.name, u.surname].filter(Boolean).join(' ') || (u.nickname ? '@' + u.nickname : '—');
    const KINDS = { note: { name: 'Замечание', icon: 'note' }, warn: { name: 'Предупреждение', icon: 'alert' }, praise: { name: 'Благодарность', icon: 'star' } };
    const LATE_MIN = 10, SHORT_MIN = 30;

    let D = null, busy = false, root = null, myName = '';

    async function getAll(q) { const s = await q.get(); const out = []; s.forEach((d) => out.push(Object.assign({ id: d.id }, d.data()))); return out; }
    const safe = (p) => p.catch((e) => { console.warn('curator', e); return []; });

    async function load() {
        root = $('curator-root'); if (!root || busy) return;
        busy = true;
        if (!D) root.innerHTML = '<div class="empty-state">Загрузка…</div>';
        const days = +(($('cur-period') || {}).value || 14);
        const from = S().addDays(S().todayStr(), -days + 1), fromMs = Date.parse(from + 'T00:00:00+05:00');
        try {
            const db0 = db, SC = window.ADM_SCOPE || '';
            // Куратор TheStarth / admin: everybody. Partner curator: only records marked with his uid (rules allow nothing else).
            const mine = (n) => db0.collection(n).where('curatorUid', '==', SC);
            let [teachers, groups, att, grades, sessions, notes] = await Promise.all(SC ? [
                safe(getAll(mine('users'))), safe(getAll(mine('groups'))), safe(getAll(mine('attendance'))),
                safe(getAll(mine('grades'))), safe(getAll(mine('lessonSessions'))), safe(getAll(mine('curatorNotes')))
            ] : [
                safe(getAll(db0.collection('users').where('role', 'in', ['teacher', 'partner', 'curator', 'partner_curator']))),
                safe(getAll(db0.collection('groups'))),
                safe(getAll(db0.collection('attendance').where('date', '>=', S().addDays(from, -1)))),
                safe(getAll(db0.collection('grades').where('date', '>=', from))),
                safe(getAll(db0.collection('lessonSessions').where('startedAt', '>=', fromMs - 864e5))),
                safe(getAll(db0.collection('curatorNotes').orderBy('ts', 'desc').limit(400)))
            ]);
            if (SC) {
                teachers = teachers.filter((t) => ['teacher', 'partner', 'curator', 'partner_curator'].indexOf(t.role) !== -1);
                att = att.filter((a) => a.date >= S().addDays(from, -1)); grades = grades.filter((g) => g.date >= from);
                sessions = sessions.filter((x) => x.startedAt >= fromMs - 864e5); notes.sort((a, b) => (b.ts || 0) - (a.ts || 0));
            }
            if (!myName && auth.currentUser) {
                try { const md = await db0.collection('users').doc(auth.currentUser.uid).get(); const mp = md.exists ? md.data() : {}; myName = [mp.name, mp.surname].filter(Boolean).join(' ') || (mp.nickname ? '@' + mp.nickname : ''); } catch (e) {}
            }
            const pres = {};
            await Promise.all(teachers.map((t) => db0.collection('presence').doc(t.id).get().then((d) => { pres[t.id] = d.exists ? d.data() : null; }).catch(() => {})));
            D = { days, from, fromMs, teachers, groups, att, grades, sessions, notes, pres, at: Date.now() };
            D.rows = teachers.map(stats).sort((a, b) => b.issues - a.issues || (a.name || '').localeCompare(b.name || ''));
            render();
        } catch (e) {
            root.innerHTML = '<div class="empty-state">Не удалось загрузить данные: ' + esc(e.message) + '. Опубликованы ли новые правила Firestore (FIREBASE_SETUP.md)?</div>';
        }
        busy = false;
    }

    // ───────── numbers for one teacher ─────────
    function stats(t) {
        const uid = t.id, now = Date.now();
        const groups = D.groups.filter((g) => g.teacherUid === uid && !g.archived);
        const students = new Set(); groups.forEach((g) => (g.memberUids || []).forEach((u) => students.add(u)));
        const missing = [], expected = [];
        groups.forEach((g) => {
            const days = S().groupDays(g), tm = S().groupTime(g);
            for (let i = 0; i < D.days; i++) {
                const d = S().addDays(S().todayStr(), -i);
                if (d < D.from || days.indexOf(S().dowOf(d)) === -1) continue;
                if (g.createdAt && d < String(g.createdAt).slice(0, 10)) continue;
                const at = S().lessonAt(d, tm || '23:59').getTime();
                if (at + 2 * 3600000 > now) continue;              // lesson not over yet (+2 h to mark it)
                expected.push({ g, date: d, at, time: tm });
                if (!D.att.some((a) => a.groupId === g.id && a.date === d)) missing.push({ g, date: d });
            }
        });
        const sess = D.sessions.filter((s) => s.teacherUid === uid && s.startedAt >= D.fromMs).sort((a, b) => b.startedAt - a.startedAt);
        const live = sess.find((s) => !s.endedAt && now - (s.lastSeen || 0) < 15 * 60000) || null;
        const ses = sess.map((s) => {
            const end = s.endedAt || s.lastSeen || s.startedAt, dur = end - s.startedAt;
            const pupils = Object.keys(s.participants || {}).filter((k) => (s.participants[k] || {}).role !== 'teacher').length;
            const exp = expected.find((e) => e.g.id === s.groupId && e.date === dayOfMs(s.startedAt) && e.time);
            let lateMin = exp ? Math.round((s.startedAt - exp.at) / 60000) : null;
            if (lateMin != null && (lateMin < -60 || lateMin > 120)) lateMin = null;   // far from the scheduled time — an extra lesson, not a late one
            const stale = !s.endedAt && now - (s.lastSeen || 0) > 15 * 60000;
            return { s, dur, pupils, lateMin, late: lateMin != null && lateMin > LATE_MIN, short: !!s.endedAt && dur < SHORT_MIN * 60000, stale, empty: !!s.endedAt && !pupils };
        });
        // students' attendance in the period (marks of this teacher's attendance records)
        let pr = 0, tot = 0;
        D.att.filter((a) => a.teacherUid === uid && a.date >= D.from).forEach((a) => Object.keys(a.marks || {}).forEach((k) => { const m = a.marks[k]; if (m === 'present' || m === 'late') pr++; if (m === 'present' || m === 'late' || m === 'absent') tot++; }));
        const gr = D.grades.filter((x) => x.teacherUid === uid);
        const avg = gr.length ? gr.reduce((s, x) => s + (+x.score || 0), 0) / gr.length : null;
        const notes = D.notes.filter((n) => n.teacherUid === uid);
        const p = D.pres[uid], st = window.StarthPresence ? window.StarthPresence.status(p) : (p && p.ts && now - p.ts < 100000 ? (p.state === 'lesson' ? 'lesson' : 'online') : 'offline');
        const lateN = ses.filter((x) => x.late).length, shortN = ses.filter((x) => x.short).length, staleN = ses.filter((x) => x.stale).length, emptyN = ses.filter((x) => x.empty).length;
        const issues = missing.length * 2 + lateN + shortN + staleN + emptyN;
        return { t, uid, name: fullName(t), nick: t.nickname || '', partner: t.role === 'partner' || t.role === 'partner_curator', groups, students: students.size, expected, missing, ses, live, lateN, shortN, staleN, emptyN,
            attPct: tot ? Math.round(pr / tot * 100) : null, grades: gr.length, avg, notes, unread: notes.filter((n) => !n.readAt).length, status: st, issues };
    }

    // ───────── page ─────────
    function render() {
        if (!root || !D) return;
        const q = (($('cur-search') || {}).value || '').trim().toLowerCase();
        const onlyBad = !!($('cur-bad') || {}).checked;
        const rows = D.rows.filter((r) => (!q || (r.name + ' ' + r.nick).toLowerCase().includes(q)) && (!onlyBad || r.issues));
        const sum = (f) => D.rows.reduce((s, r) => s + f(r), 0);
        const liveN = D.rows.filter((r) => r.live).length;
        root.innerHTML =
            '<div class="cur-tiles">' +
            tile('users', 'Учителей', D.rows.length, D.rows.filter((r) => r.status === 'online' || r.status === 'lesson').length + ' сейчас в сети') +
            tile('calendar', 'Уроков по расписанию', sum((r) => r.expected.length), 'за ' + D.days + ' дн.') +
            tile('alert', 'Без посещаемости', sum((r) => r.missing.length), 'уроков не отмечено', sum((r) => r.missing.length) ? 'bad' : 'ok') +
            tile('clock', 'Опоздания к началу', sum((r) => r.lateN), 'позже ' + LATE_MIN + ' мин', sum((r) => r.lateN) ? 'warn' : 'ok') +
            tile('video', 'Сейчас на уроке', liveN, liveN ? 'можно зайти и посмотреть' : 'уроков не идёт', liveN ? 'live' : '') +
            '</div>' +
            (rows.length ? '<div class="cur-grid">' + rows.map(card).join('') + '</div>' : '<div class="empty-state">Учителей не найдено.</div>') +
            '<p class="cur-upd">Обновлено в ' + hm(D.at) + ' · период с ' + fmtD(D.from) + '</p>';
        root.querySelectorAll('[data-cd]').forEach((b) => { b.onclick = () => detail(b.dataset.cd); });
        root.querySelectorAll('[data-cn]').forEach((b) => { b.onclick = () => noteForm(b.dataset.cn); });
    }
    function tile(icon, t, v, sub, cls) { return '<div class="cur-tile ' + (cls || '') + '"><span class="cur-ti">' + ic(icon) + '</span><div><div class="t">' + esc(t) + '</div><div class="v">' + esc(v) + '</div><small>' + esc(sub) + '</small></div></div>'; }
    function presChip(r) {
        const L = { online: 'в сети', lesson: 'на уроке', offline: 'не в сети' };
        return r.status ? '<span class="cur-pres ' + r.status + '"><i></i>' + L[r.status] + '</span>' : '';
    }
    function chips(r) {
        const c = [];
        if (r.missing.length) c.push(['bad', 'Не отмечена посещаемость: ' + r.missing.length]);
        if (r.lateN) c.push(['warn', 'Опоздал к началу: ' + r.lateN]);
        if (r.shortN) c.push(['warn', 'Урок < ' + SHORT_MIN + ' мин: ' + r.shortN]);
        if (r.staleN) c.push(['warn', 'Урок не закрыт: ' + r.staleN]);
        if (r.emptyN) c.push(['warn', 'Без учеников: ' + r.emptyN]);
        if (!c.length && r.expected.length) c.push(['ok', 'Всё в порядке']);
        if (!r.groups.length) c.push(['', 'Нет активных групп']);
        return c.map((x) => '<span class="cur-chip ' + x[0] + '">' + esc(x[1]) + '</span>').join('');
    }
    function card(r) {
        const join = r.live && r.live.room ? '<a class="btn-small primary" target="_blank" rel="noopener" href="video-lesson?room=' + encodeURIComponent(r.live.room) + (r.live.groupId ? '&group=' + encodeURIComponent(r.live.groupId) : '') + '">' + ic('video') + ' Войти на урок</a>' : '';
        return '<div class="cur-card' + (r.issues ? ' has-issues' : '') + '">' +
            '<div class="cur-head"><span class="cur-av">' + esc((r.name.replace('@', '').trim().charAt(0) || '?').toUpperCase()) + '</span><div class="cur-who"><b>' + esc(r.name) + '</b>' +
            '<small>' + (r.nick ? '@' + esc(r.nick) + ' · ' : '') + (r.partner ? 'партнёр · ' : '') + r.groups.length + ' гр. · ' + r.students + ' уч.</small></div>' + presChip(r) + '</div>' +
            (r.live ? '<div class="cur-live"><i></i>Идёт урок: ' + esc(r.live.groupName || r.live.room || '') + ' · с ' + hm(r.live.startedAt) + '</div>' : '') +
            '<div class="cur-nums">' +
            num(r.expected.length ? (r.expected.length - r.missing.length) + '/' + r.expected.length : '—', 'отмечено уроков') +
            num(r.ses.length, 'онлайн-уроков') +
            num(r.attPct == null ? '—' : r.attPct + '%', 'посещаемость') +
            num(r.avg == null ? '—' : r.avg.toFixed(1), 'ср. оценка · ' + r.grades) +
            '</div>' +
            '<div class="cur-chips">' + chips(r) + '</div>' +
            '<div class="cur-acts">' + join +
            '<button type="button" class="btn-small" data-cd="' + esc(r.uid) + '">' + ic('chart') + ' Подробнее</button>' +
            '<button type="button" class="btn-small" data-cn="' + esc(r.uid) + '">' + ic('note') + ' Замечание' + (r.notes.length ? ' <span class="cur-nc">' + r.notes.length + (r.unread ? ' · ' + r.unread + ' не прочит.' : '') + '</span>' : '') + '</button>' +
            (r.nick ? '<a class="btn-small" target="_blank" rel="noopener" href="messenger?chat=' + encodeURIComponent(r.nick) + '">' + ic('message') + ' Написать</a>' : '') +
            '</div></div>';
    }
    function num(v, l) { return '<div><b>' + esc(v) + '</b><span>' + esc(l) + '</span></div>'; }

    // ───────── detail of one teacher ─────────
    function overlay(html) {
        const ov = document.createElement('div'); ov.className = 'cur-ov';
        ov.innerHTML = '<div class="cur-modal" role="dialog" aria-modal="true"><button type="button" class="cur-x" aria-label="Закрыть">' + ic('x') + '</button>' + html + '</div>';
        document.body.appendChild(ov);
        const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.sui-back')) close(); };
        ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('.cur-x')) close(); });
        document.addEventListener('keydown', onKey);
        return { el: ov, close };
    }
    function detail(uid) {
        const r = D.rows.find((x) => x.uid === uid); if (!r) return;
        const grp = r.groups.map((g) => {
            const miss = r.missing.filter((m) => m.g.id === g.id), exp = r.expected.filter((e) => e.g.id === g.id);
            const last = r.ses.find((x) => x.s.groupId === g.id);
            return '<tr><td><b>' + esc(g.name || '—') + '</b><small>' + esc(g.scheduleText || '') + '</small></td><td>' + (g.memberUids || []).length + '</td>' +
                '<td>' + (exp.length - miss.length) + '/' + exp.length + '</td>' +
                '<td>' + (miss.length ? '<span class="cur-chip bad">' + miss.map((m) => fmtD(m.date)).join(', ') + '</span>' : '<span class="cur-chip ok">нет</span>') + '</td>' +
                '<td>' + (last ? fmtD(dayOfMs(last.s.startedAt)) + ' ' + hm(last.s.startedAt) : '—') + '</td></tr>';
        }).join('');
        const ses = r.ses.slice(0, 15).map((x) => {
            const p = [];
            if (x.late) p.push('<span class="cur-chip warn">опоздал на ' + x.lateMin + ' мин</span>');
            if (x.short) p.push('<span class="cur-chip warn">короче ' + SHORT_MIN + ' мин</span>');
            if (x.stale) p.push('<span class="cur-chip warn">не закрыт</span>');
            if (x.empty) p.push('<span class="cur-chip warn">без учеников</span>');
            if (!x.s.endedAt && !x.stale) p.push('<span class="cur-chip live">идёт сейчас</span>');
            return '<tr><td>' + fmtD(dayOfMs(x.s.startedAt)) + ' ' + hm(x.s.startedAt) + '</td><td>' + esc(x.s.groupName || x.s.room || '') + '</td><td>' + Math.round(x.dur / 60000) + ' мин</td><td>' + x.pupils + '</td><td>' + (p.join(' ') || '<span class="cur-chip ok">ок</span>') + '</td></tr>';
        }).join('');
        const m = overlay('<h2 class="cur-mh">' + esc(r.name) + ' ' + presChip(r) + '</h2>' +
            '<p class="cur-ms">' + (r.nick ? '@' + esc(r.nick) + ' · ' : '') + 'период: последние ' + D.days + ' дн. (с ' + fmtD(D.from) + ')</p>' +
            '<h3>Группы</h3>' + (grp ? '<div class="cur-tw"><table class="cur-t"><thead><tr><th>Группа</th><th>Учеников</th><th>Отмечено</th><th>Не отмечена посещаемость</th><th>Последний онлайн-урок</th></tr></thead><tbody>' + grp + '</tbody></table></div>' : '<p class="cur-ms">Активных групп нет.</p>') +
            '<h3>Онлайн-уроки</h3>' + (ses ? '<div class="cur-tw"><table class="cur-t"><thead><tr><th>Начало</th><th>Группа</th><th>Длительность</th><th>Учеников</th><th></th></tr></thead><tbody>' + ses + '</tbody></table></div>' : '<p class="cur-ms">За период онлайн-уроков не было.</p>') +
            '<h3>Замечания куратора</h3><div id="curNotesBox">' + notesHtml(r) + '</div>' +
            '<div class="cur-acts"><button type="button" class="btn-small primary" id="curAddNote">' + ic('plus') + ' Новое замечание</button>' +
            (r.nick ? '<a class="btn-small" target="_blank" rel="noopener" href="messenger?chat=' + encodeURIComponent(r.nick) + '">' + ic('message') + ' Написать в мессенджер</a>' : '') +
            '<button type="button" class="btn-small" id="curJournal">' + ic('book') + ' Журнал оценок</button></div>');
        m.el.querySelector('#curAddNote').onclick = () => noteForm(uid, () => { const b = m.el.querySelector('#curNotesBox'); const rr = D.rows.find((x) => x.uid === uid); if (b && rr) { b.innerHTML = notesHtml(rr); bindNoteDel(b, uid); } });
        m.el.querySelector('#curJournal').onclick = () => { m.close(); if (window.switchTab) window.switchTab('journal'); };
        bindNoteDel(m.el, uid);
    }
    function notesHtml(r) {
        if (!r.notes.length) return '<p class="cur-ms">Замечаний пока нет.</p>';
        return '<div class="cur-notes">' + r.notes.slice(0, 20).map((n) => {
            const k = KINDS[n.kind] || KINDS.note;
            return '<div class="cur-note ' + esc(n.kind || 'note') + '">' + ic(k.icon) + '<div><b>' + esc(k.name) + '</b> <small>' + new Date(n.ts || 0).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + (n.byName ? ' · ' + esc(n.byName) : '') + ' · ' +
                (n.readAt ? '<span class="cur-read">прочитано ' + new Date(n.readAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + '</span>' : '<span class="cur-unread">не прочитано</span>') + '</small><p>' + esc(n.text) + '</p></div>' +
                '<button type="button" class="cur-del" data-del-note="' + esc(n.id) + '" title="Удалить">' + ic('trash') + '</button></div>';
        }).join('') + '</div>';
    }
    function bindNoteDel(el, uid) {
        el.querySelectorAll('[data-del-note]').forEach((b) => { b.onclick = async () => {
            if (!(await UI().confirm('Удалить это замечание? Учитель его больше не увидит.'))) return;
            try {
                await db.collection('curatorNotes').doc(b.dataset.delNote).delete();
                D.notes = D.notes.filter((n) => n.id !== b.dataset.delNote);
                D.rows = D.rows.map((r) => (r.uid === uid ? stats(r.t) : r));
                const box = b.closest('#curNotesBox'); const rr = D.rows.find((x) => x.uid === uid);
                if (box && rr) { box.innerHTML = notesHtml(rr); bindNoteDel(box, uid); }
                render();
            } catch (e) { UI().alert('Ошибка: ' + e.message); }
        }; });
    }

    // ───────── new note to a teacher ─────────
    function noteForm(uid, after) {
        const r = D.rows.find((x) => x.uid === uid); if (!r) return;
        const hint = r.missing.length ? 'Не отмечена посещаемость: ' + r.missing.slice(0, 6).map((m) => (m.g.name || '') + ' ' + fmtD(m.date)).join(', ') + '. Пожалуйста, отметьте сегодня.' : '';
        const m = overlay('<h2 class="cur-mh">Замечание учителю</h2><p class="cur-ms">' + esc(r.name) + ' увидит его на главной своего кабинета и отметит «Понятно».</p>' +
            '<div class="cur-kinds">' + Object.keys(KINDS).map((k, i) => '<label class="cur-kind ' + k + '"><input type="radio" name="curKind" value="' + k + '"' + (i === 0 ? ' checked' : '') + '>' + ic(KINDS[k].icon) + '<span>' + KINDS[k].name + '</span></label>').join('') + '</div>' +
            '<textarea id="curNoteText" class="cur-ta" maxlength="1000" placeholder="Например: урок 12.03 начался на 15 минут позже. Пожалуйста, заходите заранее."></textarea>' +
            (hint ? '<button type="button" class="cur-link" id="curHint">' + ic('bulb') + ' Вставить: ' + esc(hint.slice(0, 90)) + (hint.length > 90 ? '…' : '') + '</button>' : '') +
            '<div class="cur-acts end"><button type="button" class="btn-small" id="curCancel">Отмена</button><button type="button" class="btn-small primary" id="curSend">' + ic('send') + ' Отправить учителю</button></div>');
        const ta = m.el.querySelector('#curNoteText'); setTimeout(() => ta.focus(), 30);
        const h = m.el.querySelector('#curHint'); if (h) h.onclick = () => { ta.value = hint; ta.focus(); };
        m.el.querySelector('#curCancel').onclick = m.close;
        m.el.querySelector('#curSend').onclick = async () => {
            const text = ta.value.trim(); if (!text) { ta.focus(); return UI().toast('Напишите текст замечания.', 'warn'); }
            const kind = (m.el.querySelector('input[name="curKind"]:checked') || {}).value || 'note';
            const me = auth.currentUser, prof = window.currentUserProfile || {};
            const btn = m.el.querySelector('#curSend'); btn.disabled = true;
            try {
                const doc = { teacherUid: uid, teacherName: r.name.slice(0, 80), curatorUid: window.ADM_SCOPE || r.t.curatorUid || '', kind, text: text.slice(0, 1000), byUid: me.uid, byName: (myName || [prof.name, prof.surname].filter(Boolean).join(' ') || 'Куратор').slice(0, 80), ts: Date.now(), readAt: 0 };
                const ref = await db.collection('curatorNotes').add(doc);
                D.notes.unshift(Object.assign({ id: ref.id }, doc));
                D.rows = D.rows.map((x) => (x.uid === uid ? stats(x.t) : x));
                m.close(); render(); if (after) after();
                UI().toast('Замечание отправлено учителю.', 'ok');
            } catch (e) { btn.disabled = false; UI().alert('Не удалось отправить: ' + e.message); }
        };
    }

    window.CuratorPanel = { load, render };
})();
