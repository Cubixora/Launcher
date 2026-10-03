package com.cubixora.cosmetics;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Sürümden bağımsız ortak durum. */
public final class Cubixora {
    public static final Logger LOG = LoggerFactory.getLogger("cubixora");

    /** Kendi kanatlarımız açık mı (K tuşuyla değişir). null = launcher'daki varsayılan. */
    public static volatile Boolean selfWingsOpen = null;

    private Cubixora() {}

    /** Oyuncunun kanatları şu an açık olmalı mı? */
    public static boolean wantWingsOpen(String name, PlayerCosmetics c) {
        boolean self = name != null && name.equalsIgnoreCase(CosmeticsManager.selfName());
        return self && selfWingsOpen != null ? selfWingsOpen : c.wingsOpenDefault;
    }

    /** K tuşu: kendi kanatlarını aç/kapat. Döner: yeni durum, kanat yoksa null. */
    public static Boolean toggleSelfWings(String selfName) {
        PlayerCosmetics c = CosmeticsManager.get(selfName);
        if (c == null || c.wingsTexture == null) return null;
        boolean now = selfWingsOpen == null ? c.wingsOpenDefault : selfWingsOpen;
        selfWingsOpen = !now;
        return selfWingsOpen;
    }

    /**
     * Omuzdaki mini kopyanın yatay uzaklığı (piksel). Baş döndükçe köşeleri dışarı taşar;
     * mini kopya da o kadar dışarı kayar ki başın içine girmesin.
     */
    public static float petOffsetPx(float headYawDeg) {
        double h = Math.toRadians(headYawDeg);
        return (float) (3.6 + 4.5 * (Math.abs(Math.cos(h)) + Math.abs(Math.sin(h))));
    }

    // ---------------------------------------------------------------- omuzdan sarkma (eğilince)
    private static final class Pet { float v, vel, vRel; long last, sneakAt, releaseAt; boolean sneaking; }
    private static final java.util.Map<String, Pet> PETS = new java.util.concurrent.ConcurrentHashMap<>();
    private static final float SLIP = 0.22f;  // ayağın kayma süresi (sn)
    private static final float CLIMB = 1.05f; // geri tırmanma süresi (sn)

    private static Pet pet(String name) { return PETS.computeIfAbsent(name == null ? "" : name, k -> new Pet()); }
    private static float since(long at) { return at == 0L ? 99f : (System.nanoTime() - at) / 1e9f; }
    public static float lerp(float a, float b, float t) { return a + (b - a) * t; }
    private static float clamp01(float v) { return Math.max(0f, Math.min(1f, v)); }
    private static float smooth(float v) { v = clamp01(v); return v * v * (3f - 2f * v); }
    private static float bump(float v) { return (float) Math.sin(Math.PI * clamp01(v)); }
    /** Shift bırakıldıktan sonraki tırmanma ilerlemesi (0..1); tırmanmıyorsa -1. */
    private static float climb(Pet s) {
        if (s.sneaking || s.releaseAt == 0L || s.vRel < 0.05f) return -1f;
        float c = since(s.releaseAt) / CLIMB;
        return c >= 1f ? -1f : c;
    }

    /**
     * Oyuncu eğilince (shift) omuzdaki mini kopyanın ayağı kayar, oyuncunun arkasına düşer, son anda
     * omzunun arkasından tutunup sarkarak bekler. Shift bırakılınca elleriyle tutunarak kendini yukarı
     * çeker, dizini omza atıp tırmanır ve yerine oturur.
     * Dönen değer: 0 = omuzda, ~1 = sarkıyor.
     */
    public static float petHang(String name, boolean sneaking) {
        Pet s = pet(name);
        long now = System.nanoTime();
        if (sneaking && !s.sneaking) s.sneakAt = now;
        if (!sneaking && s.sneaking) { s.releaseAt = now; s.vRel = s.v; }
        s.sneaking = sneaking;
        float dt = s.last == 0L ? 0f : Math.max(0f, Math.min(0.05f, (now - s.last) / 1e9f));
        s.last = now;
        if (!sneaking) {
            float c = climb(s);
            if (c >= 0f) { // tırmanma: eller omuzda sabit, gövde yukarı çekilir
                float y;
                if (c < 0.5f) y = lerp(s.vRel, 0.24f, smooth(c / 0.5f));              // kendini yukarı çekiyor
                else if (c < 0.85f) y = lerp(0.24f, -0.05f, smooth((c - 0.5f) / 0.35f)); // omzun üstüne çıkıyor
                else y = lerp(-0.05f, 0f, smooth((c - 0.85f) / 0.15f));                // yerine oturuyor
                s.v = y; s.vel = 0f;
                return y;
            }
            s.v = 0f; s.vel = 0f;
            return 0f;
        }
        float ts = since(s.sneakAt);
        float target, stiff, damp;
        if (ts < SLIP) { target = 0.1f; stiff = 60f; damp = 10f; }   // ayağı kayıyor
        else { target = 1f; stiff = 150f; damp = 7.5f; }               // düşüş + yakalanma sekmesi
        s.vel += (stiff * (target - s.v) - damp * s.vel) * dt;
        s.v += s.vel * dt;
        if (s.v < 0f) { s.v = 0f; s.vel = 0f; }
        if (s.v > 1.35f) { s.v = 1.35f; s.vel = 0f; }
        return s.v;
    }

