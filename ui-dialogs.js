/* TheStarth — site-styled dialogs and toasts instead of the browser's grey alert / confirm / prompt boxes.
 *
 *   StarthUI.alert(text, opts?)            -> Promise<void>        (OK)
 *   StarthUI.confirm(text, opts?)          -> Promise<boolean>     (Да / Отмена)
 *   StarthUI.prompt(text, value?, opts?)   -> Promise<string|null> (null = cancelled)
 *   StarthUI.toast(text, kind?, ms?)       kind: 'ok' | 'err' | 'info'
 *   opts: { title, ok, cancel, danger:bool, kind:'ok'|'err'|'warn'|'info', placeholder, multiline }
 *
 * window.alert is replaced too, so every old alert('…') on the site already looks like the site
 * (short «Готово / Сохранено / скопировано» messages become a toast, the rest a dialog).
 * confirm / prompt cannot be replaced transparently (they must return at once), so the code calls
 * `await StarthUI.confirm(…)` / `await StarthUI.prompt(…)` instead.
 * Loaded in <head> right after theme.js on every page. Colours come from styles.css variables (dark theme works).
 */
(function () {
    'use strict';
    if (window.StarthUI) return;
    var nativeAlert = window.alert ? window.alert.bind(window) : function () {};

    var T = {
        ru: { ok: 'OK', yes: 'Да', cancel: 'Отмена', confirm: 'Подтвердите действие', note: 'Сообщение', err: 'Ошибка', done: 'Готово', input: 'Введите значение', close: 'Закрыть' },
        uz: { ok: 'OK', yes: 'Ha', cancel: 'Bekor qilish', confirm: 'Amalni tasdiqlang', note: 'Xabar', err: 'Xato', done: 'Tayyor', input: 'Qiymatni kiriting', close: 'Yopish' },
        en: { ok: 'OK', yes: 'Yes', cancel: 'Cancel', confirm: 'Please confirm', note: 'Message', err: 'Error', done: 'Done', input: 'Enter a value', close: 'Close' }
    };
    function L() { var l = 'ru'; try { l = localStorage.getItem('starthLang') || 'ru'; } catch (e) {} return T[l] || T.ru; }

    var P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    var ICON = {
        ok: '<svg viewBox="0 0 24 24" ' + P + '><circle cx="12" cy="12" r="9.5"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>',
        err: '<svg viewBox="0 0 24 24" ' + P + '><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>',
        warn: '<svg viewBox="0 0 24 24" ' + P + '><path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
        info: '<svg viewBox="0 0 24 24" ' + P + '><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5M12 7.5h.01"/></svg>',
        ask: '<svg viewBox="0 0 24 24" ' + P + '><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.2a2.9 2.9 0 0 1 5.6 1c0 2-2.8 2.6-2.8 4.3M12 17.5h.01"/></svg>',
        edit: '<svg viewBox="0 0 24 24" ' + P + '><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
        x: '<svg viewBox="0 0 24 24" ' + P + '><path d="M6 6l12 12M18 6 6 18"/></svg>'
    };

    var CSS = '' +
        '.sui-back{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(10,12,16,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);opacity:0;transition:opacity .18s ease}' +
        '.sui-back.show{opacity:1}' +
        '.sui-box{width:min(440px,100%);max-height:calc(100dvh - 2rem);overflow:auto;background:var(--paper,#fff);color:var(--ink,#111);border:1px solid var(--rule,#ddd);border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.35);padding:1.4rem 1.4rem 1.1rem;transform:translateY(10px) scale(.98);transition:transform .2s ease;font-family:var(--font-body,inherit);position:relative}' +
        '.sui-back.show .sui-box{transform:none}' +
        '.sui-head{display:flex;align-items:center;gap:.75rem;margin:0 2rem .7rem 0}' +
        '.sui-ic{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;flex:0 0 auto;background:var(--accent-tint,rgba(212,160,23,.15));color:var(--accent,#d4a017)}' +
        '.sui-ic svg{width:24px;height:24px}' +
        '.sui-ic.err{background:rgba(192,57,43,.13);color:#c0392b}.sui-ic.ok{background:rgba(30,132,73,.13);color:#1e8449}.sui-ic.warn{background:rgba(214,137,16,.15);color:#d68910}' +
        '[data-theme="dark"] .sui-ic.err{color:#f1948a}[data-theme="dark"] .sui-ic.ok{color:#58d68d}' +
        '.sui-title{font-weight:700;font-size:1.05rem;line-height:1.3;margin:0}' +
        '.sui-text{margin:0;line-height:1.55;white-space:pre-line;color:var(--ink,#111);font-size:.98rem;overflow-wrap:anywhere}' +
        '.sui-in{width:100%;box-sizing:border-box;margin-top:.9rem;padding:.75rem .9rem;border-radius:12px;border:1px solid var(--rule,#ccc);background:var(--surface,var(--paper-alt,#f6f6f6));color:var(--ink,#111);font:inherit;font-size:1rem}' +
        '.sui-in:focus{outline:2px solid var(--accent,#d4a017);outline-offset:1px}textarea.sui-in{min-height:110px;resize:vertical;line-height:1.5}' +
        '.sui-acts{display:flex;justify-content:flex-end;gap:.55rem;margin-top:1.2rem;flex-wrap:wrap}' +
        '.sui-btn{font:inherit;font-weight:600;font-size:.95rem;padding:.65rem 1.25rem;border-radius:12px;cursor:pointer;border:1px solid var(--rule,#ccc);background:var(--paper-alt,#f3f3f3);color:var(--ink,#111);min-width:96px;transition:transform .1s,filter .15s}' +
        '.sui-btn:hover{filter:brightness(.97)}.sui-btn:active{transform:translateY(1px)}' +
        '.sui-btn.pri{background:var(--accent,#d4a017);border-color:var(--accent,#d4a017);color:var(--on-accent,#111)}' +
        '.sui-btn.danger{background:#c0392b;border-color:#c0392b;color:#fff}' +
        '.sui-btn:focus-visible{outline:2px solid var(--accent,#d4a017);outline-offset:2px}' +
        '.sui-x{position:absolute;top:.8rem;right:.8rem;width:34px;height:34px;border-radius:10px;border:0;background:transparent;color:var(--ink-soft,#777);cursor:pointer;display:grid;place-items:center}.sui-x:hover{background:var(--paper-alt,#f3f3f3)}.sui-x svg{width:18px;height:18px}' +
        '@media(max-width:480px){.sui-back{align-items:flex-end;padding:.6rem}.sui-box{border-radius:20px;padding:1.2rem 1.1rem 1rem}.sui-acts{flex-direction:column-reverse}.sui-btn{width:100%}}' +
        '.sui-toasts{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:100001;display:flex;flex-direction:column;gap:.5rem;align-items:center;pointer-events:none;width:min(460px,calc(100% - 1.5rem))}' +
        'body:has(.navbar) .sui-toasts{top:92px}html.in-call .sui-toasts,html.embed .sui-toasts{top:14px}' +
        '.sui-toast{pointer-events:auto;display:flex;align-items:center;gap:.65rem;width:100%;box-sizing:border-box;padding:.75rem .9rem;border-radius:14px;background:var(--paper,#fff);color:var(--ink,#111);border:1px solid var(--rule,#ddd);border-left:4px solid var(--accent,#d4a017);box-shadow:0 12px 32px rgba(0,0,0,.22);font-size:.93rem;line-height:1.4;opacity:0;transform:translateY(-10px);transition:opacity .2s,transform .2s;cursor:pointer}' +
        '.sui-toast.show{opacity:1;transform:none}.sui-toast svg{width:22px;height:22px;flex:0 0 auto;color:var(--accent,#d4a017)}' +
        '.sui-toast.ok{border-left-color:#1e8449}.sui-toast.ok svg{color:#1e8449}.sui-toast.err{border-left-color:#c0392b}.sui-toast.err svg{color:#c0392b}' +
        '[data-theme="dark"] .sui-toast.ok svg{color:#58d68d}[data-theme="dark"] .sui-toast.err svg{color:#f1948a}' +
        '.sui-toast span{flex:1;min-width:0;overflow-wrap:anywhere}';

    function css() {
        if (document.getElementById('sui-css')) return;
        var st = document.createElement('style'); st.id = 'sui-css'; st.textContent = CSS;
        (document.head || document.documentElement).appendChild(st);
    }
    function whenBody(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    // what kind of message is it — decides the icon and colour
    function guess(text) {
        var s = String(text || '').toLowerCase();
        if (/ошибк|не удалось|не получилось|нельзя|xato|bo'lmadi|bo‘lmadi|error|failed|could not|couldn't|cannot|denied|нет доступа/.test(s)) return 'err';
        if (/готово|сохранен|скопирован|отправлен|добавлен|обновлен|создан|удален|опубликован|спасибо|saqlandi|nusxalandi|yuborildi|tayyor|saved|copied|sent|added|done|thank/.test(s)) return 'ok';
        if (/введите|выберите|укажите|нужно|должн|сначала|kiriting|tanlang|please|enter|choose|need/.test(s)) return 'warn';
        return 'info';
    }
    function dangerous(text) { return /удалить|стереть|закончить|выйти|заблокир|отклонить|очистить|забрать|отменить отметку|покинуть|убрать|o'chir|o‘chir|chiqish|delete|remove|leave|end the|block|erase|clear/i.test(String(text || '')); }

    // one dialog at a time; the next one waits in the queue
    var queue = Promise.resolve();
    function open(kind, text, opts) {
        opts = opts || {};
        var job = queue.then(function () { return new Promise(function (resolve) { whenBody(function () { show(kind, text, opts, resolve); }); }); });
        queue = job.catch(function () {});
        return job;
    }

    function show(kind, text, opts, resolve) {
        css();
        var l = L(), k = opts.kind || (kind === 'confirm' ? (opts.danger || dangerous(text) ? 'warn' : 'ask') : kind === 'prompt' ? 'edit' : guess(text));
        var title = opts.title || (kind === 'confirm' ? l.confirm : kind === 'prompt' ? (opts.placeholder ? l.input : l.note) : k === 'err' ? l.err : k === 'ok' ? l.done : l.note);
        var danger = kind === 'confirm' && (opts.danger != null ? opts.danger : dangerous(text));
        var back = document.createElement('div'); back.className = 'sui-back';
        back.setAttribute('role', kind === 'alert' ? 'alertdialog' : 'dialog'); back.setAttribute('aria-modal', 'true');
        var input = kind === 'prompt'
            ? (opts.multiline ? '<textarea class="sui-in" maxlength="5000"></textarea>' : '<input class="sui-in" type="text" autocomplete="off">')
            : '';
        back.innerHTML = '<div class="sui-box" tabindex="-1">' +
            '<button type="button" class="sui-x" aria-label="' + esc(l.close) + '">' + ICON.x + '</button>' +
            '<div class="sui-head"><span class="sui-ic ' + (k === 'ask' || k === 'edit' ? '' : k) + '">' + (ICON[k] || ICON.info) + '</span><p class="sui-title">' + esc(title) + '</p></div>' +
            '<p class="sui-text">' + esc(text) + '</p>' + input +
            '<div class="sui-acts">' +
            (kind === 'alert' ? '' : '<button type="button" class="sui-btn" data-a="no">' + esc(opts.cancel || l.cancel) + '</button>') +
            '<button type="button" class="sui-btn ' + (danger ? 'danger' : 'pri') + '" data-a="yes">' + esc(opts.ok || (kind === 'confirm' ? l.yes : l.ok)) + '</button>' +
            '</div></div>';
        var inp = back.querySelector('.sui-in');
        if (inp) { inp.value = opts.value == null ? '' : String(opts.value); if (opts.placeholder) inp.placeholder = opts.placeholder; }
        var prevFocus = document.activeElement, done = false;
        function finish(yes) {
            if (done) return; done = true;
            document.removeEventListener('keydown', onKey, true);
            back.classList.remove('show');
            setTimeout(function () { if (back.parentNode) back.parentNode.removeChild(back); }, 180);
            try { if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } catch (e) {}
            if (kind === 'confirm') resolve(!!yes);
            else if (kind === 'prompt') resolve(yes ? inp.value : null);
            else resolve();
        }
        function onKey(e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
            else if (e.key === 'Enter' && !(inp && inp.tagName === 'TEXTAREA' && !e.ctrlKey && !e.metaKey)) {
                if (document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-a') === 'no') return;
                e.preventDefault(); e.stopPropagation(); finish(true);
            } else if (e.key === 'Tab') {   // keep focus inside the dialog
                var f = Array.prototype.slice.call(back.querySelectorAll('button, input, textarea'));
                var i = f.indexOf(document.activeElement);
                if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
                else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
            }
        }
        back.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('[data-a], .sui-x') : null;
            if (b) { finish(b.getAttribute('data-a') === 'yes'); return; }
            if (e.target === back && kind === 'alert') finish(true);
        });
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(back);
        requestAnimationFrame(function () { back.classList.add('show'); });
        setTimeout(function () {
            try {
                if (inp) { inp.focus(); inp.select && inp.select(); }
                else back.querySelector(danger ? '[data-a="no"]' : '[data-a="yes"]').focus();
            } catch (e) {}
        }, 30);
    }

    var toastsBox = null;
    function toast(text, kind, ms) {
        whenBody(function () {
            css();
            if (!toastsBox || !toastsBox.parentNode) { toastsBox = document.createElement('div'); toastsBox.className = 'sui-toasts'; toastsBox.setAttribute('aria-live', 'polite'); document.body.appendChild(toastsBox); }
            var k = kind || guess(text);
            var t = document.createElement('div'); t.className = 'sui-toast ' + k; t.setAttribute('role', k === 'err' ? 'alert' : 'status');
            t.innerHTML = (ICON[k] || ICON.info) + '<span>' + esc(text) + '</span>';
            toastsBox.appendChild(t);
            requestAnimationFrame(function () { t.classList.add('show'); });
            var gone = function () { t.classList.remove('show'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220); };
            t.onclick = gone;
            setTimeout(gone, ms || Math.min(7000, 2600 + String(text).length * 35));
        });
    }

    var UI = {
        alert: function (text, opts) { return open('alert', text == null ? '' : String(text), opts); },
        confirm: function (text, opts) { return open('confirm', text == null ? '' : String(text), opts); },
        prompt: function (text, value, opts) { opts = Object.assign({}, opts || {}); opts.value = value; return open('prompt', text == null ? '' : String(text), opts); },
        toast: toast,
        nativeAlert: nativeAlert
    };
    window.StarthUI = UI;

    // every old alert() on the site: short good news → toast, everything else → dialog
    window.alert = function (msg) {
        var s = msg == null ? '' : String(msg);
        if (guess(s) === 'ok' && s.length <= 140) { toast(s, 'ok'); return; }
        UI.alert(s);
    };
})();
