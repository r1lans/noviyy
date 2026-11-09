/* TheStarth — Admin panel → «Олимпиада».
 *
 * Steps for the admin:
 *   1) «Новая олимпиада»: name, subject, description, when it is open (from / to), how many minutes each participant has.
 *   2) Questions: one correct option (A–F) or a short answer (several accepted answers separated by «|»), points for each.
 *      Many questions at once: «Вставить списком» (format below).
 *   3) «Подтвердить и опубликовать» — the «Олимпиада» button appears on the home page (under «Пройти тест»)
 *      and the test opens for participants at the start time (page olympiad?id=…).
 *   4) «Результаты» → «Проверить» marks every participant with the answer key, «Опубликовать результаты» shows
 *      each participant their score and place, and the top 10 on the olympiad page.
 *
 * Firestore:
 *   olympiads/{id}          public when published: everything except the answers
 *   olympiadKeys/{id}       { answers: { qid: optionIndex | ['answer', 'other spelling'] } } — admins only
 *   olympiadAttempts/{oid_uid}  one per participant: answers, startedAt (server time), status, score / rank after checking,
 *                               region / district / school / grade (copied from the registration), placeRegion
 *   olympiadRegs/{oid_uid}      registration before the start (region, district, school, class)
 * Settings per olympiad: registration on/off, classes (gradeMin–gradeMax), shuffle questions and options,
 * maxLeaves (hand in automatically after N leaves of the page, 0 = only count).
 */
