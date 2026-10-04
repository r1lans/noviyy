/* TheStarth — home page intro video stage.
 * The video plays on entry (muted: browsers do not allow sound before a tap). The last seconds show buttons drawn INSIDE the video
 * (a trial-lesson button and four subject chips). Invisible real buttons are laid exactly over them and switch on when the
 * buttons appear in the video, so they work like normal buttons (hover, keyboard, tap). The video stops on its last picture.
 */
(function () {
    'use strict';
    const frame = document.getElementById('introFrame'), v = document.getElementById('introVideo');
    if (!frame || !v) return;
    const $ = (id) => document.getElementById(id);
    const end = $('introEnd'), hot = $('introHot'), playBtn = $('introPlay'), soundBtn = $('introSound'), skipBtn = $('introSkip');
    const HOLD_MS = 6500;                                // how long the last picture stays before the intro starts again
    let holdTimer = null;
    const MAIN_AT = 22.3, CHIPS_AT = 22.6, STILL_AT = 25.4;   // seconds in the video when the buttons are fully drawn
    const tr = (k, fb) => { try { const d = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[typeof getCurrentLang === 'function' ? getCurrentLang() : 'ru']) || {}; return d[k] || (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS.ru[k]) || fb; } catch (e) { return fb; } };
    const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    // keep the stage right under the fixed navigation bar
    const nav = document.querySelector('.navbar');
    const fit = () => { if (nav) document.getElementById('introStage').style.setProperty('--stage-nav', nav.offsetHeight + 'px'); };
    fit(); window.addEventListener('resize', fit); window.addEventListener('load', fit);

    const small = Math.min(screen.width || 9999, window.innerWidth) < 900 || (navigator.connection && navigator.connection.saveData);
    v.src = small ? v.dataset.srcSd : v.dataset.srcHd;

    function sync() {
        const t = v.currentTime || 0, atEnd = v.ended || t >= STILL_AT;
        if (atEnd && !v.paused) { v.pause(); if (!holdTimer) holdTimer = setTimeout(restart, HOLD_MS); }   // hold the last picture, then play again
        frame.classList.toggle('is-live', t >= MAIN_AT || atEnd);
        frame.classList.toggle('is-chips', t >= CHIPS_AT || atEnd);
        skipBtn.hidden = t >= MAIN_AT || atEnd;
    }
    function showStill() { end.hidden = false; v.style.visibility = 'hidden'; }
    function hideStill() { end.hidden = true; v.style.visibility = ''; }
    function setSound() {
        const on = !v.muted; soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        soundBtn.textContent = on ? tr('stage.sound_off', 'Выключить звук') : tr('stage.sound_on', 'Включить звук');
        soundBtn.setAttribute('data-i18n', on ? 'stage.sound_off' : 'stage.sound_on');
    }
    function restart() {
        holdTimer = null;
        if (document.hidden) { holdTimer = setTimeout(restart, 1000); return; }         // do not restart in a background tab
        try { v.currentTime = 0; } catch (e) {}
        frame.classList.remove('is-live', 'is-chips'); skipBtn.hidden = false;
        start();
    }
    function start() {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        hideStill(); playBtn.hidden = true;
        const p = v.play(); if (p && p.catch) p.catch(() => { playBtn.hidden = false; });
    }

    v.addEventListener('timeupdate', sync);
    v.addEventListener('ended', () => { sync(); });
    v.addEventListener('play', () => { playBtn.hidden = true; });
    v.addEventListener('error', () => { showStill(); frame.classList.add('is-live', 'is-chips'); skipBtn.hidden = true; });
    playBtn.onclick = start;
    soundBtn.onclick = () => { v.muted = !v.muted; if (!v.muted && v.paused && !v.ended) start(); setSound(); };
    skipBtn.onclick = () => { try { v.currentTime = MAIN_AT; } catch (e) {} if (v.paused && !v.ended && (v.currentTime || 0) < STILL_AT) start(); sync(); };
    window.addEventListener('starth-lang-changed', setSound);

    // ---- what each real button does ----
    function openLead(course) {
        const modal = document.getElementById('appModal'); if (!modal) { location.hash = '#contact'; return; }
        const f = document.getElementById('leadForm');
        if (f && f.course && course) f.course.value = course;
        modal.classList.add('show');
    }
    const ACTIONS = { trial: () => openLead(''), ielts: () => openLead('ielts'), sat: () => openLead('sat'), math: () => openLead('math'), german: () => openLead('german') };
    hot.addEventListener('click', (e) => { const b = e.target.closest('.ih'); if (b && ACTIONS[b.dataset.act]) ACTIONS[b.dataset.act](); });

    setSound(); sync();
    if (reduced) { showStill(); frame.classList.add('is-live', 'is-chips'); skipBtn.hidden = true; soundBtn.hidden = true; return; }
    start();
})();
