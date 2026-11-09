/* TheStarth — "swarm rebuild" intro of the home page.
 * The page starts as an empty canvas; a flock of multiplayer cursors scans it, then every cursor grabs a piece of the
 * page (logo, menu item, video, heading, card…), draws a selection frame with its size (like in Figma) and the piece
 * appears. Sections below the first screen are built the same way when the visitor scrolls to them.
 *
 * Smoothness: only transform / opacity / clip-path are animated (all done by the GPU), the cursors move in one
 * requestAnimationFrame loop that stops when they rest, sizes are read once per piece, nothing on the page
 * changes its size or position (hidden pieces keep their place), so the page never jumps.
 *
 * When it does NOT run (decided in the <head> before the first paint, see index.html): it was already shown in this
 * browser tab session, the link has #anchor, the visitor asked the system for less motion, data-saver is on, or it is
 * a search robot. ?build=1 in the address shows it again. "Skip" (or Esc) shows the whole page at once.
 */
(function () {
    'use strict';
    const html = document.documentElement;
    if (!html.classList.contains('sw-pending') || window.__swarmCancelled) return;
    window.__swarmStarted = true;
    try { sessionStorage.setItem('swarmSeen', '1'); } catch (e) {}

    const lang = () => { try { const l = localStorage.getItem('starthLang') || html.lang || 'ru'; return ['ru', 'uz', 'en'].indexOf(l) !== -1 ? l : 'ru'; } catch (e) { return 'ru'; } };
    const TX = {
        ru: { scan: 'Сканирую страницу…', agents: 'агентов', layers: 'слоёв', build: 'Собираю страницу', scroll: 'Листайте — сборка продолжится', done: 'Готово', skip: 'Пропустить' },
        uz: { scan: 'Sahifa skanerlanmoqda…', agents: 'agent', layers: 'qatlam', build: "Sahifa yig'ilmoqda", scroll: "Pastga suring — yig'ish davom etadi", done: 'Tayyor', skip: "O'tkazib yuborish" },
        en: { scan: 'Scanning page…', agents: 'agents', layers: 'layers', build: 'Building the page', scroll: 'Scroll to keep building', done: 'Done', skip: 'Skip' },
    };
    const T = TX[lang()] || TX.ru;

    const small = Math.min(window.innerWidth, screen.width || 9999) < 760;
    const N = small ? 8 : 14;
    const COLORS = ['#ff4d6d', '#ffb703', '#3a86ff', '#8338ec', '#06d6a0', '#fb5607', '#ff006e', '#00b4d8', '#7cb518', '#e63946', '#4361ee', '#f72585', '#2a9d8f', '#f4a261'];
    const BLUE = '#0d99ff';
    const now = () => performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const TIP = -116.6 * Math.PI / 180;          // direction the arrow points to when not rotated

    // ── styles ────────────────────────────────────────────────────────────
    const css = `
#sw-veil{position:fixed;inset:0;z-index:1490;background:var(--paper,#faf9f5);background-image:radial-gradient(color-mix(in srgb,var(--ink,#111) 14%,transparent) 1px,transparent 1.2px);background-size:22px 22px;transition:opacity .5s ease;pointer-events:none}
#sw-veil.out{opacity:0}
.sw-chip{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;padding:6px 12px 6px 8px;border-radius:999px;background:color-mix(in srgb,var(--ink,#111) 7%,transparent);color:var(--ink-soft,#666);font:600 13px/1 Inter,system-ui,sans-serif;letter-spacing:.02em}
.sw-chip img{width:22px;height:22px;object-fit:contain}
#sw-doc{position:absolute;left:0;top:0;width:100%;height:0;overflow:visible;z-index:1495;pointer-events:none}
.sw-cur{position:absolute;left:0;top:0;width:20px;height:21px;margin:-1px 0 0 -2px;transform-origin:2px 1px;will-change:transform;transition:opacity .4s ease;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))}
.sw-cur.gone{opacity:0}
.sw-cur.nap{opacity:.28}
.sw-box{position:absolute;border:1.5px solid ${BLUE};background:rgba(13,153,255,.05);border-radius:2px;clip-path:inset(0 100% 100% 0);transition:clip-path var(--d,.4s) cubic-bezier(.4,0,.2,1),opacity .3s ease;box-sizing:border-box}
.sw-box.on{clip-path:inset(0 0 0 0)}
.sw-box.out{opacity:0}
.sw-box i{position:absolute;width:7px;height:7px;background:#fff;border:1.5px solid ${BLUE};box-sizing:border-box}
.sw-box i:nth-child(1){left:-1px;top:-1px}.sw-box i:nth-child(2){right:-1px;top:-1px}.sw-box i:nth-child(3){left:-1px;bottom:-1px}.sw-box i:nth-child(4){right:-1px;bottom:-1px}
.sw-dim{position:absolute;transform:translate(-50%,0) scale(.8);opacity:0;padding:2px 6px;border-radius:4px;background:${BLUE};color:#fff;font:600 10.5px/1.3 Inter,system-ui,sans-serif;white-space:nowrap;transition:opacity .2s ease,transform .25s ease;font-variant-numeric:tabular-nums}
.sw-dim.on{opacity:1;transform:translate(-50%,0) scale(1)}
.sw-gh,.sw-gv{position:absolute;left:0;top:0;background:#ff3b6b;opacity:0;transition:transform .45s cubic-bezier(.4,0,.2,1),opacity .3s ease;will-change:transform}
.sw-gh{width:100%;height:1px}.sw-gv{width:1px;height:100vh}
.sw-gh.on,.sw-gv.on{opacity:.75}
.sw-rul{position:fixed;z-index:1496;pointer-events:none;background:color-mix(in srgb,var(--paper,#fff) 88%,var(--ink,#000));color:var(--ink-soft,#777);font:500 9px/1 Inter,system-ui,sans-serif;transition:transform .45s cubic-bezier(.4,0,.2,1);overflow:hidden}
.sw-rul.t{left:0;top:0;right:0;height:18px;transform:translateY(-100%);border-bottom:1px solid var(--rule,#ddd);background-image:repeating-linear-gradient(90deg,var(--rule,#bbb) 0 1px,transparent 1px 10px);background-size:100% 5px;background-repeat:no-repeat;background-position:bottom}
.sw-rul.l{left:0;top:18px;bottom:0;width:18px;transform:translateX(-100%);border-right:1px solid var(--rule,#ddd);background-image:repeating-linear-gradient(180deg,var(--rule,#bbb) 0 1px,transparent 1px 10px);background-size:5px 100%;background-repeat:no-repeat;background-position:right}
.sw-rul.on{transform:none}
.sw-rul span{position:absolute}
.sw-rul.t span{top:3px;padding-left:3px;border-left:1px solid var(--ink-soft,#999);height:15px}
.sw-rul.l span{left:2px;writing-mode:vertical-rl;transform:rotate(180deg);padding-top:3px;border-bottom:1px solid var(--ink-soft,#999);width:15px}
#sw-hud{position:fixed;left:50%;bottom:18px;z-index:1497;transform:translate(-50%,0);display:flex;align-items:center;gap:12px;padding:8px 8px 8px 12px;border-radius:12px;background:#1d1e22;color:#e9e9ec;font:500 12px/1.2 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.28);transition:opacity .4s ease,transform .4s ease;white-space:nowrap;max-width:calc(100vw - 24px)}
#sw-hud.out{opacity:0;transform:translate(-50%,12px)}
#sw-hud b{color:#fff;font-weight:700;font-variant-numeric:tabular-nums}
.sw-av{display:flex}.sw-av i{width:16px;height:16px;border-radius:50%;border:2px solid #1d1e22;margin-left:-6px}.sw-av i:first-child{margin-left:0}
.sw-sep{width:1px;height:16px;background:#3a3b41}
.sw-bar{width:70px;height:3px;border-radius:2px;background:#3a3b41;overflow:hidden}
.sw-bar i{display:block;height:100%;width:100%;background:${BLUE};transform-origin:0 50%;transform:scaleX(0);transition:transform .35s ease}
.sw-st{color:#a9abb3}
.sw-x{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:8px;background:#2c2d33;color:#e9e9ec;font:600 12px/1 Inter,system-ui,sans-serif;padding:7px 10px;cursor:pointer}
.sw-x:hover{background:#3a3b42}
.sw-x:focus-visible{outline:2px solid ${BLUE};outline-offset:2px}
@media (max-width:760px){#sw-hud{left:10px;right:84px;transform:none;gap:8px;bottom:14px;padding:7px 7px 7px 10px;font-size:11px}#sw-hud.out{transform:translateY(12px)}.sw-bar,.sw-hide-s{display:none}.sw-st{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}.sw-x{margin-left:auto}}
.sw-wait>*{opacity:0!important;pointer-events:none!important}
.sw-layer{opacity:0!important;visibility:hidden!important;translate:0 10px;scale:.985}
.sw-layer.sw-txt{clip-path:inset(0 100% 0 0)}
.sw-layer.sw-in{opacity:1!important;visibility:visible!important;translate:0 0;scale:1;clip-path:inset(0 0 0 0);transition:opacity .45s ease,translate .55s cubic-bezier(.2,.8,.2,1),scale .55s cubic-bezier(.2,.8,.2,1),clip-path .7s cubic-bezier(.4,0,.2,1)!important}
`;
    const style = document.createElement('style'); style.id = 'sw-style'; style.textContent = css;
    (document.head || html).appendChild(style);

    // ── overlay pieces ─────────────────────────────────────────────────────
    let veil, doc, hud, rulT, rulL, gh, gv, hudCnt, hudTot, hudBar, hudSt;
    const cursors = [];
    function buildOverlay() {
        veil = document.createElement('div'); veil.id = 'sw-veil';
        veil.innerHTML = '<div class="sw-chip"><img src="images/logo-icon.png" alt="">TheStarth</div>';
        doc = document.createElement('div'); doc.id = 'sw-doc'; doc.setAttribute('aria-hidden', 'true');
        gh = document.createElement('div'); gh.className = 'sw-gh'; gv = document.createElement('div'); gv.className = 'sw-gv';
        doc.appendChild(gh); doc.appendChild(gv);
        const cx = window.innerWidth / 2, cy = window.scrollY + window.innerHeight / 2;
        for (let i = 0; i < N; i++) {
            const el = document.createElement('div'); el.className = 'sw-cur';
            el.innerHTML = '<svg width="20" height="21" viewBox="0 0 20 21"><path d="M2 1v16l4.5-4.2 3 6.7 2.5-1.1-2.9-6.6 5.9-.2Z" fill="' + COLORS[i % COLORS.length] + '" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
            doc.appendChild(el);
            const a = Math.random() * Math.PI * 2, r = 220 + Math.random() * 260;
            cursors.push({ el, i, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, rot: 0, tw: null, busy: false, rest: false, g: i % (small ? 2 : 3), k: Math.floor(i / (small ? 2 : 3)) });
        }
        rulT = document.createElement('div'); rulT.className = 'sw-rul t';
        rulL = document.createElement('div'); rulL.className = 'sw-rul l';
        let s = ''; for (let x = 100; x < window.innerWidth; x += 100) s += '<span style="left:' + x + 'px">' + x + '</span>'; rulT.innerHTML = s;
        s = ''; for (let y = 100; y < window.innerHeight; y += 100) s += '<span style="top:' + (y - 18) + 'px">' + y + '</span>'; rulL.innerHTML = s;
        hud = document.createElement('div'); hud.id = 'sw-hud'; hud.setAttribute('role', 'status');
        hud.innerHTML = '<span class="sw-av">' + COLORS.slice(0, 5).map((c) => '<i style="background:' + c + '"></i>').join('') + '</span>' +
            '<span class="sw-hide-s"><b>' + N + '</b> ' + T.agents + '</span><span class="sw-sep sw-hide-s"></span>' +
            '<span><b class="sw-cnt">0</b> / <span class="sw-tot">…</span> ' + T.layers + '</span><span class="sw-bar"><i></i></span>' +
            '<span class="sw-st">' + T.scan + '</span>' +
            '<button type="button" class="sw-x">' + T.skip + ' <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>';
        hudCnt = hud.querySelector('.sw-cnt'); hudTot = hud.querySelector('.sw-tot'); hudBar = hud.querySelector('.sw-bar i'); hudSt = hud.querySelector('.sw-st');
        hud.querySelector('.sw-x').addEventListener('click', skipAll);
        document.addEventListener('keydown', onKey);
        const b = document.body;
        b.appendChild(veil); b.appendChild(rulT); b.appendChild(rulL); b.appendChild(doc); b.appendChild(hud);
    }
    function onKey(e) { if (e.key === 'Escape') skipAll(); }

    // ── cursor motion: one rAF loop, transforms only ──────────────────────
    let raf = 0, phase = 'flock', flockT0 = 0;
    function moveTo(c, x, y, dur, done) {
        const dx = x - c.x, dy = y - c.y;
        c.tw = { sx: c.x, sy: c.y, x, y, t0: now(), dur, done, arc: (Math.random() - 0.5) * Math.min(120, Math.hypot(dx, dy) * 0.25) };
        c.rest = false; kick();
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function frame(t) {
        raf = 0;
        let moving = false;
        const vw = window.innerWidth, sy = window.scrollY;
        if (phase === 'flock') {
            const cx = vw / 2, cy = sy + window.innerHeight / 2, e = (t - flockT0) / 1000;
            const R = Math.min(vw * 0.32, 420), groups = small ? 2 : 3;
            for (const c of cursors) {
                const ph = c.g * (Math.PI * 2 / groups), w = 1.25;
                const lx = cx + Math.cos(e * w + ph) * R, ly = cy + Math.sin(e * w * 2 + ph) * R * 0.32;
                const vx = -Math.sin(e * w + ph) * R * w, vy = Math.cos(e * w * 2 + ph) * R * 0.32 * w * 2;
                const len = Math.hypot(vx, vy) || 1, dx = vx / len, dy = vy / len;
                const side = (c.k % 2 ? 1 : -1) * Math.ceil(c.k / 2) * 9, back = Math.ceil(c.k / 2) * 15;
                const tx = lx - dx * back - dy * side, ty = ly - dy * back + dx * side;
                c.x += (tx - c.x) * 0.16; c.y += (ty - c.y) * 0.16;
                c.rot = Math.atan2(dy, dx) - TIP;
            }
            moving = true;
        } else {
            for (const c of cursors) {
                if (c.tw) {
                    const w = c.tw, p = clamp((t - w.t0) / w.dur, 0, 1), k = ease(p);
                    const bx = w.sx + (w.x - w.sx) * k, by = w.sy + (w.y - w.sy) * k;
                    const len = Math.hypot(w.x - w.sx, w.y - w.sy) || 1, arc = Math.sin(Math.PI * k) * w.arc;
                    c.x = bx - (w.y - w.sy) / len * arc; c.y = by + (w.x - w.sx) / len * arc;
                    if (p >= 1) { c.tw = null; if (w.done) w.done(); }
                    moving = true;
                }
                if (Math.abs(c.rot) > 0.01) { c.rot *= 0.85; moving = true; } else c.rot = 0;   // straighten to a normal pointer
            }
        }
        for (const c of cursors) c.el.style.transform = 'translate3d(' + Math.min(c.x, vw - 16).toFixed(1) + 'px,' + c.y.toFixed(1) + 'px,0) rotate(' + c.rot.toFixed(3) + 'rad)';
        if (moving) kick();
    }

    // ── what to build: top-level blocks ("roots") and the pieces inside them ("layers") ──
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'BR']);
    const ATOM_TAGS = new Set(['IMG', 'VIDEO', 'CANVAS', 'SVG', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'FORM', 'TABLE', 'UL', 'OL', 'IFRAME', 'PICTURE', 'BLOCKQUOTE', 'SMALL', 'STRONG', 'SPAN', 'DETAILS']);
    const ATOM_RE = /(^|[\s-])(card|btn|badge|logo|chip|pill|stat|quest|marquee|cert|intro-frame|hero-carousel|lang-switch|price|stepper-item|faq-item|item|toggle-container|promo)/i;
    const cls = (el) => (typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '');
    const roots = [];
    function skipRoot(el) {
        if (SKIP_TAGS.has(el.tagName) || /^sw-/.test(el.id || '')) return true;
        if (/(^|\s)(modal|starth-toast|cookie-banner)(\s|$)/.test(cls(el))) return true;
        const cs = getComputedStyle(el);
        if (cs.display === 'none') return true;
        if (cs.position === 'fixed' && el.tagName !== 'NAV') return true;
        const r = el.getBoundingClientRect();
        return r.width < 4 || r.height < 4;
    }
    function collect(root, maxDepth) {
        const out = [];
        (function walk(el, depth) {
            for (const ch of el.children) {
                if (SKIP_TAGS.has(ch.tagName)) continue;
                if (/reveal/.test(cls(ch))) continue;                             // has its own appear animation
                const r = ch.getBoundingClientRect();
                if (r.width < 6 || r.height < 6) continue;
                const cs = getComputedStyle(ch);                                     // closed menus, invisible click areas…
                if (cs.visibility === 'hidden' || (depth > 0 && cs.opacity === '0')) continue;    // depth 0 is hidden by the intro itself
                const atom = ATOM_TAGS.has(ch.tagName.toUpperCase()) || ATOM_RE.test(cls(ch)) || !ch.children.length || depth >= maxDepth;
                if (atom) out.push(ch); else walk(ch, depth + 1);
            }
        })(root, 0);
        return out;
    }
    function layersOf(root) { let l = []; for (const d of [4, 3, 2, 1]) { l = collect(root, d); if (l.length <= 24) break; } return l; }

    // ── progress ───────────────────────────────────────────────────────────
    let total = 0, built = 0;
    function hudCount() {
        hudCnt.textContent = built; hudTot.textContent = Math.max(total, built);
        hudBar.style.transform = 'scaleX(' + (total ? Math.min(1, built / total) : 0) + ')';
    }

    // ── building ───────────────────────────────────────────────────────────
    const queue = [];
    const boxes = [];
    function getBox() {
        let b = boxes.find((x) => !x.used);
        if (!b) {
            const el = document.createElement('div'); el.className = 'sw-box'; el.innerHTML = '<i></i><i></i><i></i><i></i>';
            const dim = document.createElement('div'); dim.className = 'sw-dim';
            doc.appendChild(el); doc.appendChild(dim);
            b = { el, dim, used: false }; boxes.push(b);
        }
        b.used = true; return b;
    }
    let introSent = false;
    function releaseIntro() {
        if (introSent) return; introSent = true;
        window.__swarmHold = false;
        try { window.dispatchEvent(new Event('swarm:intro')); } catch (e) {}
    }
    function reveal(L) {
        if (L.done) return; L.done = true;
        const el = L.el;
        el.classList.add('sw-in');
        built++; hudCount();
        if (L.root) { L.root.left--; if (L.root.left <= 0) L.root.state = 'done'; }
        if (el.id === 'introFrame' || el.querySelector && el.querySelector('#introVideo')) releaseIntro();
        setTimeout(() => el.classList.remove('sw-layer', 'sw-in', 'sw-txt'), 800);
    }
    function work(c) {
        if (finished) return;
        let L = queue.shift();
        while (L && L.done) L = queue.shift();
        if (!L) { c.busy = false; idle(c); return; }
        c.busy = true; c.el.classList.remove('nap');
        const r = L.el.getBoundingClientRect(), sy = window.scrollY;
        if (!r.width || !r.height) { reveal(L); work(c); return; }
        const x0 = r.left, y0 = r.top + sy, x1 = r.right, y1 = r.bottom + sy;
        // far away (the visitor scrolled): come in from just above the visible part instead of flying across the page
        if (Math.abs(c.y - y0) > window.innerHeight * 1.2) { c.x = clamp(x0 + (Math.random() - 0.5) * 300, 10, window.innerWidth - 20); c.y = sy - 30; }
        const d1 = clamp(Math.hypot(x0 - c.x, y0 - c.y) / 1.7, 260, 650);
        moveTo(c, x0, y0, d1, () => {
            if (finished) return;
            const b = getBox(), w = x1 - x0, h = y1 - y0;
            const dur = clamp(Math.hypot(w, h) / 2.4, 280, 700);
            b.el.style.cssText = 'left:' + x0 + 'px;top:' + y0 + 'px;width:' + w + 'px;height:' + h + 'px;--d:' + dur + 'ms';
            b.el.classList.remove('out', 'on'); void b.el.offsetWidth; b.el.classList.add('on');
            b.dim.textContent = Math.round(w) + ' × ' + Math.round(h);
            b.dim.style.left = (x0 + w / 2) + 'px'; b.dim.style.top = (y1 + 6) + 'px'; b.dim.classList.remove('on');
            gh.style.transform = 'translate3d(0,' + y0 + 'px,0)'; gv.style.transform = 'translate3d(' + x0 + 'px,' + (y0 - 200) + 'px,0)';
            gh.classList.add('on'); gv.classList.add('on');
            moveTo(c, x1, y1, dur, () => {
                b.dim.classList.add('on');
                reveal(L);
                setTimeout(() => { b.el.classList.add('out'); b.dim.classList.remove('on'); setTimeout(() => { b.used = false; }, 320); }, 380);
                work(c);
            });
        });
    }
    function idle(c) {
        if (finished) return;
        // rest in a loose cluster near the bottom of what is on screen, then the loop stops
        const sy = window.scrollY, vw = window.innerWidth, vh = window.innerHeight;
        const x = vw * (0.62 + Math.random() * 0.3), y = sy + vh * (0.62 + Math.random() * 0.22);
        moveTo(c, x, y, 900 + Math.random() * 500, () => { c.rest = true; if (!c.busy && !finished) c.el.classList.add('nap'); });
        checkIdle();
    }
    function feed() { for (const c of cursors) if (!c.busy && queue.length) work(c); }

    function enqueue(R) {
        if (R.state !== 'wait' || finished) return;
        R.state = 'queued';
        const ls = layersOf(R.el).map((el) => ({ el, root: R, done: false }));
        const rects = ls.map((L) => L.el.getBoundingClientRect());
        ls.forEach((L, i) => { L.top = rects[i].top; L.left = rects[i].left; });
        ls.sort((a, b) => (Math.abs(a.top - b.top) < 24 ? a.left - b.left : a.top - b.top));
        total += ls.length - (R.est || 0); R.left = ls.length;
        // writes after all reads
        ls.forEach((L) => { L.el.classList.add('sw-layer'); if (/^H[1-3]$/.test(L.el.tagName)) L.el.classList.add('sw-txt'); });
        R.el.classList.remove('sw-wait');
        if (!ls.length) R.state = 'done';
        ls.forEach((L) => queue.push(L));
        hudCount(); setStatus(T.build);
        // never leave a part of the page empty for long (very fast scrolling, slow phone…)
        R.timer = setTimeout(() => { ls.forEach(reveal); checkIdle(); }, 2600 + ls.length * 40);
        feed();
    }
    function setStatus(s) { if (hudSt && hudSt.textContent !== s) hudSt.textContent = s; }

    let io = null, aboveDone = false;
    function checkIdle() {
        if (finished) return;
        const busy = cursors.some((c) => c.busy) || queue.some((L) => !L.done);
        if (busy) return;
        if (!aboveDone) { aboveDone = true; rulT.classList.remove('on'); rulL.classList.remove('on'); gh.classList.remove('on'); gv.classList.remove('on'); }
        if (roots.every((R) => R.state === 'done' || (R.state === 'queued' && R.left <= 0))) { finish(); return; }
        setStatus(T.scroll);
    }

    // ── start ─────────────────────────────────────────────────────────────
    let finished = false, started = false;
    function begin() {
        if (started || finished) return; started = true;
        // reads: which blocks are there, how many pieces they have, which are on the first screen
        const vh = window.innerHeight;
        for (const el of Array.from(document.body.children)) {
            if (skipRoot(el)) continue;
            const r = el.getBoundingClientRect();
            roots.push({ el, state: 'wait', top: r.top, bottom: r.bottom, left: 0 });
        }
        roots.forEach((R) => { R.est = layersOf(R.el).length; total += R.est; });
        // writes
        roots.forEach((R) => R.el.classList.add('sw-wait'));
        html.classList.remove('sw-pending');
        hudCount();
        phase = 'build';
        cursors.forEach((c) => { c.busy = false; c.tw = null; });
        veil.classList.add('out'); setTimeout(() => { if (veil) veil.remove(); veil = null; }, 600);
        rulT.classList.add('on'); rulL.classList.add('on');
        roots.filter((R) => R.top < vh).forEach(enqueue);
        if ('IntersectionObserver' in window) {
            io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { const R = roots.find((x) => x.el === e.target); if (R) { enqueue(R); io.unobserve(e.target); } } }), { rootMargin: '0px 0px -12% 0px' });
            roots.filter((R) => R.state === 'wait').forEach((R) => io.observe(R.el));
        } else roots.forEach(enqueue);
        window.addEventListener('scroll', onScroll, { passive: true });
        feed();
        cursors.forEach((c) => { if (!c.busy) idle(c); });
        kick();
    }
    // at the very end of the page: build whatever is left (the last block may never reach the trigger line)
    function onScroll() { if (window.innerHeight + window.scrollY >= html.scrollHeight - 8) roots.forEach(enqueue); }

    function cleanupDom() {
        roots.forEach((R) => { R.el.classList.remove('sw-wait'); clearTimeout(R.timer); });
        document.querySelectorAll('.sw-layer').forEach((el) => el.classList.add('sw-in'));
        setTimeout(() => document.querySelectorAll('.sw-layer').forEach((el) => el.classList.remove('sw-layer', 'sw-in', 'sw-txt')), 650);
        html.classList.remove('sw-pending');
    }
    function finish() {
        if (finished) return; finished = true;
        releaseIntro();
        if (io) io.disconnect();
        window.removeEventListener('scroll', onScroll);
        document.removeEventListener('keydown', onKey);
        cleanupDom();
        if (hud) {
            setStatus(T.done);
            hud.querySelector('.sw-x').style.display = 'none';
            built = Math.max(built, total); hudCount();
        }
        if (rulT) { rulT.classList.remove('on'); rulL.classList.remove('on'); }
        if (veil) veil.classList.add('out');
        phase = 'build';
        const sy = window.scrollY;
        cursors.forEach((c) => { c.el.classList.remove('nap'); moveTo(c, c.x + (Math.random() - 0.5) * 300, sy - 60, 700 + Math.random() * 400, null); c.el.classList.add('gone'); });
        setTimeout(() => { if (hud) hud.classList.add('out'); }, 900);
        setTimeout(() => { [veil, doc, hud, rulT, rulL, style].forEach((el) => { if (el && el.parentNode) el.remove(); }); cancelAnimationFrame(raf); raf = 0; }, 1500);
    }
    function skipAll() { finish(); }

    // safety: whatever happens, after a minute the page is simply shown
    setTimeout(finish, 60000);

    function boot() {
        if (!document.body) { requestAnimationFrame(boot); return; }
        buildOverlay();
        flockT0 = now(); kick();
        const t0 = now();
        const ready = new Promise((res) => { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', res, { once: true }); else res(); })
            .then(() => Promise.race([document.fonts ? document.fonts.ready : null, new Promise((r) => setTimeout(r, 1500))]))
            .then(() => new Promise((r) => setTimeout(r, Math.max(0, 1500 - (now() - t0)))));
        ready.then(() => requestAnimationFrame(begin));
    }
    boot();
    window.StarthSwarm = { skip: skipAll };
})();
