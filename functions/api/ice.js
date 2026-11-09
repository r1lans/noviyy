/* TheStarth — relay servers (TURN) for video lessons, served from the site's own address: thestarth.com/api/ice.
 * Cloudflare Pages runs this file by itself (folder «functions»). The same address as the site cannot be blocked
 * separately by an internet provider (unlike *.workers.dev), so video works on mobile internet and strict Wi-Fi.
 *
 * Settings: Cloudflare -> Workers & Pages -> thestarth (Pages) -> Settings -> Variables and Secrets:
 *   TURN_KEY_ID          (Text)   — the TURN key id (Realtime -> TURN Server)
 *   TURN_KEY_API_TOKEN   (Secret) — its API token
 *   FIREBASE_PROJECT_ID  (Text, optional) — thestarth-b7620 by default
 * Only signed-in people of the site get relay credentials (the Firebase sign-in token is checked here).
 */
const JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let keys = null, keysAt = 0;

const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const b64uDec = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function jwk(kid) {
    if (!keys || Date.now() - keysAt > 3600000) {
        const r = await fetch(JWKS); const j = await r.json(); keys = {}; (j.keys || []).forEach((k) => { keys[k.kid] = k; }); keysAt = Date.now();
    }
    return keys[kid] || null;
}
/** Firebase ID token -> uid, or '' when it is not valid */
export async function verifyFirebase(token, projectId, nowSec) {
    try {
        const [h, p, s] = String(token || '').split('.'); if (!s) return '';
        const head = JSON.parse(new TextDecoder().decode(b64uDec(h))), pay = JSON.parse(new TextDecoder().decode(b64uDec(p)));
        const now = nowSec || Math.floor(Date.now() / 1000);
        if (head.alg !== 'RS256' || pay.aud !== projectId || pay.iss !== 'https://securetoken.google.com/' + projectId || !pay.sub || pay.exp < now || pay.iat > now + 300) return '';
        const k = await jwk(head.kid); if (!k) return '';
        const key = await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
        return (await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64uDec(s), new TextEncoder().encode(h + '.' + p))) ? pay.sub : '';
    } catch (e) { return ''; }
}

export async function onRequestPost({ request, env }) {
    const uid = await verifyFirebase((request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''), env.FIREBASE_PROJECT_ID || 'thestarth-b7620');
    if (!uid) return json({ error: 'auth' }, 401);
    if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return json({ iceServers: [], off: true });
    const base = 'https://rtc.live.cloudflare.com/v1/turn/keys/' + encodeURIComponent(env.TURN_KEY_ID) + '/credentials/';
    const h = { Authorization: 'Bearer ' + env.TURN_KEY_API_TOKEN, 'Content-Type': 'application/json' };
    let list = [];
    try {
        let r = await fetch(base + 'generate-ice-servers', { method: 'POST', headers: h, body: JSON.stringify({ ttl: 43200 }) });
        if (!r.ok) r = await fetch(base + 'generate', { method: 'POST', headers: h, body: JSON.stringify({ ttl: 43200 }) });
        if (!r.ok) return json({ error: 'turn ' + r.status }, 502);
        const j = await r.json();
        list = Array.isArray(j.iceServers) ? j.iceServers : j.iceServers ? [j.iceServers] : [];
    } catch (e) { return json({ error: 'turn' }, 502); }
    // browsers refuse port 53 — drop those addresses so they do not slow the connection down
    list = list.map((x) => Object.assign({}, x, { urls: [].concat(x.urls || []).filter((u) => !/:53(\?|$)/.test(u)) })).filter((x) => x.urls.length);
    return json({ iceServers: list });
}
export const onRequestGet = () => json({ ok: true, hint: 'POST with the Firebase sign-in token' });