    /** Dikey düşüş miktarı: ayak kayarken omuz hizasında kalır, sonra düşer; tırmanırken yükselir. */
    public static float dropY(String name) {
        Pet s = pet(name);
        if (s.sneaking && since(s.sneakAt) < SLIP) return 0.04f * smooth(since(s.sneakAt) / SLIP);
        return s.v;
    }
    /** Sırttan uzaklık (blok). Pelerin ya da kanat takılıysa onlara değmesin diye biraz daha dışarıda durur. */
    public static float backZ(String name, float k) {
        Pet s = pet(name);
        float back = 0.22f;
        PlayerCosmetics c = CosmeticsManager.get(name);
        if (c != null) { if (c.wingsTexture != null) back += 0.12f; else if (c.capeTexture != null) back += 0.07f; }
        if (s.sneaking) { float ts = since(s.sneakAt); return ts < SLIP ? back * smooth(ts / SLIP) : back; }
        float cl = climb(s);
        if (cl >= 0f) return cl < 0.5f ? back : back * (1f - smooth((cl - 0.5f) / 0.4f));
        return 0f;
    }
    /** Öne/arkaya devrilme (derece, X ekseni). */
    public static float hangPitch(String name, float t) {
        Pet s = pet(name);
        float h = clamp01(s.v);
        if (s.sneaking) {
            float ts = since(s.sneakAt);
            if (ts < SLIP) return -38f * smooth(ts / SLIP);                           // ayağı kaydı, arkaya devriliyor
            float after = ts - SLIP;
            float tilt = -38f * (1f - smooth(after / 0.18f));                          // düşerken dikleşir
            float jolt = (float) Math.sin(after * 11f) * 12f * Math.max(0f, 1f - after / 0.9f); // yakalanınca sarsılır
            float pend = (float) Math.sin(t * 2.4f) * 5f * h;                          // asılıyken sarkaç
            return tilt + jolt + pend;
        }
        float c = climb(s);
        if (c < 0f) return 0f;
        if (c < 0.5f) return 5f * bump(c / 0.5f);                                       // çekilirken hafif geriye
        if (c < 0.85f) return 20f * bump((c - 0.5f) / 0.35f);                           // omzun üstüne eğilip çıkıyor
        return 0f;
    }
    /** Devrilme ekseninin yüksekliği: kayarken ayakları, asılı/tırmanırken elleri etrafında döner. */
    public static float hangPivot(String name, float k) {
        Pet s = pet(name);
        float feet = 1.5f * k, hands = -0.5f * k;
        if (s.sneaking) { float ts = since(s.sneakAt); return lerp(feet, hands, smooth((ts - SLIP) / 0.15f)); }
        return hands;
    }
    /** Kolların yukarıda olma miktarı (1 = tam yukarı, tutunuyor). */
    public static float armsUp(String name, float h) {
        Pet s = pet(name);
        if (s.sneaking) { float ts = since(s.sneakAt); return ts < SLIP ? 0.55f * smooth(ts / SLIP) : h; }
        float c = climb(s);
        if (c < 0f) return 0f;
        if (c < 0.5f) return lerp(1f, 0.62f, smooth(c / 0.5f));                     // kendini çekerken kollar bükülür
        if (c < 0.85f) return lerp(0.62f, 0.04f, smooth((c - 0.5f) / 0.35f));       // omza bastırarak yükselir
        return lerp(0.04f, 0f, (c - 0.85f) / 0.15f);
    }

    /** Eski: yan sallanma artık kullanılmıyor. */
    public static float hangSway(String name, float t, float side) { return 0f; }

    /** Bacak açısı (radyan): düşerken çırpınır, asılıyken sallanıp ara ara tekmeler, tırmanırken dizini omza atar. */
    public static float flail(String name, float t, int i) {
        Pet s = pet(name);
        double ph = i * Math.PI;
        if (!s.sneaking) {
            float c = climb(s);
            if (c < 0f) return 0f;
            if (c < 0.5f) return (float) Math.sin(t * 9f + ph) * 0.3f * (1f - c);        // çekilirken bacaklar sallanır
            if (c < 0.85f) { float p = (c - 0.5f) / 0.35f; return i == 0 ? -1.35f * bump(p) : 0.25f * bump(p); } // sağ dizini omza atar
            return 0f;
        }
        float h = clamp01(s.v);
        float ts = since(s.sneakAt);
        if (ts < SLIP) return (float) Math.sin(ts / SLIP * Math.PI) * (i == 0 ? 0.9f : 0.4f); // ayak kayar
        float panic = Math.max(0f, 1f - (ts - SLIP) / 0.9f);                       // düşüş anındaki panik
        float cyc = t % 2.8f, kick = cyc < 0.7f ? (float) Math.sin(cyc / 0.7f * Math.PI) : 0f; // ara ara tekme
        float amp = Math.max(panic, kick * 0.75f);
        return (float) (Math.sin(t * 3.1f + ph) * 0.22f + Math.sin(t * 16f + ph) * 0.85f * amp) * h;
    }
}
