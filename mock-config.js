/* TheStarth — address of the AI helper used in Admin panel -> Mock-тесты.
 * Leave empty until you deploy worker/mock-ai-worker.js (see MOCK_SETUP.md). With an empty value the panel shows
 * "Скопировать запрос для ИИ" / "Вставить JSON" instead of the "Составить с помощью ИИ" button.
 * Example: window.MOCK_AI_URL = 'https://starth-mock-ai.YOURNAME.workers.dev';
 */
// Own address (Cloudflare -> Workers -> starth-ai -> Settings -> Domains & Routes -> Custom domain: ai.thestarth.com).
// The *.workers.dev address is blocked by some internet providers, so it is kept only as a spare for the video lessons.
window.MOCK_AI_URL = window.MOCK_AI_URL || 'https://ai.thestarth.com';
window.MOCK_AI_FALLBACK = ['https://starth-ai.ralmi999777.workers.dev'];
