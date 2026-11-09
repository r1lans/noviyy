/* TheStarth — attendance journal, like a school class register: one month per page,
 * students down the side, lesson days across the top, a mark in every cell.
 *
 *   ✓  был        О  опоздал        Н  не был        (empty) not marked yet
 *
 * Who may mark what (the same split is enforced by firestore.rules → match /attendance):
 *   mode 'teacher'  — the group's teacher: ONLY today's lesson. Past and future days are locked («отмечает куратор»).
 *   mode 'curator'  — admin, Куратор TheStarth or the partner curator of the group: any day.
 *   readOnly: true  — a second teacher of the group only looks.
 *
 * Data: attendance/{groupId_yyyy-mm-dd} { groupId, teacherUid (always the group's teacher), curatorUid, date, topic,
 *        marks:{ nickname: 'present'|'late'|'absent' }, studentUids, updatedAt, updatedBy }
 * Usage: StarthAttJournal.mount(el, { group, mode: 'teacher'|'curator', readOnly, onChange(records) }) → { reload() }
 */
(function () {
    'use strict';
    if (window.StarthAttJournal) return;
    var X = function (m) { return window.X ? window.X(m) : m; };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var pad = function (n) { return String(n).padStart(2, '0'); };
    // Tashkent calendar (the rules check the same date)
    var today = function () { var d = new Date(Date.now() + 5 * 3600000); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
    var addDays = function (date, k) { var d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
    var dowOf = function (date) { return (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7; };
    var shiftMonth = function (m, k) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + k; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; return y + '-' + pad(mo + 1); };
    var MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    var DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    var ORDER = ['', 'present', 'late', 'absent'];
    var SIGN = { present: '✓', late: 'О', absent: 'Н' };
    var NAME = { present: 'Был', late: 'Опоздал', absent: 'Не был' };

    function groupDays(g) {
        if (window.StarthSalary && StarthSalary.groupDays) return StarthSalary.groupDays(g);
        return Array.isArray(g && g.days) ? g.days.map(Number) : [];
    }

    var CSS = '' +
        '.aj{--aj-ok:#2e9a43;--aj-late:#c98a12;--aj-no:#d64545}' +
        '.aj-top{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;justify-content:space-between;margin-bottom:.8rem}' +
        '.aj-month{display:flex;align-items:center;gap:.4rem}.aj-month b{min-width:9.5rem;text-align:center;font-size:1.02rem}' +
        '.aj-month button,.aj-btn{border:1px solid var(--rule);background:var(--surface,var(--paper));color:var(--ink);border-radius:9px;padding:.4rem .75rem;font:inherit;font-size:.88rem;font-weight:600;cursor:pointer}' +
        '.aj-month button:hover,.aj-btn:hover{border-color:var(--accent);color:var(--accent)}.aj-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent,#fff)}' +
        '.aj-legend{display:flex;flex-wrap:wrap;gap:.8rem;font-size:.8rem;color:var(--ink-soft)}.aj-legend i{font-style:normal;font-weight:800;margin-right:.25rem}' +
        '.aj-rule{display:flex;gap:.55rem;align-items:flex-start;padding:.65rem .85rem;border-radius:12px;background:var(--accent-tint,var(--paper-alt));font-size:.86rem;margin-bottom:.8rem;line-height:1.45}' +
        '.aj-today{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-bottom:.8rem}.aj-today input{flex:1 1 220px;padding:.5rem .65rem;border:1px solid var(--rule);border-radius:9px;background:var(--paper);color:var(--ink);font:inherit;font-size:16px}' +
        '.aj-wrap{overflow-x:auto;border:1px solid var(--rule);border-radius:14px;background:var(--surface,var(--paper))}' +
        '.aj-t{border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;font-size:.88rem}' +
        '.aj-t th,.aj-t td{border-bottom:1px solid var(--rule);border-right:1px solid var(--rule);padding:0;text-align:center;height:38px}' +
        '.aj-t thead th{background:var(--paper-alt);font-size:.74rem;font-weight:700;color:var(--ink-soft);padding:.3rem .2rem;line-height:1.15;position:sticky;top:0}' +
        '.aj-t thead th b{display:block;font-size:.9rem;color:var(--ink)}.aj-t thead th.today{background:var(--accent);color:var(--on-accent,#fff)}.aj-t thead th.today b{color:inherit}' +
        '.aj-t thead th.extra{font-style:italic}' +
        '.aj-t .aj-name{position:sticky;left:0;z-index:1;background:var(--surface,var(--paper));text-align:left;padding:0 .75rem;min-width:170px;max-width:230px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.aj-t thead .aj-name{z-index:2;background:var(--paper-alt)}.aj-t .aj-name small{display:block;color:var(--ink-soft);font-size:.72rem}' +
        '.aj-c{width:42px;min-width:42px;font-weight:800;font-size:1rem;user-select:none}' +
        '.aj-c.ed{cursor:pointer}.aj-c.ed:hover{background:var(--accent-tint,rgba(0,0,0,.05))}.aj-c.lock{background:repeating-linear-gradient(135deg,transparent 0 6px,rgba(127,127,127,.06) 6px 12px)}' +
        '.aj-c.today{box-shadow:inset 0 0 0 2px var(--accent)}' +
        '.aj-c.present{color:var(--aj-ok)}.aj-c.late{color:var(--aj-late)}.aj-c.absent{color:var(--aj-no);background:rgba(214,69,69,.08)}' +
        '.aj-c .aj-w{display:block;font-size:.6rem;font-weight:700;color:#b07a0e;line-height:1}' +
        '.aj-c.saving{opacity:.45}.aj-c.err{outline:2px solid var(--aj-no);outline-offset:-2px}' +
        '.aj-sum{min-width:64px;padding:0 .4rem!important;font-weight:700}.aj-sum small{display:block;font-weight:500;color:var(--ink-soft);font-size:.7rem}' +
        '.aj-foot td{background:var(--paper-alt);font-size:.75rem;color:var(--ink-soft);font-weight:700}' +
        '.aj-msg{font-size:.85rem;margin-top:.6rem;color:var(--ink-soft)}.aj-msg.err{color:var(--aj-no)}' +
        '.aj-empty{padding:1.4rem;text-align:center;color:var(--ink-soft)}' +
        '.aj-hd{cursor:default}.aj-hd.ed{cursor:pointer}.aj-hd.ed:hover{outline:2px solid var(--accent);outline-offset:-2px}';
    function css() { if (document.getElementById('aj-css')) return; var st = document.createElement('style'); st.id = 'aj-css'; st.textContent = CSS; document.head.appendChild(st); }

    function mount(el, o) {
        css();
        var g = o.group, mode = o.mode === 'curator' ? 'curator' : 'teacher', ro = !!o.readOnly;
        var month = (o.date || today()).slice(0, 7), recs = {}, absences = [], timers = {}, saving = {}, msg = '';
        var members = function () { return (g.members || []).filter(function (m) { return m && m.nickname; }); };
        var canEdit = function (date) { return !ro && (mode === 'curator' || date === today()); };

        async function q(fn) { try { var s = await fn(); var out = []; s.forEach(function (d) { out.push(Object.assign({ id: d.id }, d.data())); }); return out; } catch (e) { return null; } }
        async function load() {
            el.innerHTML = '<div class="aj-empty">' + esc(X('Загрузка…')) + '</div>';
            var me = (window.auth && auth.currentUser) ? auth.currentUser.uid : '';
            var col = db.collection('attendance');
            // the plain group query works for admins and the group's teachers; a partner curator must also filter by himself
            var list = await q(function () { return col.where('groupId', '==', g.id).get(); });
            if (!list && me) list = await q(function () { return col.where('groupId', '==', g.id).where('curatorUid', '==', me).get(); });
            if (!list && me) list = await q(function () { return col.where('groupId', '==', g.id).where('teacherUid', '==', me).get(); });
            recs = {}; (list || []).forEach(function (a) { recs[a.date] = a; });
            absences = (await q(function () { return db.collection('absences').where('teacherUid', '==', g.teacherUid).get(); }) || []).filter(function (a) { return a.groupId === g.id; });
            if (o.onChange) try { o.onChange(Object.keys(recs).map(function (k) { return recs[k]; })); } catch (e) {}
            render();
        }
        function dates() {
            var days = groupDays(g), out = [], d = month + '-01';
            while (d.slice(0, 7) === month) { if (days.indexOf(dowOf(d)) !== -1) out.push(d); d = addDays(d, 1); }
            var extra = Object.keys(recs).filter(function (x) { return x.slice(0, 7) === month && out.indexOf(x) === -1; });
            if (today().slice(0, 7) === month && out.indexOf(today()) === -1 && extra.indexOf(today()) === -1 && !ro && mode === 'teacher') extra.push(today());
            return { list: out.concat(extra).sort(), extra: extra };
        }
        function warnOf(date, m) { return absences.find(function (a) { return a.date === date && (a.uid === m.uid || a.nickname === m.nickname); }); }
        function stats(m, list) {
            var marked = 0, ok = 0, no = 0, late = 0;
            Object.keys(recs).forEach(function (d) { var s = recs[d].marks && recs[d].marks[m.nickname]; if (!s) return; marked++; if (s === 'absent') no++; else { ok++; if (s === 'late') late++; } });
            return { pct: marked ? Math.round(ok / marked * 100) : null, no: no, late: late };
        }
        function render() {
            var D = dates(), ms = members(), t = today(), lockedToday = mode === 'teacher' && !ro;
            var rule = ro ? X('Вы второй преподаватель этой группы — журнал только для просмотра.')
                : mode === 'teacher' ? X('Вы отмечаете только сегодняшний урок. Прошлые и будущие уроки отмечает куратор — если нужно исправить, напишите ему.')
                : X('Вы куратор: можно отметить или исправить любой день. Нажмите на клетку: ✓ был → О опоздал → Н не был → пусто.');
            var head = '<div class="aj-top"><div class="aj-month"><button type="button" data-m="-1" aria-label="Предыдущий месяц">‹</button><b>' + esc(X(MONTHS[+month.slice(5, 7) - 1])) + ' ' + month.slice(0, 4) + '</b><button type="button" data-m="1" aria-label="Следующий месяц">›</button>' +
                (month !== t.slice(0, 7) ? '<button type="button" data-m="0">' + esc(X('Сегодня')) + '</button>' : '') + '</div>' +
                '<div class="aj-legend"><span><i style="color:var(--aj-ok)">✓</i>' + esc(X('был')) + '</span><span><i style="color:var(--aj-late)">О</i>' + esc(X('опоздал')) + '</span><span><i style="color:var(--aj-no)">Н</i>' + esc(X('не был')) + '</span><span><i style="color:#b07a0e">!</i>' + esc(X('предупредил')) + '</span></div></div>' +
                '<div class="aj-rule">' + (window.Icons ? Icons.svg(ro || mode === 'teacher' ? 'lock' : 'check') : '') + '<span>' + esc(rule) + '</span></div>';
            var todayBox = '';
            if (lockedToday && D.list.indexOf(t) !== -1) {
                var tr = recs[t] || {};
                todayBox = '<div class="aj-today"><input type="text" id="ajTopic" maxlength="120" placeholder="' + esc(X('Тема сегодняшнего урока (по желанию)')) + '" value="' + esc(tr.topic || '') + '">' +
                    '<button type="button" class="aj-btn primary" data-all="' + t + '">' + esc(X('Все были')) + '</button></div>';
            }
            if (!ms.length) { el.innerHTML = '<div class="aj">' + head + '<div class="aj-empty">' + esc(X('В группе пока нет учеников.')) + '</div></div>'; bind(); return; }
            if (!D.list.length) {
                el.innerHTML = '<div class="aj">' + head + '<div class="aj-empty">' + esc(X('В этом месяце нет дней уроков. Укажите дни недели в расписании группы (например «Пн Ср Пт 18:00»).')) + '</div></div>'; bind(); return;
            }
            var th = D.list.map(function (d) {
                var r = recs[d], cls = (d === t ? 'today ' : '') + (D.extra.indexOf(d) !== -1 ? 'extra ' : '') + (canEdit(d) ? 'ed' : '');
                var title = (r && r.topic ? X('Тема') + ': ' + r.topic + '\n' : '') + (canEdit(d) ? X('Нажмите, чтобы отметить всех: был') : (mode === 'teacher' && !ro ? X('Этот день отмечает куратор') : ''));
                return '<th class="aj-hd ' + cls + '" data-hd="' + d + '" title="' + esc(title) + '"><b>' + (+d.slice(8)) + '</b>' + esc(X(DOW[dowOf(d)])) + '</th>';
            }).join('');
            var rows = ms.map(function (m) {
                var s = stats(m, D.list);
                return '<tr><td class="aj-name" title="@' + esc(m.nickname) + '">' + esc(m.name || '@' + m.nickname) + '<small>@' + esc(m.nickname) + '</small></td>' + D.list.map(function (d) {
                    var r = recs[d], v = (r && r.marks && r.marks[m.nickname]) || '', w = warnOf(d, m), ed = canEdit(d);
                    var tip = (v ? X(NAME[v]) : X('не отмечено')) + (w ? ' · ' + X(w.excused ? 'предупредил за 24 ч+' : 'предупредил меньше чем за 24 ч') + (w.reason ? ' «' + w.reason + '»' : '') : '') + (!ed && !ro && mode === 'teacher' ? ' · ' + X('отмечает куратор') : '');
                    return '<td class="aj-c ' + v + (ed ? ' ed' : ' lock') + (d === t ? ' today' : '') + (saving[d] ? ' saving' : '') + '" data-d="' + d + '" data-n="' + esc(m.nickname) + '" title="' + esc(tip) + '"' + (ed ? ' role="button" tabindex="0"' : '') + '>' +
                        (SIGN[v] || '') + (w ? '<span class="aj-w">!</span>' : '') + '</td>';
                }).join('') + '<td class="aj-sum">' + (s.pct == null ? '—' : s.pct + '%') + '<small>' + (s.no ? s.no + ' ' + X('Н') : '') + (s.late ? ' ' + s.late + ' ' + X('О') : '') + '</small></td></tr>';
            }).join('');
            var foot = '<tr class="aj-foot"><td class="aj-name">' + esc(X('Было на уроке')) + '</td>' + D.list.map(function (d) {
                var r = recs[d]; if (!r || !r.marks) return '<td>—</td>';
                var n = ms.filter(function (m) { var v = r.marks[m.nickname]; return v === 'present' || v === 'late'; }).length;
                return '<td>' + n + '/' + ms.length + '</td>';
            }).join('') + '<td></td></tr>';
            el.innerHTML = '<div class="aj">' + head + todayBox + '<div class="aj-wrap"><table class="aj-t"><thead><tr><th class="aj-name">' + esc(X('Ученик')) + '</th>' + th + '<th class="aj-sum">%</th></tr></thead><tbody>' + rows + foot + '</tbody></table></div>' +
                '<div class="aj-msg' + (/^!/.test(msg) ? ' err' : '') + '" id="ajMsg">' + esc(msg.replace(/^!/, '')) + '</div></div>';
            bind();
            // scroll today's column into view
            var tc = el.querySelector('th.today'); var wrap = el.querySelector('.aj-wrap');
            if (tc && wrap && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = Math.max(0, tc.offsetLeft - wrap.clientWidth / 2);
        }
        function bind() {
            el.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { var k = +b.getAttribute('data-m'); month = k ? shiftMonth(month, k) : today().slice(0, 7); render(); }; });
            el.querySelectorAll('.aj-c.ed').forEach(function (c) {
                var go = function () { cycle(c.getAttribute('data-d'), c.getAttribute('data-n')); };
                c.onclick = go; c.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
            });
            el.querySelectorAll('.aj-hd.ed').forEach(function (h) { h.onclick = function () { allPresent(h.getAttribute('data-hd')); }; });
            var ab = el.querySelector('[data-all]'); if (ab) ab.onclick = function () { allPresent(ab.getAttribute('data-all')); };
            var tp = el.querySelector('#ajTopic'); if (tp) tp.oninput = function () { var d = today(); var r = ensure(d); r.topic = tp.value.slice(0, 120); queue(d); };
        }
        function ensure(d) {
            if (!recs[d]) recs[d] = { id: g.id + '_' + d, groupId: g.id, date: d, topic: '', marks: {}, _new: true };
            if (!recs[d].marks) recs[d].marks = {};
            return recs[d];
        }
        function cycle(d, nick) {
            if (!canEdit(d)) return;
            var r = ensure(d), v = r.marks[nick] || '';
            var nx = ORDER[(ORDER.indexOf(v) + 1) % ORDER.length];
            if (nx) r.marks[nick] = nx; else delete r.marks[nick];
            queue(d); render();
        }
        function allPresent(d) {
            if (!canEdit(d)) return;
            var r = ensure(d); members().forEach(function (m) { if (!r.marks[m.nickname]) r.marks[m.nickname] = 'present'; });
            queue(d); render();
        }
        function queue(d) { clearTimeout(timers[d]); timers[d] = setTimeout(function () { save(d); }, 700); }
        async function save(d) {
            var r = recs[d]; if (!r || !canEdit(d)) return;
            saving[d] = true; msg = X('Сохраняю…');
            var ref = db.collection('attendance').doc(g.id + '_' + d);
            try {
                var empty = !Object.keys(r.marks || {}).length && !(r.topic || '').trim();
                if (empty) { if (!r._new) await ref.delete(); delete recs[d]; }
                else {
                    var data = { groupId: g.id, teacherUid: g.teacherUid, curatorUid: g.curatorUid || '', date: d, topic: (r.topic || '').trim().slice(0, 120), marks: r.marks,
                        studentUids: (g.memberUids || []).slice(), updatedAt: new Date().toISOString(), updatedBy: (window.auth && auth.currentUser) ? auth.currentUser.uid : '' };
                    await ref.set(data); recs[d] = Object.assign({ id: ref.id }, data);
                }
                msg = X('Сохранено') + ' · ' + d.slice(8) + '.' + d.slice(5, 7);
            } catch (e) {
                msg = '!' + (/permission/i.test(e.message || '') ? X('Нет прав отметить этот день. Прошлые и будущие уроки отмечает куратор.') : X('Не удалось сохранить: ') + e.message);
                await load(); saving[d] = false; return;
            }
            saving[d] = false;
            if (o.onChange) try { o.onChange(Object.keys(recs).map(function (k) { return recs[k]; }).filter(function (x) { return !x._new; })); } catch (e) {}
            render();
        }
        load();
        return { reload: load, setMonth: function (m) { month = m; render(); } };
    }
    window.StarthAttJournal = { mount: mount, today: today };
})();
