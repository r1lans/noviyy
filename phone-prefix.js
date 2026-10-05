/* TheStarth — phone fields always start with the country prefix (+998 by default).
 *   - an empty field shows "+998 " as soon as it is focused, and the prefix cannot be erased;
 *   - the number is formatted while typing:  +998 90 123 45 67;
 *   - a number from another country can still be pasted ("+7 ...", "+1 ...": anything that starts with + and is not +998 is kept as typed).
 * Applies to every <input type="tel"> and to inputs named/id'ed "phone" on the page, including fields created later (modals).
 */
(function () {
    'use strict';
    const PREFIX = '+998', MAXN = 9;
    const isPhone = (el) => el && el.tagName === 'INPUT' && !el.hasAttribute('data-nophone') && (el.type === 'tel' || el.name === 'phone' || /phone$/i.test(el.id || ''));
    function fmt(raw) {
        raw = String(raw || '');
        if (raw.charAt(0) === '+' && raw.length > 4 && raw.indexOf(PREFIX) !== 0) {            // another country, pasted as a whole
            return '+' + raw.replace(/\D/g, '').slice(0, 15);
        }
        let d = raw.replace(/\D/g, '');
        if (d.indexOf('998') === 0) d = d.slice(3); else if (raw.charAt(0) !== '+' && d.charAt(0) === '0') d = d.slice(1);
        d = d.slice(0, MAXN);
        let out = PREFIX + ' ';
        if (d.length) out += d.slice(0, 2);
        if (d.length > 2) out += ' ' + d.slice(2, 5);
        if (d.length > 5) out += ' ' + d.slice(5, 7);
        if (d.length > 7) out += ' ' + d.slice(7, 9);
        return out;
    }
    const MSG = { ru: 'Введите номер полностью: +998 XX XXX XX XX', uz: "Raqamni to'liq kiriting: +998 XX XXX XX XX", en: 'Enter the full number: +998 XX XXX XX XX' };
    const lang = () => { try { return localStorage.getItem('starthLang') || 'ru'; } catch (e) { return 'ru'; } };
    function validity(el) {
        const v = el.value.trim(), d = v.replace(/\D/g, '');
        let ok = true;
        if (d && d !== '998') ok = v.indexOf(PREFIX) === 0 ? d.length === 12 : d.length >= 8;
        el.setCustomValidity(ok ? '' : (MSG[lang()] || MSG.ru));
    }
    function apply(el) {
        const before = el.value, v = fmt(before);
        if (v !== before) el.value = v;
        validity(el);
        try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {}
    }
    function prep(el) {
        if (el.__phone) return; el.__phone = true;
        el.setAttribute('inputmode', 'tel'); el.setAttribute('autocomplete', el.getAttribute('autocomplete') || 'tel');
        el.removeAttribute('maxlength');
        el.setAttribute('placeholder', '+998 90 123 45 67');
        if (el.value) el.value = fmt(el.value);
    }
    document.addEventListener('focusin', (e) => { const el = e.target; if (!isPhone(el)) return; prep(el); if (!el.value) { el.value = PREFIX + ' '; setTimeout(() => { try { el.setSelectionRange(el.value.length, el.value.length); } catch (x) {} }, 0); } });
    document.addEventListener('input', (e) => { const el = e.target; if (!isPhone(el)) return; prep(el); apply(el); }, true);
    document.addEventListener('keydown', (e) => {
        const el = e.target; if (!isPhone(el)) return;
        if ((e.key === 'Backspace' || e.key === 'Delete') && el.value.length <= PREFIX.length + 1 && el.selectionStart === el.selectionEnd) e.preventDefault();   // keep "+998 "
    });
    document.addEventListener('blur', (e) => { const el = e.target; if (isPhone(el)) { if (el.value.replace(/\D/g, '') === '998') el.value = ''; validity(el); } }, true);   // nothing typed: leave the field empty (so "required" and the placeholder work)
    function scan() { document.querySelectorAll('input[type="tel"], input[name="phone"], input[id$="hone"]').forEach((el) => { if (isPhone(el)) prep(el); }); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
    window.StarthPhone = { format: fmt };
})();
