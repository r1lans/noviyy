/* TheStarth — «Вести свои уроки на TheStarth»: an outside teacher asks to use our video lessons, board and groups.
 * Shown in the personal cabinet -> Профиль (students' accounts). Writes partnerStatus: 'pending' + partnerApply on the
 * person's own profile (Firestore rules allow only that); the admin approves it in Admin panel -> Партнёры.
 * For partners it shows how long the paid access lasts.
 */
(function () {
    'use strict';
    const X = (m) => (window.X ? window.X(m) : m);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ic = (n) => (window.Icons ? window.Icons.svg(n) : '');
    let user = null, profile = {};

    function css() {
        if (document.getElementById('pa-css')) return;
        const st = document.createElement('style'); st.id = 'pa-css';
        st.textContent = '.pa-card{margin-top:1.2rem;border:1px solid var(--rule);border-radius:16px;padding:1.1rem 1.2rem;background:var(--paper)}' +
            '.pa-card h3{margin:0 0 .3rem;font-size:1.08rem;display:flex;gap:.45rem;align-items:center}.pa-card h3 svg{width:20px;height:20px;color:var(--accent);flex-shrink:0}' +
            '.pa-card p{margin:.2rem 0;color:var(--ink-soft);font-size:.92rem}.pa-card ul{margin:.5rem 0 .8rem 1.1rem;padding:0;color:var(--ink);font-size:.92rem}' +
            '.pa-form{display:flex;flex-direction:column;gap:.55rem;margin-top:.6rem}.pa-form textarea,.pa-form input{width:100%;box-sizing:border-box;padding:.6rem .75rem;border:1px solid var(--rule);border-radius:10px;background:var(--paper);color:var(--ink);font:inherit;font-size:16px}' +
            '.pa-form textarea{min-height:90px;resize:vertical}.pa-msg{font-size:.88rem;margin-top:.3rem}.pa-ok{color:#1e7a3a}.pa-err{color:#a1271b}';
        document.head.appendChild(st);
    }
    function mount() {
        let box = document.getElementById('partnerApply');
        if (!box) {
            const panel = document.querySelector('.cab-panel[data-p="profile"]'); if (!panel) return null;
            box = document.createElement('div'); box.id = 'partnerApply'; panel.appendChild(box);
        }
        return box;
    }
    function render() {
        const box = mount(); if (!box) return; css();
        const role = profile.role || 'student', st = profile.partnerStatus || '';
        if (role === 'teacher' || role === 'curator') { box.innerHTML = ''; return; }   // our own teachers do not need it
        if (role === 'partner' || role === 'partner_curator') {
            const until = profile.partnerUntil || 0, ok = until > Date.now();
            box.innerHTML = '<div class="pa-card"><h3>' + ic('calendar') + esc(X('Доступ к платформе')) + '</h3>' +
                '<p>' + (ok ? esc(X('Оплачено до')) + ' <b>' + esc(new Date(until).toLocaleDateString('ru-RU')) + '</b>.' : esc(X('Доступ закончился — уроки и новые группы недоступны.'))) + ' ' +
                esc(X('Продлить: напишите нам в Telegram @TheStarth.')) + '</p></div>';
            return;
        }
        if (st === 'pending') {
            box.innerHTML = '<div class="pa-card"><h3>' + ic('clock') + esc(X('Заявка отправлена')) + '</h3><p>' + esc(X('Мы свяжемся с вами в течение дня. После одобрения у вас появится кабинет учителя: группы, видеоуроки и доска.')) + '</p></div>';
            return;
        }
        if (st === 'blocked') { box.innerHTML = ''; return; }
        box.innerHTML = '<div class="pa-card"><h3>' + ic('video') + esc(X('Вы преподаватель? Ведите свои уроки на TheStarth')) + '</h3>' +
            '<p>' + esc(X('Наша платформа вместо Зума: видеоурок по ссылке, доска, на которой пишет только тот, кому вы разрешили, посещаемость и оценки ваших учеников.')) + '</p>' +
            '<ul><li>' + esc(X('Ученики заходят с телефона или ноутбука, без программ')) + '</li><li>' + esc(X('Уроки без ограничения по времени')) + '</li><li>' + esc(X('14 дней бесплатно, дальше — небольшая оплата в месяц')) + '</li></ul>' +
            (st === 'rejected' ? '<p class="pa-err">' + esc(X('Прошлая заявка была отклонена. Можно отправить новую.')) + '</p>' : '') +
            '<button type="button" class="btn-primary" id="paOpen">' + esc(X('Подать заявку')) + '</button>' +
            '<form class="pa-form" id="paForm" hidden>' +
                '<textarea id="paAbout" maxlength="600" required placeholder="' + esc(X('Что вы преподаёте, сколько у вас учеников, сколько человек обычно на уроке')) + '"></textarea>' +
                '<input id="paPhone" type="tel" maxlength="30" required placeholder="' + esc(X('Телефон для связи')) + '" value="' + esc(profile.phone || '') + '">' +
                '<button type="submit" class="btn-primary">' + esc(X('Отправить заявку')) + '</button><div class="pa-msg" id="paMsg"></div></form></div>';
        const f = box.querySelector('#paForm');
        box.querySelector('#paOpen').onclick = function () { this.hidden = true; f.hidden = false; box.querySelector('#paAbout').focus(); };
        f.onsubmit = async (e) => {
            e.preventDefault();
            const about = box.querySelector('#paAbout').value.trim(), phone = box.querySelector('#paPhone').value.trim(), msg = box.querySelector('#paMsg');
            if (about.length < 10) { msg.className = 'pa-msg pa-err'; msg.textContent = X('Напишите пару слов о себе и своих уроках.'); return; }
            const data = { partnerStatus: 'pending', partnerApply: { about: about.slice(0, 600), phone: phone.slice(0, 30), at: Date.now() } };
            try {
                f.querySelector('button[type="submit"]').disabled = true;
                await db.collection('users').doc(user.uid).update(data);
                Object.assign(profile, data);
                if (window.logToSheet) { try { window.logToSheet('log_partner_request', { name: [profile.name, profile.surname].filter(Boolean).join(' '), nickname: profile.nickname || '', phone, about }); } catch (x) {} }
                render();
            } catch (err) { f.querySelector('button[type="submit"]').disabled = false; msg.className = 'pa-msg pa-err'; msg.textContent = X('Не получилось отправить, попробуйте ещё раз.') + ' (' + err.message + ')'; }
        };
    }
    function init(u, p) { user = u; profile = p || {}; render(); }
    window.addEventListener('starth-lang-changed', () => { if (user) render(); });
    window.PartnerApply = { init };
})();
