// Firebase project config — see firebase-backend/FIREBASE_SETUP.md, Step 5.
// These values are NOT secret; Firebase is designed to have them visible
// in client code. Real protection comes from firestore.rules.
const firebaseConfig = {
    apiKey: "AIzaSyAvoRM09suEEJDDMLRUGArrLbPEFtVfCVQ",
    authDomain: "thestarth-b7620.firebaseapp.com",
    projectId: "thestarth-b7620",
    storageBucket: "thestarth-b7620.firebasestorage.app",
    messagingSenderId: "597137579605",
    appId: "1:597137579605:web:3770514798f2161266bedc",
    measurementId: "G-T8PCCGPKDM"
};

let auth = null;
let db = null;
const FIREBASE_READY = !!firebaseConfig.apiKey;

if (FIREBASE_READY) {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    // Antivirus / company proxies on some laptops break Firestore's live connection (data and video lessons hang).
    // Long polling is detected automatically and used only when the normal connection does not work.
    // Inside Telegram (the bot's mini-app) the WebView often breaks Firestore's streaming connection: a sent message
    // stayed «in the air» forever and never reached the other person. There we always use plain long polling.
    const inTelegram = !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) || /tg-app/.test(location.pathname);
    try { db.settings(inTelegram ? { experimentalForceLongPolling: true, merge: true } : { experimentalAutoDetectLongPolling: true, merge: true }); } catch (e) {}
} else {
    console.warn('Firebase not configured yet — see firebase-backend/FIREBASE_SETUP.md. Accounts and admin panel will not work until it is.');
}

// Имя Telegram-бота для напоминаний об уроках (без токена!). Например: 'TheStarthBot'. Токен хранится ТОЛЬКО в секретах Cloudflare Worker.
window.STARTH_TG_BOT = 'TheStarth_bot';
