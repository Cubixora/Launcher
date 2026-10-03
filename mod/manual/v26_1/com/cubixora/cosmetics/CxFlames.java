package com.cubixora.cosmetics;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Ateş efekti (kırmızı / mavi): launcher önizlemesindeki alevlerin oyun içi karşılığı.
 * Alevler oyuncunun ayaklarının çevresinden doğar, titreyerek yükselir, küçülerek söner.
 * Çizim oyuncu katmanında, çapraz düzlemli küçük bir modelle yapılır (Minecraft ateş bloğu gibi);
 * böylece her açıdan dolgun görünür, kamera hesabı gerekmez. Yalnız istemcide; sunucuya hiçbir şey gitmez.
 * Bütçe: oyuncu başına en fazla 48 alev, saniyede ~32 yeni alev; görünmeyen oyuncunun hesabı yapılmaz.
 */
public final class CxFlames {
    private CxFlames() {}

    /** Bir alev: [x, yükseklik (blok, ayaktan yukarı), z, ölçek, saydamlık 0-1, titreme (dikey çarpan)]. */
    private static final class Sys {
        final ArrayList<float[]> live = new ArrayList<>();   // x, y, z, vy, ömür, yaş, boy, tohum
        long last; double acc; long seen;
        final ArrayList<float[]> out = new ArrayList<>();
    }
    private static final Map<String, Sys> SYS = new HashMap<>();
    private static final Random R = new Random();
    private static long sweepAt;
    private static final int MAX = 48;
    private static final float RATE = 32f;

    /** Bu kare için alevleri ilerletir ve çizilecek listeyi döndürür (aynı karede ikinci çağrı neredeyse bedava). */
    public static synchronized List<float[]> update(String name, String fx) {
        long now = System.nanoTime();
        Sys s = SYS.computeIfAbsent(name == null ? "" : name, k -> new Sys());
        float dt = s.last == 0 ? 0.016f : Math.min(0.1f, (now - s.last) / 1e9f);
        s.last = now; s.seen = now;
        // yeni alevler (kırmızı / mavi aynı hız)
        s.acc += dt * RATE;
        while (s.acc >= 1 && s.live.size() < MAX) {
            s.acc -= 1;
            double a = R.nextDouble() * Math.PI * 2, r = 0.45 + R.nextDouble() * 0.3;
            float life = 0.8f + R.nextFloat() * 0.5f;
            float size = 0.21f * (0.75f + R.nextFloat() * 0.5f);
            s.live.add(new float[] { (float) (Math.cos(a) * r), 0.05f + R.nextFloat() * 0.3f, (float) (Math.sin(a) * r),
                0.95f * (0.7f + R.nextFloat() * 0.6f), life, 0f, size, R.nextFloat() });
        }
        if (s.acc > 1) s.acc = 0;
        // ilerlet + çizim listesi
        double t = now / 1e9;
        int w = 0;
        while (s.out.size() < s.live.size()) s.out.add(new float[6]);
        int o = 0;
        for (int i = 0; i < s.live.size(); i++) {
            float[] q = s.live.get(i);
            q[5] += dt;
            if (q[5] >= q[4]) continue;
            q[1] += q[3] * dt;
            s.live.set(w++, q);
            float k = q[5] / q[4];
            float alpha = k < 0.12f ? k / 0.12f : 1f - Math.max(0f, (k - 0.5f) / 0.5f);
            // launcher'daki ile aynı boy: alev yüksekliği ≈ 3.2 × boy blok, yükseldikçe küçülür
            float h = 3.2f * q[6] * (1f - k * 0.55f);
            float flick = 1f + (float) Math.sin(t * 18 + q[7] * 20) * 0.09f;
            float[] d = s.out.get(o++);
            d[0] = q[0]; d[1] = q[1]; d[2] = q[2]; d[3] = h / 6f; d[4] = Math.max(0f, Math.min(1f, alpha)); d[5] = flick;
        }
        while (s.live.size() > w) s.live.remove(s.live.size() - 1);
        // uzun süredir görünmeyen oyuncuların kaydını at
        if (now - sweepAt > 5_000_000_000L) {
            sweepAt = now;
            for (Iterator<Map.Entry<String, Sys>> it = SYS.entrySet().iterator(); it.hasNext();) if (now - it.next().getValue().seen > 5_000_000_000L) it.remove();
        }
        return o == s.out.size() ? s.out : s.out.subList(0, o);
    }

    /** ARGB beyaz × saydamlık (model rengi). */
    public static int color(float alpha) { return ((int) (Math.max(0f, Math.min(1f, alpha)) * 255f) << 24) | 0xFFFFFF; }

    /** Efekt kimliği -> alev modeli. */
    public static String model(String fx) { return "ruh".equals(fx) ? "flame_blue" : "ates".equals(fx) ? "flame_red" : null; }
}
