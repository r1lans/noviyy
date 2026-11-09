/* TheStarth — «Олимпиада» button on the home page, under «Пройти тест / Записаться на курс».
 * Shows the nearest olympiad that the admin confirmed and published (Admin panel → «Олимпиада»), with «Показывать кнопку
 * на главной» on, until it ends (and for 7 more days when results are published). Nothing published — nothing shown.
 */
(function () {
    'use strict';
    var box = document.getElementById('olyHero'); if (!box) return;
    var T = {
        ru: { oly: 'Олимпиада', live: 'Идёт сейчас — участвуйте!', soon: 'Начало', res: 'Результаты опубликованы' },
        uz: { oly: 'Olimpiada', live: 'Hozir davom etmoqda — qatnashing!', soon: 'Boshlanishi', res: 'Natijalar e’lon qilindi' },
        en: { oly: 'Olympiad', live: 'Running now — take part!', soon: 'Starts', res: 'Results are out' }
    };
    var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-1.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98 1.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0z"/></svg>';
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var lang = function () { var l = 'ru'; try { l = localStorage.getItem('starthLang') || 'ru'; } catch (e) {} return T[l] ? l : 'ru'; };
    var pick = null;

    function paint() {
        if (!pick) { box.hidden = true; box.innerHTML = ''; return; }
        var L = T[lang()], now = Date.now(), live = now >= pick.startAt && now <= pick.endAt;
        var sub = live ? '<span class="ho-live"></span>' + L.live : now > pick.endAt ? L.res
            : L.soon + ': ' + new Date(pick.startAt).toLocaleString(window.starthLocale ? window.starthLocale() : 'ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
        box.innerHTML = '<a class="hero-oly" href="olympiad?id=' + encodeURIComponent(pick.id) + '"><span class="ho-ic">' + ICON + '</span><span class="ho-tx"><b>' + esc(L.oly) + ': ' + esc(pick.title) + '</b><small>' + sub + '</small></span></a>';
        box.hidden = false;
    }
    function load() {
        if (typeof FIREBASE_READY === 'undefined' || !FIREBASE_READY || typeof db === 'undefined' || !db) return;
        db.collection('olympiads').where('published', '==', true).get().then(function (snap) {
            var now = Date.now(), list = [];
            snap.forEach(function (d) { var o = d.data(); o.id = d.id;
                if (o.showOnHome === false) return;
                if (o.endAt >= now || (o.resultsPublished && now - o.endAt < 7 * 864e5)) list.push(o); });
            // running first, then the nearest upcoming, then recent results
            list.sort(function (a, b) { var r = function (o) { return now >= o.startAt && now <= o.endAt ? 0 : o.startAt > now ? 1 : 2; }; return r(a) - r(b) || a.startAt - b.startAt; });
            pick = list[0] || null; paint();
        }).catch(function () {});
    }
    window.addEventListener('starth-lang-changed', paint);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
