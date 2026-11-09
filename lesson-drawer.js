/* TheStarth — side panel inside the video lesson: the cabinet's Messenger and the AI Support Teacher,
 * so nobody has to leave the lesson (the site menu is hidden while the call is on).
 *
 *   StarthLessonDrawer.open('msg' | 'ai')   .close()   .toggle(kind)   .openMessenger(chatId)   .openChatId()
 * Both are our own pages in a frame (messenger?embed=1, ai-teacher?embed=lesson) — theme.js hides their site chrome.
 * The frames are created on first use and kept, so a chat or an AI conversation is not lost when the panel is closed.
 * Unread messages: msg-notify.js fires `starth-unread` → the badge on the «Сообщения» button in the call bar.
 * Desktop: the call shrinks to make room for the panel. Phone: the panel covers the call (close it to go back).
 */
(function () {
    'use strict';
    if (window.StarthLessonDrawer) return;
    var ic = function (n) { return window.Icons ? window.Icons.svg(n) : ''; };
    var L = {
        ru: { msg: 'Сообщения', ai: 'ИИ-учитель', close: 'Закрыть панель', full: 'Открыть в новой вкладке' },
        uz: { msg: 'Xabarlar', ai: 'AI-o‘qituvchi', close: 'Panelni yopish', full: 'Yangi oynada ochish' },
        en: { msg: 'Messages', ai: 'AI teacher', close: 'Close panel', full: 'Open in a new tab' }
    };
    function t(k) { var l = 'ru'; try { l = localStorage.getItem('starthLang') || 'ru'; } catch (e) {} return (L[l] || L.ru)[k]; }
    var SRC = { msg: 'messenger?embed=1', ai: 'ai-teacher?embed=lesson' };
    var FULL = { msg: 'messenger', ai: 'ai-teacher' };
    var root = null, frames = {}, cur = '', unread = 0;

    var CSS = '' +
        '.ld{position:fixed;top:0;right:0;bottom:0;width:min(420px,100vw);z-index:1700;display:flex;flex-direction:column;background:var(--paper);border-left:1px solid var(--rule);box-shadow:-12px 0 40px rgba(0,0,0,.35);transform:translateX(105%);transition:transform .22s ease;visibility:hidden}' +
        '.ld.open{transform:none;visibility:visible}' +
        '.ld-head{display:flex;align-items:center;gap:.4rem;padding:.5rem .6rem;background:#0f1216;border-bottom:1px solid #232933;flex:0 0 auto}' +
        '.ld-tab{position:relative;display:inline-flex;align-items:center;gap:.4rem;font:inherit;font-size:.88rem;font-weight:600;padding:.5rem .8rem;border-radius:10px;border:1px solid #2c323c;background:#1d2128;color:#cfd3da;cursor:pointer}' +
        '.ld-tab .ico{width:1.05em;height:1.05em}.ld-tab:hover{background:#2a303a}.ld-tab.on{background:#fff;color:#14171c;border-color:#fff}' +
        '.ld-tab i{position:absolute;top:-5px;right:-5px;background:#e74c3c;color:#fff;font:700 .65rem/1 var(--font-body,inherit);border-radius:999px;padding:.18rem .35rem;font-style:normal}' +
        '.ld-sp{flex:1}' +
        '.ld-ib{width:36px;height:36px;border-radius:10px;border:1px solid #2c323c;background:#1d2128;color:#cfd3da;cursor:pointer;display:grid;place-items:center;text-decoration:none}' +
        '.ld-ib:hover{background:#2a303a;color:#fff}.ld-ib .ico{width:18px;height:18px}' +
        '.ld-body{flex:1;min-height:0;position:relative;background:var(--paper)}' +
        '.ld-body iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:var(--paper)}' +
        '.ld-body iframe[hidden]{display:none}' +
        '@media(min-width:900px){html.in-call.ld-open #meeting-screen{right:min(420px,100vw)}}' +
        '@media(max-width:899px){.ld{width:100vw;border-left:0}}' +
        '.cb .cb-badge.ld-badge{background:#e74c3c}';

    function build() {
        if (root) return;
        if (!document.getElementById('ld-css')) { var st = document.createElement('style'); st.id = 'ld-css'; st.textContent = CSS; document.head.appendChild(st); }
        root = document.createElement('aside'); root.className = 'ld'; root.setAttribute('aria-hidden', 'true');
        root.innerHTML = '<div class="ld-head">' +
            '<button type="button" class="ld-tab" data-ld="msg">' + ic('message') + '<span></span><i hidden></i></button>' +
            '<button type="button" class="ld-tab" data-ld="ai">' + ic('sparkles') + '<span></span></button>' +
            '<span class="ld-sp"></span>' +
            '<a class="ld-ib" id="ldFull" target="_blank" rel="noopener">' + ic('maximize') + '</a>' +
            '<button type="button" class="ld-ib" id="ldClose">' + ic('x') + '</button></div>' +
            '<div class="ld-body"></div>';
        document.body.appendChild(root);
        root.querySelectorAll('[data-ld]').forEach(function (b) { b.onclick = function () { open(b.getAttribute('data-ld')); }; });
        root.querySelector('#ldClose').onclick = close;
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur && !document.querySelector('.sui-back')) close(); });
        labels();
    }
    function labels() {
        if (!root) return;
        root.querySelector('[data-ld="msg"] span').textContent = t('msg');
        root.querySelector('[data-ld="ai"] span').textContent = t('ai');
        var c = root.querySelector('#ldClose'); c.title = t('close'); c.setAttribute('aria-label', t('close'));
        var f = root.querySelector('#ldFull'); f.title = t('full'); f.setAttribute('aria-label', t('full'));
    }
    function frame(kind, extra) {
        if (frames[kind]) return frames[kind];
        var f = document.createElement('iframe');
        f.title = t(kind); f.src = SRC[kind] + (extra || '');
        f.setAttribute('allow', 'microphone; clipboard-write');
        root.querySelector('.ld-body').appendChild(f);
        frames[kind] = f;
        return f;
    }
    function open(kind, extra) {
        build();
        if (kind !== 'msg' && kind !== 'ai') kind = 'msg';
        cur = kind;
        var f = frame(kind, extra);
        Object.keys(frames).forEach(function (k) { frames[k].hidden = k !== kind; });
        root.querySelectorAll('[data-ld]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-ld') === kind); });
        root.querySelector('#ldFull').href = FULL[kind];
        root.classList.add('open'); root.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('ld-open');
        sync();
        setTimeout(function () { try { f.contentWindow.focus(); } catch (e) {} }, 250);
    }
    function close() {
        if (!root) return;
        cur = ''; root.classList.remove('open'); root.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('ld-open');
        sync();
    }
    function toggle(kind) { if (cur === kind) close(); else open(kind); }
    function openMessenger(chatId) {
        build();
        var f = frames.msg;
        if (!f) { open('msg', chatId ? '&gid=' + encodeURIComponent(chatId) : ''); return; }
        open('msg');
        try { if (chatId && f.contentWindow.Messenger) f.contentWindow.Messenger.openById(chatId); } catch (e) {}
    }
    function openChatId() {
        if (cur !== 'msg' || !frames.msg) return '';
        try { return frames.msg.contentWindow.Messenger ? frames.msg.contentWindow.Messenger.openId() : ''; } catch (e) { return ''; }
    }
    // the buttons in the call bar (lesson-call.js) show the state and the unread badge
    function sync() {
        ['msg', 'ai'].forEach(function (k) {
            var b = document.getElementById('cb-' + k); if (!b) return;
            b.classList.toggle('on', cur === k); b.setAttribute('aria-pressed', cur === k ? 'true' : 'false');
        });
        var mb = document.getElementById('cb-msg');
        if (mb) {
            var badge = mb.querySelector('.ld-badge');
            if (unread) { if (!badge) { badge = document.createElement('i'); badge.className = 'cb-badge ld-badge'; mb.appendChild(badge); } badge.textContent = unread > 9 ? '9+' : String(unread); }
            else if (badge) badge.remove();
        }
        var more = document.getElementById('cb-more');   // phone: «Сообщения» sits behind «Ещё» — show the count there too
        if (more) {
            var mbg = more.querySelector('.ld-badge');
            if (unread && !more.classList.contains('on')) { if (!mbg) { mbg = document.createElement('i'); mbg.className = 'cb-badge ld-badge'; more.appendChild(mbg); } mbg.textContent = unread > 9 ? '9+' : String(unread); }
            else if (mbg) mbg.remove();
        }
        if (root) { var tb = root.querySelector('[data-ld="msg"] i'); tb.hidden = !unread; tb.textContent = unread > 9 ? '9+' : String(unread); }
    }
    window.addEventListener('starth-unread', function (e) { unread = (e.detail && e.detail.n) || 0; sync(); });
    window.addEventListener('starth-lang-changed', labels);

    window.StarthLessonDrawer = { open: open, close: close, toggle: toggle, openMessenger: openMessenger, openChatId: openChatId, sync: sync, current: function () { return cur; } };
})();
