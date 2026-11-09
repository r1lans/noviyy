/* TheStarth — the app inside the Telegram bot (menu button «TheStarth»). Personal cabinet only, no video lessons.
 *   Student: next lesson, «Не смогу прийти», grades, attendance, schedule, homework, test results (Speaking / Mock),
 *            profile, payment, invite a friend, language.
 *   Teacher: today's lessons, MARK ATTENDANCE right here, warnings from students, groups with students, profile.
 * Sign-in: Telegram -> our bot server checks who it is (Telegram username in the site profile) -> Firebase custom token.
 * Fallback: e-mail + password of the site account. All lesson times are Tashkent time (salary.js helpers).
 */
(function () {
    'use strict';
    // the bot server (Cloudflare Worker with the Telegram bot). Own domain first: *.workers.dev is blocked by some providers.
    const BOT_URLS = window.STARTH_BOT_URLS || ['https://bot.thestarth.com', 'https://summer-dust-2e9.ralmi999777.workers.dev'];
    const SITE = 'https://thestarth.com';
    const W = window.Telegram && window.Telegram.WebApp;
    const S = window.StarthSalary;
    const $ = (s) => document.querySelector(s);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ic = (n) => (window.Icons ? window.Icons.svg(n) : '');
    const haptic = (k) => { try { if (W && W.HapticFeedback) { if (k === 'ok') W.HapticFeedback.notificationOccurred('success'); else if (k === 'err') W.HapticFeedback.notificationOccurred('error'); else W.HapticFeedback.selectionChanged(); } } catch (e) {} };

    // ── language: chosen on the site / in the app, otherwise Telegram's ──
    const T = {
        ru: { newChat: 'Новый чат', newGroup: 'Группа', noChats2: 'Чатов пока нет — нажмите «Новый чат» и найдите человека по имени или нику.', searchPh: 'Имя, фамилия или @ник', searchHint: 'Начните вводить имя или ник', nobody: 'Никого не найдено', groupName: 'Название группы', addPeople: 'Добавьте хотя бы одного человека', create: 'Создать', groupCreated: 'Группа создана', pinned: 'Закреплено', editing: 'Редактирование', edited: 'изменено', reply: 'Ответить', copy: 'Копировать', copied: 'Скопировано', edit: 'Изменить', pin: 'Закрепить', unpin: 'Открепить', del: 'Удалить', close: 'Закрыть', members: 'участников', admin: 'создатель', leaveGroup: 'Покинуть группу', chats: 'Чаты', noChats: 'Чатов пока нет. Начать переписку можно на сайте в «Мессенджере».', msgPh: 'Сообщение…', photo: 'Фото', allLessons: 'Все уроки', you: 'Вы', hi: 'Привет', loading: 'Загрузка…', home: 'Главная', grades: 'Оценки', att: 'Посещаемость', sched: 'Уроки', groups: 'Группы', profile: 'Профиль', mark: 'Отметить',
            next: 'Следующий урок', now: 'Идёт сейчас', noNext: 'В ближайшие дни уроков нет', today: 'Сегодня', tomorrow: 'Завтра', joinBrowser: 'Войти на урок (в браузере)',
            avg: 'Средний балл', attPct: 'Посещаемость', lessons: 'Уроков', lastGrades: 'Последние оценки', noGrades: 'Оценок пока нет', allGrades: 'Все оценки',
            present: 'Был', late: 'Опоздал', absent: 'Не был', noAtt: 'Отметок пока нет', week: 'Ближайшие 14 дней', myGroups: 'Мои группы', noGroups: 'Вы пока не в группе',
            teacher: 'Учитель', students: 'учеников', todayLessons: 'Уроки сегодня', noToday: 'Сегодня уроков нет', unmarked: 'Не отмечена посещаемость',
            allMarked: 'Вся посещаемость отмечена', openSite: 'Открыть сайт thestarth.com', ind: 'Индивидуальный урок', speaking: 'Speaking (ИИ)', mock: 'Mock',
            cantCome: 'Не смогу прийти', warned: 'Вы предупредили учителя', undo: 'Отменить', reason: 'Причина (необязательно)', send: 'Предупредить учителя', cancel: 'Отмена',
            excusedOk: 'До урока больше 24 часов — урок не засчитается.', excusedLate: 'До урока меньше 24 часов — урок засчитается как проведённый.', sent: 'Учитель предупреждён',
            homework: 'Домашнее задание', tests: 'Результаты тестов', noTests: 'Тестов пока нет', id: 'ID ученика', phone: 'Телефон', lang: 'Язык',
            pay: 'Оплатить курс', invite: 'Пригласить друга', inviteText: 'Учусь в TheStarth — присоединяйся по моей ссылке и получи скидку:', logout: 'Выйти из аккаунта',
            warnings: 'Предупредили, что не придут', noWarnings: 'Никто не предупреждал', topic: 'Тема урока (необязательно)', save: 'Сохранить', saved: 'Сохранено', allPresent: 'Все были',
            pickGroup: 'Группа', date: 'Дата', noMembers: 'В группе пока нет учеников', error: 'Не получилось, попробуйте ещё раз', refresh: 'Обновить', excused: 'предупредил(а)',
            notLinked: 'Аккаунт не найден', notLinkedP: 'Укажите свой Telegram @{u} в профиле на сайте (Личный кабинет → Профиль → Редактировать), затем откройте приложение ещё раз. Или войдите по почте.',
            noUser: 'В Telegram нет имени пользователя', noUserP: 'Задайте его: Настройки Telegram → Имя пользователя. Или войдите по почте и паролю от сайта.',
            emailLogin: 'Войти по почте', email: 'Почта', pass: 'Пароль', signIn: 'Войти', badLogin: 'Неверная почта или пароль', openProfile: 'Открыть профиль на сайте',
            offline: 'Нет связи с сервером', offlineP: 'Проверьте интернет или войдите по почте и паролю от сайта.' },
        uz: { newChat: 'Yangi chat', newGroup: 'Guruh', noChats2: 'Hali chatlar yo‘q — «Yangi chat»ni bosing va odamni ismi yoki niki bo‘yicha toping.', searchPh: 'Ism, familiya yoki @nik', searchHint: 'Ism yoki nikni yoza boshlang', nobody: 'Hech kim topilmadi', groupName: 'Guruh nomi', addPeople: 'Kamida bitta odam qo‘shing', create: 'Yaratish', groupCreated: 'Guruh yaratildi', pinned: 'Qadalgan', editing: 'Tahrirlash', edited: 'tahrirlangan', reply: 'Javob berish', copy: 'Nusxa olish', copied: 'Nusxa olindi', edit: 'Tahrirlash', pin: 'Qadash', unpin: 'Olib tashlash', del: 'O‘chirish', close: 'Yopish', members: 'a’zo', admin: 'yaratuvchi', leaveGroup: 'Guruhdan chiqish', chats: 'Chatlar', noChats: 'Hali chatlar yo‘q. Yozishmani saytdagi «Messenjer»da boshlash mumkin.', msgPh: 'Xabar…', photo: 'Rasm', allLessons: 'Barcha darslar', you: 'Siz', hi: 'Salom', loading: 'Yuklanmoqda…', home: 'Asosiy', grades: 'Baholar', att: 'Davomat', sched: 'Darslar', groups: 'Guruhlar', profile: 'Profil', mark: 'Belgilash',
            next: 'Keyingi dars', now: 'Hozir ketmoqda', noNext: 'Yaqin kunlarda dars yo‘q', today: 'Bugun', tomorrow: 'Ertaga', joinBrowser: 'Darsga kirish (brauzerda)',
            avg: 'O‘rtacha ball', attPct: 'Davomat', lessons: 'Darslar', lastGrades: 'So‘nggi baholar', noGrades: 'Hali baho yo‘q', allGrades: 'Barcha baholar',
            present: 'Keldi', late: 'Kechikdi', absent: 'Kelmadi', noAtt: 'Hali belgilar yo‘q', week: 'Yaqin 14 kun', myGroups: 'Guruhlarim', noGroups: 'Siz hali guruhda emassiz',
            teacher: 'O‘qituvchi', students: 'o‘quvchi', todayLessons: 'Bugungi darslar', noToday: 'Bugun dars yo‘q', unmarked: 'Davomat belgilanmagan',
            allMarked: 'Barcha davomat belgilangan', openSite: 'thestarth.com saytini ochish', ind: 'Individual dars', speaking: 'Speaking (AI)', mock: 'Mock',
            cantCome: 'Kela olmayman', warned: 'O‘qituvchini ogohlantirdingiz', undo: 'Bekor qilish', reason: 'Sabab (ixtiyoriy)', send: 'O‘qituvchini ogohlantirish', cancel: 'Bekor',
            excusedOk: 'Darsgacha 24 soatdan ko‘p — dars hisoblanmaydi.', excusedLate: 'Darsgacha 24 soatdan kam — dars o‘tilgan hisoblanadi.', sent: 'O‘qituvchi ogohlantirildi',
            homework: 'Uy vazifasi', tests: 'Test natijalari', noTests: 'Hali testlar yo‘q', id: 'O‘quvchi ID', phone: 'Telefon', lang: 'Til',
            pay: 'Kurs uchun to‘lash', invite: 'Do‘stni taklif qilish', inviteText: 'TheStarth’da o‘qiyapman — havolam orqali qo‘shil va chegirma ol:', logout: 'Hisobdan chiqish',
            warnings: 'Kelmasligini aytganlar', noWarnings: 'Hech kim ogohlantirmagan', topic: 'Dars mavzusi (ixtiyoriy)', save: 'Saqlash', saved: 'Saqlandi', allPresent: 'Hammasi keldi',
            pickGroup: 'Guruh', date: 'Sana', noMembers: 'Guruhda hali o‘quvchi yo‘q', error: 'Bo‘lmadi, qayta urinib ko‘ring', refresh: 'Yangilash', excused: 'ogohlantirgan',
            notLinked: 'Hisob topilmadi', notLinkedP: 'Saytdagi profilingizda Telegram @{u} ni ko‘rsating (Shaxsiy kabinet → Profil → Tahrirlash), so‘ng ilovani qayta oching. Yoki pochta orqali kiring.',
            noUser: 'Telegramda foydalanuvchi nomi yo‘q', noUserP: 'Uni o‘rnating: Telegram sozlamalari → Foydalanuvchi nomi. Yoki sayt pochtasi va paroli bilan kiring.',
            emailLogin: 'Pochta orqali kirish', email: 'Pochta', pass: 'Parol', signIn: 'Kirish', badLogin: 'Pochta yoki parol noto‘g‘ri', openProfile: 'Saytdagi profilni ochish',
            offline: 'Server bilan aloqa yo‘q', offlineP: 'Internetni tekshiring yoki sayt pochtasi va paroli bilan kiring.' },
        en: { newChat: 'New chat', newGroup: 'Group', noChats2: 'No chats yet — tap «New chat» and find a person by name or nickname.', searchPh: 'Name, surname or @nickname', searchHint: 'Start typing a name or nickname', nobody: 'Nobody found', groupName: 'Group name', addPeople: 'Add at least one person', create: 'Create', groupCreated: 'Group created', pinned: 'Pinned', editing: 'Editing', edited: 'edited', reply: 'Reply', copy: 'Copy', copied: 'Copied', edit: 'Edit', pin: 'Pin', unpin: 'Unpin', del: 'Delete', close: 'Close', members: 'members', admin: 'creator', leaveGroup: 'Leave the group', chats: 'Chats', noChats: 'No chats yet. Start a conversation on the site in «Messenger».', msgPh: 'Message…', photo: 'Photo', allLessons: 'All lessons', you: 'You', hi: 'Hi', loading: 'Loading…', home: 'Home', grades: 'Grades', att: 'Attendance', sched: 'Lessons', groups: 'Groups', profile: 'Profile', mark: 'Mark',
            next: 'Next lesson', now: 'On now', noNext: 'No lessons in the next days', today: 'Today', tomorrow: 'Tomorrow', joinBrowser: 'Join the lesson (in browser)',
            avg: 'Average', attPct: 'Attendance', lessons: 'Lessons', lastGrades: 'Latest grades', noGrades: 'No grades yet', allGrades: 'All grades',
            present: 'Present', late: 'Late', absent: 'Absent', noAtt: 'No marks yet', week: 'Next 14 days', myGroups: 'My groups', noGroups: 'You are not in a group yet',
            teacher: 'Teacher', students: 'students', todayLessons: 'Today’s lessons', noToday: 'No lessons today', unmarked: 'Attendance not marked',
            allMarked: 'All attendance is marked', openSite: 'Open thestarth.com', ind: 'Individual lesson', speaking: 'Speaking (AI)', mock: 'Mock',
            cantCome: 'I can’t come', warned: 'You warned the teacher', undo: 'Undo', reason: 'Reason (optional)', send: 'Warn the teacher', cancel: 'Cancel',
            excusedOk: 'More than 24 hours before the lesson — it will not count.', excusedLate: 'Less than 24 hours before the lesson — it counts as held.', sent: 'The teacher has been warned',
            homework: 'Homework', tests: 'Test results', noTests: 'No tests yet', id: 'Student ID', phone: 'Phone', lang: 'Language',
            pay: 'Pay for the course', invite: 'Invite a friend', inviteText: 'I study at TheStarth — join with my link and get a discount:', logout: 'Log out',
            warnings: 'Will not come', noWarnings: 'Nobody has warned', topic: 'Lesson topic (optional)', save: 'Save', saved: 'Saved', allPresent: 'All present',
            pickGroup: 'Group', date: 'Date', noMembers: 'No students in the group yet', error: 'Something went wrong, try again', refresh: 'Refresh', excused: 'warned',
            notLinked: 'Account not found', notLinkedP: 'Add your Telegram @{u} to your profile on the site (Dashboard → Profile → Edit), then open the app again. Or sign in with e-mail.',
            noUser: 'Your Telegram has no username', noUserP: 'Set one in Telegram Settings → Username. Or sign in with the site e-mail and password.',
            emailLogin: 'Sign in with e-mail', email: 'E-mail', pass: 'Password', signIn: 'Sign in', badLogin: 'Wrong e-mail or password', openProfile: 'Open my profile on the site',
            offline: 'Cannot reach the server', offlineP: 'Check the internet or sign in with the site e-mail and password.' }
    };
    const DAYS_ = { ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], uz: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] };
    const MONTHS_ = { ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'], uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
    const tgLang = W && W.initDataUnsafe && W.initDataUnsafe.user && W.initDataUnsafe.user.language_code;
    let lang = 'ru';
    try { lang = localStorage.getItem('starthLang') || (tgLang && tgLang.slice(0, 2)) || 'ru'; } catch (e) {}
    if (!T[lang]) lang = 'ru';
    let L = T[lang], DAYS = DAYS_[lang], MONTHS = MONTHS_[lang];
    function setLang(l) { lang = T[l] ? l : 'ru'; L = T[lang]; DAYS = DAYS_[lang]; MONTHS = MONTHS_[lang]; try { localStorage.setItem('starthLang', lang); } catch (e) {} document.documentElement.lang = lang; }

    if (W) { try { W.ready(); W.expand(); W.setHeaderColor('secondary_bg_color'); if (W.disableVerticalSwipes) W.disableVerticalSwipes(); } catch (e) {} }
    const openExternal = (url) => { if (W && W.openLink) W.openLink(url); else window.open(url, '_blank'); };
    const openTg = (url) => { if (W && W.openTelegramLink) W.openTelegramLink(url); else window.open(url, '_blank'); };

    // ── dates (lesson dates are 'YYYY-MM-DD' in Tashkent time) ──
    const today = () => S.todayStr();
    const fmtDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] : String(s || ''); };
    const dayLabel = (date) => date === today() ? L.today : date === S.addDays(today(), 1) ? L.tomorrow : DAYS[S.dowOf(date)] + ', ' + fmtDate(date);
    const lessonUrl = (l) => SITE + '/video-lesson?room=' + encodeURIComponent(l.room) + (l.groupId ? '&group=' + encodeURIComponent(l.groupId) : '');
    const scoreCls = (v) => (v >= 8 ? 's-hi' : v >= 6 ? 's-mid' : 's-lo');
    const ms = (v) => (v == null ? 0 : typeof v === 'number' ? v : v.toMillis ? v.toMillis() : v.seconds ? v.seconds * 1000 : Date.parse(v) || 0);
    const LESSON_MS = 90 * 60000;

    // ── data ──
    let me = null, P = {}, D = null, tab = 'home', markSel = null, loadedAt = 0;
    let chats = [], chatsUnsub = null, chatId = '', msgsUnsub = null, msgs = [];
    try { const m = /[?&#]chat=([^&#]+)/.exec(location.search + location.hash); if (m) { chatId = decodeURIComponent(m[1]); tab = 'chat'; } } catch (e) {}
    const all = async (q) => { try { const s = await q.get(); const a = []; s.forEach((d) => a.push(Object.assign({ id: d.id }, d.data()))); return a; } catch (e) { console.warn(e); return []; } };
    async function load() {
        const uid = me.uid, c = (n) => db.collection(n);
        try { const d = await db.collection('users').doc(uid).get(); P = d.exists ? d.data() : {}; } catch (e) { P = {}; }
        const role = ['teacher', 'partner', 'curator', 'partner_curator'].indexOf(P.role) !== -1 ? 'teacher' : 'student';
        if (role === 'teacher') {
            const [groups, att, sched, abs] = await Promise.all([all(c('groups').where('teacherUid', '==', uid)), all(c('attendance').where('teacherUid', '==', uid)),
                all(c('schedule').where('teacherUid', '==', uid)), all(c('absences').where('teacherUid', '==', uid))]);
            D = { role, groups: groups.filter((g) => !g.archived).sort((a, b) => (a.name || '').localeCompare(b.name || '')), att, sched, abs };
        } else {
            const nick = P.nickname || '';
            const [groups, grades, att, sched, mocks, speak, abs] = await Promise.all([
                all(c('groups').where('memberUids', 'array-contains', uid)), all(c('grades').where('studentUid', '==', uid)),
                all(c('attendance').where('studentUids', 'array-contains', uid)), nick ? all(c('schedule').where('studentNickname', '==', nick)) : [],
                all(c('mockResults').where('uid', '==', uid)), all(c('speakingResults').where('uid', '==', uid)), all(c('absences').where('uid', '==', uid))]);
            const gname = {}; groups.forEach((g) => { gname[g.id] = g.name; });
            const marks = [];
            att.forEach((a) => { const m = (a.marks || {})[nick]; if (m) marks.push({ date: a.date, s: m, group: gname[a.groupId] || '', topic: a.topic || '' }); });
            marks.sort((a, b) => String(b.date).localeCompare(String(a.date)));
            grades.sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
            const ts = (x) => ms(x.ts) || ms(x.createdAt);
            mocks.sort((a, b) => ts(b) - ts(a)); speak.sort((a, b) => ts(b) - ts(a));
            const absMap = {}; abs.forEach((a) => { absMap[a.id] = a; });
            D = { role, groups: groups.filter((g) => !g.archived), grades, marks, sched, gname, mocks, speak, absMap, ts };
        }
        loadedAt = Date.now();
    }
    const upcoming = (days) => S.upcoming(D.groups, D.sched, days, Date.now() - LESSON_MS);

    // ── building blocks ──
    function header() {
        const name = [P.name, P.surname].filter(Boolean).join(' ') || (P.nickname ? '@' + P.nickname : '');
        const sub = D.role === 'teacher' ? (P.role === 'partner' || P.role === 'partner_curator' ? L.teacher + ' · partner' : L.teacher) : (D.groups.map((g) => g.name).join(' · ') || (P.nickname ? '@' + P.nickname : ''));
        return '<div class="top"><div class="ava">' + esc((name || 'S').charAt(0).toUpperCase()) + '</div><div class="top-t"><h1>' + esc(L.hi + ', ' + (P.name || name)) + '</h1><small>' + esc(sub) + '</small></div><button class="icon-btn" data-act="refresh" aria-label="' + esc(L.refresh) + '">' + ic('refresh') + '</button></div>';
    }
    function nextCard(list) {
        const n = list[0];
        if (!n) return '<div class="card"><h2>' + ic('calendar') + esc(L.next) + '</h2><p class="muted">' + esc(L.noNext) + '</p></div>';
        const at = S.lessonAt(n.date, n.time).getTime(), live = at <= Date.now();
        return '<div class="card next"><h2>' + ic('calendar') + esc(live ? L.now : L.next) + '</h2><div class="big">' + esc(dayLabel(n.date) + ' · ' + n.time) + '</div><p class="muted">' + esc(n.title) + (n.teacherName && D.role !== 'teacher' ? ' · ' + esc(n.teacherName) : '') + '</p>' +
            (n.room ? '<button class="btn btn-light" data-open="' + esc(lessonUrl(n)) + '">' + ic('video') + esc(L.joinBrowser) + '</button>' : '') +
            (D.role !== 'teacher' && !live ? absenceBtn(n, true) : '') + '</div>';
    }
    function absenceBtn(l, onAccent) {
        const id = S.absenceId(l, me.uid), a = D.absMap && D.absMap[id];
        if (a) return '<div class="warned' + (onAccent ? ' on-acc' : '') + '">' + ic('check') + '<span>' + esc(L.warned) + '</span><button class="link" data-undo="' + esc(id) + '">' + esc(L.undo) + '</button></div>';
        return '<button class="btn ' + (onAccent ? 'btn-on-acc' : 'btn-ghost') + '" style="margin-top:8px" data-absent="' + esc(l.key) + '">' + ic('x-circle') + esc(L.cantCome) + '</button>';
    }
    function gradeRow(g) {
        const v = Number(g.score);
        return '<div class="row"><div class="score ' + scoreCls(v) + '">' + esc(isNaN(v) ? '—' : v) + '</div><div class="main"><b>' + esc(g.type || '') + (D.gname[g.groupId] ? ' · ' + esc(D.gname[g.groupId]) : '') + '</b><small>' + esc(fmtDate(g.date || String(g.createdAt || '').slice(0, 10))) + (g.comment ? ' · ' + esc(g.comment) : '') + '</small></div></div>';
    }
    const MARK = { present: ['check', 'd-present'], late: ['clock', 'd-late'], absent: ['x', 'd-absent'] };
    function markRow(m) {
        const k = MARK[m.s] || MARK.absent;
        return '<div class="row"><div class="dot ' + k[1] + '">' + ic(k[0]) + '</div><div class="main"><b>' + esc(L[m.s] || m.s) + '</b><small>' + esc(fmtDate(m.date)) + (m.group ? ' · ' + esc(m.group) : '') + (m.topic ? ' · ' + esc(m.topic) : '') + '</small></div></div>';
    }
    function attStats() { const n = D.marks.length, ok = D.marks.filter((m) => m.s !== 'absent').length; return { n, pct: n ? Math.round(ok * 100 / n) : null }; }
    function avg(list) { const v = list.map((g) => Number(g.score)).filter((x) => !isNaN(x)); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; }
    function homework() {
        const hw = D.sched.filter((s) => s.homework && String(s.homework).trim()).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3);
        if (!hw.length) return '';
        return '<div class="card"><h2>' + ic('note') + esc(L.homework) + '</h2>' + hw.map((s) => '<div class="row"><div class="main"><b>' + esc(s.subject || L.ind) + '</b><small>' + esc(fmtDate(s.date)) + '</small><p class="hw">' + esc(s.homework) + '</p></div></div>').join('') + '</div>';
    }

    // ── student screens ──
    function studentHome() {
        const up = upcoming(14), a = attStats(), av = avg(D.grades), sp = D.speak[0], mk = D.mocks[0];
        return nextCard(up) +
            '<div class="stats"><button class="stat" data-tab="grades"><b>' + (av == null ? '—' : av) + '</b><span>' + esc(L.avg) + '</span></button><button class="stat" data-tab="att"><b>' + (a.pct == null ? '—' : a.pct + '%') + '</b><span>' + esc(L.attPct) + '</span></button><button class="stat" data-tab="att"><b>' + a.n + '</b><span>' + esc(L.lessons) + '</span></button></div>' +
            ((sp || mk) ? '<div class="card duo">' +
                (sp ? '<div><span class="chip">' + esc(L.speaking) + '</span><div class="band">' + esc(sp.overall != null ? sp.overall : '—') + '</div></div>' : '') +
                (mk ? '<div><span class="chip">' + esc(L.mock) + (mk.skill ? ' · ' + esc(mk.skill) : '') + '</span><div class="band">' + esc(mk.band != null ? mk.band : '—') + '</div></div>' : '') + '</div>' : '') +
            homework() +
            '<div class="card"><h2>' + ic('star') + esc(L.lastGrades) + '</h2>' + (D.grades.length ? D.grades.slice(0, 3).map(gradeRow).join('') + '<button class="btn btn-ghost" style="margin-top:8px" data-tab="grades">' + esc(L.allGrades) + '</button>' : '<p class="muted">' + esc(L.noGrades) + '</p>') + '</div>';
    }
    function studentGrades() {
        if (!D.grades.length) return '<div class="card"><p class="muted">' + esc(L.noGrades) + '</p></div>';
        const by = {}; D.grades.forEach((g) => { (by[g.groupId || ''] = by[g.groupId || ''] || []).push(g); });
        return Object.keys(by).map((gid) => '<div class="card"><h2>' + ic('book') + '<span class="grow">' + esc(D.gname[gid] || L.grades) + '</span><span class="chip">' + esc(L.avg) + ' ' + avg(by[gid]) + '</span></h2>' + by[gid].map(gradeRow).join('') + '</div>').join('');
    }
    function studentAtt() {
        const a = attStats();
        if (!a.n) return '<div class="card"><p class="muted">' + esc(L.noAtt) + '</p></div>';
        const cnt = (s) => D.marks.filter((m) => m.s === s).length;
        return '<div class="card"><h2>' + ic('check-circle') + '<span class="grow">' + esc(L.attPct) + '</span><span style="font-size:1.3rem">' + a.pct + '%</span></h2><div class="bar"><i style="width:' + a.pct + '%"></i></div>' +
            '<p class="muted" style="margin-top:8px">' + esc(L.present) + ': ' + cnt('present') + ' · ' + esc(L.late) + ': ' + cnt('late') + ' · ' + esc(L.absent) + ': ' + cnt('absent') + '</p></div>' +
            '<div class="card">' + D.marks.slice(0, 60).map(markRow).join('') + '</div>';
    }
    function lessonsList(isTeacher) {
        const up = upcoming(14);
        const list = up.length ? up.map((l) => {
            const live = S.lessonAt(l.date, l.time).getTime() <= Date.now();
            return '<div class="row lesson"><div class="day"><b>' + esc(l.time) + '</b><small>' + esc(DAYS[S.dowOf(l.date)]) + '</small></div><div class="main"><b>' + esc(l.title) + '</b><small>' + esc(live ? L.now : dayLabel(l.date)) +
                (isTeacher ? '' : (l.teacherName ? ' · ' + esc(l.teacherName) : '')) + '</small>' + (!isTeacher && !live ? absenceBtn(l, false) : '') + '</div>' +
                (l.room ? '<button class="icon-btn acc" aria-label="' + esc(L.joinBrowser) + '" data-open="' + esc(lessonUrl(l)) + '">' + ic('video') + '</button>' : '') + '</div>';
        }).join('') : '<p class="muted">' + esc(L.noNext) + '</p>';
        const groups = D.groups.length ? D.groups.map((g) => '<div class="row"><div class="dot acc">' + ic('users') + '</div><div class="main"><b>' + esc(g.name) + '</b><small>' + esc(g.scheduleText || '') +
            (isTeacher ? ' · ' + (g.members || []).length + ' ' + esc(L.students) : (g.teacherName ? ' · ' + esc(g.teacherName) : '')) + '</small></div></div>').join('') : '<p class="muted">' + esc(L.noGroups) + '</p>';
        return '<div class="card"><h2>' + ic('calendar') + esc(L.week) + '</h2>' + list + '</div>' + (isTeacher ? '' : '<div class="card"><h2>' + ic('users') + esc(L.myGroups) + '</h2>' + groups + '</div>');
    }
    function testsCard() {
        const rows = [];
        D.speak.slice(0, 5).forEach((x) => rows.push({ t: D.ts(x), html: '<div class="row"><div class="score s-mid">' + esc(x.overall != null ? x.overall : '—') + '</div><div class="main"><b>' + esc(L.speaking) + '</b><small>' + esc(x.topic || x.kind || '') + '</small></div></div>' }));
        D.mocks.slice(0, 5).forEach((x) => rows.push({ t: D.ts(x), html: '<div class="row"><div class="score s-hi">' + esc(x.band != null ? x.band : '—') + '</div><div class="main"><b>' + esc(L.mock + (x.skill ? ' · ' + x.skill : '')) + '</b><small>' + esc(x.title || '') + (x.total ? ' · ' + x.correct + '/' + x.total : '') + '</small></div></div>' }));
        rows.sort((a, b) => b.t - a.t);
        return '<div class="card"><h2>' + ic('trophy') + esc(L.tests) + '</h2>' + (rows.length ? rows.map((r) => r.html).join('') : '<p class="muted">' + esc(L.noTests) + '</p>') + '</div>';
    }
    function profile() {
        const name = [P.name, P.surname].filter(Boolean).join(' ');
        const info = [['@', P.nickname ? '@' + P.nickname : ''], [L.id, P.studentId || ''], [L.phone, P.phone || '']].filter((x) => x[1]);
        const langs = ['ru', 'uz', 'en'].map((l) => '<button class="seg-b' + (l === lang ? ' on' : '') + '" data-lang="' + l + '">' + l.toUpperCase() + '</button>').join('');
        const student = D.role !== 'teacher';
        return '<div class="card"><h2>' + ic('users') + esc(name || L.profile) + '</h2>' + info.map((x) => '<div class="kv"><span>' + esc(x[0] === '@' ? 'Nickname' : x[0]) + '</span><b>' + esc(x[1]) + '</b></div>').join('') + '</div>' +
            (student ? testsCard() : '') +
            '<div class="card actions">' +
                (student ? '<button class="btn btn-main" data-open="' + esc(SITE + '/payment' + (P.studentId ? '?id=' + encodeURIComponent(P.studentId) + '&name=' + encodeURIComponent(P.name || '') + '&surname=' + encodeURIComponent(P.surname || '') : '')) + '">' + ic('wallet') + esc(L.pay) + '</button>' : '') +
                (student && P.nickname ? '<button class="btn btn-ghost" data-act="invite">' + ic('gift') + esc(L.invite) + '</button>' : '') +
                '<button class="btn btn-ghost" data-open="' + SITE + '/dashboard">' + ic('arrow-right') + esc(L.openSite) + '</button>' +
            '</div>' +
            '<div class="card"><h2>' + ic('keyboard') + esc(L.lang) + '</h2><div class="seg">' + langs + '</div></div>' +
            '<button class="btn btn-plain" data-act="logout">' + ic('logout') + esc(L.logout) + '</button>';
    }

    // ── teacher screens ──
    function unmarkedList() {
        const todo = [], t0 = today();
        D.groups.forEach((g) => {
            const t = S.groupTime(g); if (!t) return;
            for (let i = 0; i <= 10; i++) {
                const date = S.addDays(t0, -i);
                if (S.groupDays(g).indexOf(S.dowOf(date)) === -1 || S.lessonAt(date, t).getTime() > Date.now() || (g.createdAt && date < String(g.createdAt).slice(0, 10))) continue;
                if (!D.att.some((a) => a.groupId === g.id && a.date === date)) todo.push({ g, date });
            }
        });
        return todo.sort((a, b) => b.date.localeCompare(a.date));
    }
    function teacherHome() {
        const up = upcoming(7), t0 = today(), todays = up.filter((l) => l.date === t0), todo = unmarkedList();
        const nStud = {}; D.groups.forEach((g) => (g.memberUids || []).forEach((u) => { nStud[u] = 1; }));
        const warn = D.abs.filter((a) => a.date >= t0).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        const until = P.role === 'partner' || P.role === 'partner_curator' ? (P.partnerUntil || 0) : 0;
        return nextCard(up) +
            (P.role === 'partner' || P.role === 'partner_curator' ? '<div class="card' + (until < Date.now() ? ' bad' : '') + '"><p class="muted">' + esc(until > Date.now() ? 'Доступ до ' + new Date(until).toLocaleDateString('ru-RU') : 'Доступ к платформе закончился — напишите @TheStarth') + '</p></div>' : '') +
            '<div class="stats"><button class="stat" data-tab="groups"><b>' + D.groups.length + '</b><span>' + esc(L.groups) + '</span></button><button class="stat" data-tab="groups"><b>' + Object.keys(nStud).length + '</b><span>' + esc(L.students) + '</span></button><button class="stat" data-tab="mark"><b>' + todo.length + '</b><span>' + esc(L.unmarked) + '</span></button></div>' +
            '<div class="card"><h2>' + ic('clock') + '<span class="grow">' + esc(L.todayLessons) + '</span><button class="link acc-t" data-tab="sched">' + esc(L.allLessons) + '</button></h2>' + (todays.length ? todays.map((l) => '<div class="row"><div class="day"><b>' + esc(l.time) + '</b></div><div class="main"><b>' + esc(l.title) + '</b><small>' + (l.kind === 'group' ? ((D.groups.find((g) => g.id === l.groupId) || {}).members || []).length + ' ' + esc(L.students) : esc(L.ind)) + '</small></div>' +
                (l.groupId ? '<button class="btn btn-small" data-mark="' + esc(l.groupId) + '" data-date="' + esc(l.date) + '">' + esc(L.mark) + '</button>' : '') + '</div>').join('') : '<p class="muted">' + esc(L.noToday) + '</p>') + '</div>' +
            '<div class="card"><h2>' + ic('alert') + esc(L.unmarked) + '</h2>' + (todo.length ? todo.slice(0, 8).map((x) => '<div class="row"><div class="dot d-late">' + ic('clock') + '</div><div class="main"><b>' + esc(x.g.name) + '</b><small>' + esc(dayLabel(x.date)) + '</small></div><button class="btn btn-small" data-mark="' + esc(x.g.id) + '" data-date="' + esc(x.date) + '">' + esc(L.mark) + '</button></div>').join('') : '<p class="muted">' + esc(L.allMarked) + '</p>') + '</div>' +
            '<div class="card"><h2>' + ic('bell') + esc(L.warnings) + '</h2>' + (warn.length ? warn.slice(0, 8).map((a) => '<div class="row"><div class="dot ' + (a.excused ? 'd-present' : 'd-late') + '">' + ic('bell') + '</div><div class="main"><b>' + esc(a.name || '@' + a.nickname) + '</b><small>' + esc(dayLabel(a.date) + ' · ' + (a.time || '') + ' · ' + (a.title || '')) + (a.reason ? ' · ' + esc(a.reason) : '') + '</small></div></div>').join('') : '<p class="muted">' + esc(L.noWarnings) + '</p>') + '</div>';
    }
    function teacherGroups() {
        if (!D.groups.length) return '<div class="card"><p class="muted">' + esc(L.noGroups) + '</p></div>';
        return D.groups.map((g) => '<div class="card"><h2>' + ic('users') + '<span class="grow">' + esc(g.name) + '</span><span class="chip">' + (g.members || []).length + '</span></h2><p class="muted">' + esc(g.scheduleText || '') + '</p>' +
            ((g.members || []).length ? (g.members || []).map((m) => '<div class="row"><div class="ava sm">' + esc(((m.name || m.nickname || '?').charAt(0)).toUpperCase()) + '</div><div class="main"><b>' + esc(m.name || '@' + m.nickname) + '</b><small>@' + esc(m.nickname || '') + '</small></div></div>').join('') : '<p class="muted">' + esc(L.noMembers) + '</p>') +
            '<button class="btn btn-ghost" style="margin-top:8px" data-mark="' + esc(g.id) + '" data-date="' + esc(today()) + '">' + ic('check-circle') + esc(L.att) + '</button></div>').join('');
    }
    // attendance marking (the same document as on the site: attendance/<groupId>_<date>)
    function lastLessonDay(g) {
        for (let i = 0; i <= 14; i++) { const d = S.addDays(today(), -i); if (S.groupDays(g).indexOf(S.dowOf(d)) !== -1) return d; }
        return today();
    }
    function markScreen() {
        if (!D.groups.length) return '<div class="card"><p class="muted">' + esc(L.noGroups) + '</p></div>';
        if (!markSel || !D.groups.some((g) => g.id === markSel.gid)) { const g = D.groups[0]; markSel = { gid: g.id, date: lastLessonDay(g), marks: null, topic: null }; }
        const g = D.groups.find((x) => x.id === markSel.gid), date = markSel.date;
        const rec = D.att.find((a) => a.groupId === g.id && a.date === date);
        if (!markSel.marks) { markSel.marks = Object.assign({}, (rec && rec.marks) || {}); markSel.topic = (rec && rec.topic) || ''; }
        const absBy = {}; D.abs.filter((a) => a.groupId === g.id && a.date === date).forEach((a) => { absBy[a.nickname] = a; });
        const opts = D.groups.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === g.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
        const members = g.members || [];
        return '<div class="card"><div class="form-row"><label>' + esc(L.pickGroup) + '<select id="mkGroup">' + opts + '</select></label><label>' + esc(L.date) + '<input type="date" id="mkDate" value="' + esc(date) + '" max="' + esc(today()) + '"></label></div>' +
            (members.length ? '<button class="btn btn-ghost" data-act="allpresent" style="margin:4px 0 6px">' + ic('check') + esc(L.allPresent) + '</button>' +
            members.map((m) => {
                const cur = markSel.marks[m.nickname] || '', a = absBy[m.nickname];
                return '<div class="mk-row"><div class="main"><b>' + esc(m.name || '@' + m.nickname) + '</b>' + (a ? '<small class="warn-t">' + esc(L.excused) + (a.reason ? ': ' + esc(a.reason) : '') + '</small>' : '') + '</div><div class="seg">' +
                    ['present', 'late', 'absent'].map((s) => '<button class="seg-b mk ' + (cur === s ? 'on-' + s : '') + '" data-nick="' + esc(m.nickname) + '" data-s="' + s + '">' + esc(L[s]) + '</button>').join('') + '</div></div>';
            }).join('') +
            '<input type="text" id="mkTopic" class="inp" maxlength="120" placeholder="' + esc(L.topic) + '" value="' + esc(markSel.topic || '') + '">' +
            '<button class="btn btn-main" data-act="savemark" style="margin-top:10px">' + esc(L.save) + '</button><div class="msg" id="mkMsg"></div>'
            : '<p class="muted">' + esc(L.noMembers) + '</p>') + '</div>';
    }
    async function saveMarks() {
        const g = D.groups.find((x) => x.id === markSel.gid); if (!g) return;
        const btn = document.querySelector('[data-act="savemark"]'); if (btn) btn.disabled = true;
        const data = { groupId: g.id, teacherUid: me.uid, curatorUid: g.curatorUid || '', date: markSel.date, topic: String(($('#mkTopic') || {}).value || '').trim().slice(0, 120), marks: markSel.marks, studentUids: (g.memberUids || []).slice(), updatedAt: new Date().toISOString() };
        try {
            await db.collection('attendance').doc(g.id + '_' + markSel.date).set(data);
            const i = D.att.findIndex((a) => a.groupId === g.id && a.date === markSel.date);
            const rec = Object.assign({ id: g.id + '_' + markSel.date }, data); if (i >= 0) D.att[i] = rec; else D.att.push(rec);
            haptic('ok'); const m = $('#mkMsg'); if (m) { m.className = 'msg ok'; m.textContent = L.saved; }
        } catch (e) { haptic('err'); const m = $('#mkMsg'); if (m) { m.className = 'msg err'; m.textContent = L.error + ' (' + e.message + ')'; } }
        if (btn) btn.disabled = false;
    }

    // ── «Не смогу прийти» (same document as on the site: absences/<group|s_schedule>_<date>_<uid>) ──
    function absenceSheet(key) {
        const l = upcoming(14).find((x) => x.key === key); if (!l) return;
        const at = S.lessonAt(l.date, l.time), excused = at.getTime() - Date.now() >= 24 * 3600000;
        sheet('<h3>' + esc(L.cantCome) + '</h3><p class="muted">' + esc(l.title + ' · ' + dayLabel(l.date) + ' · ' + l.time) + '</p>' +
            '<div class="note ' + (excused ? 'ok' : 'late') + '">' + esc(excused ? L.excusedOk : L.excusedLate) + '</div>' +
            '<textarea id="abReason" class="inp" maxlength="200" placeholder="' + esc(L.reason) + '"></textarea>' +
            '<button class="btn btn-main" id="abSend" style="margin-top:10px">' + esc(L.send) + '</button><button class="btn btn-plain" data-close>' + esc(L.cancel) + '</button><div class="msg" id="abMsg"></div>');
        $('#abSend').onclick = async () => {
            const b = $('#abSend'); b.disabled = true;
            const fv = firebase.firestore.FieldValue, TS = firebase.firestore.Timestamp;
            const doc = { uid: me.uid, nickname: P.nickname || '', name: [P.name, P.surname].filter(Boolean).join(' '), groupId: l.groupId || '', scheduleId: l.scheduleId || '', teacherUid: l.teacherUid || '',
                date: l.date, dateNum: S.dateNum(l.date), time: l.time || '', lessonAt: TS.fromDate(at), title: l.title || '', reason: String($('#abReason').value || '').trim().slice(0, 200),
                excused: at.getTime() - Date.now() >= 24 * 3600000, createdAt: fv.serverTimestamp(), via: 'site' };
            try {
                const id = S.absenceId(l, me.uid);
                await db.collection('absences').doc(id).set(doc);
                D.absMap[id] = Object.assign({ id }, doc); haptic('ok'); closeSheet(); toast(L.sent); render();
            } catch (e) { b.disabled = false; haptic('err'); $('#abMsg').className = 'msg err'; $('#abMsg').textContent = L.error + ' (' + e.message + ')'; }
        };
    }
    async function undoAbsence(id) {
        try { await db.collection('absences').doc(id).delete(); delete D.absMap[id]; haptic('ok'); render(); } catch (e) { haptic('err'); toast(L.error); }
    }

    // ── chats (the same chats as the site's «Мессенджер») ──
    const isUnread = (c) => c.lastFrom && c.lastFrom !== me.uid && (c.lastTs || 0) > ((c.reads || {})[me.uid] || 0);
    const chatName = (c) => { if (c.group) return c.title || L.chats; const o = (c.members || []).find((u) => u !== me.uid) || ''; return (c.names || {})[o] || ((c.nicks || {})[o] ? '@' + c.nicks[o] : '…'); };
    const hm = (t) => { const d = new Date(t + 5 * 3600000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
    const whenMsg = (t) => { if (!t) return ''; const day = new Date(t + 5 * 3600000).toISOString().slice(0, 10); return day === today() ? hm(t) : fmtDate(day); };
    function listenChats() {
        if (chatsUnsub) chatsUnsub();
        chatsUnsub = db.collection('chats').where('members', 'array-contains', me.uid).onSnapshot((snap) => {
            chats = []; snap.forEach((d) => chats.push(Object.assign({ id: d.id }, d.data())));
            chats.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
            if (!D) return;
            if (tab === 'chats') render();
            else if (tab === 'chat') { const h = $('#chatHead b'); const c = chats.find((x) => x.id === chatId); if (!c) { if (snap.metadata && snap.metadata.fromCache) return; backFromChat(); return; } if (h) h.textContent = chatName(c); renderPin(); }
            else { const t = document.querySelector('#tabs [data-tab="chats"]'); if (t) { const n = chats.filter(isUnread).length; let b = t.querySelector('.tab-badge'); if (n && !b) { b = document.createElement('i'); b.className = 'tab-badge'; t.appendChild(b); } if (b) { if (n) b.textContent = n; else b.remove(); } } }
        }, (e) => console.warn('chats', e));
    }
    // ── full messenger (same documents and rules as the site's «Мессенджер») ──
    const isGroup = (c) => !!(c && c.group);
    const myName = () => [P.name, P.surname].filter(Boolean).join(' ') || (P.nickname ? '@' + P.nickname : '');
    const myRole = () => (['teacher', 'partner', 'curator', 'partner_curator'].indexOf(P.role) !== -1 ? 'teacher' : 'student');
    const nameOf = (c, uid) => (uid === me.uid ? L.you : ((c.names || {})[uid] || ((c.nicks || {})[uid] ? '@' + c.nicks[uid] : '…')));
    const snippet = (x) => { const t = String((x && x.text) || '').trim(); return (t ? t : (x && x.img ? L.photo : '')).slice(0, 100); };
    const canDelete = (c, x) => x.from === me.uid || (isGroup(c) && c.createdBy === me.uid);
    const canPin = (c) => !isGroup(c) || c.createdBy === me.uid;
    let replyTo = null, editing = null;
    const norm = (v) => String(v || '').toLowerCase();
    async function searchUsers(raw) {
        const q = norm(raw).replace(/^@/, '').trim(), toks = q.split(/\s+/).filter(Boolean);
        if (!toks.length || toks.every((t) => t.length < 2)) return [];
        const first = toks.slice().sort((a, b) => b.length - a.length)[0].slice(0, 15), out = new Map();
        try {
            const snap = await db.collection('directory').where('keys', 'array-contains', first).limit(30).get();
            snap.forEach((d) => { const x = d.data(); if (d.id === me.uid) return; const words = [x.name, x.surname, x.nickname].map(norm).join(' ').split(/\s+/);
                if (toks.every((t) => words.some((w) => w.startsWith(t)))) out.set(d.id, { uid: d.id, name: [x.name, x.surname].filter(Boolean).join(' '), nick: x.nickname || '', role: x.role || '' }); });
        } catch (e) { console.warn('directory', e); }
        if (!out.size && toks.length === 1 && /^[a-z0-9_.-]{2,40}$/i.test(toks[0])) {
            try { const nd = await db.collection('nicknames').doc(toks[0]).get(); if (nd.exists && nd.data().uid && nd.data().uid !== me.uid) out.set(nd.data().uid, { uid: nd.data().uid, name: nd.data().displayName || '', nick: toks[0], role: '' }); } catch (e) {}
        }
        return Array.from(out.values());
    }
    function chatList() {
        const top = '<div class="chat-tools"><button class="btn btn-main" data-act="newchat">' + ic('plus') + esc(L.newChat) + '</button><button class="btn btn-ghost" data-act="newgroup">' + ic('users') + esc(L.newGroup) + '</button></div>';
        if (!chats.length) return top + '<div class="card"><p class="muted">' + esc(L.noChats2) + '</p></div>';
        return top + '<div class="card">' + chats.map((c) => '<button class="row chat-row" data-chat="' + esc(c.id) + '"><div class="ava sm' + (isGroup(c) ? ' grp' : '') + '">' + (isGroup(c) ? ic('users') : esc((chatName(c).replace('@', '').charAt(0) || '?').toUpperCase())) + '</div><div class="main"><b>' + esc(chatName(c)) + '</b><small>' +
            (c.lastFrom === me.uid ? esc(L.you) + ': ' : (isGroup(c) && c.lastName ? esc(c.lastName) + ': ' : '')) + esc(c.lastText || '') + '</small></div><div class="chat-meta"><small>' + esc(whenMsg(c.lastTs)) + '</small>' + (isUnread(c) ? '<i class="unread-dot"></i>' : '') + '</div></button>').join('') + '</div>';
    }
    // people picker inside a sheet: onPick(user)
    function bindPicker(onPick, exclude) {
        const inp = $('#pkQ'), box = $('#pkRes'); let t = 0, seq = 0;
        inp.oninput = () => { clearTimeout(t); const q = inp.value; if (norm(q).replace(/^@/, '').trim().length < 2) { box.innerHTML = '<p class="muted">' + esc(L.searchHint) + '</p>'; return; }
            t = setTimeout(async () => { const my = ++seq; const r = (await searchUsers(q)).filter((u) => !(exclude && exclude().has(u.uid))); if (my !== seq) return;
                box.innerHTML = r.length ? r.map((u, i) => '<button class="row chat-row" data-pk="' + i + '"><div class="ava sm">' + esc(((u.name || u.nick || '?').charAt(0)).toUpperCase()) + '</div><div class="main"><b>' + esc(u.name || '@' + u.nick) + '</b><small>@' + esc(u.nick) + (u.role === 'teacher' ? ' · ' + esc(L.teacher) : '') + '</small></div></button>').join('') : '<p class="muted">' + esc(L.nobody) + '</p>';
                box.querySelectorAll('[data-pk]').forEach((b) => { b.onclick = () => onPick(r[+b.getAttribute('data-pk')]); });
            }, 250); };
        box.innerHTML = '<p class="muted">' + esc(L.searchHint) + '</p>'; setTimeout(() => inp.focus(), 50);
    }
    function newChatSheet() {
        sheet('<h3>' + esc(L.newChat) + '</h3><input class="inp" id="pkQ" placeholder="' + esc(L.searchPh) + '" autocomplete="off"><div id="pkRes" class="pk-res"></div><button class="btn btn-plain" data-close>' + esc(L.cancel) + '</button>');
        bindPicker(async (u) => {
            const id = [me.uid, u.uid].sort().join('_');
            try {
                if (!chats.find((c) => c.id === id)) {
                    const doc = { members: [me.uid, u.uid].sort(), names: { [me.uid]: myName(), [u.uid]: u.name }, nicks: { [me.uid]: P.nickname || '', [u.uid]: u.nick }, roles: { [me.uid]: myRole(), [u.uid]: u.role || '' }, lastText: '', lastTs: 0, lastFrom: '', reads: { [me.uid]: Date.now() } };
                    await db.collection('chats').doc(id).set(doc); chats.push(Object.assign({ id }, doc));
                }
                closeSheet(); chatId = id; go('chat');
            } catch (e) { toast(L.error); }
        });
    }
    function newGroupSheet() {
        const picked = new Map();
        sheet('<h3>' + esc(L.newGroup) + '</h3><input class="inp" id="gTitle" maxlength="60" placeholder="' + esc(L.groupName) + '"><div class="chips" id="gChips"></div><input class="inp" id="pkQ" placeholder="' + esc(L.searchPh) + '" autocomplete="off" style="margin-top:8px"><div id="pkRes" class="pk-res"></div>' +
            '<button class="btn btn-main" id="gCreate">' + esc(L.create) + '</button><button class="btn btn-plain" data-close>' + esc(L.cancel) + '</button><div class="msg" id="gMsg"></div>');
        const paint = () => { $('#gChips').innerHTML = Array.from(picked.values()).map((u) => '<span class="chip-x">' + esc(u.name || '@' + u.nick) + '<button data-rm="' + esc(u.uid) + '">' + ic('x') + '</button></span>').join('');
            $('#gChips').querySelectorAll('[data-rm]').forEach((b) => { b.onclick = () => { picked.delete(b.getAttribute('data-rm')); paint(); }; }); };
        bindPicker((u) => { if (picked.size < 49) { picked.set(u.uid, u); paint(); $('#pkQ').value = ''; $('#pkRes').innerHTML = ''; $('#pkQ').focus(); } }, () => new Set(picked.keys()));
        $('#gTitle').focus();
        $('#gCreate').onclick = async () => {
            const t = $('#gTitle').value.trim().slice(0, 60), m = $('#gMsg');
            if (!t) { m.className = 'msg err'; m.textContent = L.groupName; return; }
            if (!picked.size) { m.className = 'msg err'; m.textContent = L.addPeople; return; }
            const ts = Date.now(), members = [me.uid].concat(Array.from(picked.keys())), names = { [me.uid]: myName() }, nicks = { [me.uid]: P.nickname || '' }, roles = { [me.uid]: myRole() };
            picked.forEach((u) => { names[u.uid] = u.name || ''; nicks[u.uid] = u.nick || ''; roles[u.uid] = u.role || ''; });
            const doc = { group: true, title: t, createdBy: me.uid, members, names, nicks, roles, lastText: L.groupCreated, lastTs: ts, lastFrom: me.uid, lastName: myName(), reads: { [me.uid]: ts } };
            try { $('#gCreate').disabled = true; const ref = await db.collection('chats').add(doc); chats.push(Object.assign({ id: ref.id }, doc)); closeSheet(); chatId = ref.id; go('chat'); }
            catch (e) { $('#gCreate').disabled = false; m.className = 'msg err'; m.textContent = L.error + ' (' + e.message + ')'; }
        };
    }
    function renderChat() {
        const c = chats.find((x) => x.id === chatId);
        $('#tabs').classList.add('hidden'); replyTo = null; editing = null;
        $('#app').innerHTML = '<div class="chat-head" id="chatHead"><button class="icon-btn" data-act="back" aria-label="back">' + ic('arrow-left') + '</button><b>' + esc(c ? chatName(c) : '…') + '</b>' +
            (c && isGroup(c) ? '<button class="icon-btn" data-act="ginfo" aria-label="info">' + ic('more') + '</button>' : '') + '</div><div id="pinBar"></div>' +
            '<div class="msgs" id="msgs"><div class="spin"></div></div>' +
            '<div class="chat-bottom"><div id="ctxBar"></div><form class="chat-in" id="chatIn"><label class="icon-btn att" aria-label="photo">' + ic('image') + '<input type="file" id="chatImg" accept="image/*" hidden></label>' +
            '<textarea id="chatTa" rows="1" maxlength="2000" placeholder="' + esc(L.msgPh) + '"></textarea><button class="send" type="submit" aria-label="send">' + ic('send') + '</button></form></div>';
        try { W && W.BackButton && (W.BackButton.show(), W.BackButton.onClick(backFromChat)); } catch (e) {}
        $('[data-act="back"]').onclick = backFromChat;
        const gi = $('[data-act="ginfo"]'); if (gi) gi.onclick = groupInfo;
        const ta = $('#chatTa'); ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
        $('#chatIn').onsubmit = (e) => { e.preventDefault(); sendMsg(); };
        ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); sendMsg(); } };
        $('#chatImg').onchange = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) sendImage(f); };
        renderPin();
        if (msgsUnsub) msgsUnsub();
        msgsUnsub = db.collection('chats').doc(chatId).collection('messages').orderBy('ts').limitToLast(150).onSnapshot((snap) => {
            msgs = []; snap.forEach((d) => msgs.push(Object.assign({ id: d.id }, d.data()))); drawMsgs(); markRead();
        }, () => { $('#msgs').innerHTML = '<p class="muted" style="text-align:center;padding:30px">' + esc(L.error) + '</p>'; });
    }
    function renderPin() {
        const c = chats.find((x) => x.id === chatId), bar = $('#pinBar'); if (!bar) return;
        bar.innerHTML = c && c.pinned ? '<button class="pin-bar" data-goto="' + esc(c.pinned.mid) + '">' + ic('pin') + '<span><b>' + esc(L.pinned) + '</b>' + esc(c.pinned.text || '') + '</span></button>' : '';
        const b = bar.querySelector('[data-goto]'); if (b) b.onclick = () => gotoMsg(b.getAttribute('data-goto'));
    }
    function gotoMsg(id) { const el = document.querySelector('.bub[data-mid="' + id + '"]'); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); } }
    function renderCtx() {
        const bar = $('#ctxBar'); if (!bar) return;
        const x = replyTo || editing;
        bar.innerHTML = x ? '<div class="ctx">' + ic(editing ? 'pencil' : 'reply') + '<span><b>' + esc(editing ? L.editing : (replyTo.name || '')) + '</b>' + esc(editing ? editing.text : replyTo.text) + '</span><button data-act="ctxx" aria-label="x">' + ic('x') + '</button></div>' : '';
        const b = bar.querySelector('[data-act="ctxx"]'); if (b) b.onclick = () => { if (editing) $('#chatTa').value = ''; replyTo = null; editing = null; renderCtx(); };
    }
    function drawMsgs() {
        const box = $('#msgs'); if (!box) return;
        const c = chats.find((x) => x.id === chatId) || {};
        let lastDay = '';
        box.innerHTML = msgs.map((m) => {
            const mine = m.from === me.uid, day = new Date((m.ts || 0) + 5 * 3600000).toISOString().slice(0, 10);
            const sep = day !== lastDay ? '<div class="day-sep">' + esc(day === today() ? L.today : fmtDate(day)) + '</div>' : ''; lastDay = day;
            const who = isGroup(c) && !mine ? '<i class="who">' + esc((c.names || {})[m.from] || '') + '</i>' : '';
            const txt = String(m.text || '').trim();
            const img = m.img && /^data:image\/(jpeg|png|webp);base64,/.test(m.img) ? '<img src="' + m.img + '" alt="" data-img>' : '';
            const rp = m.replyTo ? '<button class="rp" data-goto="' + esc(m.replyTo.id) + '"><b>' + esc(m.replyTo.name || '') + '</b><span>' + esc(m.replyTo.text || '') + '</span></button>' : '';
            const pin = c.pinned && c.pinned.mid === m.id ? ic('pin') : '';
            return sep + '<div class="bub' + (mine ? ' mine' : '') + '" data-mid="' + esc(m.id) + '">' + who + rp + img + (txt ? '<span>' + esc(txt) + '</span>' : '') + '<small>' + pin + esc(hm(m.ts || 0)) + (m.edited ? ' · ' + esc(L.edited) : '') + '</small></div>';
        }).join('') || '<p class="muted" style="text-align:center;padding:30px">' + esc(L.msgPh) + '</p>';
        box.querySelectorAll('.bub').forEach((b) => { b.onclick = (e) => { const g = e.target.closest('[data-goto]'); if (g) { gotoMsg(g.getAttribute('data-goto')); return; } if (e.target.matches('[data-img]')) { openImg(e.target.src); return; } msgMenu(b.getAttribute('data-mid')); }; });
        window.scrollTo(0, document.body.scrollHeight);
    }
    function openImg(src) { sheet('<img src="' + src + '" alt="" style="width:100%;border-radius:12px"><button class="btn btn-plain" data-close>' + esc(L.close) + '</button>'); }
    function msgMenu(id) {
        const c = chats.find((x) => x.id === chatId), x = msgs.find((m) => m.id === id); if (!c || !x) return;
        const items = [['reply', L.reply, 'reply']];
        if (String(x.text || '').trim()) items.push(['copy', L.copy, 'copy']);
        if (x.from === me.uid && String(x.text || '').trim() && !(x.img && !String(x.text).trim())) items.push(['edit', L.edit, 'pencil']);
        if (canPin(c)) items.push(['pin', c.pinned && c.pinned.mid === id ? L.unpin : L.pin, 'pin']);
        if (canDelete(c, x)) items.push(['del', L.del, 'trash']);
        sheet('<div class="menu">' + items.map((i) => '<button class="menu-i' + (i[0] === 'del' ? ' danger' : '') + '" data-m="' + i[0] + '">' + ic(i[2]) + esc(i[1]) + '</button>').join('') + '</div><button class="btn btn-plain" data-close>' + esc(L.cancel) + '</button>');
        document.querySelectorAll('[data-m]').forEach((b) => { b.onclick = async () => {
            const a = b.getAttribute('data-m'); closeSheet();
            if (a === 'reply') { editing = null; replyTo = { id, from: x.from, name: nameOf(c, x.from), text: snippet(x) }; renderCtx(); $('#chatTa').focus(); }
            else if (a === 'copy') { try { await navigator.clipboard.writeText(x.text); toast(L.copied); } catch (e) {} }
            else if (a === 'edit') { replyTo = null; editing = { id, text: snippet(x) }; $('#chatTa').value = x.text; renderCtx(); $('#chatTa').focus(); }
            else if (a === 'pin') { try { const p = c.pinned && c.pinned.mid === id ? null : { mid: id, text: snippet(x), by: me.uid, name: nameOf(c, x.from) }; await db.collection('chats').doc(chatId).update({ pinned: p }); c.pinned = p; renderPin(); drawMsgs(); } catch (e) { toast(L.error); } }
            else if (a === 'del') {
                try {
                    await db.collection('chats').doc(chatId).collection('messages').doc(id).delete();
                    const upd = {}, rest = msgs.filter((m) => m.id !== id), prev = rest[rest.length - 1];
                    if (msgs.length && msgs[msgs.length - 1].id === id) { upd.lastText = prev ? snippet(prev).slice(0, 120) : ''; upd.lastFrom = prev ? prev.from : ''; }
                    if (c.pinned && c.pinned.mid === id) upd.pinned = null;
                    if (Object.keys(upd).length) await db.collection('chats').doc(chatId).update(upd);
                } catch (e) { toast(L.error); }
            }
        }; });
    }
    function groupInfo() {
        const c = chats.find((x) => x.id === chatId); if (!c) return;
        const owner = c.createdBy === me.uid;
        sheet('<h3>' + esc(c.title || '') + '</h3><p class="muted">' + (c.members || []).length + ' ' + esc(L.members) + '</p>' +
            (c.members || []).map((u) => '<div class="row"><div class="ava sm">' + esc((nameOf(c, u).replace('@', '').charAt(0) || '?').toUpperCase()) + '</div><div class="main"><b>' + esc(nameOf(c, u)) + '</b>' + (u === c.createdBy ? '<small>' + esc(L.admin) + '</small>' : '') + '</div>' +
                (owner && u !== me.uid ? '<button class="icon-btn" data-kick="' + esc(u) + '" aria-label="remove">' + ic('x') + '</button>' : '') + '</div>').join('') +
            (owner ? '' : '<button class="btn btn-plain danger-t" data-act="leavegrp">' + ic('logout') + esc(L.leaveGroup) + '</button>') + '<button class="btn btn-plain" data-close>' + esc(L.close) + '</button>');
        document.querySelectorAll('[data-kick]').forEach((b) => { b.onclick = async () => { const u = b.getAttribute('data-kick'); try { await db.collection('chats').doc(c.id).update({ members: c.members.filter((x) => x !== u) }); closeSheet(); } catch (e) { toast(L.error); } }; });
        const lv = $('[data-act="leavegrp"]'); if (lv) lv.onclick = async () => { try { await db.collection('chats').doc(c.id).update({ members: c.members.filter((x) => x !== me.uid) }); closeSheet(); backFromChat(); } catch (e) { toast(L.error); } };
    }
    function markRead() {
        const c = chats.find((x) => x.id === chatId); if (!c || !isUnread(c) || document.hidden) return;
        const reads = Object.assign({}, c.reads || {}, { [me.uid]: c.lastTs || Date.now() });
        db.collection('chats').doc(chatId).update({ reads }).catch(() => {});
    }
    // a write that does not reach the server in 20 s is reported as an error (it used to hang silently)
    const timed = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))]);
    // the chat may not be in the list yet (opened from a notification link right after start) — read it directly
    async function chatDoc() {
        let c = chats.find((x) => x.id === chatId); if (c) return c;
        try { const d = await db.collection('chats').doc(chatId).get(); if (d.exists) { c = Object.assign({ id: d.id }, d.data()); if (!chats.some((x) => x.id === c.id)) chats.push(c); return c; } } catch (e) {}
        return null;
    }
    async function bumpChat(c, lastText, ts) {
        await db.collection('chats').doc(chatId).update({ lastText: lastText.slice(0, 120), lastTs: ts, lastFrom: me.uid, lastName: myName(),
            names: Object.assign({}, c.names || {}, { [me.uid]: myName() }), nicks: Object.assign({}, c.nicks || {}, { [me.uid]: P.nickname || '' }),
            roles: Object.assign({}, c.roles || {}, { [me.uid]: myRole() }), reads: Object.assign({}, c.reads || {}, { [me.uid]: ts }) });
    }
    async function sendMsg() {
        const ta = $('#chatTa'); const text = ta.value.trim(); if (!text) return;
        const c = await chatDoc(); if (!c) { haptic('err'); toast(L.error); return; }
        if (editing) {
            const ed = editing; editing = null; renderCtx(); ta.value = '';
            try {
                await db.collection('chats').doc(chatId).collection('messages').doc(ed.id).update({ text: text.slice(0, 2000), edited: true, editedAt: Date.now() });
                if (msgs.length && msgs[msgs.length - 1].id === ed.id) await db.collection('chats').doc(chatId).update({ lastText: text.slice(0, 120) });
            } catch (e) { toast(L.error); }
            return;
        }
        ta.value = ''; ta.style.height = 'auto'; const ts = Date.now(), rp = replyTo; replyTo = null; renderCtx();
        try {
            const mm = { from: me.uid, text: text.slice(0, 2000), ts }; if (rp) mm.replyTo = rp;
            await timed(db.collection('chats').doc(chatId).collection('messages').add(mm));
            bumpChat(c, text, ts).catch((e) => console.warn('chat bump', e));   // the message is sent even if the list preview fails
            haptic();
        } catch (e) { console.warn('send', e); if (!ta.value) ta.value = text; haptic('err'); toast(L.error + (e && e.code === 'permission-denied' ? ' (нет доступа к чату)' : e && e.message === 'timeout' ? ' (нет связи)' : '')); }
    }
    function shrink(file) {
        return new Promise((resolve, reject) => {
            if (!/^image\//.test(file.type)) return reject(new Error('not an image'));
            const url = URL.createObjectURL(file), im = new Image();
            im.onload = () => { URL.revokeObjectURL(url); let max = 1000, q = 0.72;
                for (let i = 0; i < 6; i++) { const k = Math.min(1, max / Math.max(im.width, im.height)); const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
                    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height); const out = cv.toDataURL('image/jpeg', q);
                    if (out.length <= 200000) return resolve(out); max = Math.round(max * 0.8); q = Math.max(0.5, q - 0.05); }
                reject(new Error('too big')); };
            im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); }; im.src = url;
        });
    }
    async function sendImage(file) {
        const c = await chatDoc(); if (!c) { toast(L.error); return; }
        try {
            const img = await shrink(file), ta = $('#chatTa'), cap = ta.value.trim().slice(0, 500); ta.value = '';
            const ts = Date.now(), mm = { from: me.uid, text: cap || ' ', img, ts }; if (replyTo) mm.replyTo = replyTo; replyTo = null; renderCtx();
            await timed(db.collection('chats').doc(chatId).collection('messages').add(mm));
            bumpChat(c, cap || L.photo, ts).catch((e) => console.warn('chat bump', e)); haptic();
        } catch (e) { haptic('err'); toast(L.error); }
    }
    function backFromChat() {
        try { W && W.BackButton && (W.BackButton.offClick(backFromChat), W.BackButton.hide()); } catch (e) {}
        if (msgsUnsub) { msgsUnsub(); msgsUnsub = null; }
        chatId = ''; try { history.replaceState(null, '', location.pathname); } catch (e) {}
        tab = 'chats'; render();
    }

    // ── sheet / toast ──
    function sheet(html) {
        closeSheet();
        const ov = document.createElement('div'); ov.className = 'sheet-ov'; ov.innerHTML = '<div class="sheet">' + html + '</div>';
        ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close]')) closeSheet(); });
        document.body.appendChild(ov);
        try { W && W.BackButton && (W.BackButton.show(), W.BackButton.onClick(closeSheet)); } catch (e) {}
    }
    function closeSheet() {
        const ov = document.querySelector('.sheet-ov'); if (ov) ov.remove();
        try { W && W.BackButton && (W.BackButton.offClick(closeSheet), W.BackButton.hide()); } catch (e) {}
    }
    function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }

    // ── render ──
    const TABS = {
        student: [['home', 'star', 'home'], ['grades', 'book', 'grades'], ['sched', 'calendar', 'sched'], ['chats', 'message', 'chats'], ['profile', 'users', 'profile']],
        teacher: [['home', 'star', 'home'], ['mark', 'check-circle', 'att'], ['groups', 'users', 'groups'], ['chats', 'message', 'chats'], ['profile', 'keyboard', 'profile']]
    };
    function render() {
        const teacher = D.role === 'teacher';
        const extra = teacher ? ['sched', 'chat'] : ['att', 'chat'];
        if (!TABS[teacher ? 'teacher' : 'student'].some((t) => t[0] === tab) && extra.indexOf(tab) === -1) tab = 'home';
        if (tab !== 'chat' && msgsUnsub) { msgsUnsub(); msgsUnsub = null; }
        if (tab === 'chat') return renderChat();
        const body = tab === 'chats' ? chatList() : tab === 'grades' ? studentGrades() : tab === 'att' ? studentAtt() : tab === 'sched' ? lessonsList(teacher) : tab === 'profile' ? profile()
            : tab === 'mark' ? markScreen() : tab === 'groups' ? teacherGroups() : (teacher ? teacherHome() : studentHome());
        $('#app').innerHTML = header() + '<div class="wrap">' + body + '</div>';
        const tabs = $('#tabs'); tabs.classList.remove('hidden');
        const unread = chats.filter(isUnread).length;
        tabs.innerHTML = TABS[teacher ? 'teacher' : 'student'].map((t) => '<button type="button" data-tab="' + t[0] + '" class="' + (tab === t[0] || (tab === 'att' && t[0] === 'home') || (tab === 'sched' && teacher && t[0] === 'home') ? 'on' : '') + '">' + ic(t[1]) + '<span>' + esc(L[t[2]]) + '</span>' + (t[0] === 'chats' && unread ? '<i class="tab-badge">' + unread + '</i>' : '') + '</button>').join('');
        bind();
    }
    function go(t) { tab = t; render(); window.scrollTo(0, 0); haptic(); }
    function bind() {
        document.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => go(b.getAttribute('data-tab')); });
        document.querySelectorAll('[data-chat]').forEach((b) => { b.onclick = () => { chatId = b.getAttribute('data-chat'); go('chat'); }; });
        document.querySelectorAll('[data-open]').forEach((b) => { b.onclick = (e) => { e.preventDefault(); openExternal(b.getAttribute('data-open')); }; });
        document.querySelectorAll('[data-absent]').forEach((b) => { b.onclick = () => absenceSheet(b.getAttribute('data-absent')); });
        document.querySelectorAll('[data-undo]').forEach((b) => { b.onclick = () => undoAbsence(b.getAttribute('data-undo')); });
        document.querySelectorAll('[data-mark]').forEach((b) => { b.onclick = () => { markSel = { gid: b.getAttribute('data-mark'), date: b.getAttribute('data-date') || today(), marks: null }; go('mark'); }; });
        document.querySelectorAll('[data-lang]').forEach((b) => { b.onclick = () => { setLang(b.getAttribute('data-lang')); render(); haptic(); }; });
        document.querySelectorAll('.mk').forEach((b) => { b.onclick = () => {
            const n = b.getAttribute('data-nick'), s = b.getAttribute('data-s'); markSel.marks[n] = markSel.marks[n] === s ? undefined : s; if (!markSel.marks[n]) delete markSel.marks[n];
            markSel.topic = ($('#mkTopic') || {}).value || markSel.topic; render(); haptic(); }; });
        const mg = $('#mkGroup'); if (mg) mg.onchange = () => { const g = D.groups.find((x) => x.id === mg.value); markSel = { gid: mg.value, date: lastLessonDay(g), marks: null }; render(); };
        const md = $('#mkDate'); if (md) md.onchange = () => { if (md.value) { markSel = { gid: markSel.gid, date: md.value > today() ? today() : md.value, marks: null }; render(); } };
        const act = (a, fn) => document.querySelectorAll('[data-act="' + a + '"]').forEach((b) => { b.onclick = fn; });
        act('refresh', async () => { $('#app').classList.add('busy'); await load(); render(); haptic('ok'); });
        act('savemark', saveMarks);
        act('newchat', newChatSheet); act('newgroup', newGroupSheet);
        act('allpresent', () => { const g = D.groups.find((x) => x.id === markSel.gid); (g.members || []).forEach((m) => { markSel.marks[m.nickname] = 'present'; }); markSel.topic = ($('#mkTopic') || {}).value || markSel.topic; render(); haptic(); });
        act('invite', () => { const url = SITE + '/?ref=' + encodeURIComponent(P.nickname || ''); openTg('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(L.inviteText)); });
        act('logout', async () => { try { sessionStorage.setItem('tgNoAuto', '1'); } catch (e) {} await auth.signOut(); });
    }
    // coming back to the app after a while — show fresh data
    document.addEventListener('visibilitychange', async () => { if (!document.hidden && me && D && Date.now() - loadedAt > 60000 && tab !== 'chat') { await load(); render(); } });

    // ── sign in ──
    function screen(icon, title, text, withForm, extraBtn) {
        $('#tabs').classList.add('hidden');
        $('#app').innerHTML = '<div class="center">' + ic(icon) + '<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>' + (extraBtn || '') +
            (withForm ? '<button class="btn btn-ghost" id="showLogin" style="margin-top:10px">' + esc(L.emailLogin) + '</button><form class="form hidden" id="lf"><input type="email" id="le" placeholder="' + esc(L.email) + '" autocomplete="username" required><input type="password" id="lp" placeholder="' + esc(L.pass) + '" autocomplete="current-password" required><button class="btn btn-main" type="submit">' + esc(L.signIn) + '</button><div class="err" id="lerr"></div></form>' : '') + '</div>';
        const sl = $('#showLogin'); if (sl) sl.onclick = () => { sl.classList.add('hidden'); $('#lf').classList.remove('hidden'); $('#le').focus(); };
        const f = $('#lf'); if (f) f.onsubmit = async (e) => {
            e.preventDefault(); $('#lerr').textContent = '';
            try { await auth.signInWithEmailAndPassword($('#le').value.trim(), $('#lp').value); } catch (err) { $('#lerr').textContent = L.badLogin; }
        };
        document.querySelectorAll('[data-open]').forEach((b) => { b.onclick = (e) => { e.preventDefault(); openExternal(b.getAttribute('data-open')); }; });
    }
    async function telegramLogin() {
        const initData = W && W.initData;
        let noAuto = false; try { noAuto = sessionStorage.getItem('tgNoAuto') === '1'; sessionStorage.removeItem('tgNoAuto'); } catch (e) {}
        if (!initData || noAuto) return screen('lock', L.emailLogin, '', true);
        let last = null;
        for (const base of BOT_URLS) {
            try {
                const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
                const r = await fetch(base.replace(/\/+$/, '') + '/app/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData }), signal: ctl.signal });
                clearTimeout(t);
                const j = await r.json().catch(() => ({}));
                if (r.ok && j.token) { await auth.signInWithCustomToken(j.token); return; }
                last = j; if (r.status && j && j.error) break;   // our server answered — another address will not change the answer
            } catch (e) { last = null; }
        }
        if (last && last.error === 'not_linked') return screen('users', L.notLinked, L.notLinkedP.replace('{u}', last.username || ''), true, '<button class="btn btn-main" data-open="' + SITE + '/dashboard#profile">' + esc(L.openProfile) + '</button>');
        if (last && last.error === 'no_username') return screen('alert', L.noUser, L.noUserP, true);
        screen('alert', L.offline, L.offlineP, true);
    }

    if (typeof FIREBASE_READY === 'undefined' || !FIREBASE_READY || !S) { screen('alert', L.offline, L.offlineP, false); return; }
    let tried = false;
    auth.onAuthStateChanged(async (u) => {
        if (!u) { me = null; D = null; if (chatsUnsub) { chatsUnsub(); chatsUnsub = null; } if (!tried) { tried = true; await telegramLogin(); } else screen('lock', L.emailLogin, '', true); return; }
        me = u; tab = chatId ? 'chat' : 'home'; markSel = null;
        $('#app').innerHTML = '<div class="spin"></div><p class="muted" style="text-align:center">' + esc(L.loading) + '</p>';
        listenChats();
        await load(); render();
    });
})();
