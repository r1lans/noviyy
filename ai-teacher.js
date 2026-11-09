/* TheStarth — AI Support Teacher (ai-teacher.html; also opened inside the video lesson as a side panel: ai-teacher?embed=lesson).
 *
 * What it does (the AI helper, mode "tutor" / "tutor_quiz", see worker/mock-ai-worker.js):
 *   - explains a topic simply, with examples and the typical mistake, then checks understanding with a question;
 *   - helps with homework by hints and guiding questions — it does NOT give the finished answer, the student solves it;
 *   - checks the student's own attempt and points to the exact mistake;
 *   - makes short multiple-choice mini-tests on a topic (on request, or offers one itself after explaining),
 *     marks them here and then goes through the mistakes.
 * Who may use it: signed-in students in a group, teachers and admins (the AI helper checks this again).
 * The conversation is kept on this device (localStorage, per subject). Mini-test results go to Firestore `tutorQuizzes`:
 * the student sees them in the cabinet, teachers in the journal.
 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const app = $('aitApp'); if (!app) return;
    const ic = (n) => (window.Icons ? window.Icons.svg(n) : '');
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const lang = () => { try { const l = localStorage.getItem('starthLang'); return l === 'uz' || l === 'en' ? l : 'ru'; } catch (e) { return 'ru'; } };
    const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
    const qs = new URLSearchParams(location.search);
    const EMBED = !!qs.get('embed');
    const IN_LESSON = qs.get('embed') === 'lesson';
    const LESSON_TOPIC = (qs.get('topic') || '').slice(0, 160);
    const UI = window.StarthUI || { confirm: async (m) => window.confirm(m), prompt: async (m, v) => window.prompt(m, v), toast: () => {} };

    const L = {
        ru: {
            title: 'ИИ-ассистент', tabT: 'ИИ Support Teacher', tabS: 'ИИ Speaking',
            lead: 'Ваш ИИ-помощник учителя: объясняет темы, помогает разобраться с заданием подсказками (а не готовыми ответами) и проверяет мини-тестами, поняли ли вы тему.',
            loading: 'Проверяю доступ…', guest: 'Войдите в аккаунт, чтобы заниматься с ИИ-учителем.', login: 'Войти',
            denied: 'ИИ-учитель доступен ученикам групп TheStarth. Если вы уже учитесь у нас, попросите учителя добавить вас в группу.', trial: 'Записаться на бесплатный урок',
            noai: 'ИИ-учитель сейчас недоступен. Попробуйте позже.',
            subject: 'Предмет', english: 'Английский', ielts: 'IELTS', sat: 'SAT', math: 'Математика', other: 'Другое',
            newChat: 'Новый диалог', newQ: 'Начать новый диалог? Текущая переписка по этому предмету удалится с устройства.',
            testMe: 'Проверь меня', testTopic: 'По какой теме сделать мини-тест?', testPh: 'Например: Present Perfect',
            how: 'Как я помогаю', how1: 'Объясняю темы простыми словами и с примерами', how2: 'Помогаю с заданием подсказками — решаете вы сами', how3: 'Проверяю ваше решение и показываю, где ошибка', how4: 'Составляю мини-тесты, чтобы проверить понимание',
            hist: 'Мои мини-тесты', histEmpty: 'Пока нет пройденных тестов.',
            hello: 'Привет! Я ваш ИИ Support Teacher.', helloSub: 'Спросите про любую тему или пришлите задание — я помогу разобраться, но решать будете вы. С чего начнём?',
            s1: 'Объясни тему', s1q: 'Объясни мне тему: ', s1ph: 'Какую тему объяснить?',
            s2: 'Помоги с заданием', s2q: 'Помоги мне разобраться с заданием (не решай за меня, дай подсказку):\n',
            s3: 'Проверь моё решение', s3q: 'Проверь моё решение и покажи, где ошибка:\n',
            s4: 'Сделай мини-тест', s5: 'Что повторить перед уроком?', s5q: 'Что мне стоит повторить перед следующим уроком? Задай мне пару вопросов, чтобы понять мой уровень.',
            s1d: 'Простыми словами, с примерами', s2d: 'Подсказки шаг за шагом', s3d: 'Найду ошибку и объясню', s4d: '5 вопросов с разбором',
            ph: 'Напишите вопрос или вставьте задание…', send: 'Отправить', mic: 'Сказать голосом', micStop: 'Остановить запись',
            you: 'Вы', ai: 'ИИ-учитель', thinking: 'ИИ-учитель думает…', making: 'Составляю мини-тест…',
            takeQuiz: 'Пройти мини-тест', qOf: 'Вопрос {i} из {n}', next: 'Дальше', finishQ: 'Результат', right: 'Верно!', wrong: 'Неверно.', correctIs: 'Правильный ответ:',
            score: 'Ваш результат: {s} из {n}', scoreGood: 'Отлично — тема понята!', scoreMid: 'Неплохо, но есть что повторить.', scoreLow: 'Тему стоит разобрать ещё раз.',
            review: 'Разобрать мои ошибки', again: 'Ещё один тест', saved: 'Результат сохранён — его видите вы и ваш учитель.',
            quizRes: 'Я прошёл(ла) мини-тест «{t}»: {s} из {n}.', quizWrong: 'Ошибки:', quizPick: 'я выбрал(а)', quizAns: 'правильно',
            quizAsk: ' Объясни, пожалуйста, мои ошибки и что повторить.', quizAllOk: ' Что изучать дальше?',
            err: 'Не получилось связаться с ИИ. Проверьте интернет и попробуйте ещё раз.', limit: 'Слишком много сообщений подряд. Подождите пару минут.',
            daily: 'Лимит сообщений ИИ-учителю на сегодня исчерпан. Возвращайтесь завтра.', retry: 'Повторить',
            quizErr: 'Не получилось составить тест. Попробуйте ещё раз или уточните тему.',
            foot: 'ИИ может ошибаться. Важное уточняйте у своего учителя.', copy: 'Копировать', copied: 'Скопировано',
            lessonNote: 'Вы на уроке — слушайте учителя. Я подскажу, если что-то непонятно.',
            toCab: 'В личный кабинет',
        },
        uz: {
            title: 'AI-yordamchi', tabT: 'AI Support Teacher', tabS: 'AI Speaking',
            lead: 'O‘qituvchingizning AI-yordamchisi: mavzularni tushuntiradi, topshiriqni tayyor javob bilan emas, maslahatlar bilan tushunishga yordam beradi va mini-testlar bilan mavzuni tushunganingizni tekshiradi.',
            loading: 'Kirish tekshirilmoqda…', guest: 'AI-o‘qituvchi bilan shug‘ullanish uchun akkauntga kiring.', login: 'Kirish',
            denied: 'AI-o‘qituvchi TheStarth guruhlari o‘quvchilari uchun. Agar bizda o‘qiyotgan bo‘lsangiz, o‘qituvchingizdan guruhga qo‘shishni so‘rang.', trial: 'Bepul darsga yozilish',
            noai: 'AI-o‘qituvchi hozir ishlamayapti. Keyinroq urinib ko‘ring.',
            subject: 'Fan', english: 'Ingliz tili', ielts: 'IELTS', sat: 'SAT', math: 'Matematika', other: 'Boshqa',
            newChat: 'Yangi suhbat', newQ: 'Yangi suhbat boshlansinmi? Bu fan bo‘yicha joriy yozishmalar qurilmadan o‘chiriladi.',
            testMe: 'Meni tekshir', testTopic: 'Qaysi mavzu bo‘yicha mini-test tuzay?', testPh: 'Masalan: Present Perfect',
            how: 'Qanday yordam beraman', how1: 'Mavzularni oddiy so‘zlar va misollar bilan tushuntiraman', how2: 'Topshiriqda maslahatlar bilan yordam beraman — o‘zingiz yechasiz', how3: 'Yechimingizni tekshirib, xatoni ko‘rsataman', how4: 'Tushunganingizni tekshirish uchun mini-testlar tuzaman',
            hist: 'Mening mini-testlarim', histEmpty: 'Hozircha topshirilgan testlar yo‘q.',
            hello: 'Salom! Men sizning AI Support Teacher-ingizman.', helloSub: 'Istalgan mavzu haqida so‘rang yoki topshiriqni yuboring — tushunishga yordam beraman, lekin yechish sizdan. Nimadan boshlaymiz?',
            s1: 'Mavzuni tushuntir', s1q: 'Menga mavzuni tushuntir: ', s1ph: 'Qaysi mavzuni tushuntiray?',
            s2: 'Topshiriqqa yordam ber', s2q: 'Topshiriqni tushunishga yordam ber (men uchun yechma, maslahat ber):\n',
            s3: 'Yechimimni tekshir', s3q: 'Yechimimni tekshir va xato qayerdaligini ko‘rsat:\n',
            s4: 'Mini-test tuz', s5: 'Darsdan oldin nimani takrorlay?', s5q: 'Keyingi darsdan oldin nimani takrorlashim kerak? Darajamni bilish uchun menga bir-ikki savol ber.',
            s1d: 'Oddiy so‘zlar va misollar bilan', s2d: 'Qadamma-qadam maslahatlar', s3d: 'Xatoni topib tushuntiraman', s4d: 'Tahlil bilan 5 ta savol',
            ph: 'Savol yozing yoki topshiriqni qo‘ying…', send: 'Yuborish', mic: 'Ovoz bilan aytish', micStop: 'Yozishni to‘xtatish',
            you: 'Siz', ai: 'AI-o‘qituvchi', thinking: 'AI-o‘qituvchi o‘ylayapti…', making: 'Mini-test tuzilmoqda…',
            takeQuiz: 'Mini-testni topshirish', qOf: '{n} tadan {i}-savol', next: 'Keyingi', finishQ: 'Natija', right: 'To‘g‘ri!', wrong: 'Noto‘g‘ri.', correctIs: 'To‘g‘ri javob:',
            score: 'Natijangiz: {n} tadan {s}', scoreGood: 'Ajoyib — mavzu tushunilgan!', scoreMid: 'Yomon emas, lekin takrorlash kerak.', scoreLow: 'Mavzuni yana bir bor ko‘rib chiqish kerak.',
            review: 'Xatolarimni tahlil qilish', again: 'Yana bir test', saved: 'Natija saqlandi — uni siz va o‘qituvchingiz ko‘rasiz.',
            quizRes: '«{t}» mini-testini topshirdim: {n} tadan {s}.', quizWrong: 'Xatolar:', quizPick: 'men tanladim', quizAns: 'to‘g‘ri javob',
            quizAsk: ' Iltimos, xatolarimni va nimani takrorlashni tushuntir.', quizAllOk: ' Keyin nimani o‘rganay?',
            err: 'AI bilan bog‘lanib bo‘lmadi. Internetni tekshiring va qayta urinib ko‘ring.', limit: 'Ketma-ket juda ko‘p xabar. Bir-ikki daqiqa kuting.',
            daily: 'Bugungi AI-o‘qituvchi xabarlari limiti tugadi. Ertaga qaytib keling.', retry: 'Qayta urinish',
            quizErr: 'Test tuzib bo‘lmadi. Qayta urinib ko‘ring yoki mavzuni aniqlashtiring.',
            foot: 'AI xato qilishi mumkin. Muhim narsalarni o‘qituvchingizdan so‘rang.', copy: 'Nusxalash', copied: 'Nusxalandi',
            lessonNote: 'Siz darsdasiz — o‘qituvchini tinglang. Biror narsa tushunarsiz bo‘lsa, yordam beraman.',
            toCab: 'Shaxsiy kabinetga',
        },
        en: {
            title: 'AI assistant', tabT: 'AI Support Teacher', tabS: 'AI Speaking',
            lead: 'Your teacher’s AI helper: it explains topics, helps you work through a task with hints (not ready answers) and checks with mini-tests whether you really understood.',
            loading: 'Checking access…', guest: 'Sign in to study with the AI teacher.', login: 'Sign in',
            denied: 'The AI teacher is available to students in TheStarth groups. If you already study with us, ask your teacher to add you to a group.', trial: 'Book a free lesson',
            noai: 'The AI teacher is not available right now. Please try later.',
            subject: 'Subject', english: 'English', ielts: 'IELTS', sat: 'SAT', math: 'Math', other: 'Other',
            newChat: 'New chat', newQ: 'Start a new chat? The current conversation for this subject will be removed from this device.',
            testMe: 'Test me', testTopic: 'Which topic should the mini-test be about?', testPh: 'For example: Present Perfect',
            how: 'How I help', how1: 'I explain topics simply, with examples', how2: 'I help with tasks through hints — you solve them', how3: 'I check your solution and show the mistake', how4: 'I make mini-tests to check your understanding',
            hist: 'My mini-tests', histEmpty: 'No tests taken yet.',
            hello: 'Hi! I’m your AI Support Teacher.', helloSub: 'Ask about any topic or send me a task — I’ll help you understand it, but you do the solving. Where shall we start?',
            s1: 'Explain a topic', s1q: 'Explain this topic to me: ', s1ph: 'Which topic should I explain?',
            s2: 'Help with a task', s2q: 'Help me understand this task (don’t solve it for me, give me a hint):\n',
            s3: 'Check my solution', s3q: 'Check my solution and show me where the mistake is:\n',
            s4: 'Make a mini-test', s5: 'What should I revise?', s5q: 'What should I revise before my next lesson? Ask me a couple of questions to find out my level.',
            s1d: 'Simple words and examples', s2d: 'Step-by-step hints', s3d: 'I’ll find and explain the mistake', s4d: '5 questions with explanations',
            ph: 'Type a question or paste a task…', send: 'Send', mic: 'Speak', micStop: 'Stop recording',
            you: 'You', ai: 'AI teacher', thinking: 'The AI teacher is thinking…', making: 'Making a mini-test…',
            takeQuiz: 'Take the mini-test', qOf: 'Question {i} of {n}', next: 'Next', finishQ: 'See result', right: 'Correct!', wrong: 'Not quite.', correctIs: 'Correct answer:',
            score: 'Your score: {s} of {n}', scoreGood: 'Great — you’ve got it!', scoreMid: 'Not bad, but worth revising.', scoreLow: 'Let’s go through this topic again.',
            review: 'Go through my mistakes', again: 'Another test', saved: 'Saved — you and your teacher can see this result.',
            quizRes: 'I took the mini-test “{t}”: {s} of {n}.', quizWrong: 'Mistakes:', quizPick: 'I chose', quizAns: 'correct',
            quizAsk: ' Please explain my mistakes and what to revise.', quizAllOk: ' What should I learn next?',
            err: 'Could not reach the AI. Check your internet and try again.', limit: 'Too many messages in a row. Please wait a couple of minutes.',
            daily: 'You have used today’s messages to the AI teacher. Come back tomorrow.', retry: 'Retry',
            quizErr: 'Could not make the test. Try again or make the topic more specific.',
            foot: 'The AI can make mistakes. Check important things with your teacher.', copy: 'Copy', copied: 'Copied',
            lessonNote: 'You are in a lesson — listen to your teacher. I’ll help if something is unclear.',
            toCab: 'My dashboard',
        },
    };
    const t = (k, vars) => { let s = L[lang()][k] != null ? L[lang()][k] : L.ru[k]; if (vars) Object.keys(vars).forEach((v) => { s = s.split('{' + v + '}').join(vars[v]); }); return s; };
    const SUBJ = ['english', 'ielts', 'sat', 'math', 'other'];

    // ───────── state ─────────
    const S = { user: null, profile: {}, access: 'loading', subject: store.get('aitSubject', 'english'), msgs: [], busy: false, quiz: null, hist: [], lastErr: null };
    if (SUBJ.indexOf(S.subject) === -1) S.subject = 'english';
    const key = () => 'aitChat:' + (S.user ? S.user.uid : '-') + ':' + S.subject;
    function load() { S.msgs = (store.get(key(), []) || []).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.text).slice(-60); }
    function save() { store.set(key(), S.msgs.slice(-60).map((m) => ({ role: m.role, text: m.text, kind: m.kind || '', quiz: m.quiz || null, ts: m.ts || 0 }))); }

    // ───────── AI helper ─────────
    async function ai(body) {
        const token = await auth.currentUser.getIdToken();
        let r;
        try { r = await fetch(window.MOCK_AI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(Object.assign({ lang: lang(), subject: S.subject, context: IN_LESSON ? 'lesson' : 'page', lessonTopic: LESSON_TOPIC }, body)) }); }
        catch (e) { throw new Error('err'); }
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error === 'daily' ? 'daily' : j.error === 'limit' ? 'limit' : j.error === 'not_member' ? 'denied' : 'err');
        return j;
    }
    const historyForAi = () => S.msgs.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-20).map((m) => ({ role: m.role, text: m.text }));

    // ───────── tiny, safe markdown: **bold**, `code`, lists, paragraphs ─────────
    function md(src) {
        const inline = (s) => esc(s).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<i>$2</i>');
        const lines = String(src || '').replace(/\r/g, '').split('\n');
        let out = '', list = '', para = [];
        const flushP = () => { if (para.length) { out += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
        const closeL = () => { if (list) { out += '</' + list + '>'; list = ''; } };
        lines.forEach((ln) => {
            const ul = /^\s*[-•*]\s+(.*)$/.exec(ln), ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(ln);
            if (ul || ol) {
                flushP(); const want = ul ? 'ul' : 'ol';
                if (list !== want) { closeL(); out += '<' + want + '>'; list = want; }
                out += '<li>' + inline(ul ? ul[1] : ol[2]) + '</li>';
            } else if (!ln.trim()) { flushP(); closeL(); }
            else { closeL(); para.push(ln.replace(/^#+\s*/, '')); }
        });
        flushP(); closeL();
        return out;
    }

    // ───────── page shell ─────────
    function tabs() {
        const tb = document.querySelector('.ai-tabs'); if (!tb) return;
        tb.innerHTML = `<a href="ai-teacher" class="on" aria-current="page">${ic('sparkles')}<span>${esc(t('tabT'))}</span></a><a href="speaking">${ic('mic')}<span>${esc(t('tabS'))}</span></a>`;
    }
    function heading() {
        const h = $('aitH1'); if (h) h.textContent = t('title');
        const ld = $('aitLead'); if (ld) ld.textContent = t('lead');
        document.title = t('tabT') + ' — TheStarth';
        tabs();
    }
    function gate(icon, text, btn) { app.innerHTML = `<div class="ait-gate">${ic(icon)}<p>${esc(text)}</p>${btn || ''}</div>`; }

    function render() {
        heading();
        if (S.access === 'loading') return gate('hourglass', t('loading'));
        if (S.access === 'guest') return gate('lock', t('guest'), `<a class="btn-primary" href="dashboard?next=${encodeURIComponent(location.pathname + location.search)}" target="${EMBED ? '_top' : '_self'}">${esc(t('login'))}</a>`);
        if (S.access === 'denied') return gate('users', t('denied'), EMBED ? '' : `<a class="btn-primary" href="./#pricing">${esc(t('trial'))}</a>`);
        if (S.access === 'noai') return gate('alert', t('noai'));
        const subj = SUBJ.map((s) => `<button type="button" class="ait-subj${S.subject === s ? ' on' : ''}" data-subj="${s}">${esc(t(s))}</button>`).join('');
        app.innerHTML = `
<div class="ait${EMBED ? ' ait-embed' : ''}">
  <aside class="ait-side">
    <div class="ait-lbl">${esc(t('subject'))}</div>
    <div class="ait-subjs" id="aitSubjs">${subj}</div>
    <div class="ait-acts">
      <button type="button" class="btn-primary ait-btn" id="aitQuizBtn">${ic('target')}<span>${esc(t('testMe'))}</span></button>
      <button type="button" class="btn-outline ait-btn" id="aitNew">${ic('refresh')}<span>${esc(t('newChat'))}</span></button>
    </div>
    ${EMBED ? '' : `<div class="ait-how"><b>${ic('bulb')}${esc(t('how'))}</b><ul><li>${esc(t('how1'))}</li><li>${esc(t('how2'))}</li><li>${esc(t('how3'))}</li><li>${esc(t('how4'))}</li></ul></div>
    <div class="ait-lbl ait-lbl-h">${esc(t('hist'))}</div><div class="ait-hist" id="aitHist"></div>`}
  </aside>
  <div class="ait-chat">
    ${IN_LESSON ? `<div class="ait-lesson">${ic('video')}<span>${esc(t('lessonNote'))}</span></div>` : ''}
    <div class="ait-msgs" id="aitMsgs" data-notr aria-live="polite"></div>
    <div class="ait-chips" id="aitChips"></div>
    <form class="ait-form" id="aitForm" autocomplete="off">
      <textarea id="aitIn" rows="1" maxlength="3000" placeholder="${esc(t('ph'))}" aria-label="${esc(t('ph'))}"></textarea>
      ${SR ? `<button type="button" class="ait-ib" id="aitMic" title="${esc(t('mic'))}" aria-label="${esc(t('mic'))}">${ic('mic')}</button>` : ''}
      <button type="submit" class="ait-ib ait-send" id="aitSend" title="${esc(t('send'))}" aria-label="${esc(t('send'))}">${ic('send')}</button>
    </form>
    <div class="ait-foot">${esc(t('foot'))}</div>
  </div>
</div>`;
        bind();
        paintMsgs();
        paintHist();
    }

    function bind() {
        app.querySelectorAll('[data-subj]').forEach((b) => { b.onclick = () => {
            if (S.busy || S.subject === b.dataset.subj) return;
            S.subject = b.dataset.subj; store.set('aitSubject', S.subject); S.quiz = null; load();
            app.querySelectorAll('[data-subj]').forEach((x) => x.classList.toggle('on', x === b));
            paintMsgs();
        }; });
        $('aitNew').onclick = async () => {
            if (S.busy) return;
            if (S.msgs.length && !(await UI.confirm(t('newQ'), { danger: false }))) return;
            S.msgs = []; S.quiz = null; save(); paintMsgs();
        };
        $('aitQuizBtn').onclick = () => askQuiz();
        const inp = $('aitIn');
        const grow = () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 180) + 'px'; };
        inp.oninput = grow;
        inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('aitForm').requestSubmit ? $('aitForm').requestSubmit() : submit(); } };
        $('aitForm').onsubmit = (e) => { e.preventDefault(); submit(); };
        const mic = $('aitMic'); if (mic) mic.onclick = toggleMic;
    }
    function submit() {
        const inp = $('aitIn'); const text = inp.value.trim();
        if (!text || S.busy) return;
        stopMic();
        inp.value = ''; inp.style.height = 'auto';
        send(text);
    }

    // ───────── messages ─────────
    function avatar() { return `<span class="ait-ava">${ic('sparkles')}</span>`; }
    function msgHTML(m, i) {
        if (m.role === 'user') {
            if (m.kind === 'quizres') return `<div class="ait-m u note"><div class="ait-bub">${ic('target')}<span>${esc(m.text)}</span></div></div>`;
            return `<div class="ait-m u"><div class="ait-bub">${esc(m.text).replace(/\n/g, '<br>')}</div></div>`;
        }
        const quiz = m.quiz && m.quiz.topic ? `<button type="button" class="ait-qoffer" data-qtopic="${esc(m.quiz.topic)}">${ic('target')}<span>${esc(t('takeQuiz'))}: <b>${esc(m.quiz.topic)}</b></span></button>` : '';
        return `<div class="ait-m a">${avatar()}<div class="ait-bub"><div class="ait-md">${md(m.text)}</div>${quiz}
            <button type="button" class="ait-copy" data-copy="${i}" title="${esc(t('copy'))}" aria-label="${esc(t('copy'))}">${ic('copy')}</button></div></div>`;
    }
    function welcome() {
        const card = (id, icon, title, sub) => `<button type="button" class="ait-start" data-start="${id}">${ic(icon)}<b>${esc(title)}</b><small>${esc(sub)}</small></button>`;
        return `<div class="ait-hello">${avatar()}<div><h2>${esc(t('hello'))}</h2><p>${esc(t('helloSub'))}</p></div></div>
        <div class="ait-starts">${card('explain', 'book', t('s1'), t('s1d'))}${card('task', 'pencil', t('s2'), t('s2d'))}${card('check', 'check-circle', t('s3'), t('s3d'))}${card('quiz', 'target', t('s4'), t('s4d'))}</div>`;
    }
    function paintMsgs() {
        const box = $('aitMsgs'); if (!box) return;
        box.innerHTML = (S.msgs.length ? S.msgs.map(msgHTML).join('') : welcome()) +
            (S.quiz ? `<div class="ait-m a" id="aitQuizWrap">${avatar()}<div class="ait-quiz" id="aitQuiz"></div></div>` : '') +
            (S.busy ? `<div class="ait-m a ait-typing">${avatar()}<div class="ait-bub"><span class="ait-dots"><i></i><i></i><i></i></span><span class="ait-tlabel">${esc(S.busy === 'quiz' ? t('making') : t('thinking'))}</span></div></div>` : '') +
            (S.lastErr ? `<div class="ait-err">${ic('alert')}<span>${esc(t(S.lastErr))}</span>${S.lastErr === 'err' ? `<button type="button" class="btn-outline ait-btn sm" id="aitRetry">${ic('refresh')}${esc(t('retry'))}</button>` : ''}</div>` : '');
        if (S.quiz) paintQuiz();
        box.querySelectorAll('[data-qtopic]').forEach((b) => { b.onclick = () => startQuiz(b.dataset.qtopic); });
        box.querySelectorAll('[data-copy]').forEach((b) => { b.onclick = () => {
            const m = S.msgs[+b.dataset.copy]; if (!m) return;
            try { navigator.clipboard.writeText(m.text).then(() => UI.toast(t('copied'), 'ok', 1800)); } catch (e) {}
        }; });
        box.querySelectorAll('[data-start]').forEach((b) => { b.onclick = () => starter(b.dataset.start); });
        const rt = $('aitRetry'); if (rt) rt.onclick = () => { S.lastErr = null; S.retry ? S.retry() : paintMsgs(); };
        paintChips();
        requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
        const sendB = $('aitSend'); if (sendB) sendB.disabled = !!S.busy;
    }
    function paintChips() {
        const el = $('aitChips'); if (!el) return;
        const last = S.msgs[S.msgs.length - 1];
        const chips = !S.busy && !S.quiz && last && last.role === 'assistant' && Array.isArray(last.chips) ? last.chips : [];
        el.innerHTML = chips.map((c) => `<button type="button" class="ait-chip">${esc(c)}</button>`).join('');
        el.querySelectorAll('.ait-chip').forEach((b) => { b.onclick = () => send(b.textContent); });
    }
    async function starter(kind) {
        const inp = $('aitIn');
        if (kind === 'quiz') return askQuiz();
        if (kind === 'explain') {
            const topic = await UI.prompt(t('s1ph'), '', { placeholder: t('testPh'), ok: t('send') });
            if (topic && topic.trim()) send(t('s1q') + topic.trim());
            return;
        }
        const pre = kind === 'task' ? t('s2q') : kind === 'check' ? t('s3q') : t('s5q');
        if (kind === 'revise') return send(pre);
        inp.value = pre; inp.focus(); inp.setSelectionRange(pre.length, pre.length); inp.dispatchEvent(new Event('input'));
    }

    async function send(text) {
        if (S.busy) return;
        S.lastErr = null;
        S.msgs.push({ role: 'user', text: String(text).slice(0, 3000), ts: Date.now() }); save();
        await reply();
    }
    async function reply() {
        S.busy = 'reply'; S.retry = reply; paintMsgs();
        try {
            const j = await ai({ mode: 'tutor', history: historyForAi() });
            S.msgs.push({ role: 'assistant', text: j.say, quiz: j.quiz || null, chips: j.chips || [], ts: Date.now() }); save();
        } catch (e) {
            if (e.message === 'denied') { S.access = 'denied'; S.busy = false; return render(); }
            S.lastErr = e.message === 'daily' || e.message === 'limit' ? e.message : 'err';
        }
        S.busy = false; paintMsgs();
    }

    // ───────── mini-tests ─────────
    function lastTopic() {
        for (let i = S.msgs.length - 1; i >= 0; i--) { const m = S.msgs[i]; if (m.quiz && m.quiz.topic) return m.quiz.topic; }
        return LESSON_TOPIC || '';
    }
    async function askQuiz() {
        if (S.busy) return;
        const topic = await UI.prompt(t('testTopic'), lastTopic(), { placeholder: t('testPh'), ok: t('testMe') });
        if (topic && topic.trim()) startQuiz(topic.trim().slice(0, 140));
    }
    async function startQuiz(topic) {
        if (S.busy) return;
        S.lastErr = null; S.quiz = null; S.busy = 'quiz'; S.retry = () => startQuiz(topic); paintMsgs();
        try {
            const j = await ai({ mode: 'tutor_quiz', topic, n: 5, history: historyForAi().slice(-6) });
            if (!j || !Array.isArray(j.questions) || !j.questions.length) throw new Error('quizErr');
            S.quiz = { topic, title: j.title || topic, qs: j.questions, i: 0, picks: [], shown: false, done: false, savedId: '' };
        } catch (e) {
            if (e.message === 'denied') { S.access = 'denied'; S.busy = false; return render(); }
            S.lastErr = e.message === 'daily' || e.message === 'limit' ? e.message : e.message === 'quizErr' ? 'quizErr' : 'err';
        }
        S.busy = false; paintMsgs();
    }
    function paintQuiz() {
        const box = $('aitQuiz'), Q = S.quiz; if (!box || !Q) return;
        const n = Q.qs.length;
        if (Q.done) {
            const s = Q.picks.filter((p, i) => p === Q.qs[i].answer).length, pct = s / n;
            box.innerHTML = `<div class="ait-q-head"><b>${esc(Q.title)}</b></div>
              <div class="ait-q-score ${pct >= 0.8 ? 'good' : pct >= 0.5 ? 'mid' : 'low'}"><strong>${s}/${n}</strong><span>${esc(t('score', { s, n }))}<br><small>${esc(pct >= 0.8 ? t('scoreGood') : pct >= 0.5 ? t('scoreMid') : t('scoreLow'))}</small></span></div>
              <ol class="ait-q-sum">${Q.qs.map((q, i) => `<li class="${Q.picks[i] === q.answer ? 'ok' : 'bad'}">${ic(Q.picks[i] === q.answer ? 'check' : 'x')}<span>${esc(q.q)}</span></li>`).join('')}</ol>
              ${Q.saved ? `<div class="ait-q-saved">${ic('check-circle')}${esc(t('saved'))}</div>` : ''}
              <div class="ait-q-acts"><button type="button" class="btn-primary ait-btn" id="aitQReview">${ic('message')}${esc(t('review'))}</button><button type="button" class="btn-outline ait-btn" id="aitQAgain">${ic('refresh')}${esc(t('again'))}</button></div>`;
            $('aitQReview').onclick = () => reviewQuiz();
            $('aitQAgain').onclick = () => { const tp = Q.topic; S.quiz = null; startQuiz(tp); };
            return;
        }
        const q = Q.qs[Q.i], pick = Q.picks[Q.i], shown = Q.shown;
        const letters = ['A', 'B', 'C', 'D'];
        box.innerHTML = `<div class="ait-q-head"><b>${esc(Q.title)}</b><span>${esc(t('qOf', { i: Q.i + 1, n }))}</span></div>
          <div class="ait-q-bar"><i style="width:${Math.round((Q.i + (shown ? 1 : 0)) / n * 100)}%"></i></div>
          <div class="ait-q-q">${md(q.q)}</div>
          <div class="ait-q-opts">${q.options.map((o, k) => {
              const cls = shown ? (k === q.answer ? ' right' : k === pick ? ' wrong' : ' dim') : '';
              return `<button type="button" class="ait-q-opt${cls}" data-k="${k}" ${shown ? 'disabled' : ''}><em>${letters[k]}</em><span>${esc(o)}</span></button>`;
          }).join('')}</div>
          ${shown ? `<div class="ait-q-exp ${pick === q.answer ? 'ok' : 'bad'}">${ic(pick === q.answer ? 'check-circle' : 'x-circle')}<div><b>${esc(pick === q.answer ? t('right') : t('wrong'))}</b> ${pick === q.answer ? '' : esc(t('correctIs')) + ' <b>' + esc(q.options[q.answer]) + '</b>. '}${esc(q.explain || '')}</div></div>
          <div class="ait-q-acts"><button type="button" class="btn-primary ait-btn" id="aitQNext">${esc(Q.i + 1 < n ? t('next') : t('finishQ'))}${ic('arrow-right')}</button></div>` : ''}`;
        box.querySelectorAll('.ait-q-opt').forEach((b) => { b.onclick = () => { if (Q.shown) return; Q.picks[Q.i] = +b.dataset.k; Q.shown = true; paintQuiz(); scrollEnd(); }; });
        const nx = $('aitQNext'); if (nx) { nx.onclick = () => { Q.shown = false; if (Q.i + 1 < n) Q.i++; else { Q.done = true; saveQuiz(); } paintQuiz(); scrollEnd(); }; setTimeout(() => { try { nx.focus({ preventScroll: true }); } catch (e) {} }, 30); }
    }
    function scrollEnd() { const box = $('aitMsgs'); if (box) requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; }); }
    async function saveQuiz() {
        const Q = S.quiz; if (!Q || Q.savedId || typeof db === 'undefined' || !S.user) return;
        const p = S.profile || {};
        const score = Q.picks.filter((pk, i) => pk === Q.qs[i].answer).length;
        const wrong = Q.qs.map((q, i) => (Q.picks[i] === q.answer ? null : String(q.q).slice(0, 200))).filter(Boolean).slice(0, 8);
        Q.savedId = 'pending';
        try {
            const ref = await db.collection('tutorQuizzes').add({ uid: S.user.uid, name: ([p.name, p.surname].filter(Boolean).join(' ') || p.nickname || '').slice(0, 80),
                nickname: String(p.nickname || '').slice(0, 40), subject: S.subject, topic: String(Q.topic).slice(0, 140), score, total: Q.qs.length, wrong, ts: Date.now() });
            Q.savedId = ref.id; Q.saved = true;
            S.hist.unshift({ id: ref.id, subject: S.subject, topic: Q.topic, score, total: Q.qs.length, ts: Date.now() });
            paintHist(); if (S.quiz === Q && Q.done) paintQuiz();
        } catch (e) { Q.savedId = ''; console.warn('tutorQuizzes', e); }
    }
    function reviewQuiz() {
        const Q = S.quiz; if (!Q) return;
        const n = Q.qs.length, s = Q.picks.filter((p, i) => p === Q.qs[i].answer).length;
        const wrong = Q.qs.map((q, i) => (Q.picks[i] === q.answer ? '' : '«' + q.q.replace(/\s+/g, ' ').slice(0, 160) + '» — ' + t('quizPick') + ': ' + (q.options[Q.picks[i]] || '—') + '; ' + t('quizAns') + ': ' + q.options[q.answer])).filter(Boolean);
        const text = t('quizRes', { t: Q.title, s, n }) + (wrong.length ? ' ' + t('quizWrong') + '\n' + wrong.map((w, i) => (i + 1) + '. ' + w).join('\n') + '\n' + t('quizAsk') : t('quizAllOk'));
        S.quiz = null;
        S.msgs.push({ role: 'user', kind: 'quizres', text, ts: Date.now() }); save();
        reply();
    }

    // ───────── history of mini-tests ─────────
    async function loadHist() {
        if (!S.user || typeof db === 'undefined') return;
        try {
            const snap = await db.collection('tutorQuizzes').where('uid', '==', S.user.uid).get();
            S.hist = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 30);
        } catch (e) { S.hist = []; }
        paintHist();
    }
    function paintHist() {
        const el = $('aitHist'); if (!el) return;
        if (!S.hist.length) { el.innerHTML = `<div class="ait-hist-empty">${esc(t('histEmpty'))}</div>`; return; }
        el.innerHTML = S.hist.slice(0, 8).map((h) => { const pct = h.total ? h.score / h.total : 0;
            return `<button type="button" class="ait-hrow" data-htopic="${esc(h.topic)}" data-hsubj="${esc(h.subject || '')}" title="${esc(t('again'))}"><span class="ait-hs ${pct >= 0.8 ? 'good' : pct >= 0.5 ? 'mid' : 'low'}">${h.score}/${h.total}</span><span class="ait-ht"><b>${esc(h.topic)}</b><small>${esc(t(h.subject) || '')} · ${new Date(h.ts || 0).toLocaleDateString(window.starthLocale ? window.starthLocale() : 'ru-RU', { day: 'numeric', month: 'short' })}</small></span></button>`; }).join('');
        el.querySelectorAll('[data-htopic]').forEach((b) => { b.onclick = () => {
            const sj = b.dataset.hsubj; if (sj && SUBJ.indexOf(sj) !== -1 && sj !== S.subject) { S.subject = sj; store.set('aitSubject', sj); load(); render(); }
            startQuiz(b.dataset.htopic);
        }; });
    }

    // ───────── voice input (browser speech recognition) ─────────
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec = null, recBase = '';
    function toggleMic() { if (rec) stopMic(); else startMic(); }
    function startMic() {
        if (!SR) return;
        const inp = $('aitIn'); recBase = inp.value ? inp.value.replace(/\s*$/, ' ') : '';
        const r = new SR(); rec = r;
        r.lang = S.subject === 'english' || S.subject === 'ielts' ? 'en-US' : ({ ru: 'ru-RU', uz: 'uz-UZ', en: 'en-US' })[lang()];
        r.continuous = true; r.interimResults = true;
        r.onresult = (e) => { let fin = '', tmp = ''; for (let i = 0; i < e.results.length; i++) { if (e.results[i].isFinal) fin += e.results[i][0].transcript; else tmp += e.results[i][0].transcript; } inp.value = (recBase + fin + tmp).slice(0, 3000); inp.dispatchEvent(new Event('input')); };
        r.onerror = () => stopMic(); r.onend = () => { if (rec === r) stopMic(); };
        try { r.start(); } catch (e) { rec = null; return; }
        const b = $('aitMic'); if (b) { b.classList.add('on'); b.title = t('micStop'); }
    }
    function stopMic() {
        const r = rec; rec = null; if (r) { try { r.onend = null; r.stop(); } catch (e) {} }
        const b = $('aitMic'); if (b) { b.classList.remove('on'); b.title = t('mic'); }
    }

    // ───────── access ─────────
    async function checkAccess(user, profile) {
        S.user = user; S.profile = profile || {};
        if (!window.MOCK_AI_URL || typeof db === 'undefined' || !db) { S.access = 'noai'; return render(); }
        if (!user) { S.access = 'guest'; return render(); }
        let ok = ['teacher', 'partner', 'curator', 'partner_curator'].indexOf(S.profile.role) !== -1;
        if (!ok) { try { ok = (await db.collection('admins').doc(user.uid).get()).exists; } catch (e) { ok = false; } }
        if (!ok) { try { ok = !(await db.collection('groups').where('memberUids', 'array-contains', user.uid).limit(1).get()).empty; } catch (e) { ok = false; } }
        S.access = ok ? 'ok' : 'denied';
        if (ok) load();
        render();
        if (ok && !EMBED) loadHist();
    }
    window.addEventListener('starth-auth-ready', (e) => { const d = e.detail || {}; checkAccess(d.user || null, d.profile || window.currentUserProfile); });
    window.addEventListener('starth-lang-changed', () => { if (S.access === 'ok') { const v = $('aitIn') ? $('aitIn').value : ''; render(); if ($('aitIn')) $('aitIn').value = v; } else render(); });
    render();
    if (typeof FIREBASE_READY !== 'undefined' && !FIREBASE_READY) { S.access = 'noai'; render(); }

    window.StarthTutor = { _state: S, send, startQuiz, md };
})();
