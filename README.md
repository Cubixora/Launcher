<p align="center"><img src="src/assets/icon.png" width="96" alt="Cubixora" /></p>

<h1 align="center">Cubixora Launcher</h1>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/Lisans-Source--Available-red.svg" alt="Lisans" /></a>
  <img src="https://img.shields.io/badge/Platform-Windows-blue.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/Minecraft-1.21.1%20%E2%80%93%2026.1-green.svg" alt="Minecraft" />
  <img src="https://img.shields.io/badge/Electron-31-47848F.svg" alt="Electron" />
  <a href="https://discord.gg/Cubixora"><img src="https://img.shields.io/badge/Discord-Cubixora-5865F2?logo=discord&logoColor=white" alt="Discord" /></a>
</p>

Cubixora; Minecraft için **Electron** ile yazılmış, modern ve hafif bir masaüstü launcher'ı ve onunla birlikte çalışan **Fabric istemci modu**dur (Cubixora Client). Arkadaşlar, sohbet, sesli arama, kozmetik mağazası ve oyun içi gardrop tek yerde; en zayıf bilgisayarda bile akıcı çalışacak şekilde optimize edilmiştir.

> [!IMPORTANT]
> **Lisans:** Bu depo yalnızca inceleme ve eğitim amacıyla **kaynak kodu açık (source-available)** olarak paylaşılmıştır. Kodun ya da derlenmiş halinin **yeniden dağıtılması, satılması, ticari kullanımı veya başka bir isimle yayınlanması yasaktır.** Ayrıntılar: [LICENSE](./LICENSE)

## ⬇️ İndir

Son sürümü sağdaki **[Releases](../../releases/latest)** bölümünden indir: `Cubixora-Launcher.exe` dosyasını çalıştırıp kur.

---

## ✨ Özellikler

**Launcher**
- Cubixora hesabı (e-posta), Google ve Microsoft ile giriş; Microsoft hesabını Cubixora hesabına bağlama
- Profiller: her profilin kendi sürümü, yükleyicisi (Vanilla / Fabric), RAM'i, modları ve dünyaları
- Modrinth'ten mod, doku paketi ve shader arama, tek tıkla kurma, bağımlılıklar otomatik
- Doğru Java sürümünü otomatik indirme, optimizasyon modlarını otomatik kurma
- Arkadaşlar, çevrimiçi durumu, özel ve grup sohbeti (görsel, sesli mesaj), sesli arama
- Profil: çerçeve, renk paketi, banner, çok satırlı durum mesajı, başarımlar, etkinlik
- Coin ve LP sistemi, seviye ödülleri, görev zincirleri, hediye kodları
- Görevli çekilişler: launcher'da ve partner sunucularda geçirilen süre gibi koşullar, katılım, otomatik kura ve sonuç
- 17 özgün fare imleci; launcher ve oyun arasında iki yönlü eşitlenir
- Kozmetik mağazası: pelerin, kanat, omuz petleri, şapka, uçan pet, ateş efektleri, emote, sprey
- WebGL ile çizilen 3D karakter / kozmetik önizlemesi
- İmzalı güncelleme paketleri: yeni EXE gerekmeden anında güncelleme
- Admin paneli: mağaza, partner sunucular, haberler, görevler, bildirimler, kullanıcılar (coin/eşya ver-al, rütbe, yasak), güncelleme yayınlama

**Cubixora Client (Fabric modu)**
- Modern ana menü, ayarlar ve ESC menüsü, "Yüklü Modlar" ekranı
- Oyun içi gardrop ve mağaza: launcher ile anlık eşitlenen kozmetikler
- Pelerin / kanat / pet / şapka / ateş efekti çizimi, emote çarkı, sprey
- Sesli sohbet, oyuncu listesi, hata bildirimi
- Sandıkta "Hepsini Al" / "Hepsini Koy" düğmeleri, Fullbright (Y), Zoom ve HUD modülleri
- Özel nişangah (crosshair) editörü, oyun içi görev ve çekiliş bildirimleri
- Desteklenen sürümler: 1.21.1, 1.21.4, 1.21.8, 1.21.11, 26.1

---

## 📁 Klasör yapısı

```
src/            Launcher (Electron ana süreç + arayüz)
  boot.js       Açılış: imzalı güncelleme paketini doğrular ve yükler
  main.js       Ana süreç: oyun başlatma, profiller, içerik, IPC
  sbdb.js       Supabase istemcisi (belgeler + anlık kanallar)
  social.js     Arkadaşlar, sohbet, mağaza, coin, admin işlemleri (Supabase)
  renderer/     Arayüz (HTML/CSS/JS, framework yok)
mod/            Cubixora Client (Fabric) — her Minecraft sürümü için ayrı klasör
  shared/       Tüm sürümlerin ortak kodu ve dokuları
```

---

## 🚀 Kurulum (geliştirme)

Gerekenler: Windows, [Node.js](https://nodejs.org/) 18+, mod derlemek için JDK 25.

```bash
git clone https://github.com/KULLANICI/cubixora-launcher.git
cd cubixora-launcher
npm install
```

1. `src/oauth.example.json` dosyasını `src/oauth.json` olarak kopyalayıp kendi Google OAuth bilgilerini yaz (Google girişi için).
2. Kendi Supabase projende `supabase/cubixora.sql` dosyasını çalıştır, `src/cloud.json` içine projenin adresini ve publishable anahtarını yaz.
3. Çalıştır: `npm start`
4. Kurulum dosyası (EXE): `npm run dist`
5. Mod: `mod` klasöründe `gradlew build` (JDK 25 ile; derlenen modlar `src/mod-jars` altına kopyalanır)

---

## 🔒 Lisans

Bu yazılım özel bir lisansla dağıtılır:
- Kişisel ve ticari olmayan amaçla indirip derleyip çalıştırabilirsin.
- Kaynak kodu ya da derlenmiş halini yeniden dağıtamaz, değiştirilmiş halini yayınlayamaz, ticari kazanç için kullanamazsın.

Ayrıntılar için [LICENSE](./LICENSE). Minecraft, Mojang Studios'un ticari markasıdır; bu proje Mojang veya Microsoft ile bağlantılı değildir.

---

# Cubixora Launcher (English)

A modern, lightweight Minecraft launcher built with **Electron**, together with its **Fabric client mod** (Cubixora Client): friends, chat, voice calls, a cosmetics store and an in-game wardrobe, optimized to run smoothly even on low-end PCs.

> [!IMPORTANT]
> This repository is **source-available** for review and educational purposes only. **Redistribution, selling, commercial use or rebranding is prohibited.** See [LICENSE](./LICENSE).

**Highlights:** Cubixora / Google / Microsoft login · per-profile versions, Fabric and mods · Modrinth browser · friends, DMs, group chat, voice calls · coins, levels, quests, gift codes · cosmetics store with WebGL 3D preview · signed instant updates · full admin panel · Fabric client mod for 1.21.1 – 26.1 with synced cosmetics, emotes and voice chat.

Download the latest `Cubixora-Launcher.exe` from **[Releases](../../releases/latest)**. Join us on [Discord](https://discord.gg/Cubixora).
