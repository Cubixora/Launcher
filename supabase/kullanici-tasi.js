// Firebase hesaplarını (şifreleriyle) Supabase'e taşımak için SQL üretir. Bir kez çalıştırılır.
//
// 1) Firebase hesaplarını dışa aktar (bilgisayarında, bu klasörde):
//      npx firebase-tools login
//      npx firebase-tools auth:export kullanicilar.json --format=json --project cubixora-launcher
// 2) Firebase Console > Authentication > Users > (sağ üstteki ⋮) > Password hash parameters
//    penceresindeki değerleri aşağıdaki gibi sifre-ayarlari.json dosyasına yaz:
//      { "base64_signer_key": "...", "base64_salt_separator": "...", "rounds": 8, "mem_cost": 14 }
// 3) node kullanici-tasi.js
//    -> kullanicilar.sql oluşur. Supabase > SQL Editor > New query > dosyanın tamamını yapıştır > Run.
//
// Oyuncular eski şifreleriyle giriş yapar (Supabase ilk girişte şifreyi kendi biçimine çevirir).
// Google ile girenler Google ile girmeye devam eder. Eski kimlikler app_metadata.fbuid'de saklanır,
// böylece taşınan tüm veriler (profil, coin, envanter, arkadaşlık...) aynı hesaba bağlı kalır.
// DİKKAT: kullanicilar.json, sifre-ayarlari.json ve kullanicilar.sql gizlidir; kimseyle paylaşma, GitHub'a koyma.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = __dirname;
const users = JSON.parse(fs.readFileSync(path.join(dir, 'kullanicilar.json'), 'utf8')).users || [];
const hp = JSON.parse(fs.readFileSync(path.join(dir, 'sifre-ayarlari.json'), 'utf8'));
const std = (b) => { b = String(b || '').replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; return b; };
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
// Firebase kimliğinden her seferinde aynı UUID (dosya tekrar çalıştırılabilir)
const uuidOf = (s) => { const h = crypto.createHash('sha1').update('cubixora:' + s).digest(); h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80; const x = h.slice(0, 16).toString('hex'); return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`; };

const out = ['-- Cubixora: Firebase hesapları -> Supabase Auth (otomatik üretildi; GİZLİ)', 'begin;'];
let n = 0, skipped = 0;
for (const u of users) {
  if (!u.email || u.disabled) { skipped++; continue; }
  const id = uuidOf(u.localId);
  const email = String(u.email).toLowerCase();
  const created = Number(u.createdAt) ? `to_timestamp(${Number(u.createdAt) / 1000})` : 'now()';
  const pw = u.passwordHash && u.salt
    ? `$fbscrypt$v=1,n=${hp.mem_cost},r=${hp.rounds},p=1,ss=${std(hp.base64_salt_separator)},sk=${std(hp.base64_signer_key)}$${std(u.salt)}$${std(u.passwordHash)}`
    : null;
  const google = (u.providerUserInfo || []).find((p) => p.providerId === 'google.com');
  const providers = [...(pw ? ['email'] : []), ...(google ? ['google'] : [])];
  const appMeta = { provider: providers[0] || 'email', providers, fbuid: u.localId };
  const userMeta = { ...(u.displayName ? { full_name: u.displayName } : {}), ...(u.photoUrl ? { avatar_url: u.photoUrl } : {}) };
  out.push(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', ${q(id)}, 'authenticated', 'authenticated', ${q(email)}, ${q(pw || '')}, now(), ${q(JSON.stringify(appMeta))}::jsonb, ${q(JSON.stringify(userMeta))}::jsonb, ${created}, now(), '', '', '', '')
  on conflict do nothing;`);
  if (pw) out.push(`insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select ${q(id)}, ${q(id)}, ${q(JSON.stringify({ sub: id, email, email_verified: true }))}::jsonb, 'email', now(), now(), now()
  where exists (select 1 from auth.users where id = ${q(id)}) on conflict do nothing;`);
  if (google) out.push(`insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select ${q(google.rawId)}, ${q(id)}, ${q(JSON.stringify({ sub: google.rawId, email: google.email || email, email_verified: true, ...(google.displayName ? { name: google.displayName } : {}) }))}::jsonb, 'google', now(), now(), now()
  where exists (select 1 from auth.users where id = ${q(id)}) on conflict do nothing;`);
  n++;
}
out.push('commit;', `-- ${n} hesap`);
fs.writeFileSync(path.join(dir, 'kullanicilar.sql'), out.join('\n') + '\n');
console.log(`${n} hesap kullanicilar.sql dosyasına yazıldı${skipped ? ` (${skipped} hesap atlandı: e-postasız ya da devre dışı)` : ''}.`);
