/* TheStarth — captcha on the registration form.
 *   - a picture with 5 distorted characters (drawn on a canvas, no outside service, works without any keys);
 *   - a "new picture" button; the answer is not case-sensitive;
 *   - a hidden "website" field that people never see (bots fill every field → rejected);
 *   - a form sent in less than 3 seconds after it was shown is rejected (people cannot type that fast);
 *   - after 5 wrong answers in a row the next try is possible only after 30 seconds.
 * Applies to every form with id="registerForm" (and any form with data-captcha), including forms shown later.
 * The check runs in the capture phase on document, so it stops the submit before app.js creates the account.
 */
(function () {
    'use strict';
    const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';          // no I / L / O / 0 / 1: they look alike
    const LEN = 5, MIN_MS = 3000, MAX_WRONG = 5, LOCK_MS = 30000;
    const lang = () => { try { const l = localStorage.getItem('starthLang') || document.documentElement.lang || 'ru'; return ['ru', 'uz', 'en'].indexOf(l) !== -1 ? l : 'ru'; } catch (e) { return 'ru'; } };
    const L = {
        ru: { label: 'Проверка, что вы не робот', ph: 'Символы с картинки', fresh: 'Другая картинка', img: 'Картинка с кодом проверки', empty: 'Введите символы с картинки.', wrong: 'Символы введены неверно — попробуйте новую картинку.', fast: 'Слишком быстро. Проверьте данные и нажмите ещё раз.', lock: 'Слишком много попыток. Подождите {s} сек.' },
        uz: { label: "Robot emasligingizni tasdiqlang", ph: 'Rasmdagi belgilar', fresh: 'Boshqa rasm', img: 'Tekshiruv kodi rasmi', empty: 'Rasmdagi belgilarni kiriting.', wrong: "Belgilar noto'g'ri — yangi rasm bilan urinib ko'ring.", fast: "Juda tez. Ma'lumotlarni tekshirib, yana bosing.", lock: "Urinishlar juda ko'p. {s} soniya kuting." },
        en: { label: "Prove you're not a robot", ph: 'Characters from the picture', fresh: 'New picture', img: 'Verification code picture', empty: 'Type the characters from the picture.', wrong: 'Wrong characters — try the new picture.', fast: 'Too fast. Check your details and press again.', lock: 'Too many attempts. Wait {s} s.' },
    };
    const T = () => L[lang()] || L.ru;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = (s) => s.charAt(Math.floor(Math.random() * s.length));

    const css = `
.sc-box{margin:.75rem 0 .25rem;padding:.7rem;border:1px solid var(--rule,#ddd);border-radius:10px;background:var(--paper-alt,#f4f4f4)}
.sc-label{display:block;font-size:.8rem;color:var(--ink-soft,#666);margin:0 0 .45rem}
.sc-row{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
.sc-img{display:block;width:170px;height:54px;border-radius:8px;border:1px solid var(--rule,#ddd);background:#fff;flex:0 0 auto}
.sc-new{flex:0 0 auto;width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid var(--rule,#ddd);background:var(--paper,#fff);color:var(--ink,#111);cursor:pointer;padding:0}
.sc-new:hover{border-color:var(--accent,#8F5A0C);color:var(--accent,#8F5A0C)}
.sc-new svg{transition:transform .35s ease}
.sc-new:active svg{transform:rotate(-180deg)}
.sc-box input.sc-in{flex:1 1 130px;min-width:0;margin:0!important;text-transform:uppercase;letter-spacing:.18em;font-weight:600}
.sc-box input.sc-in::placeholder{text-transform:none;letter-spacing:normal;font-weight:400}
.sc-box.sc-bad{border-color:var(--accent-warm,#A32638)}
.sc-box.sc-ok{border-color:#1e8449}
.sc-hp{position:absolute!important;left:-9999px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important}`;

    function addStyle() {
        if (document.getElementById('sc-style')) return;
        const st = document.createElement('style'); st.id = 'sc-style'; st.textContent = css; document.head.appendChild(st);
    }

    function draw(cv, code) {
        const dpr = Math.min(2, window.devicePixelRatio || 1), W = 170, H = 54;
        cv.width = W * dpr; cv.height = H * dpr;
        const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const g = c.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, 'hsl(' + rnd(30, 60) + ',60%,95%)'); g.addColorStop(1, 'hsl(' + rnd(180, 230) + ',50%,94%)');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 45; i++) { c.fillStyle = 'hsla(' + rnd(0, 360) + ',40%,45%,' + rnd(0.15, 0.4) + ')'; c.beginPath(); c.arc(rnd(0, W), rnd(0, H), rnd(0.6, 1.8), 0, 6.3); c.fill(); }
        const fonts = ['Georgia,serif', '"Trebuchet MS",sans-serif', 'Verdana,sans-serif', '"Courier New",monospace', 'Arial,sans-serif'];
        const step = (W - 24) / code.length;
        for (let i = 0; i < code.length; i++) {
            c.save();
            c.translate(14 + step * i + step / 2 + rnd(-3, 3), H / 2 + rnd(-5, 5));
            c.rotate(rnd(-0.45, 0.45)); c.transform(1, 0, rnd(-0.25, 0.25), 1, 0, 0);
            c.font = (Math.random() < 0.5 ? '700 ' : '600 ') + Math.round(rnd(25, 32)) + 'px ' + fonts[Math.floor(Math.random() * fonts.length)];
            c.fillStyle = 'hsl(' + rnd(0, 360) + ',' + rnd(45, 70) + '%,' + rnd(22, 36) + '%)';
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(code[i], 0, 0);
            c.restore();
        }
        for (let i = 0; i < 4; i++) {                     // lines across the characters
            c.strokeStyle = 'hsla(' + rnd(0, 360) + ',50%,35%,' + rnd(0.35, 0.6) + ')'; c.lineWidth = rnd(1, 2);
            c.beginPath(); c.moveTo(rnd(-10, 20), rnd(0, H));
            c.bezierCurveTo(rnd(30, 70), rnd(-10, H + 10), rnd(90, 130), rnd(-10, H + 10), rnd(W - 20, W + 10), rnd(0, H)); c.stroke();
        }
    }

    function attach(form) {
        if (form.__sc) return;
        addStyle();
        const t = T();
        const box = document.createElement('div'); box.className = 'sc-box';
        box.innerHTML = '<span class="sc-label"></span><div class="sc-row"><canvas class="sc-img" role="img"></canvas>' +
            '<button type="button" class="sc-new"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg></button>' +
            '<input type="text" class="sc-in" maxlength="' + LEN + '" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" inputmode="text" data-nophone></div>';
        const hp = document.createElement('input');
        hp.type = 'text'; hp.name = 'website'; hp.className = 'sc-hp'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.setAttribute('aria-hidden', 'true'); hp.setAttribute('data-nophone', '');
        const err = form.querySelector('#register-form-error, .form-error');
        const submit = form.querySelector('button[type="submit"]');
        form.insertBefore(box, err || submit || null);
        form.appendChild(hp);
        const cv = box.querySelector('canvas'), inp = box.querySelector('.sc-in'), btn = box.querySelector('.sc-new');
        const S = form.__sc = { code: '', shownAt: Date.now(), wrong: 0, lockUntil: 0, box, inp, cv, err };
        const texts = () => { const x = T(); box.querySelector('.sc-label').textContent = x.label; inp.placeholder = x.ph; btn.title = x.fresh; btn.setAttribute('aria-label', x.fresh); cv.setAttribute('aria-label', x.img); };
        S.renew = () => { S.code = Array.from({ length: LEN }, () => pick(CHARS)).join(''); draw(cv, S.code); inp.value = ''; box.classList.remove('sc-ok', 'sc-bad'); texts(); };
        btn.addEventListener('click', () => { S.renew(); inp.focus(); });
        inp.addEventListener('input', () => {
            const v = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LEN);
            if (inp.value !== v) inp.value = v;
            box.classList.toggle('sc-ok', v === S.code); box.classList.remove('sc-bad');
        });
        S.renew();
        // the form may be hidden while the page loads; time is counted from when it is really seen
        if ('IntersectionObserver' in window) new IntersectionObserver((es) => { if (es[0].isIntersecting && !S.seen) { S.seen = true; S.shownAt = Date.now(); } }).observe(box);
        document.addEventListener('starth-lang', texts);
    }

    function say(S, msg) {
        if (S.err) S.err.textContent = msg;
        S.box.classList.add('sc-bad');
    }

    document.addEventListener('submit', (e) => {
        const form = e.target;
        if (!form || !form.__sc) return;
        const S = form.__sc, t = T(), now = Date.now();
        const stop = (msg, renew) => { e.preventDefault(); e.stopImmediatePropagation(); if (renew) S.renew(); say(S, msg); try { S.inp.focus(); } catch (er) {} };
        if (S.lockUntil > now) return stop(t.lock.replace('{s}', Math.ceil((S.lockUntil - now) / 1000)), false);
        const hp = form.querySelector('input.sc-hp');
        if (hp && hp.value) return stop(t.wrong, true);                        // only a bot fills the invisible field
        const v = S.inp.value.toUpperCase();
        if (!v) return stop(t.empty, false);
        if (v !== S.code) {
            S.wrong++;
            if (S.wrong >= MAX_WRONG) { S.wrong = 0; S.lockUntil = now + LOCK_MS; return stop(t.lock.replace('{s}', LOCK_MS / 1000), true); }
            return stop(t.wrong, true);
        }
        if (now - S.shownAt < MIN_MS) return stop(t.fast, false);
        // passed: one picture is good for one try. If the account cannot be created (nickname taken, …), a new picture is shown.
        S.wrong = 0;
        if (S.err) S.err.textContent = '';
        setTimeout(() => { if (document.body.contains(form)) S.renew(); }, 1500);
    }, true);

    function scan() { document.querySelectorAll('form#registerForm, form[data-captcha]').forEach(attach); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
    window.addEventListener('load', scan);
    window.StarthCaptcha = { scan };
})();
