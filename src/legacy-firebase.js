// GEÇİCİ — sadece Firebase'den Supabase'e geçiş için (admin panelinde kullanılır):
//  * eski verileri okuyup Supabase'e kopyalamak (Firebase'den taşı)
//  * eski launcher'lara Supabase'li sürümü son bir kez Firebase üzerinden göndermek
// Ayarlar src/cloud.json içindeki "firebaseLegacy": { apiKey, projectId }. Geçiş bitince bu dosya, fsdb.js ve
// cloud.json'daki firebaseLegacy silinebilir; launcher'ın geri kalanı Firebase'i hiç kullanmaz.
module.exports = function legacyFirebase(conf) {
  if (!conf || !conf.apiKey || !conf.projectId) return null;
  let idToken = null;
  // admin hesabı Google ile açılmış: Google kimlik anahtarıyla eski Firebase oturumu alınır
  async function signIn(googleIdToken) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(conf.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`, requestUri: 'http://localhost', returnSecureToken: true })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Firebase girişi olmadı: ${(j.error && j.error.message) || r.status}`);
    if (String(j.email || '').toLowerCase() !== 'cubixora@gmail.com') throw new Error('Firebase\'e admin hesabıyla (cubixora@gmail.com) girmelisin.');
    idToken = j.idToken;
    return true;
  }
  const db = require('./fsdb')({ projectId: () => conf.projectId, apiKey: () => conf.apiKey, token: async () => idToken, rtdbUrl: () => '' });
  return { signIn, db };
};
