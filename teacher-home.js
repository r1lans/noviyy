/* TheStarth — teacher cabinet «Главная»: today's lessons, what needs doing (unmarked attendance), notices, month earnings.
 *   TeacherHome.render(el, user, profile)
 */
(function () {
    'use strict';
    var X = function (m) { return window.X ? window.X(m) : m; };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var S = function () { return window.StarthSalary; };
    var fmtD = function (iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '.' + p[1] : iso; };

    var CSS = '' +
        '.th-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8rem;margin-bottom:1.2rem}' +
        '@media(max-width:900px){.th-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
        '.th-tile{text-align:left;background:var(--surface);border:1px solid var(--rule);border-radius:16px;padding:1rem 1.1rem;cursor:pointer;font:inherit;color:var(--ink);transition:border-color .15s,transform .15s}' +
        '.th-tile:hover{border-color:var(--accent);transform:translateY(-2px)}' +
        '.th-tile .t{font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}' +
        '.th-tile .v{font-size:1.5rem;font-weight:800;margin:.25rem 0 .1rem;font-family:var(--font-heading)}.th-tile small{color:var(--ink-soft);font-size:.78rem}' +
        '.th-tile.dark{background:linear-gradient(135deg,#161B2E,#232A44);color:#FAF7F0;border-color:#161B2E}.th-tile.dark .t{color:#E3B04B}.th-tile.dark small{color:#C9CCD6}' +
        '.th-cols{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:1rem}' +
        '@media(max-width:900px){.th-cols{grid-template-columns:1fr}}' +
        '.th-card{background:var(--surface);border:1px solid var(--rule);border-radius:16px;padding:1.1rem 1.2rem;margin-bottom:1rem}' +
        '.th-card h3{font-size:1.05rem;margin:0 0 .8rem;display:flex;align-items:center;gap:.5rem}' +
        '.th-les{display:flex;align-items:center;gap:1rem;padding:.75rem 0;border-top:1px dashed var(--rule);flex-wrap:wrap}.th-les:first-of-type{border-top:0}' +
        '.th-time{font-weight:800;font-size:1.15rem;min-width:62px;color:var(--accent)}' +
        '.th-main{flex:1 1 200px;min-width:0}.th-main b{display:block}.th-main small{color:var(--ink-soft);font-size:.8rem}' +
        '.th-acts{display:flex;gap:.4rem;flex-wrap:wrap}' +
        '.th-todo{display:flex;align-items:center;justify-content:space-between;gap:.8rem;padding:.6rem .8rem;border-radius:12px;background:rgba(214,69,69,.07);border:1px solid rgba(214,69,69,.2);margin-bottom:.5rem;flex-wrap:wrap}' +
        '.th-todo b{font-size:.9rem}.th-todo small{display:block;color:var(--ink-soft);font-size:.78rem}' +
        '.th-ok{color:var(--ink-soft);font-size:.9rem;padding:.3rem 0}' +
        '.th-quick{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.2rem}' +
        '.th-quick button{border:1px solid var(--accent);background:var(--surface);color:var(--accent);border-radius:999px;padding:.5rem 1rem;font:inherit;font-size:.9rem;font-weight:600;cursor:pointer}' +
        '.th-quick button:hover{background:var(--accent);color:var(--on-accent)}' +
        '.th-cn{display:flex;gap:.7rem;align-items:flex-start;padding:.8rem .9rem;border-radius:14px;border:1px solid var(--rule);background:var(--surface);margin-bottom:.6rem;border-left:4px solid var(--accent)}' +
        '.th-cn.warn{border-left-color:#c0392b;background:rgba(192,57,43,.05)}.th-cn.praise{border-left-color:#1e8449;background:rgba(30,132,73,.05)}' +
        '.th-cn>svg{width:22px;height:22px;flex:0 0 auto;color:var(--accent);margin-top:.1rem}.th-cn.warn>svg{color:#c0392b}.th-cn.praise>svg{color:#1e8449}' +
        '.th-cn>div{flex:1;min-width:0}.th-cn small{color:var(--ink-soft);font-size:.78rem}.th-cn p{margin:.25rem 0 0;white-space:pre-line;line-height:1.5}' +
        '.th-cn.read{opacity:.75;border-left-color:var(--rule)}';
    function css() { if (document.getElementById('th-style')) return; var s = document.createElement('style'); s.id = 'th-style'; s.textContent = CSS; document.head.appendChild(s); }

    // partner teachers: how long the paid access lasts
    function accessHtml(p) {
        var until = (p && p.partnerUntil) || 0, left = Math.ceil((until - Date.now()) / 86400000);
        var d = until ? new Date(until).toLocaleDateString('ru-RU') : '—';
        var bad = left <= 0, soon = left > 0 && left <= 5;
        return '<div class="th-card" style="margin-bottom:1rem;border-color:' + (bad ? '#c0392b' : soon ? '#b07a0e' : 'var(--rule)') + '">' +
            '<h3>' + (window.Icons ? Icons.svg('calendar') : '') + esc(X(bad ? 'Доступ к платформе закончился' : 'Доступ к платформе')) + '</h3>' +
            '<p style="margin:.2rem 0 0">' + (bad ? esc(X('Уроки и новые группы недоступны. Чтобы продлить, напишите нам в Telegram @TheStarth.'))
                : esc(X('Оплачено до')) + ' <b>' + esc(d) + '</b>' + (soon ? ' · ' + esc(X('осталось дней:')) + ' ' + left + '. ' + esc(X('Чтобы продлить, напишите нам в Telegram @TheStarth.')) : '')) + '</p></div>';
    }

    async function render(el, user, profile, partner) {
        if (!el) return; css();
        el.innerHTML = '<div class="th-ok">' + esc(X('Загрузка…')) + '</div>';
        var st = await S().loadSettings(), data = await S().loadTeacherData(user.uid);
        var month = S().curMonth(), r = S().compute(data, st, month), today = S().todayStr();
        var groups = data.groups.filter(function (g) { return !g.archived; });
        var students = {}; groups.forEach(function (g) { (g.members || []).forEach(function (m) { students[m.uid || m.nickname] = 1; }); });
        var upAbs = data.absences.filter(function (a) { return a.date >= today; }).sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
        if (window.Cabinet) window.Cabinet.badge('absences', upAbs.length);

        // today's lessons
        var todays = S().upcoming(groups, data.schedule.filter(function (s) { return s.date === today; }), 1, Date.parse(today + 'T00:00:00+05:00'));
        var lessonsHtml = todays.length ? todays.map(function (l) {
            var g = groups.find(function (x) { return x.id === l.groupId; });
            var abs = upAbs.filter(function (a) { return a.date === l.date && (l.groupId ? a.groupId === l.groupId : a.scheduleId === l.scheduleId); });
            var n = g ? (g.members || []).length : 1;
            var room = l.room ? 'video-lesson?room=' + encodeURIComponent(l.room) + (l.groupId ? '&group=' + encodeURIComponent(l.groupId) : '') : '';
            return '<div class="th-les"><div class="th-time">' + esc(l.time) + '</div><div class="th-main"><b>' + esc(l.title) + '</b><small>' +
                (l.kind === 'group' ? n + ' ' + esc(X('учеников')) : esc(X('индивидуальный урок'))) +
                (abs.length ? ' · <span style="color:#b07a0e">' + abs.length + ' ' + esc(X('предупредили')) + ': ' + abs.map(function (a) { return esc(a.name || '@' + a.nickname); }).join(', ') + '</span>' : '') + '</small></div>' +
                '<div class="th-acts">' + (room ? '<a class="btn-primary" style="padding:.5rem 1rem" href="' + room + '">' + esc(X('Начать урок')) + '</a>' : '') +
                (l.groupId ? '<button class="tc-btn" type="button" data-att="' + esc(l.groupId) + '" data-date="' + esc(l.date) + '">' + esc(X('Посещаемость')) + '</button>' : '') + '</div></div>';
        }).join('') : '<div class="th-ok">' + esc(X('Сегодня уроков нет.')) + '</div>';

        // unmarked attendance (last 10 days, group lesson days without a record)
        var todo = [];
        groups.forEach(function (g) {
            var days = S().groupDays(g), t = S().groupTime(g);
            for (var i = 0; i <= 10; i++) {
                var d = S().addDays(today, -i);
                if (days.indexOf((new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7) === -1) continue;
                if (S().lessonAt(d, t || '23:59').getTime() > Date.now()) continue;
                if (g.createdAt && d < String(g.createdAt).slice(0, 10)) continue;
                if (!data.attendance.some(function (a) { return a.groupId === g.id && a.date === d; })) todo.push({ g: g, date: d });
            }
        });
        todo.sort(function (a, b) { return b.date.localeCompare(a.date); });
        var todoHtml = todo.length ? todo.slice(0, 6).map(function (x) {
            // a teacher marks only today's lesson himself; an earlier day is fixed by the curator
            var isToday = x.date === today;
            return '<div class="th-todo"><div><b>' + esc(x.g.name) + ' · ' + esc(fmtD(x.date)) + '</b><small>' +
                esc(X(isToday ? (partner ? 'Посещаемость не отмечена' : 'Посещаемость не отмечена — урок не будет оплачен') : 'Не отмечено. Прошлые уроки отмечает куратор — напишите ему.')) + '</small></div>' +
                (isToday ? '<button class="tc-btn primary" type="button" data-att="' + esc(x.g.id) + '" data-date="' + esc(x.date) + '">' + esc(X('Отметить')) + '</button>' : '') + '</div>';
        }).join('') : '<div class="th-ok">' + (window.Icons ? Icons.svg('check') : '') + ' ' + esc(X('Вся посещаемость отмечена.')) + '</div>';

        var absHtml = upAbs.length ? upAbs.slice(0, 5).map(function (a) {
            return '<div class="th-les"><div class="th-time" style="font-size:.95rem">' + esc(fmtD(a.date)) + '</div><div class="th-main"><b>' + esc(a.name || '@' + a.nickname) + '</b><small>' + esc(a.title || '') + ' · ' + esc(a.time || '') +
                (partner ? '' : ' · <span style="color:' + (a.excused ? '#2e9a43' : '#b07a0e') + '">' + esc(a.excused ? X('за 24 ч+ · не оплачивается') : X('меньше 24 ч · оплачивается')) + '</span>') + '</small></div></div>';
        }).join('') + (upAbs.length > 5 ? '<button class="tc-btn" type="button" data-go="absences">' + esc(X('Все предупреждения')) + '</button>' : '')
            : '<div class="th-ok">' + esc(X('Никто не предупреждал об отсутствии.')) + '</div>';

        // notes from the curator (Admin panel → «Контроль учителей»): unread ones first, «Понятно» marks them read
        var notes = [];
        try { var ns = await db.collection('curatorNotes').where('teacherUid', '==', user.uid).get(); ns.forEach(function (d) { notes.push(Object.assign({ id: d.id }, d.data())); }); } catch (e) { notes = []; }
        notes.sort(function (a, b) { return ((a.readAt ? 1 : 0) - (b.readAt ? 1 : 0)) || ((b.ts || 0) - (a.ts || 0)); });
        var KIND = { note: ['note', 'Замечание куратора'], warn: ['alert', 'Предупреждение от куратора'], praise: ['star', 'Благодарность от куратора'] };
        var shownNotes = notes.filter(function (n) { return !n.readAt || Date.now() - n.readAt < 7 * 864e5; }).slice(0, 5);
        var notesHtml = shownNotes.length ? '<div class="th-card"><h3>' + (window.Icons ? Icons.svg('megaphone') : '') + esc(X('Сообщения от куратора')) + '</h3>' + shownNotes.map(function (n) {
            var k = KIND[n.kind] || KIND.note;
            return '<div class="th-cn ' + esc(n.kind || 'note') + (n.readAt ? ' read' : '') + '">' + (window.Icons ? Icons.svg(k[0]) : '') + '<div><b>' + esc(X(k[1])) + '</b> <small>' +
                esc(new Date(n.ts || 0).toLocaleDateString(window.starthLocale ? window.starthLocale() : 'ru-RU', { day: 'numeric', month: 'long' })) + (n.byName ? ' · ' + esc(n.byName) : '') + '</small><p>' + esc(n.text) + '</p></div>' +
                (n.readAt ? '' : '<button type="button" class="tc-btn primary" data-cn-read="' + esc(n.id) + '">' + esc(X('Понятно')) + '</button>') + '</div>';
        }).join('') + '</div>' : '';

        el.innerHTML =
            notesHtml +
            '<div class="th-quick">' +
                '<button type="button" data-q="new">' + (window.Icons ? Icons.svg('plus') : '') + ' ' + esc(X('Новая группа')) + '</button>' +
                '<button type="button" data-go="groups">' + esc(X('Отметить посещаемость')) + '</button>' +
                '<button type="button" data-go="journal">' + esc(X('Журнал')) + '</button>' +
                (partner ? '' : '<button type="button" data-go="guide">' + esc(X('Инструкция')) + '</button>') + '</div>' +
            (partner ? accessHtml(profile) : '') +
            '<div class="th-tiles">' +
                (partner ? '' : '<button type="button" class="th-tile dark" data-go="salary"><div class="t">' + esc(X('Заработано')) + ' · ' + esc(S().monthName(month)) + '</div><div class="v">' + esc(S().money(r.total, st)) + '</div><small>' + r.paidVisits + ' ' + esc(X('оплачиваемых посещений')) + '</small></button>') +
                '<button type="button" class="th-tile" data-go="groups"><div class="t">' + esc(X('Группы')) + '</div><div class="v">' + groups.length + '</div><small>' + Object.keys(students).length + ' ' + esc(X('учеников')) + '</small></button>' +
                '<button type="button" class="th-tile" data-go="' + (partner ? 'journal' : 'salary') + '"><div class="t">' + esc(X('Посещаемость')) + '</div><div class="v">' + (r.attPct == null ? '—' : r.attPct + '%') + '</div><small>' + esc(X('за этот месяц')) + '</small></button>' +
                '<button type="button" class="th-tile" data-go="absences"><div class="t">' + esc(X('Предупреждения')) + '</div><div class="v">' + upAbs.length + '</div><small>' + esc(X('о пропусках впереди')) + '</small></button>' +
            '</div>' +
            '<div class="th-cols"><div>' +
                '<div class="th-card"><h3>' + (window.Icons ? Icons.svg('calendar') : '') + '' + esc(X('Уроки сегодня')) + '</h3>' + lessonsHtml + '</div>' +
                '<div class="th-card"><h3>' + (window.Icons ? Icons.svg('check-circle') : '') + '' + esc(X('Нужно сделать')) + '</h3>' + todoHtml + '</div>' +
            '</div><div>' +
                '<div class="th-card"><h3>' + (window.Icons ? Icons.svg('bell') : '') + '' + esc(X('Предупредили, что не придут')) + '</h3>' + absHtml + '</div>' +
            '</div></div>';

        el.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { window.Cabinet && Cabinet.go(b.getAttribute('data-go')); }; });
        el.querySelectorAll('[data-cn-read]').forEach(function (b) { b.onclick = function () {
            b.disabled = true;
            db.collection('curatorNotes').doc(b.getAttribute('data-cn-read')).update({ readAt: Date.now() })
                .then(function () { var box = b.closest('.th-cn'); if (box) box.classList.add('read'); b.remove(); })
                .catch(function (e) { b.disabled = false; alert(X('Не удалось') + ': ' + e.message); });
        }; });
        el.querySelectorAll('[data-att]').forEach(function (b) {
            b.onclick = function () { window.Cabinet && Cabinet.go('groups'); if (window.TeacherCabinet && TeacherCabinet.openGroup) TeacherCabinet.openGroup(b.getAttribute('data-att'), 'attendance', b.getAttribute('data-date')); };
        });
        var nb = el.querySelector('[data-q="new"]'); if (nb) nb.onclick = function () { window.Cabinet && Cabinet.go('groups'); setTimeout(function () { window.TeacherCabinet && TeacherCabinet.newGroup && TeacherCabinet.newGroup(); }, 50); };
    }

    window.TeacherHome = { render: render };
})();
