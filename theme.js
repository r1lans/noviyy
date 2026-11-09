/* TheStarth — light / dark theme.
 *
 * Loaded in <head> of every page so the saved theme is applied BEFORE the
 * first paint (no white flash on dark). The toggle button is injected into
 * the navbar automatically, so pages don't need any extra markup.
 *
 * Order of choice: saved choice (localStorage) -> system preference -> light.
 */
(function () {
    var KEY = 'starthTheme';
    var root = document.documentElement;

    function readSaved() {
        try { var v = localStorage.getItem(KEY); return (v === 'dark' || v === 'light') ? v : null; }
        catch (e) { return null; }
    }
    function systemTheme() {
        return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    function current() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }

    function apply(theme) {
        root.setAttribute('data-theme', theme);
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'theme-color');
            (document.head || root).appendChild(meta);
        }
        meta.setAttribute('content', theme === 'dark' ? '#12141A' : '#FAF9F5');
        document.querySelectorAll('.theme-toggle').forEach(function (b) {
            b.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
        });
    }

    apply(readSaved() || systemTheme());

    // Clickjacking guard: the site must not be shown inside someone else's page (a hidden frame over fake buttons).
    // The only exception is Telegram's web version (web.telegram.org), which shows our Mini App in a frame.
    var parentIsTelegram = function () {
        try {
            var a = location.ancestorOrigins && location.ancestorOrigins.length ? location.ancestorOrigins[0] : document.referrer;
            return /^https:\/\/([a-z0-9-]+\.)*telegram\.org(\/|$)/i.test(a || '');
        } catch (e) { return false; }
    };
    try { if (window.top !== window.self && window.top.location.hostname !== window.location.hostname) throw 0; }
    catch (e) { if (!parentIsTelegram()) { try { window.top.location = window.self.location.href; } catch (x) { document.documentElement.style.display = 'none'; } } }

    /* ── a page of ours shown inside another page of ours (the video lesson's side panel: messenger?embed=1,
       ai-teacher?embed=lesson) — no navbar / footer / floating buttons, see styles.css «html.embed» ── */
    try {
        if (/[?&]embed=/.test(location.search) && window.top !== window.self && window.top.location.hostname === location.hostname) {
            root.classList.add('embed'); window.STARTH_EMBED = true;
        }
    } catch (e) {}

    /* ── Telegram Mini App: the bot's «TheStarth» button opens the site inside Telegram (?tg=1) ── */
    var inTg = false;
    try {
        inTg = /[?&]tg=1\b/.test(location.search) || /tgWebApp/.test(location.hash) || sessionStorage.getItem('starthTg') === '1';
        if (inTg) sessionStorage.setItem('starthTg', '1');
    } catch (e) {}
    if (inTg) {
        root.classList.add('in-tg');
        var tgs = document.createElement('script');
        tgs.src = 'https://telegram.org/js/telegram-web-app.js';
        tgs.onload = function () {
            var W = window.Telegram && window.Telegram.WebApp; if (!W) return;
            try { W.ready(); W.expand(); } catch (e) {}
            var paint = function () { try { var c = current() === 'dark' ? '#12141A' : '#FAF9F5'; W.setHeaderColor(c); W.setBackgroundColor(c); } catch (e) {} };
            paint(); new MutationObserver(paint).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
            // Telegram's own «Back» button instead of closing the app
            try {
                var p = location.pathname.replace(/\/+$/, '').split('/').pop().replace(/\.html$/, '');
                if (p && p !== 'index') { W.BackButton.show(); W.BackButton.onClick(function () { if (history.length > 1) history.back(); else location.href = './'; }); }
            } catch (e) {}
        };
        (document.head || document.documentElement).appendChild(tgs);
        // video lessons need the camera — inside Telegram it often does not work, so lessons open in the real browser
        document.addEventListener('click', function (e) {
            var a = e.target.closest ? e.target.closest('a[href]') : null; if (!a) return;
            var href = a.getAttribute('href') || '';
            var W = window.Telegram && window.Telegram.WebApp;
            if (/video-lesson/.test(href) && W && W.openLink) { e.preventDefault(); W.openLink(new URL(href, location.href).href); }
            else if (/^https?:/.test(href) && a.hostname !== location.hostname && W && W.openLink) { e.preventDefault(); W.openLink(a.href); }
        }, true);
    }
    window.StarthInTelegram = inTg;
    if (inTg && /video-lesson/.test(location.pathname)) {
        document.addEventListener('DOMContentLoaded', function () {
            var L = { ru: ['Камера и микрофон в Telegram часто не работают. Откройте урок в браузере.', 'Открыть в браузере'],
                uz: ['Telegram ichida kamera va mikrofon ko‘pincha ishlamaydi. Darsni brauzerda oching.', 'Brauzerda ochish'],
                en: ['Camera and microphone often do not work inside Telegram. Open the lesson in your browser.', 'Open in browser'] };
            var l = 'ru'; try { l = localStorage.getItem('starthLang') || 'ru'; } catch (e) {} var t = L[l] || L.ru;
            var bar = document.createElement('div'); bar.className = 'tg-open-bar';
            bar.innerHTML = '<span>' + t[0] + '</span><button type="button">' + t[1] + '</button>';
            bar.querySelector('button').onclick = function () {
                var W = window.Telegram && window.Telegram.WebApp; var u = location.href.replace(/([?&])tg=1&?/, '$1').replace(/[?&]$/, '');
                if (W && W.openLink) W.openLink(u); else window.open(u, '_blank');
            };
            document.body.insertBefore(bar, document.body.firstChild);
        });
    }

    var SUN = '<svg class="ti-sun" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    var MOON = '<svg class="ti-moon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';

    function makeButton(extraClass) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'theme-toggle ' + (extraClass || '');
        b.setAttribute('aria-label', 'Переключить тему / Toggle theme');
        b.setAttribute('title', 'Светлая / тёмная тема');
        b.setAttribute('aria-pressed', current() === 'dark' ? 'true' : 'false');
        b.innerHTML = SUN + MOON;
        b.addEventListener('click', toggle);
        return b;
    }

    function toggle() {
        var next = current() === 'dark' ? 'light' : 'dark';
        // short-lived class -> smooth colour transition only while switching
        root.classList.add('theme-anim');
        apply(next);
        try { localStorage.setItem(KEY, next); } catch (e) {}
        setTimeout(function () { root.classList.remove('theme-anim'); }, 350);
    }

    var BURGER_SVG =
        '<svg class="mi-bars" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
        '<svg class="mi-close" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

    /* ── Navigation: the SAME clear menu on every page ──
       Bar (computer): Mock Exam · Оплата · Личный кабинет · languages · theme · «Меню».
       «Меню» opens a card with two groups («Учёба», «О школе»): icon + title + one-line hint.
       Phone: «Меню» slides a side panel in: account buttons first, then the same groups, then languages. */
    var SV = function (inner) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'; };
    var NI = {
        home: SV('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>'),
        book: SV('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>'),
        target: SV('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>'),
        math: SV('<path d="M5 7h6M8 4v6M14 7h5M5 17h6M14.5 14.5l4 4M18.5 14.5l-4 4"/>'),
        exam: SV('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.8h6V4"/><path d="m9 12.5 2 2 4-4"/>'),
        award: SV('<circle cx="12" cy="9" r="6"/><path d="M8.6 14 7 22l5-3 5 3-1.6-8"/>'),
        trend: SV('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
        team: SV('<circle cx="9" cy="8" r="4"/><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M16 4.1a4 4 0 0 1 0 7.8M22 21c0-3.2-2-5.9-5-6.7"/>'),
        news: SV('<path d="M4 5h12v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M16 9h4v10a2 2 0 0 1-2 2M8 9h4M8 13h4M8 17h2"/>'),
        work: SV('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'),
        card: SV('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>'),
        spark: SV('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
        mic: SV('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>'),
        user: SV('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>'),
        arrow: SV('<path d="m9 6 6 6-6 6"/>'),
        pen: SV('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>')
    };
    var NT = {
        ru: { menu: 'Меню', close: 'Закрыть', g1: 'Учёба', g2: 'О школе', pay: 'Оплата', cab: 'Личный кабинет', home: 'Главная' },
        uz: { menu: 'Menyu', close: 'Yopish', g1: 'O‘qish', g2: 'Maktab haqida', pay: 'To‘lov', cab: 'Shaxsiy kabinet', home: 'Bosh sahifa' },
        en: { menu: 'Menu', close: 'Close', g1: 'Learning', g2: 'About the school', pay: 'Payment', cab: 'Dashboard', home: 'Home' }
    };
    var NAV_ITEMS = [
        { g: 1, id: 'apply', href: './?apply=1', icon: 'pen', t: {
            ru: ['Записаться на курс', 'Оставьте заявку — мы перезвоним'], uz: ['Kursga yozilish', 'Ariza qoldiring — qo‘ng‘iroq qilamiz'], en: ['Sign up for a course', 'Leave a request and we will call you'] } },
        { g: 1, id: 'courses', href: '#pricing', icon: 'book', t: {
            ru: ['Курсы и цены', 'Направления, форматы и стоимость'], uz: ['Kurslar va narxlar', 'Yo‘nalishlar, formatlar va narxlar'], en: ['Courses & prices', 'Subjects, formats and prices'] } },
        { g: 1, id: 'level', href: 'level-test', icon: 'target', t: {
            ru: ['Тест уровня английского', 'Бесплатно узнайте свой уровень'], uz: ['Ingliz tili darajasi testi', 'Darajangizni bepul aniqlang'], en: ['English level test', 'Find out your level for free'] } },
        { g: 1, id: 'mock', href: 'mock-exam', icon: 'exam', t: {
            ru: ['Mock Exam', 'Пробный IELTS-экзамен онлайн'], uz: ['Mock Exam', 'Onlayn IELTS sinov imtihoni'], en: ['Mock Exam', 'Online IELTS practice test'] } },
        { g: 1, id: 'ai', href: 'ai-teacher', icon: 'spark', t: {
            ru: ['ИИ-ассистент', 'ИИ-учитель и Speaking для учеников'], uz: ['AI-yordamchi', 'O‘quvchilar uchun AI-o‘qituvchi va Speaking'], en: ['AI assistant', 'AI teacher and Speaking for our students'] } },
        { g: 1, id: 'math', href: 'math-test', icon: 'math', t: {
            ru: ['Тест по математике', 'SAT Math: проверьте свой уровень'], uz: ['Matematika testi', 'SAT Math: darajangizni tekshiring'], en: ['Math test', 'SAT Math: check your level'] } },
        { g: 1, id: 'cert', href: '#certificates', icon: 'award', t: {
            ru: ['Сертификаты', 'Проверить сертификат по номеру'], uz: ['Sertifikatlar', 'Sertifikatni raqami bo‘yicha tekshirish'], en: ['Certificates', 'Verify a certificate by its number'] } },
        { g: 2, id: 'home', href: './', icon: 'home', t: {
            ru: ['Главная', 'Курсы, цены и запись на урок'], uz: ['Bosh sahifa', 'Kurslar, narxlar va darsga yozilish'], en: ['Home', 'Courses, prices and sign-up'] } },
        { g: 2, id: 'results', href: 'results', icon: 'trend', t: {
            ru: ['Результаты', 'Баллы и истории наших учеников'], uz: ['Natijalar', 'O‘quvchilarimiz ballari va hikoyalari'], en: ['Results', 'Our students’ scores and stories'] } },
        { g: 2, id: 'about', href: 'about', icon: 'team', t: {
            ru: ['О нас', 'Команда и преподаватели'], uz: ['Biz haqimizda', 'Jamoa va o‘qituvchilar'], en: ['About us', 'Our team and teachers'] } },
        { g: 2, id: 'news', href: 'news', icon: 'news', t: {
            ru: ['Новости', 'Объявления и полезные статьи'], uz: ['Yangiliklar', 'E’lonlar va foydali maqolalar'], en: ['News', 'Announcements and useful articles'] } },
        { g: 2, id: 'partners', href: 'partners', icon: 'team', t: {
            ru: ['Партнёрам', 'Ведите свои уроки на нашей платформе'], uz: ['Hamkorlarga', 'Darslaringizni platformamizda o‘tkazing'], en: ['For teachers', 'Run your own lessons on our platform'] } },
        { g: 2, id: 'careers', href: 'careers', icon: 'work', t: {
            ru: ['Вакансии', 'Работа преподавателем у нас'], uz: ['Bo‘sh ish o‘rinlari', 'Bizda o‘qituvchi bo‘lib ishlash'], en: ['Careers', 'Teach with TheStarth'] } }
    ];
    function navLang() { var l = 'ru'; try { l = localStorage.getItem('starthLang') || 'ru'; } catch (e) {} return NT[l] ? l : 'ru'; }
    function pageName() { var p = location.pathname.replace(/\/+$/, '').split('/').pop().replace(/\.html$/, ''); return p || 'index'; }
    function isHome() { var p = pageName(); return p === 'index' || p === ''; }
    function hrefOf(it) {
        if (it.href.charAt(0) === '#') return isHome() ? it.href : './' + it.href;
        return it.href;
    }
    function isHere(it) { return it.href.charAt(0) !== '#' && ((it.id === 'home' && isHome()) || pageName() === it.href || (it.id === 'ai' && pageName() === 'speaking')); }

    function buildMenu(menu) {
        var lang = navLang(), L = NT[lang];
        var html = '';
        [1, 2].forEach(function (g) {
            html += '<div class="nm-group"><div class="nm-head">' + L['g' + g] + '</div>';
            NAV_ITEMS.forEach(function (it) {
                if (it.g !== g) return;
                var tx = it.t[lang] || it.t.ru;
                html += '<a class="nm-item' + (isHere(it) ? ' is-current' : '') + '" href="' + hrefOf(it) + '" data-nav="' + it.id + '">' +
                    '<span class="nm-ico">' + NI[it.icon] + '</span>' +
                    '<span class="nm-txt"><b>' + tx[0] + '</b><small>' + tx[1] + '</small></span>' +
                    '<span class="nm-go">' + NI.arrow + '</span></a>';
            });
            html += '</div>';
        });
        menu.innerHTML = html;
    }

    function setupMenu(container, links, burger) {
        var root = document.documentElement;
        var navbar = container.closest('.navbar') || container;
        var lang = navLang(), L = NT[lang];

        // 1) drop the page's own section links — every page gets the same menu
        var pay = null, cab = null, mock = null;
        Array.prototype.slice.call(links.children).forEach(function (el) {
            if (el.tagName !== 'A' || el.classList.contains('lang-btn')) return;
            var href = (el.getAttribute('href') || '').replace(/\.html$/, '');
            if (el.classList.contains('admin-nav-link') || el.classList.contains('nav-msg-link')) return;
            if (/^mock-exam/.test(href) && !mock) { mock = el; return; }
            if (href === 'payment' && !pay) { pay = el; return; }
            if ((href === 'dashboard' || el.classList.contains('auth-nav-link') || el.getAttribute('data-i18n') === 'nav.dashboard') && !cab) { cab = el; return; }
            el.remove();
        });
        // 2) make sure the three bar buttons exist on every page
        if (!mock) { mock = document.createElement('a'); mock.href = 'mock-exam'; }
        mock.removeAttribute('style'); mock.className = 'nav-pin nav-pin--mock';
        mock.innerHTML = 'Mock Exam<span class="nav-new">NEW</span>';
        if (!pay) { pay = document.createElement('a'); pay.href = 'payment'; pay.setAttribute('data-i18n', 'nav.payment'); pay.textContent = L.pay; }
        pay.removeAttribute('style'); pay.className = 'btn-outline nav-pin nav-pin--pay';
        if (!cab) { cab = document.createElement('a'); cab.href = 'dashboard'; cab.setAttribute('data-i18n', 'nav.dashboard'); cab.textContent = L.cab; }
        cab.removeAttribute('style'); cab.classList.add('btn-outline', 'nav-pin', 'nav-pin--cab');
        if (pageName() === 'mock-exam') mock.classList.add('is-current');
        if (pageName() === 'payment') pay.classList.add('is-current');

        var menu = document.createElement('div'); menu.className = 'nav-menu'; menu.id = 'navMenu';
        buildMenu(menu);
        var lsw = links.querySelector('.lang-switch');
        links.insertBefore(mock, links.firstChild);
        links.insertBefore(pay, mock.nextSibling);
        links.insertBefore(cab, lsw || null);
        links.appendChild(menu);
        if (lsw) links.appendChild(lsw);

        // bar order: logo | links | theme | «Меню»
        var themeBtn = makeButton('theme-toggle--bar');
        container.appendChild(links);
        container.appendChild(themeBtn);
        container.appendChild(burger);

        function burgerHtml() { var l = NT[navLang()]; burger.innerHTML = BURGER_SVG + '<span class="mi-label mi-label--open">' + l.menu + '</span><span class="mi-label mi-label--close">' + l.close + '</span>'; }
        burgerHtml();
        burger.setAttribute('aria-label', L.menu);
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-controls', 'navMenu');
        window.addEventListener('starth-lang-changed', function () { buildMenu(menu); burgerHtml(); });

        var backdrop = document.createElement('div');
        backdrop.className = 'nav-backdrop';
        document.body.appendChild(backdrop);

        function measure() {
            root.style.setProperty('--nav-h', Math.round(navbar.getBoundingClientRect().bottom) + 'px');
        }
        function isOpen() { return root.classList.contains('nav-is-open'); }
        function setOpen(open) {
            if (open) measure();
            root.classList.toggle('nav-is-open', open);
            burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        burger.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!isOpen()); });
        backdrop.addEventListener('click', function () { setOpen(false); });
        links.addEventListener('click', function (e) {
            var a = e.target.closest ? e.target.closest('a') : null;
            if (a && !a.classList.contains('lang-btn')) setOpen(false);
        });
        document.addEventListener('click', function (e) {
            if (!isOpen()) return;
            if (links.contains(e.target) || burger.contains(e.target)) return;
            setOpen(false);
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) setOpen(false); });
        window.addEventListener('resize', function () { if (isOpen()) measure(); });
        if (window.matchMedia) {
            var mq = window.matchMedia('(min-width: 1201px)');
            var onMq = function () { setOpen(false); };
            if (mq.addEventListener) mq.addEventListener('change', onMq);
            else if (mq.addListener) mq.addListener(onMq);
        }
    }

    function inject() {
        var container = document.querySelector('.nav-container');
        var links = document.querySelector('.nav-links');

        if (!container) {
            // pages without a navbar (e.g. admin panel): small floating button
            document.body.appendChild(makeButton('theme-toggle--floating'));
            return;
        }
        if (!links) {
            container.appendChild(makeButton(''));
            return;
        }

        // Some pages have a nav menu but no burger button — add one.
        var burger = container.querySelector('.mobile-toggle');
        if (!burger) {
            burger = document.createElement('button');
            burger.type = 'button';
            burger.className = 'mobile-toggle';
        }
        setupMenu(container, links, burger);
        setupApply();
    }

    /* ── «Записаться на курс»: always within reach (many visitors skip the intro video with the button) ──
       Floating button on public pages for visitors who are not signed in; the menu item is for everybody.
       ./?apply=1 opens the application form on the home page. */
    var APPLY_T = { ru: 'Записаться на курс', uz: 'Kursga yozilish', en: 'Sign up for a course' };
    var NO_FAB = ['dashboard', 'admin', 'video-lesson', 'speaking', 'ai-teacher', 'olympiad', 'mock-exam', 'level-test', 'math-test', 'messenger', 'payment', 'teacher-schedule', '404'];
    function openApplyForm() {
        var m = document.getElementById('appModal');
        if (!m) return false;
        m.classList.add('show');
        var f = m.querySelector('input[name="name"]'); if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 50);
        return true;
    }
    window.StarthOpenApply = function () { if (!openApplyForm()) location.href = './?apply=1'; };
    function setupApply() {
        // links to ./?apply=1 open the form right here when the page has it
        document.addEventListener('click', function (e) {
            var a = e.target.closest ? e.target.closest('a[href="./?apply=1"]') : null;
            if (a && openApplyForm()) { e.preventDefault(); document.documentElement.classList.remove('nav-is-open'); }
        });
        if (isHome() && /[?&]apply=1/.test(location.search)) {
            var tries = 0, t = setInterval(function () {
                if (openApplyForm() || ++tries > 40) {
                    clearInterval(t);
                    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
                }
            }, 100);
        }
        // home page: the big «Записаться на курс» button in the hero is its place — no floating copy there
        // (it used to flash for a second while the intro video loaded, then hide)
        if (isHome() || NO_FAB.indexOf(pageName()) !== -1) return;
        var fab = document.createElement('a');
        fab.className = 'apply-fab'; fab.href = './?apply=1';
        var label = function () { var l = navLang(); fab.innerHTML = NI.pen + '<span>' + (APPLY_T[l] || APPLY_T.ru) + '</span>'; fab.setAttribute('aria-label', APPLY_T[l] || APPLY_T.ru); };
        label(); window.addEventListener('starth-lang-changed', label);
        document.body.appendChild(fab);
        // signed-in people (students, teachers) already study with us — no floating button for them
        var signedIn = false, heroSeen = false;
        var upd = function () { fab.hidden = signedIn || heroSeen; };
        var hide = function (u) { signedIn = !!u; upd(); };
        // on the home page the big «Записаться на курс» button is already in view — don't show two at once
        var heroBtn = document.querySelector('.hero-btn--apply');
        if (heroBtn && 'IntersectionObserver' in window) new IntersectionObserver(function (en) { heroSeen = en[0].isIntersecting; upd(); }).observe(heroBtn);
        var hook = function () {
            try { if (typeof auth !== 'undefined' && auth && auth.onAuthStateChanged) { auth.onAuthStateChanged(hide); return true; } } catch (e) {}
            return false;
        };
        if (!hook()) window.addEventListener('load', hook);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
    else inject();

    // keep several open tabs in sync
    window.addEventListener('storage', function (e) {
        if (e.key === KEY && (e.newValue === 'dark' || e.newValue === 'light')) apply(e.newValue);
    });
    // follow the system theme live, but only until the visitor picks one manually
    if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        var onChange = function (e) { if (!readSaved()) apply(e.matches ? 'dark' : 'light'); };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    }

    window.StarthTheme = { toggle: toggle, get: current, set: function (t) { apply(t); try { localStorage.setItem(KEY, t); } catch (e) {} } };
})();
