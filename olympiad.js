/* TheStarth — online olympiad for participants (olympiad.html?id=…). Created and published in Admin panel → «Олимпиада».
 *
 *  before the start   → description, date, countdown
 *  open               → «Начать» (sign-in needed). The timer starts on the server; answers are saved as you go,
 *                       so a closed tab or lost internet loses nothing — come back and press «Продолжить».
 *                       When time is up the answers are handed in automatically.
 *  after handing in   → «Ответы приняты»; once the admin publishes results — your score, place and the top 10.
 * Without ?id= the page lists the published olympiads.
 *
 *  registration       → before the start a participant registers once: region, district / city, school, class
 *                       (olympiadRegs/{oid_uid}). Registering early spreads the load of new accounts over days.
 *  fairness           → questions (and options) can be shuffled for every participant, copying / pasting / the
 *                       context menu are blocked during the test, leaving the page is counted and shown, and after
 *                       maxLeaves leaves the work is handed in automatically (if the organiser set a limit).
 *  certificate        → once results are published a participant can print / save a certificate (PDF).
 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const app = $('olyApp'); if (!app) return;
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ic = (n) => (window.Icons ? window.Icons.svg(n) : '');
    const lang = () => { try { const l = localStorage.getItem('starthLang'); return l === 'uz' || l === 'en' ? l : 'ru'; } catch (e) { return 'ru'; } };
    const UI = window.StarthUI || { confirm: async (m) => window.confirm(m), toast: () => {}, alert: async (m) => window.alert(m) };
    const LET = ['A', 'B', 'C', 'D', 'E', 'F'];
    const REGIONS = ['Ташкент (город)', 'Ташкентская область', 'Андижанская область', 'Бухарская область', 'Джизакская область', 'Кашкадарьинская область', 'Навоийская область',
        'Наманганская область', 'Самаркандская область', 'Сурхандарьинская область', 'Сырдарьинская область', 'Ферганская область', 'Хорезмская область', 'Республика Каракалпакстан'];
    const GRADES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'student', 'other'];
    // the same participant always sees the same order (seeded by uid + olympiad), different participants see different ones
    function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
    function shuffled(arr, seed) { const r = seeded(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    const L = {
        ru: { regT: 'Регистрация участника', regSub: 'Заполните один раз — эти данные будут в протоколе и в сертификате.', region: 'Регион', district: 'Район / город', school: 'Школа / учебное заведение', grade: 'Класс', gradeStudent: 'Студент', gradeOther: 'Другое', regBtn: 'Зарегистрироваться', regDone: 'Вы зарегистрированы', regEdit: 'Изменить данные', regNeed: 'Сначала зарегистрируйтесь — это займёт минуту.', regFill: 'Заполните все поля.', regGrade: 'Эта олимпиада для {g} классов.', regClosed: 'Регистрация закрыта.', regCount: 'Зарегистрировано участников: {n}', choose: 'Выберите…', r5: 'Копировать и вставлять текст во время олимпиады нельзя.', r6: 'После {n} уходов со страницы работа сдаётся автоматически.', leftPage: 'Вы ушли со страницы ({n}). Это видят организаторы.', leftLimit: 'Слишком много уходов со страницы — работа сдана автоматически.', noCopy: 'Копировать во время олимпиады нельзя', cert: 'Сертификат', certT: 'СЕРТИФИКАТ', certP: 'участника олимпиады', certFor: 'награждается', certRes: 'Результат: {s} из {m} баллов', certPlace: '{p} место из {n}', certDate: 'Дата', regionPlace: 'Место в регионе', gradesFor: 'Классы', gradesAll: 'все', print: 'Сохранить или распечатать',
            title: 'Олимпиада', list: 'Олимпиады TheStarth', none: 'Сейчас олимпиад нет. Следите за новостями!', loading: 'Загрузка…', notFound: 'Олимпиада не найдена или ещё не опубликована.',
            when: 'Когда', dur: 'Время на решение', min: 'мин', qs: 'Вопросов', maxS: 'Максимум баллов', open: 'Открыть',
            soon: 'Начнётся через', live: 'Идёт сейчас', ended: 'Завершена', d: 'д', h: 'ч', m: 'мин', s: 'с',
            login: 'Войдите в аккаунт, чтобы участвовать', loginBtn: 'Войти или зарегистрироваться',
            start: 'Начать олимпиаду', startQ: 'Начать? Таймер на {n} мин запустится сразу и не остановится, даже если закрыть страницу. Пройти можно один раз.',
            cont: 'Продолжить', rules: 'Правила', r1: 'Пройти можно только один раз.', r2: 'Ответы сохраняются сами — если пропал интернет, вернитесь и продолжайте.', r3: 'Когда время закончится, ответы отправятся автоматически.', r4: 'Не уходите со страницы во время олимпиады — это видно организаторам.',
            left: 'Осталось', saved: 'Сохранено', saving: 'Сохраняю…', offline: 'Нет связи — ответ сохранится, когда интернет вернётся', answered: 'Отвечено', of: 'из',
            prev: 'Назад', next: 'Дальше', submit: 'Сдать работу', submitQ: 'Сдать работу? Изменить ответы будет нельзя.', unanswered: 'Без ответа: {n}.', yourAns: 'Ваш ответ',
            done: 'Ответы приняты!', doneSub: 'Результаты появятся здесь после проверки. Спасибо за участие!', timeUp: 'Время вышло — ответы отправлены.',
            closedNo: 'Олимпиада завершена. Вы не участвовали.', res: 'Результаты', yourScore: 'Ваш результат', place: 'Место', ofN: 'из {n} участников', top: 'Лучшие участники',
            notYet: 'Олимпиада ещё не началась.', home: 'На главную', err: 'Не получилось: ', pts: 'б.', back: 'Все олимпиады' },
        uz: { regT: 'Ishtirokchini ro‘yxatdan o‘tkazish', regSub: 'Bir marta to‘ldiring — bu ma’lumotlar bayonnomada va sertifikatda bo‘ladi.', region: 'Viloyat', district: 'Tuman / shahar', school: 'Maktab / o‘quv muassasasi', grade: 'Sinf', gradeStudent: 'Talaba', gradeOther: 'Boshqa', regBtn: 'Ro‘yxatdan o‘tish', regDone: 'Siz ro‘yxatdan o‘tdingiz', regEdit: 'Ma’lumotlarni o‘zgartirish', regNeed: 'Avval ro‘yxatdan o‘ting — bir daqiqa vaqt oladi.', regFill: 'Barcha maydonlarni to‘ldiring.', regGrade: 'Bu olimpiada {g}-sinflar uchun.', regClosed: 'Ro‘yxatdan o‘tish yopilgan.', regCount: 'Ro‘yxatdan o‘tganlar: {n}', choose: 'Tanlang…', r5: 'Olimpiada vaqtida matnni nusxalash va qo‘yish mumkin emas.', r6: 'Sahifadan {n} marta chiqilsa, ish avtomatik topshiriladi.', leftPage: 'Siz sahifadan chiqdingiz ({n}). Buni tashkilotchilar ko‘radi.', leftLimit: 'Sahifadan juda ko‘p chiqildi — ish avtomatik topshirildi.', noCopy: 'Olimpiada vaqtida nusxalash mumkin emas', cert: 'Sertifikat', certT: 'SERTIFIKAT', certP: 'olimpiada ishtirokchisi', certFor: 'taqdirlanadi', certRes: 'Natija: {m} balldan {s}', certPlace: '{n} tadan {p}-o‘rin', certDate: 'Sana', regionPlace: 'Viloyatdagi o‘rin', gradesFor: 'Sinflar', gradesAll: 'hammasi', print: 'Saqlash yoki chop etish',
            title: 'Olimpiada', list: 'TheStarth olimpiadalari', none: 'Hozircha olimpiada yo‘q. Yangiliklarni kuzating!', loading: 'Yuklanmoqda…', notFound: 'Olimpiada topilmadi yoki hali e’lon qilinmagan.',
            when: 'Qachon', dur: 'Yechish vaqti', min: 'daq', qs: 'Savollar', maxS: 'Maksimal ball', open: 'Ochish',
            soon: 'Boshlanishiga', live: 'Hozir davom etmoqda', ended: 'Yakunlangan', d: 'k', h: 's', m: 'daq', s: 's',
            login: 'Qatnashish uchun akkauntga kiring', loginBtn: 'Kirish yoki ro‘yxatdan o‘tish',
            start: 'Olimpiadani boshlash', startQ: 'Boshlaysizmi? {n} daqiqalik taymer darhol ishga tushadi va sahifani yopsangiz ham to‘xtamaydi. Faqat bir marta topshirish mumkin.',
            cont: 'Davom etish', rules: 'Qoidalar', r1: 'Faqat bir marta topshirish mumkin.', r2: 'Javoblar avtomatik saqlanadi — internet uzilsa, qaytib davom eting.', r3: 'Vaqt tugaganda javoblar avtomatik yuboriladi.', r4: 'Olimpiada davomida sahifadan chiqmang — tashkilotchilar buni ko‘radi.',
            left: 'Qoldi', saved: 'Saqlandi', saving: 'Saqlanmoqda…', offline: 'Aloqa yo‘q — internet qaytganda javob saqlanadi', answered: 'Javob berildi', of: '/',
            prev: 'Orqaga', next: 'Keyingi', submit: 'Ishni topshirish', submitQ: 'Ishni topshirasizmi? Javoblarni o‘zgartirib bo‘lmaydi.', unanswered: 'Javobsiz: {n}.', yourAns: 'Javobingiz',
            done: 'Javoblar qabul qilindi!', doneSub: 'Natijalar tekshiruvdan so‘ng shu yerda paydo bo‘ladi. Qatnashganingiz uchun rahmat!', timeUp: 'Vaqt tugadi — javoblar yuborildi.',
            closedNo: 'Olimpiada yakunlangan. Siz qatnashmagansiz.', res: 'Natijalar', yourScore: 'Natijangiz', place: 'O‘rin', ofN: '{n} ta ishtirokchidan', top: 'Eng yaxshi ishtirokchilar',
            notYet: 'Olimpiada hali boshlanmagan.', home: 'Bosh sahifa', err: 'Bo‘lmadi: ', pts: 'b.', back: 'Barcha olimpiadalar' },
        en: { regT: 'Participant registration', regSub: 'Fill it in once — it goes into the results list and the certificate.', region: 'Region', district: 'District / city', school: 'School', grade: 'Class', gradeStudent: 'University student', gradeOther: 'Other', regBtn: 'Register', regDone: 'You are registered', regEdit: 'Change details', regNeed: 'Register first — it takes a minute.', regFill: 'Please fill in every field.', regGrade: 'This olympiad is for classes {g}.', regClosed: 'Registration is closed.', regCount: 'Registered participants: {n}', choose: 'Choose…', r5: 'Copying and pasting text is not allowed during the olympiad.', r6: 'After leaving the page {n} times the work is handed in automatically.', leftPage: 'You left the page ({n}). The organisers can see it.', leftLimit: 'You left the page too many times — the work was handed in automatically.', noCopy: 'Copying is not allowed during the olympiad', cert: 'Certificate', certT: 'CERTIFICATE', certP: 'of olympiad participation', certFor: 'is awarded to', certRes: 'Score: {s} of {m}', certPlace: 'Place {p} of {n}', certDate: 'Date', regionPlace: 'Place in the region', gradesFor: 'Classes', gradesAll: 'all', print: 'Save or print',
            title: 'Olympiad', list: 'TheStarth olympiads', none: 'No olympiads right now. Stay tuned!', loading: 'Loading…', notFound: 'Olympiad not found or not published yet.',
            when: 'When', dur: 'Time to solve', min: 'min', qs: 'Questions', maxS: 'Max score', open: 'Open',
            soon: 'Starts in', live: 'Running now', ended: 'Finished', d: 'd', h: 'h', m: 'min', s: 's',
            login: 'Sign in to take part', loginBtn: 'Sign in or register',
            start: 'Start the olympiad', startQ: 'Start now? The {n}-minute timer starts at once and keeps running even if you close the page. You can take part only once.',
            cont: 'Continue', rules: 'Rules', r1: 'You can take part only once.', r2: 'Answers are saved automatically — if the internet drops, come back and continue.', r3: 'When time is up, your answers are handed in automatically.', r4: 'Do not leave the page during the olympiad — organisers can see it.',
            left: 'Time left', saved: 'Saved', saving: 'Saving…', offline: 'No connection — the answer will be saved when you are back online', answered: 'Answered', of: 'of',
            prev: 'Back', next: 'Next', submit: 'Hand in', submitQ: 'Hand in your work? You will not be able to change answers.', unanswered: 'Unanswered: {n}.', yourAns: 'Your answer',
            done: 'Answers received!', doneSub: 'Results will appear here after checking. Thank you for taking part!', timeUp: 'Time is up — your answers were handed in.',
            closedNo: 'The olympiad has finished. You did not take part.', res: 'Results', yourScore: 'Your score', place: 'Place', ofN: 'of {n} participants', top: 'Top participants',
            notYet: 'The olympiad has not started yet.', home: 'Home', err: 'Failed: ', pts: 'pts', back: 'All olympiads' }
    };
    const t = (k, v) => { let s = (L[lang()] || L.ru)[k]; if (s == null) s = L.ru[k] || k; if (v) Object.keys(v).forEach((x) => { s = s.split('{' + x + '}').join(v[x]); }); return s; };
    const loc = () => (window.starthLocale ? window.starthLocale() : 'ru-RU');
    const fmt = (ms) => new Date(ms).toLocaleString(loc(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const msOf = (x) => (x && x.toMillis ? x.toMillis() : +x || 0);
    const span = (ms) => { ms = Math.max(0, ms); const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
        return d ? d + ' ' + t('d') + ' ' + h + ' ' + t('h') : h ? h + ' ' + t('h') + ' ' + m + ' ' + t('m') : m + ':' + String(s).padStart(2, '0'); };

    const id = new URLSearchParams(location.search).get('id') || '';
    const S = { user: null, profile: {}, o: null, att: null, reg: null, regEdit: false, i: 0, answers: {}, timer: null, skew: 0, saveT: null, saving: false, leaves: 0, sent: false, order: null, optOrder: {} };
    const gradeName = (g) => (g === 'student' ? t('gradeStudent') : g === 'other' ? t('gradeOther') : g);
    // which classes may take part: o.gradeMin / o.gradeMax (1–11), empty = everybody
    const gradeOk = (o, g) => { const lo = +o.gradeMin || 0, hi = +o.gradeMax || 0; if (!lo && !hi) return true; const n = +g; return !!n && (!lo || n >= lo) && (!hi || n <= hi); };
    const gradesText = (o) => { const lo = +o.gradeMin || 0, hi = +o.gradeMax || 0; if (!lo && !hi) return t('gradesAll'); return (lo || 1) + '–' + (hi || 11); };
    const regRef = () => db.collection('olympiadRegs').doc(S.o.id + '_' + S.user.uid);

    function shell(inner) { app.innerHTML = inner; }
    function card(inner, cls) { return '<div class="oly-card ' + (cls || '') + '">' + inner + '</div>'; }
    const state = (o) => (Date.now() < o.startAt ? 'soon' : Date.now() <= o.endAt ? 'live' : 'ended');

    // ───────── list (no ?id) ─────────
    async function showList() {
        document.title = t('list') + ' — TheStarth';
        $('olyH1').textContent = t('list');
        let items = [];
        try { const snap = await db.collection('olympiads').where('published', '==', true).get(); snap.forEach((d) => items.push(Object.assign({ id: d.id }, d.data()))); } catch (e) {}
        items.sort((a, b) => (state(a) === 'ended') - (state(b) === 'ended') || a.startAt - b.startAt);
        shell(items.length ? '<div class="oly-list">' + items.map((o) => { const st = state(o);
            return '<a class="oly-li" href="olympiad?id=' + encodeURIComponent(o.id) + '"><span class="oly-li-ic">' + ic('trophy') + '</span><span class="oly-li-tx"><b>' + esc(o.title) + '</b><small>' + esc(o.subject || '') + ' · ' + esc(fmt(o.startAt)) + '</small></span><span class="oly-badge ' + st + '">' + esc(t(st)) + '</span></a>'; }).join('') + '</div>'
            : card('<div class="oly-empty">' + ic('trophy') + '<p>' + esc(t('none')) + '</p><a class="btn-primary" href="./">' + esc(t('home')) + '</a></div>'));
    }

    // ───────── one olympiad ─────────
    function infoHtml(o) {
        return '<div class="oly-info"><div><span>' + esc(t('when')) + '</span><b>' + esc(fmt(o.startAt)) + ' — ' + esc(fmt(o.endAt)) + '</b></div>' +
            '<div><span>' + esc(t('dur')) + '</span><b>' + (o.durationMin || 0) + ' ' + esc(t('min')) + '</b></div>' +
            '<div><span>' + esc(t('qs')) + '</span><b>' + (o.questions || []).length + '</b></div>' +
            '<div><span>' + esc(t('maxS')) + '</span><b>' + (o.maxScore || 0) + '</b></div>' +
            '<div><span>' + esc(t('gradesFor')) + '</span><b>' + esc(gradesText(o)) + '</b></div></div>' +
            (o.description ? '<p class="oly-desc">' + esc(o.description).replace(/\n/g, '<br>') + '</p>' : '');
    }
    function landing() {
        stopTimer();
        const o = S.o, st = state(o), att = S.att;
        document.title = o.title + ' — TheStarth';
        $('olyH1').textContent = o.title;
        let action = '';
        if (att && (att.status === 'submitted' || deadline() <= Date.now())) return finished();
        const needReg = o.registration !== false && !att;
        const countdown = st === 'soon' ? '<div class="oly-count"><span>' + esc(t('soon')) + '</span><b id="olyCount">' + span(o.startAt - Date.now()) + '</b></div>' : '';
        if (st === 'ended') return finished();
        if (!S.user) action = countdown + '<div class="oly-login"><p>' + esc(t('login')) + '</p><a class="btn-primary oly-big" href="dashboard?next=' + encodeURIComponent(location.pathname + location.search) + '">' + esc(t('loginBtn')) + '</a></div>';
        else if (needReg && (!S.reg || S.regEdit)) action = countdown + regForm(o);
        else if (st === 'soon') action = (needReg ? regDoneHtml() : '') + countdown;
        else action = (needReg ? regDoneHtml() : '') + '<button type="button" class="btn-primary oly-big" id="olyStart">' + ic('play') + esc(att ? t('cont') : t('start')) + '</button>';
        shell(card('<div class="oly-head"><span class="oly-badge ' + st + '">' + esc(t(st)) + '</span><span class="oly-subj">' + esc(o.subject || '') + '</span></div>' + infoHtml(o) +
            '<div class="oly-rules"><b>' + ic('alert') + esc(t('rules')) + '</b><ul><li>' + esc(t('r1')) + '</li><li>' + esc(t('r2')) + '</li><li>' + esc(t('r3')) + '</li><li>' + esc(t('r4')) + '</li><li>' + esc(t('r5')) + '</li>' + (+o.maxLeaves ? '<li>' + esc(t('r6', { n: +o.maxLeaves })) + '</li>' : '') + '</ul></div>' + action) +
            '<p class="oly-backl"><a href="olympiad">' + esc(t('back')) + '</a></p>');
        const b = $('olyStart'); if (b) b.onclick = startAttempt;
        bindReg();
        if (st === 'soon') S.timer = setInterval(() => { const el = $('olyCount'); if (Date.now() >= o.startAt) return landing(); if (el) el.textContent = span(o.startAt - Date.now()); }, 1000);
    }
    function regForm(o) {
        const r = S.reg || {}, p = S.profile || {};
        let last = {}; try { last = JSON.parse(localStorage.getItem('olyReg') || '{}'); } catch (e) {}
        const v = (k) => r[k] || last[k] || '';
        const opt = (list, cur, lbl) => '<option value="">' + esc(t('choose')) + '</option>' + list.map((x) => '<option value="' + esc(x) + '"' + (x === cur ? ' selected' : '') + '>' + esc(lbl ? lbl(x) : x) + '</option>').join('');
        const grades = GRADES.filter((g) => gradeOk(o, g) || (!+g && !(+o.gradeMin || +o.gradeMax)));
        return '<form class="oly-reg" id="olyReg"><h3>' + esc(t('regT')) + '</h3><p>' + esc(t('regSub')) + '</p>' +
            (o.gradeMin || o.gradeMax ? '<p class="oly-reg-note">' + esc(t('regGrade', { g: gradesText(o) })) + '</p>' : '') +
            '<div class="oly-reg-grid"><label>' + esc(t('region')) + '<select id="orRegion" required>' + opt(REGIONS, v('region')) + '</select></label>' +
            '<label>' + esc(t('district')) + '<input id="orDistrict" maxlength="60" required value="' + esc(v('district')) + '"></label>' +
            '<label class="wide">' + esc(t('school')) + '<input id="orSchool" maxlength="80" required value="' + esc(v('school')) + '" placeholder="№ 12"></label>' +
            '<label>' + esc(t('grade')) + '<select id="orGrade" required>' + opt(grades, v('grade'), gradeName) + '</select></label></div>' +
            '<button type="submit" class="btn-primary oly-big">' + ic('check') + esc(t('regBtn')) + '</button><div class="oly-reg-msg" id="orMsg"></div>' +
            (p.name ? '' : '') + '</form>';
    }
    function regDoneHtml() {
        const r = S.reg || {};
        return '<div class="oly-reg-ok">' + ic('check-circle') + '<div><b>' + esc(t('regDone')) + '</b><small>' + esc([r.region, r.district, r.school, r.grade ? t('grade') + ' ' + gradeName(r.grade) : ''].filter(Boolean).join(' · ')) + '</small></div>' +
            (S.att ? '' : '<button type="button" class="btn-outline" id="orEdit">' + esc(t('regEdit')) + '</button>') + '</div>';
    }
    function bindReg() {
        const e = $('orEdit'); if (e) e.onclick = () => { S.regEdit = true; landing(); };
        const f = $('olyReg'); if (!f) return;
        f.onsubmit = async (ev) => {
            ev.preventDefault();
            const d = { region: $('orRegion').value, district: $('orDistrict').value.trim().slice(0, 60), school: $('orSchool').value.trim().slice(0, 80), grade: $('orGrade').value };
            const msg = $('orMsg');
            if (!d.region || !d.district || !d.school || !d.grade) { msg.textContent = t('regFill'); return; }
            if (!gradeOk(S.o, d.grade) && (+S.o.gradeMin || +S.o.gradeMax)) { msg.textContent = t('regGrade', { g: gradesText(S.o) }); return; }
            const p = S.profile || {}, btn = f.querySelector('button'); btn.disabled = true;
            const data = Object.assign({ oid: S.o.id, uid: S.user.uid, name: ([p.name, p.surname].filter(Boolean).join(' ') || p.nickname || S.user.email || '').slice(0, 80), nickname: String(p.nickname || '').slice(0, 40), at: firebase.firestore.FieldValue.serverTimestamp() }, d);
            try {
                await regRef().set(data);
                try { localStorage.setItem('olyReg', JSON.stringify(d)); } catch (x) {}
                S.reg = Object.assign({}, data, { at: Date.now() }); S.regEdit = false; landing();
            } catch (err) { btn.disabled = false; msg.textContent = t('err') + err.message; }
        };
    }
    const attRef = () => db.collection('olympiadAttempts').doc(S.o.id + '_' + S.user.uid);
    const deadline = () => (S.att ? msOf(S.att.startedAt) + (S.o.durationMin || 0) * 60000 : 0);
    const now = () => Date.now() + S.skew;

    async function startAttempt() {
        const b = $('olyStart'); if (b) b.disabled = true;
        try {
            if (!S.att) {
                if (S.o.registration !== false && !S.reg) { if (b) b.disabled = false; UI.alert(t('regNeed')); S.regEdit = true; return landing(); }
                if (!(await UI.confirm(t('startQ', { n: S.o.durationMin }), { danger: false, ok: t('start') }))) { if (b) b.disabled = false; return; }
                const p = S.profile || {}, r = S.reg || {};
                const t0 = Date.now();
                await attRef().set({ oid: S.o.id, uid: S.user.uid, name: (r.name || [p.name, p.surname].filter(Boolean).join(' ') || p.nickname || S.user.email || '').slice(0, 80), nickname: String(p.nickname || '').slice(0, 40),
                    region: String(r.region || '').slice(0, 40), district: String(r.district || '').slice(0, 60), school: String(r.school || '').slice(0, 80), grade: String(r.grade || '').slice(0, 10),
                    startedAt: firebase.firestore.FieldValue.serverTimestamp(), status: 'started', answers: {}, leaves: 0 });
                const d = await attRef().get();
                S.att = d.data(); S.skew = msOf(S.att.startedAt) - Math.round((t0 + Date.now()) / 2);
            }
            S.answers = Object.assign({}, S.att.answers || {}); S.leaves = S.att.leaves || 0;
            S.i = Math.max(0, qList().findIndex((q) => S.answers[q.id] == null || S.answers[q.id] === ''));
            run();
        } catch (e) { if (b) b.disabled = false; UI.alert(t('err') + e.message); }
    }

    // ───────── taking the test ─────────
    // this participant's question order (shuffled if the organiser turned it on)
    function qList() {
        const all = S.o.questions || [];
        if (!S.o.shuffle) return all;
        if (!S.order) S.order = shuffled(all.map((q) => q.id), S.user.uid + ':' + S.o.id);
        const by = {}; all.forEach((q) => { by[q.id] = q; });
        return S.order.map((id) => by[id]).filter(Boolean).concat(all.filter((q) => S.order.indexOf(q.id) === -1));
    }
    // option order of one question: list of ORIGINAL option indexes (answers are always saved as the original index)
    function optOrder(q) {
        const n = (q.options || []).length, base = Array.from({ length: n }, (_, k) => k);
        if (!S.o.shuffle || q.noShuffle) return base;
        if (!S.optOrder[q.id]) S.optOrder[q.id] = shuffled(base, S.user.uid + ':' + q.id);
        return S.optOrder[q.id];
    }
    function run() {
        stopTimer();
        const qs = qList();
        const nav = qs.map((q, k) => '<button type="button" class="oly-dot' + (S.answers[q.id] != null && S.answers[q.id] !== '' ? ' done' : '') + (k === S.i ? ' cur' : '') + '" data-go="' + k + '">' + (k + 1) + '</button>').join('');
        const q = qs[S.i] || {}, a = S.answers[q.id];
        const body = q.type === 'single'
            ? '<div class="oly-opts">' + optOrder(q).map((k, pos) => '<button type="button" class="oly-opt' + (+a === k && a !== '' && a != null ? ' on' : '') + '" data-k="' + k + '"><em>' + LET[pos] + '</em><span>' + esc((q.options || [])[k]) + '</span></button>').join('') + '</div>'
            : '<label class="oly-lbl">' + esc(t('yourAns')) + '</label><input type="text" class="oly-in" id="olyIn" maxlength="200" autocomplete="off" value="' + esc(a == null ? '' : a) + '">';
        const n = qs.filter((x) => S.answers[x.id] != null && S.answers[x.id] !== '').length;
        shell('<div class="oly-run" id="olyRun">' +
            '<div class="oly-bar"><div class="oly-timer" id="olyTimer">' + ic('clock') + '<b>' + span(deadline() - now()) + '</b></div><div class="oly-prog">' + esc(t('answered')) + ': <b>' + n + '</b> ' + esc(t('of')) + ' ' + qs.length + '</div><div class="oly-save" id="olySave"></div>' +
            '<button type="button" class="btn-primary oly-sub" id="olySubmit">' + ic('send') + esc(t('submit')) + '</button></div>' +
            '<div class="oly-dots">' + nav + '</div>' +
            card('<div class="oly-qn">' + (S.i + 1) + ' / ' + qs.length + ' · ' + (q.points || 0) + ' ' + esc(t('pts')) + '</div><div class="oly-q">' + esc(q.q).replace(/\n/g, '<br>') + '</div>' +
                (q.image ? '<img class="oly-img" src="' + esc(q.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + body +
                '<div class="oly-nav"><button type="button" class="btn-outline" id="olyPrev"' + (S.i ? '' : ' disabled') + '>' + ic('arrow-left') + esc(t('prev')) + '</button><span class="oly-sp"></span>' +
                (S.i < qs.length - 1 ? '<button type="button" class="btn-primary" id="olyNext">' + esc(t('next')) + ic('arrow-right') + '</button>' : '<button type="button" class="btn-primary" id="olySubmit2">' + ic('send') + esc(t('submit')) + '</button>') + '</div>', 'oly-qcard') + '</div>');
        app.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => { S.i = +b.dataset.go; run(); }; });
        app.querySelectorAll('.oly-opt').forEach((b) => { b.onclick = () => { S.answers[q.id] = +b.dataset.k; queueSave(); run(); }; });
        const inp = $('olyIn'); if (inp) { inp.onpaste = (e) => { e.preventDefault(); UI.toast(t('noCopy'), 'warn'); }; inp.ondrop = (e) => e.preventDefault(); inp.oninput = () => { S.answers[q.id] = inp.value.slice(0, 200); queueSave(); }; inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const nx = $('olyNext'); if (nx) nx.click(); } }; setTimeout(() => inp.focus(), 30); }
        $('olyPrev').onclick = () => { if (S.i) { S.i--; run(); } };
        const nx = $('olyNext'); if (nx) nx.onclick = () => { S.i++; run(); };
        $('olySubmit').onclick = () => submit(false); const s2 = $('olySubmit2'); if (s2) s2.onclick = () => submit(false);
        paintSave();
        if (S.leaves) { const sv = $('olySave'); if (sv && !S.dirty) sv.innerHTML = '<span class="oly-leaves">' + esc(t('leftPage', { n: S.leaves })) + '</span>'; }
        S.timer = setInterval(tick, 500); tick();
    }
    function tick() {
        const left = deadline() - now(), el = $('olyTimer');
        if (el) { el.querySelector('b').textContent = span(left); el.classList.toggle('warn', left < 5 * 60000); el.classList.toggle('bad', left < 60000); }
        if (left <= 0 && !S.sent) submit(true);
    }
    function stopTimer() { if (S.timer) clearInterval(S.timer); S.timer = null; }
    function paintSave(txt) { const el = $('olySave'); if (el) el.textContent = txt != null ? txt : S.saving ? t('saving') : S.dirty ? '' : t('saved'); }
    function queueSave() { S.dirty = true; paintSave(''); clearTimeout(S.saveT); S.saveT = setTimeout(saveNow, 900); }
    async function saveNow() {
        if (!S.dirty || S.sent) return;
        S.saving = true; paintSave();
        try { await attRef().update({ answers: S.answers, leaves: S.leaves }); S.dirty = false; S.saving = false; paintSave(); }
        catch (e) { S.saving = false; paintSave(navigator.onLine === false ? t('offline') : t('err') + e.message); setTimeout(saveNow, 4000); }
    }
    async function submit(auto) {
        if (S.sent) return;
        if (!auto) {
            const qs = qList(), un = qs.filter((q) => S.answers[q.id] == null || S.answers[q.id] === '').length;
            if (!(await UI.confirm((un ? t('unanswered', { n: un }) + ' ' : '') + t('submitQ'), { danger: false, ok: t('submit') }))) return;
        }
        S.sent = true; stopTimer(); clearTimeout(S.saveT);
        try {
            await attRef().update({ answers: S.answers, leaves: S.leaves, status: 'submitted', submittedAt: firebase.firestore.FieldValue.serverTimestamp() });
            S.att.status = 'submitted';
        } catch (e) {
            // the server time limit has passed: the answers saved while solving are what counts
            S.att.status = 'submitted';
        }
        finished(auto);
    }
    function finished(auto) {
        stopTimer();
        const o = S.o, att = S.att;
        document.title = o.title + ' — TheStarth'; $('olyH1').textContent = o.title;
        let main;
        if (!att) main = '<div class="oly-empty">' + ic('clock') + '<p>' + esc(t('closedNo')) + '</p></div>';
        else if (o.resultsPublished && att.score != null) main = '<div class="oly-score"><span>' + esc(t('yourScore')) + '</span><b>' + att.score + '<small> / ' + (att.maxScore || o.maxScore || 0) + '</small></b>' +
            (att.place ? '<div class="oly-place">' + ic('trophy') + esc(t('place')) + ': <b>' + att.place + '</b> ' + esc(t('ofN', { n: att.participants || o.participants || '' })) + '</div>' : '') +
            (att.placeRegion && att.region ? '<div class="oly-place">' + esc(t('regionPlace')) + ' (' + esc(att.region) + '): <b>' + att.placeRegion + '</b> ' + esc(t('ofN', { n: att.regionN || '' })) + '</div>' : '') +
            '<button type="button" class="btn-primary oly-cert-btn" id="olyCert">' + ic('download') + esc(t('cert')) + '</button></div>';
        else main = '<div class="oly-empty ok">' + ic('check-circle') + '<p><b>' + esc(auto ? t('timeUp') : t('done')) + '</b><br>' + esc(t('doneSub')) + '</p></div>';
        const lb = o.resultsPublished && Array.isArray(o.leaderboard) && o.leaderboard.length
            ? '<h3 class="oly-h3">' + ic('trophy') + esc(t('top')) + '</h3><ol class="oly-lb">' + o.leaderboard.map((r) => '<li><span class="oly-pl p' + r.place + '">' + r.place + '</span><span class="oly-nm">' + esc(r.name) + '</span><b>' + r.score + '</b></li>').join('') + '</ol>' : '';
        shell(card('<div class="oly-head"><span class="oly-badge ' + state(o) + '">' + esc(t(state(o))) + '</span><span class="oly-subj">' + esc(o.subject || '') + '</span></div>' + main + lb) +
            '<p class="oly-backl"><a href="olympiad">' + esc(t('back')) + '</a> · <a href="./">' + esc(t('home')) + '</a></p>');
        const cb = $('olyCert'); if (cb) cb.onclick = () => certificate(o, att);
    }
    // printable certificate (the browser's «Save as PDF» makes a file of it)
    function certificate(o, att) {
        const w = window.open('', '_blank'); if (!w) return;
        const d = new Date(o.resultsAt || o.endAt || Date.now()).toLocaleDateString(loc(), { day: 'numeric', month: 'long', year: 'numeric' });
        const bg = window.CERT_SVG || '';
        w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(t('cert')) + ' — ' + esc(att.name || '') + '</title><style>' +
            '@page{size:A4 landscape;margin:0}html,body{margin:0;background:#eee;font-family:Georgia,"Times New Roman",serif}.c{position:relative;width:297mm;height:210mm;margin:0 auto;background:#fffdf6;overflow:hidden}' +
            '.c svg{position:absolute;inset:0;width:100%;height:100%}.t{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:24mm;color:#3b2a10}' +
            '.t h1{font-size:15mm;letter-spacing:3mm;margin:0;color:#8F5A0C}.t .p{font-size:6mm;margin:1mm 0 6mm;text-transform:uppercase;letter-spacing:1mm}.t .f{font-size:5mm;color:#7a6440}.t .n{font-size:11mm;margin:2mm 0 4mm;font-style:italic;border-bottom:.4mm solid #C99A3B;padding:0 10mm 1mm}' +
            '.t .o{font-size:6mm;max-width:200mm;margin:0 0 3mm}.t .r{font-size:5.4mm;margin:1mm 0}.t .s{font-size:4.2mm;color:#7a6440;margin-top:2mm}.t .d{position:absolute;bottom:22mm;left:30mm;font-size:4.2mm}.t .b{position:absolute;bottom:31mm;left:30mm;font-size:4.6mm;font-weight:bold;letter-spacing:.5mm}' +
            '.pb{position:fixed;top:10px;right:10px;padding:10px 16px;font:15px system-ui;border:0;border-radius:10px;background:#8F5A0C;color:#fff;cursor:pointer}@media print{.pb{display:none}html,body{background:#fff}}' +
            '</style></head><body><button class="pb" onclick="print()">' + esc(t('print')) + '</button><div class="c">' + bg + '<div class="t"><h1>' + esc(t('certT')) + '</h1><div class="p">' + esc(t('certP')) + '</div>' +
            '<div class="f">' + esc(t('certFor')) + '</div><div class="n">' + esc(att.name || '') + '</div><div class="o">«' + esc(o.title || '') + '»</div>' +
            '<div class="r">' + esc(t('certRes', { s: att.score, m: att.maxScore || o.maxScore || 0 })) + (att.place ? ' · ' + esc(t('certPlace', { p: att.place, n: att.participants || o.participants || '' })) : '') + '</div>' +
            '<div class="s">' + esc([att.region, att.school, att.grade ? t('grade') + ' ' + gradeName(att.grade) : ''].filter(Boolean).join(' · ')) + '</div>' +
            '<div class="d">' + esc(t('certDate')) + ': ' + esc(d) + '</div><div class="b">TheStarth</div></div></div></body></html>');
        w.document.close();
    }

    // leaving the page during the test is counted (organisers see it)
    const testing = () => !!(S.timer && S.att && S.att.status === 'started' && !S.sent && deadline() > now());
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && testing()) { S.leaves++; queueSave(); return; }
        if (document.visibilityState === 'visible' && testing() && S.leaves) {
            const lim = +S.o.maxLeaves || 0;
            if (lim && S.leaves >= lim) { UI.alert(t('leftLimit')); submit(true); }
            else UI.toast(t('leftPage', { n: S.leaves }) + (lim ? ' (' + S.leaves + '/' + lim + ')' : ''), 'warn');
        }
    });
    // no copying the questions out / pasting answers in while the test runs
    ['copy', 'cut', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => {
        if (!testing() || !e.target.closest || !e.target.closest('#olyRun')) return;
        e.preventDefault(); if (ev !== 'contextmenu') UI.toast(t('noCopy'), 'warn');
    }));
    window.addEventListener('beforeunload', () => { if (S.dirty && !S.sent) saveNow(); });

    async function boot(user, profile) {
        S.user = user || null; S.profile = profile || {};
        if (typeof db === 'undefined' || !db) { shell(card('<div class="oly-empty"><p>' + esc(t('notFound')) + '</p></div>')); return; }
        if (!id) return showList();
        try {
            const d = await db.collection('olympiads').doc(id).get();
            if (!d.exists || !d.data().published) throw new Error('nf');
            S.o = Object.assign({ id: d.id }, d.data());
        } catch (e) { shell(card('<div class="oly-empty">' + ic('alert') + '<p>' + esc(t('notFound')) + '</p><a class="btn-primary" href="olympiad">' + esc(t('back')) + '</a></div>')); return; }
        S.att = null;
        if (S.user) {
            try { const a = await attRef().get(); if (a.exists) S.att = a.data(); } catch (e) {}
            try { const r = await regRef().get(); S.reg = r.exists ? r.data() : null; } catch (e) { S.reg = null; }
        }
        if (S.att && S.att.status === 'started' && deadline() > Date.now()) { S.answers = Object.assign({}, S.att.answers || {}); S.leaves = S.att.leaves || 0; return landing(); }
        landing();
    }
    shell(card('<div class="oly-empty"><p>' + esc(t('loading')) + '</p></div>'));
    let booted = '';
    window.addEventListener('starth-auth-ready', (e) => { const d = e.detail || {}; const k = (d.user && d.user.uid) || '-'; if (booted === k) return; booted = k; boot(d.user, d.profile || window.currentUserProfile); });
    window.addEventListener('starth-lang-changed', () => { if (!S.o) { if (!id) showList(); return; } if (S.timer && S.att && S.att.status === 'started' && !S.sent && deadline() > now() && app.querySelector('.oly-run')) run(); else if (S.att && S.att.status === 'submitted') finished(); else landing(); });
    if (typeof FIREBASE_READY !== 'undefined' && !FIREBASE_READY) boot(null, null);

    window.StarthOlympiad = { _s: S };
})();