(function () {
    'use strict';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = (id) => document.getElementById(id);
    const UI = () => window.StarthUI;
    const LET = ['A', 'B', 'C', 'D', 'E', 'F'];
    const SUBJ = ['Математика', 'Английский язык', 'IELTS', 'SAT', 'Логика', 'Другое'];
    const rid = () => Math.random().toString(36).slice(2, 9);
    const pad = (n) => String(n).padStart(2, '0');
    const toLocal = (ms) => { if (!ms) return ''; const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    const fmt = (ms) => (ms ? new Date(ms).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—');
    const norm = (v) => String(v == null ? '' : v).toLowerCase().replace(/ё/g, 'е').replace(/,/g, '.').replace(/\s+/g, ' ').trim();

    let list = [], ed = null, root = null;

    function status(o) {
        const now = Date.now();
        if (!o.published) return ['draft', 'Черновик'];
        if (now < o.startAt) return ['soon', 'Опубликована · начнётся ' + fmt(o.startAt)];
        if (now <= o.endAt) return ['live', 'Идёт сейчас'];
        return ['done', o.resultsPublished ? 'Завершена · результаты опубликованы' : 'Завершена · нужно проверить'];
    }

    // ───────── list ─────────
    async function load() {
        root = $('olympiad-root'); if (!root) return;
        if (ed) return renderEditor();
        root.innerHTML = '<div class="empty-state">Загрузка…</div>';
        try {
            const snap = await db.collection('olympiads').get();
            list = []; snap.forEach((d) => list.push(Object.assign({ id: d.id }, d.data())));
            list.sort((a, b) => (b.startAt || 0) - (a.startAt || 0));
            // count() reads 1 document per 1000 instead of every attempt (10 000 participants = 10 reads, not 10 000)
            const cnt = (q) => (q.count ? q.count().get().then((s) => s.data().count) : q.get().then((s) => s.size)).catch(() => 0);
            const [counts, regs] = await Promise.all([
                Promise.all(list.map((o) => cnt(db.collection('olympiadAttempts').where('oid', '==', o.id)))),
                Promise.all(list.map((o) => cnt(db.collection('olympiadRegs').where('oid', '==', o.id))))]);
            list.forEach((o, i) => { o._n = counts[i]; o._r = regs[i]; });
        } catch (e) { root.innerHTML = '<div class="empty-state">Не удалось загрузить: ' + esc(e.message) + '. Опубликованы ли новые правила Firestore (FIREBASE_SETUP.md, v92)?</div>'; return; }
        renderList();
    }
    function renderList() {
        root.innerHTML = '<div class="oly-top"><button type="button" class="btn-small primary" id="olyNew">+ Новая олимпиада</button></div>' +
            (list.length ? list.map((o) => { const st = status(o);
                return '<div class="admin-card oly-card"><div class="oly-ch"><h3>' + esc(o.title || 'Без названия') + '</h3><span class="oly-st ' + st[0] + '">' + esc(st[1]) + '</span></div>' +
                    '<div class="meta">' + esc(o.subject || '') + ' · ' + fmt(o.startAt) + ' — ' + fmt(o.endAt) + ' · ' + (o.durationMin || 0) + ' мин · вопросов: ' + ((o.questions || []).length) + ' · макс. ' + (o.maxScore || 0) + ' б. · зарегистрировано: ' + (o._r || 0) + ' · участвовали: ' + (o._n || 0) + (o.gradeMin || o.gradeMax ? ' · классы ' + (o.gradeMin || 1) + '–' + (o.gradeMax || 11) : '') + '</div>' +
                    '<div class="admin-card-actions">' +
                    '<button class="btn-small" data-oe="' + o.id + '">Редактировать</button>' +
                    (o.published ? '<button class="btn-small" data-ou="' + o.id + '">Снять с публикации</button>' : '<button class="btn-small primary" data-op="' + o.id + '">Подтвердить и опубликовать</button>') +
                    '<button class="btn-small" data-or="' + o.id + '">Результаты</button>' +
                    '<button class="btn-small" data-oreg="' + o.id + '">Регистрации</button>' +
                    (o.published ? '<a class="btn-small" target="_blank" rel="noopener" href="olympiad?id=' + o.id + '">Открыть страницу</a>' : '') +
                    '<button class="btn-small danger" data-od="' + o.id + '">Удалить</button></div></div>'; }).join('')
                : '<div class="empty-state">Олимпиад пока нет. Нажмите «Новая олимпиада».</div>');
        $('olyNew').onclick = () => openEditor(null);
        root.querySelectorAll('[data-oe]').forEach((b) => { b.onclick = () => openEditor(b.dataset.oe); });
        root.querySelectorAll('[data-op]').forEach((b) => { b.onclick = () => publish(b.dataset.op, true); });
        root.querySelectorAll('[data-ou]').forEach((b) => { b.onclick = () => publish(b.dataset.ou, false); });
        root.querySelectorAll('[data-or]').forEach((b) => { b.onclick = () => results(b.dataset.or); });
        root.querySelectorAll('[data-oreg]').forEach((b) => { b.onclick = () => registrations(b.dataset.oreg); });
        root.querySelectorAll('[data-od]').forEach((b) => { b.onclick = () => remove(b.dataset.od); });
    }

    // ───────── editor ─────────
    async function openEditor(id) {
        if (!id) {
            const t = new Date(); t.setDate(t.getDate() + 7); t.setHours(10, 0, 0, 0);
            ed = { id: '', title: '', subject: SUBJ[0], description: '', startAt: t.getTime(), endAt: t.getTime() + 3 * 3600000, durationMin: 60, showOnHome: true, published: false, registration: true, shuffle: true, maxLeaves: 0, gradeMin: 0, gradeMax: 0,
                questions: [{ id: rid(), type: 'single', q: '', image: '', options: ['', '', '', ''], points: 1, key: 0 }] };
            return renderEditor();
        }
        const o = list.find((x) => x.id === id); if (!o) return;
        let key = {};
        try { const k = await db.collection('olympiadKeys').doc(id).get(); key = k.exists ? (k.data().answers || {}) : {}; } catch (e) {}
        ed = JSON.parse(JSON.stringify(o)); delete ed._n;
        ed.questions = (ed.questions || []).map((q) => Object.assign({}, q, { key: q.type === 'text' ? (Array.isArray(key[q.id]) ? key[q.id].join(' | ') : '') : (key[q.id] != null ? key[q.id] : null) }));
        renderEditor();
    }
    function qHtml(q, i) {
        const opts = q.type === 'single'
            ? '<div class="oly-opts">' + q.options.map((o, k) => '<div class="oly-opt"><label class="oly-ok" title="Правильный ответ"><input type="radio" name="olyk-' + q.id + '" data-qi="' + i + '" data-f="key" value="' + k + '"' + (q.key === k ? ' checked' : '') + '><span>' + LET[k] + '</span></label>' +
                '<input type="text" data-qi="' + i + '" data-f="opt" data-k="' + k + '" value="' + esc(o) + '" placeholder="Вариант ' + LET[k] + '">' +
                (q.options.length > 2 ? '<button type="button" class="oly-x" data-qa="delopt" data-qi="' + i + '" data-k="' + k + '" title="Удалить вариант">×</button>' : '') + '</div>').join('') +
                (q.options.length < 6 ? '<button type="button" class="btn-small" data-qa="addopt" data-qi="' + i + '">+ вариант</button>' : '') + '<small class="oly-hint">Отметьте кружком правильный вариант.</small></div>'
            : '<label>Правильные ответы (если подходит несколько написаний — через «|», например: 12 | 12.0 | двенадцать)</label><input type="text" data-qi="' + i + '" data-f="key" value="' + esc(q.key || '') + '" placeholder="Например: 42">';
        return '<div class="oly-q" data-q="' + i + '"><div class="oly-qh"><b>Вопрос ' + (i + 1) + '</b>' +
            '<select data-qi="' + i + '" data-f="type"><option value="single"' + (q.type === 'single' ? ' selected' : '') + '>Один правильный вариант</option><option value="text"' + (q.type === 'text' ? ' selected' : '') + '>Короткий ответ (число / слово)</option></select>' +
            '<label class="oly-pts">Баллы <input type="number" min="0" max="100" step="1" data-qi="' + i + '" data-f="points" value="' + (q.points == null ? 1 : q.points) + '"></label>' +
            '<span class="oly-sp"></span><button type="button" class="oly-x" data-qa="up" data-qi="' + i + '" title="Выше">↑</button><button type="button" class="oly-x" data-qa="down" data-qi="' + i + '" title="Ниже">↓</button><button type="button" class="oly-x danger" data-qa="del" data-qi="' + i + '" title="Удалить вопрос">×</button></div>' +
            '<textarea data-qi="' + i + '" data-f="q" rows="2" placeholder="Текст вопроса">' + esc(q.q) + '</textarea>' +
            '<input type="text" data-qi="' + i + '" data-f="image" value="' + esc(q.image || '') + '" placeholder="Ссылка на картинку (необязательно), https://…">' + opts + '</div>';
    }
    function renderEditor() {
        if (!root) root = $('olympiad-root');
        const max = ed.questions.reduce((s, q) => s + (+q.points || 0), 0);
        root.innerHTML = '<div class="oly-ed">' +
            '<div class="oly-top"><button type="button" class="btn-small" id="olyBack">← Ко всем олимпиадам</button><span class="oly-sp"></span>' +
            (ed.published ? '<span class="oly-st live">Опубликована — изменения сразу видны участникам</span>' : '<span class="oly-st draft">Черновик</span>') + '</div>' +
            '<div class="admin-form"><div class="oly-grid">' +
            '<div class="oly-wide"><label>Название</label><input type="text" id="olyTitle" maxlength="120" value="' + esc(ed.title) + '" placeholder="Например: Олимпиада TheStarth по математике — 2026"></div>' +
            '<div><label>Предмет</label><select id="olySubject">' + SUBJ.map((x) => '<option' + (x === ed.subject ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select></div>' +
            '<div><label>Время на решение, минут</label><input type="number" id="olyDur" min="5" max="600" value="' + (ed.durationMin || 60) + '"></div>' +
            '<div><label>Открыта с</label><input type="datetime-local" id="olyStart" value="' + toLocal(ed.startAt) + '"></div>' +
            '<div><label>Открыта до</label><input type="datetime-local" id="olyEnd" value="' + toLocal(ed.endAt) + '"></div>' +
            '<div class="oly-wide"><label>Описание для участников (правила, для кого, призы)</label><textarea id="olyDesc" rows="3" maxlength="2000">' + esc(ed.description) + '</textarea></div>' +
            '<label class="oly-chk oly-wide"><input type="checkbox" id="olyHome"' + (ed.showOnHome !== false ? ' checked' : '') + '> Показывать кнопку «Олимпиада» на главной странице (после публикации)</label>' +
            '<div><label>Классы: с</label><select id="olyGMin"><option value="0">любой</option>' + Array.from({ length: 11 }, (_, k) => '<option' + (+ed.gradeMin === k + 1 ? ' selected' : '') + '>' + (k + 1) + '</option>').join('') + '</select></div>' +
            '<div><label>Классы: по</label><select id="olyGMax"><option value="0">любой</option>' + Array.from({ length: 11 }, (_, k) => '<option' + (+ed.gradeMax === k + 1 ? ' selected' : '') + '>' + (k + 1) + '</option>').join('') + '</select></div>' +
            '<div><label>Сдать автоматически после N уходов со страницы (0 — только считать)</label><input type="number" id="olyLeaves" min="0" max="50" value="' + (+ed.maxLeaves || 0) + '"></div>' +
            '<label class="oly-chk"><input type="checkbox" id="olyShuffle"' + (ed.shuffle ? ' checked' : '') + '> Перемешивать вопросы и варианты у каждого участника</label>' +
            '<label class="oly-chk oly-wide"><input type="checkbox" id="olyReg"' + (ed.registration !== false ? ' checked' : '') + '> Регистрация до начала: регион, район, школа, класс (нужна для протокола по регионам и сертификата)</label>' +
            '</div></div>' +
            '<div class="oly-qtop"><h3>Вопросы <small>' + ed.questions.length + ' шт. · максимум ' + max + ' б.</small></h3><span class="oly-sp"></span>' +
            '<button type="button" class="btn-small" id="olyImport">Вставить списком</button><button type="button" class="btn-small" id="olyAddQ">+ Вопрос</button></div>' +
            '<div id="olyQs">' + ed.questions.map(qHtml).join('') + '</div>' +
            '<div class="oly-bottom"><button type="button" class="btn-small" id="olyAddQ2">+ Вопрос</button><span class="oly-sp"></span><span class="status-msg" id="olyMsg"></span>' +
            '<button type="button" class="btn-small primary" id="olySave">Сохранить</button>' +
            (ed.published ? '' : '<button type="button" class="btn-small primary" id="olySavePub">Сохранить, подтвердить и опубликовать</button>') + '</div></div>';
        $('olyBack').onclick = async () => { if (await UI().confirm('Выйти из редактора? Несохранённые изменения пропадут.', { danger: false })) { ed = null; load(); } };
        $('olyAddQ').onclick = $('olyAddQ2').onclick = () => { readForm(); ed.questions.push({ id: rid(), type: 'single', q: '', image: '', options: ['', '', '', ''], points: 1, key: null }); renderEditor(); const qs = root.querySelectorAll('.oly-q'); qs[qs.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); };
        $('olyImport').onclick = importText;
        $('olySave').onclick = () => save(false);
        const sp = $('olySavePub'); if (sp) sp.onclick = () => save(true);
        root.querySelector('#olyQs').onclick = (e) => {
            const b = e.target.closest('[data-qa]'); if (!b) return;
            readForm();
            const i = +b.dataset.qi, q = ed.questions[i], a = b.dataset.qa;
            if (a === 'addopt') q.options.push('');
            else if (a === 'delopt') { const k = +b.dataset.k; q.options.splice(k, 1); if (q.key === k) q.key = null; else if (q.key > k) q.key--; }
            else if (a === 'up' && i > 0) ed.questions.splice(i - 1, 0, ed.questions.splice(i, 1)[0]);
            else if (a === 'down' && i < ed.questions.length - 1) ed.questions.splice(i + 1, 0, ed.questions.splice(i, 1)[0]);
            else if (a === 'del') { if (ed.questions.length < 2) return UI().toast('Нужен хотя бы один вопрос.', 'warn'); ed.questions.splice(i, 1); }
            renderEditor();
        };
        root.querySelector('#olyQs').onchange = (e) => { if (e.target.dataset.f === 'type') { readForm(); const q = ed.questions[+e.target.dataset.qi]; q.key = q.type === 'single' ? null : ''; if (q.type === 'single' && q.options.length < 2) q.options = ['', '', '', '']; renderEditor(); } };
    }
    function readForm() {
        if (!$('olyTitle')) return;
        ed.title = $('olyTitle').value.trim(); ed.subject = $('olySubject').value; ed.description = $('olyDesc').value.trim();
        ed.durationMin = Math.round(+$('olyDur').value || 0);
        ed.startAt = $('olyStart').value ? new Date($('olyStart').value).getTime() : 0;
        ed.endAt = $('olyEnd').value ? new Date($('olyEnd').value).getTime() : 0;
        ed.showOnHome = $('olyHome').checked;
        ed.gradeMin = +$('olyGMin').value || 0; ed.gradeMax = +$('olyGMax').value || 0;
        ed.maxLeaves = Math.max(0, Math.min(50, Math.round(+$('olyLeaves').value || 0)));
        ed.shuffle = $('olyShuffle').checked; ed.registration = $('olyReg').checked;
        root.querySelectorAll('#olyQs [data-qi]').forEach((el) => {
            const q = ed.questions[+el.dataset.qi], f = el.dataset.f; if (!q || !f) return;
            if (f === 'q') q.q = el.value; else if (f === 'image') q.image = el.value.trim(); else if (f === 'points') q.points = Math.max(0, Math.round(+el.value || 0));
            else if (f === 'type') q.type = el.value; else if (f === 'opt') q.options[+el.dataset.k] = el.value;
            else if (f === 'key') { if (el.type === 'radio') { if (el.checked) q.key = +el.value; } else q.key = el.value; }
        });
    }
    function problems() {
        const p = [];
        if (!ed.title) p.push('Нет названия.');
        if (!ed.startAt || !ed.endAt || ed.endAt <= ed.startAt) p.push('Проверьте даты: «Открыта до» должно быть позже «Открыта с».');
        if (!(ed.durationMin >= 5)) p.push('Время на решение — не меньше 5 минут.');
        if (ed.gradeMin && ed.gradeMax && ed.gradeMin > ed.gradeMax) p.push('Классы: «с» должно быть не больше «по».');
        ed.questions.forEach((q, i) => {
            const n = 'Вопрос ' + (i + 1) + ': ';
            if (!q.q.trim()) p.push(n + 'нет текста.');
            if (q.image && !/^https:\/\//i.test(q.image)) p.push(n + 'ссылка на картинку должна начинаться с https://');
            if (q.type === 'single') {
                if (q.options.some((o) => !String(o).trim())) p.push(n + 'есть пустой вариант ответа.');
                if (q.key == null || q.key < 0 || q.key >= q.options.length) p.push(n + 'не отмечен правильный вариант.');
            } else if (!String(q.key || '').split('|').some((x) => x.trim())) p.push(n + 'не указан правильный ответ.');
        });
        return p;
    }
    async function save(andPublish) {
        readForm();
        const pr = problems();
        if (pr.length && (andPublish || ed.published)) return UI().alert('Перед публикацией исправьте:\n\n' + pr.slice(0, 12).join('\n') + (pr.length > 12 ? '\n…' : ''), { kind: 'warn', title: 'Олимпиада не готова' });
        if (!ed.title) return UI().toast('Введите название олимпиады.', 'warn');
        if (andPublish && !(await UI().confirm('Подтвердить и опубликовать «' + ed.title + '»?\n\nНа главной появится кнопка «Олимпиада», а ' + fmt(ed.startAt) + ' тест откроется для участников.', { danger: false, ok: 'Опубликовать' }))) return;
        const btns = root.querySelectorAll('.oly-bottom button'); btns.forEach((b) => { b.disabled = true; });
        try {
            const ref = ed.id ? db.collection('olympiads').doc(ed.id) : db.collection('olympiads').doc();
            const qs = ed.questions.map((q) => ({ id: q.id, type: q.type, q: q.q.trim(), image: q.image || '', options: q.type === 'single' ? q.options.map((o) => String(o).trim()) : [], points: +q.points || 0 }));
            const answers = {}; ed.questions.forEach((q) => { answers[q.id] = q.type === 'single' ? (q.key == null ? -1 : +q.key) : String(q.key || '').split('|').map((x) => x.trim()).filter(Boolean); });
            const data = { title: ed.title, subject: ed.subject, description: ed.description, startAt: ed.startAt, endAt: ed.endAt, durationMin: ed.durationMin,
                showOnHome: !!ed.showOnHome, registration: ed.registration !== false, shuffle: !!ed.shuffle, maxLeaves: +ed.maxLeaves || 0, gradeMin: +ed.gradeMin || 0, gradeMax: +ed.gradeMax || 0, published: andPublish ? true : !!ed.published, resultsPublished: !!ed.resultsPublished, questions: qs, qCount: qs.length,
                maxScore: qs.reduce((s, q) => s + q.points, 0), updatedAt: Date.now() };
            if (!ed.id) data.createdAt = Date.now();
            if (andPublish) { data.publishedAt = Date.now(); data.publishedBy = auth.currentUser.uid; }
            await db.collection('olympiadKeys').doc(ref.id).set({ answers, updatedAt: Date.now() });
            await ref.set(data, { merge: true });
            ed.id = ref.id; Object.assign(ed, data);
            UI().toast(andPublish ? 'Олимпиада опубликована — кнопка появилась на главной.' : 'Сохранено.', 'ok');
            if (andPublish) { ed = null; return load(); }
            renderEditor();
        } catch (e) { UI().alert('Не удалось сохранить: ' + e.message); btns.forEach((b) => { b.disabled = false; }); }
    }

    // «Вставить списком»: blocks separated by an empty line.
    //   1. Сколько будет 2+2?        ← question
    //   A) 3                          ← options A)–F)
    //   *B) 4                         ← «*» marks the correct one (or a line «Ответ: B»)
    //   Баллы: 2                      ← optional
    // A block without options is a short-answer question; its «Ответ: …» line is the answer (several via «|»).
    function parseBlocks(text) {
        const out = [];
        String(text || '').replace(/\r/g, '').split(/\n\s*\n/).forEach((blk) => {
            const lines = blk.split('\n').map((l) => l.trim()).filter(Boolean); if (!lines.length) return;
            const q = { id: rid(), type: 'single', q: '', image: '', options: [], points: 1, key: null }; const qLines = []; let ans = '';
            lines.forEach((l) => {
                let m;
                if ((m = /^(\*?)\s*([A-Fa-fА-Еа-е])[).]\s*(.+)$/.exec(l)) && qLines.length) { if (m[1]) q.key = q.options.length; q.options.push(m[3].replace(/\s*\*$/, '')); if (/\*$/.test(m[3])) q.key = q.options.length - 1; }
                else if ((m = /^(ответ|answer|javob)\s*[:\-]\s*(.+)$/i.exec(l))) ans = m[2].trim();
                else if ((m = /^(баллы|points|ball)\s*[:\-]\s*(\d+)/i.exec(l))) q.points = +m[2];
                else if ((m = /^(картинка|image|rasm)\s*[:\-]\s*(https:\/\/\S+)/i.exec(l))) q.image = m[2];
                else qLines.push(l);
            });
            q.q = qLines.join('\n').replace(/^\d+[.)]\s*/, '');
            if (q.options.length >= 2) {
                if (q.key == null && ans) { const k = 'ABCDEFАБВГДЕ'.indexOf(ans.charAt(0).toUpperCase()); q.key = k >= 6 ? k - 6 : k >= 0 ? k : null; }
            } else { q.type = 'text'; q.options = []; q.key = ans; }
            if (q.q) out.push(q);
        });
        return out;
    }
    async function importText() {
        readForm();
        const t = await UI().prompt('Вставьте вопросы. Между вопросами — пустая строка. Варианты: «A) …», правильный отметьте «*» в начале («*B) …») или строкой «Ответ: B». Без вариантов — вопрос с коротким ответом («Ответ: 42»). Можно добавить строку «Баллы: 2».', '',
            { multiline: true, ok: 'Добавить вопросы', placeholder: '1. Сколько будет 7 × 8?\nA) 54\n*B) 56\nC) 64\nD) 58\n\n2. Решите: 3x = 21. x = ?\nОтвет: 7\nБаллы: 2' });
        if (!t) return;
        const qs = parseBlocks(t);
        if (!qs.length) return UI().alert('Не нашёл ни одного вопроса. Проверьте, что между вопросами есть пустая строка.');
        const empty = ed.questions.length === 1 && !ed.questions[0].q.trim();
        ed.questions = (empty ? [] : ed.questions).concat(qs);
        renderEditor();
        const noKey = qs.filter((q) => (q.type === 'single' ? q.key == null : !q.key)).length;
        UI().toast('Добавлено вопросов: ' + qs.length + (noKey ? '. Без правильного ответа: ' + noKey + ' — отметьте их.' : '.'), noKey ? 'warn' : 'ok');
    }

    async function publish(id, on) {
        const o = list.find((x) => x.id === id); if (!o) return;
        if (on) { await openEditor(id); return save(true); }
        if (!(await UI().confirm('Снять «' + o.title + '» с публикации? Кнопка исчезнет с главной, страница олимпиады станет недоступна.'))) return;
        try { await db.collection('olympiads').doc(id).update({ published: false, updatedAt: Date.now() }); UI().toast('Снято с публикации.', 'ok'); load(); }
        catch (e) { UI().alert('Ошибка: ' + e.message); }
    }
    async function remove(id) {
        const o = list.find((x) => x.id === id); if (!o) return;
        if (!(await UI().confirm('Удалить олимпиаду «' + o.title + '» вместе с ответами участников (' + (o._n || 0) + ')? Это нельзя отменить.'))) return;
        try {
            const at = await db.collection('olympiadAttempts').where('oid', '==', id).get();
            const refs = []; at.forEach((d) => refs.push(d.ref));
            for (let i = 0; i < refs.length; i += 400) { const b = db.batch(); refs.slice(i, i + 400).forEach((r) => b.delete(r)); await b.commit(); }
            await db.collection('olympiadKeys').doc(id).delete().catch(() => {});
            await db.collection('olympiads').doc(id).delete();
            UI().toast('Олимпиада удалена.', 'ok'); load();
        } catch (e) { UI().alert('Ошибка: ' + e.message); }
    }

    // ───────── results ─────────
    function grade(o, key, att) {
        let score = 0;
        (o.questions || []).forEach((q) => {
            const a = (att.answers || {})[q.id], k = key[q.id];
            if (a == null || a === '') return;
            if (q.type === 'single' ? +a === +k : (Array.isArray(k) ? k : [k]).some((x) => norm(x) === norm(a))) score += +q.points || 0;
        });
        return score;
    }
    const msOf = (t) => (t && t.toMillis ? t.toMillis() : +t || 0);
    async function results(id) {
        const o = list.find((x) => x.id === id); if (!o) return;
        root.innerHTML = '<div class="empty-state">Загрузка…</div>';
        let rows = [], key = {};
        try {
            const [at, k] = await Promise.all([db.collection('olympiadAttempts').where('oid', '==', id).get(), db.collection('olympiadKeys').doc(id).get()]);
            key = k.exists ? (k.data().answers || {}) : {};
            at.forEach((d) => rows.push(Object.assign({ id: d.id, ref: d.ref }, d.data())));
        } catch (e) { root.innerHTML = '<div class="empty-state">Не удалось загрузить: ' + esc(e.message) + '</div>'; return; }
        rows.forEach((r) => {
            r.calc = grade(o, key, r);
            const st = msOf(r.startedAt), en = r.submittedAt ? msOf(r.submittedAt) : st + (o.durationMin || 0) * 60000;
            r.spent = Math.max(0, en - st);
        });
        rows.sort((a, b) => b.calc - a.calc || a.spent - b.spent);
        rows.forEach((r, i) => { r.place = i > 0 && rows[i - 1].calc === r.calc && rows[i - 1].spent === r.spent ? rows[i - 1].place : i + 1; });
        // place inside the region and inside the class (same rule: score, then time)
        const within = (field, out, nField) => { const by = {}; rows.forEach((r) => { const k = r[field] || ''; if (!k) return; (by[k] = by[k] || []).push(r); });
            Object.keys(by).forEach((k) => { const L = by[k]; L.forEach((r, i) => { r[out] = i > 0 && L[i - 1].calc === r.calc && L[i - 1].spent === r.spent ? L[i - 1][out] : i + 1; r[nField] = L.length; }); }); };
        within('region', 'placeRegion', 'regionN'); within('grade', 'placeGrade', 'gradeN');
        // how many solved each question — shows a question that is too hard, too easy or has a wrong key
        const solved = (o.questions || []).map((q) => { let ok = 0, tried = 0; rows.forEach((r) => { const a = (r.answers || {})[q.id]; if (a == null || a === '') return; tried++; const k = key[q.id];
            if (q.type === 'single' ? +a === +k : (Array.isArray(k) ? k : [k]).some((x) => norm(x) === norm(a))) ok++; }); return { q, ok, tried }; });
        const regions = Array.from(new Set(rows.map((r) => r.region).filter(Boolean))).sort();
        const grades = Array.from(new Set(rows.map((r) => r.grade).filter(Boolean))).sort((a, b) => (+a || 99) - (+b || 99));
        let fRegion = '', fGrade = '';
        const mm = (ms) => Math.floor(ms / 60000) + ':' + pad(Math.floor(ms / 1000) % 60);
        root.innerHTML = '<div class="oly-top"><button type="button" class="btn-small" id="olyBack2">← Ко всем олимпиадам</button><span class="oly-sp"></span>' +
            '<span class="meta" id="olyMsgR"></span><button type="button" class="btn-small" id="olyCsv"' + (rows.length ? '' : ' disabled') + '>Excel (CSV)</button>' +
            '<button type="button" class="btn-small primary" id="olyGrade"' + (rows.length ? '' : ' disabled') + '>Проверить и сохранить баллы</button>' +
            '<button type="button" class="btn-small primary" id="olyPubRes"' + (rows.length ? '' : ' disabled') + '>' + (o.resultsPublished ? 'Обновить опубликованные результаты' : 'Опубликовать результаты') + '</button></div>' +
            '<h3 style="margin:.6rem 0 .3rem">' + esc(o.title) + '</h3><p class="meta" style="margin:0 0 .8rem">Участников: ' + rows.length + ' · сдали: ' + rows.filter((r) => r.status === 'submitted').length + ' · максимум ' + (o.maxScore || 0) + ' б. ' +
            (o.resultsPublished ? '· <b style="color:#1e8449">результаты опубликованы</b>' : '· результаты пока видны только вам') + '</p>' +
            (rows.length ? '<div class="oly-filt"><label>Регион <select id="olyFR"><option value="">все</option>' + regions.map((x) => '<option>' + esc(x) + '</option>').join('') + '</select></label>' +
                '<label>Класс <select id="olyFG"><option value="">все</option>' + grades.map((x) => '<option>' + esc(x) + '</option>').join('') + '</select></label><span class="meta" id="olyFN"></span></div>' +
                '<div class="cur-tw" id="olyTbl"></div>' +
                '<details class="oly-an"><summary>Сколько решили каждый вопрос</summary><div class="cur-tw"><table class="cur-t"><thead><tr><th>№</th><th>Вопрос</th><th>Решили</th><th>Отвечали</th></tr></thead><tbody>' +
                solved.map((x, i) => { const pc = rows.length ? Math.round(x.ok / rows.length * 100) : 0; return '<tr><td>' + (i + 1) + '</td><td>' + esc(String(x.q.q || '').slice(0, 90)) + '</td><td><b>' + pc + '%</b> (' + x.ok + ')' + (pc < 5 && rows.length > 20 ? ' <span class="cur-chip warn">проверьте ключ</span>' : '') + '</td><td>' + x.tried + '</td></tr>'; }).join('') +
                '</tbody></table></div></details>' : '<div class="empty-state">Пока никто не участвовал.</div>');
        $('olyBack2').onclick = () => load();
        const drawTable = () => {
            const box = $('olyTbl'); if (!box) return;
            const shown = rows.filter((r) => (!fRegion || r.region === fRegion) && (!fGrade || r.grade === fGrade));
            $('olyFN').textContent = 'Показано: ' + shown.length + (shown.length > 500 ? ' (первые 500 — полный список в Excel)' : '');
            box.innerHTML = '<table class="cur-t"><thead><tr><th>Место</th>' + (fRegion ? '<th>В регионе</th>' : '') + '<th>Участник</th><th>Регион / школа</th><th>Класс</th><th>Баллы</th><th>Время</th><th>Уходил</th><th>Статус</th></tr></thead><tbody>' +
                shown.slice(0, 500).map((r) => '<tr><td><b>' + r.place + '</b></td>' + (fRegion ? '<td><b>' + (r.placeRegion || '—') + '</b></td>' : '') + '<td>' + esc(r.name || '—') + (r.nickname ? ' <small>@' + esc(r.nickname) + '</small>' : '') + '</td>' +
                    '<td>' + esc(r.region || '—') + (r.district || r.school ? '<br><small>' + esc([r.district, r.school].filter(Boolean).join(', ')) + '</small>' : '') + '</td><td>' + esc(r.grade || '—') + '</td>' +
                    '<td><b>' + r.calc + '</b> / ' + (o.maxScore || 0) + (r.score != null && r.score !== r.calc ? ' <small>(сохранено ' + r.score + ')</small>' : '') + '</td><td>' + mm(r.spent) + '</td><td>' + (r.leaves ? '<span class="cur-chip warn">' + r.leaves + ' раз</span>' : '—') + '</td><td>' + (r.status === 'submitted' ? '<span class="cur-chip ok">сдал(а)</span>' : '<span class="cur-chip">не нажал «Сдать» — засчитаны сохранённые ответы</span>') + '</td></tr>').join('') + '</tbody></table>';
        };
        if ($('olyFR')) { $('olyFR').onchange = (e) => { fRegion = e.target.value; drawTable(); }; $('olyFG').onchange = (e) => { fGrade = e.target.value; drawTable(); }; drawTable(); }
        const writeScores = async (publishToo) => {
            const ops = rows.map((r) => ({ ref: r.ref, data: { score: r.calc, maxScore: o.maxScore || 0, place: r.place, participants: rows.length, placeRegion: r.placeRegion || 0, regionN: r.regionN || 0, placeGrade: r.placeGrade || 0, gradeN: r.gradeN || 0, checkedAt: Date.now() } }));
            const msgEl = $('olyMsgR');
            for (let i = 0; i < ops.length; i += 400) { const b = db.batch(); ops.slice(i, i + 400).forEach((x) => b.update(x.ref, x.data)); await b.commit(); if (msgEl) msgEl.textContent = 'Сохраняю… ' + Math.min(ops.length, i + 400) + ' / ' + ops.length; }
            if (msgEl) msgEl.textContent = '';
            if (publishToo) {
                const short = (n) => { const p = String(n || '').trim().split(/\s+/); return p[0] + (p[1] ? ' ' + p[1].charAt(0) + '.' : ''); };
                await db.collection('olympiads').doc(id).update({ resultsPublished: true, participants: rows.length, resultsAt: Date.now(),
                    leaderboard: rows.slice(0, 10).map((r) => ({ place: r.place, name: short(r.name) || 'Участник', score: r.calc })) });
                o.resultsPublished = true;
            }
        };
        $('olyGrade').onclick = async () => { try { await writeScores(false); UI().toast('Баллы сохранены (' + rows.length + ').', 'ok'); results(id); } catch (e) { UI().alert('Ошибка: ' + e.message); } };
        $('olyPubRes').onclick = async () => {
            if (Date.now() < o.endAt && !(await UI().confirm('Олимпиада ещё идёт (до ' + fmt(o.endAt) + '). Опубликовать результаты сейчас?', { danger: false }))) return;
            if (!(await UI().confirm('Опубликовать результаты? Каждый участник увидит свой балл и место, а на странице олимпиады появится топ-10.', { danger: false, ok: 'Опубликовать' }))) return;
            try { await writeScores(true); UI().toast('Результаты опубликованы.', 'ok'); results(id); } catch (e) { UI().alert('Ошибка: ' + e.message); }
        };
        $('olyCsv').onclick = () => {
            const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
            const csv = '\ufeff' + ['Место;Место в регионе;Место в классе;Имя;Никнейм;Регион;Район;Школа;Класс;Баллы;Максимум;Время (мин);Уходил со страницы;Статус'].concat(rows.map((r) => [r.place, r.placeRegion || '', r.placeGrade || '', q(r.name), q(r.nickname), q(r.region), q(r.district), q(r.school), q(r.grade), r.calc, o.maxScore || 0, Math.round(r.spent / 6000) / 10, r.leaves || 0, r.status === 'submitted' ? 'сдал' : 'не сдал'].join(';'))).join('\n');
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'olympiad-' + (o.title || id).replace(/[^\wа-яё-]+/gi, '_').slice(0, 40) + '.csv'; a.click();
        };
    }

    // ───────── registrations (before the start): numbers by region and class, CSV ─────────
    async function registrations(id) {
        const o = list.find((x) => x.id === id); if (!o) return;
        root.innerHTML = '<div class="empty-state">Загрузка…</div>';
        let rows = [];
        try { const s = await db.collection('olympiadRegs').where('oid', '==', id).get(); s.forEach((d) => rows.push(d.data())); }
        catch (e) { root.innerHTML = '<div class="empty-state">Не удалось загрузить: ' + esc(e.message) + '. Опубликованы ли новые правила Firestore?</div>'; return; }
        const by = (f) => { const m = {}; rows.forEach((r) => { const k = r[f] || '—'; m[k] = (m[k] || 0) + 1; }); return Object.keys(m).map((k) => [k, m[k]]).sort((a, b) => b[1] - a[1]); };
        const bar = (L) => { const max = Math.max(1, ...L.map((x) => x[1])); return L.map((x) => '<div class="oly-rb"><span>' + esc(x[0]) + '</span><i style="width:' + Math.round(x[1] / max * 100) + '%"></i><b>' + x[1] + '</b></div>').join(''); };
        root.innerHTML = '<div class="oly-top"><button type="button" class="btn-small" id="olyBack3">← Ко всем олимпиадам</button><span class="oly-sp"></span><button type="button" class="btn-small" id="olyRegCsv"' + (rows.length ? '' : ' disabled') + '>Excel (CSV)</button></div>' +
            '<h3 style="margin:.6rem 0 .3rem">' + esc(o.title) + ' — регистрации</h3><p class="meta" style="margin:0 0 .8rem">Всего: <b>' + rows.length + '</b> · начало ' + fmt(o.startAt) + '</p>' +
            (rows.length ? '<div class="oly-rgrid"><div class="admin-card"><h4>По регионам</h4>' + bar(by('region')) + '</div><div class="admin-card"><h4>По классам</h4>' + bar(by('grade')) + '</div></div>' : '<div class="empty-state">Пока никто не зарегистрировался.</div>');
        $('olyBack3').onclick = () => load();
        $('olyRegCsv').onclick = () => {
            const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
            const csv = '\ufeff' + ['Имя;Никнейм;Регион;Район;Школа;Класс;Дата регистрации'].concat(rows.map((r) => [q(r.name), q(r.nickname), q(r.region), q(r.district), q(r.school), q(r.grade), q(r.at && r.at.toDate ? r.at.toDate().toLocaleString('ru-RU') : '')].join(';'))).join('\n');
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'registrations-' + (o.title || id).replace(/[^\wа-яё-]+/gi, '_').slice(0, 40) + '.csv'; a.click();
        };
    }

    window.OlympiadAdmin = { load, _parse: parseBlocks, _grade: grade };
})();
