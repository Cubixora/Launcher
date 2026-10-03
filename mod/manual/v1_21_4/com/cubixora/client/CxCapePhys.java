package com.cubixora.client;

import java.util.HashMap;
import java.util.Map;

/**
 * Pelerin fiziği: pelerin 8 parçalı bir zincirdir; her eklem yaylı-sönümlü bir sarkaçtır.
 * Kök açı oyunun kendi pelerin hareketinden (hız, dönüş, eğilme) gelir, alt parçalar yerçekimi,
 * rüzgâr ve atalet ile geriden gelir; böylece pelerin gerçekten bükülerek dalgalanır.
 */
public final class CxCapePhys {
    public static final int N = 8;                 // parça sayısı (ilk parça oyunun kendi köküdür)
    private static final class Sim {
        final float[] a = new float[N], av = new float[N], b = new float[N], bv = new float[N];
        long last; boolean init; float phase;
    }
    private static final Map<Integer, Sim> SIMS = new HashMap<>();
    private static long cleanAt;

    private static float clamp(float v, float lo, float hi) { return v < lo ? lo : Math.min(v, hi); }

    /**
     * @param id        oyuncu kimliği (her oyuncunun kendi simülasyonu var)
     * @param rootPitch kökün öne/arkaya açısı (derece, oyunun hesabı)
     * @param rootRoll  kökün yana açısı (derece)
     * @param outP/outR eklem açıları (derece, göreli); index 1..N-1 kullanılır
     */
    public static void step(int id, float rootPitch, float rootRoll, float[] outP, float[] outR) {
        long now = System.nanoTime();
        if (now - cleanAt > 10_000_000_000L) { cleanAt = now; SIMS.values().removeIf(s -> now - s.last > 5_000_000_000L); }
        Sim s = SIMS.computeIfAbsent(id, k -> { Sim n = new Sim(); n.phase = (k * 0.7311f) % 6.283f; return n; });
        if (!s.init) { for (int i = 0; i < N; i++) { s.a[i] = rootPitch; s.b[i] = rootRoll; } s.init = true; s.last = now; }
        float dt = (now - s.last) / 1.0e9f; s.last = now;
        if (dt > 0.1f) dt = 0.1f;
        int steps = Math.max(1, (int) Math.ceil(dt / 0.008f));
        float h = dt / steps, t = now / 1.0e9f + s.phase;
        float flare = clamp((rootPitch - 6f) / 45f, 0f, 1f);                   // koşarken / uçarken artar
        for (int k = 0; k < steps; k++) {
            s.a[0] = rootPitch; s.av[0] = 0f; s.b[0] = rootRoll; s.bv[0] = 0f;
            for (int i = 1; i < N; i++) {
                float pos = (float) i / (N - 1);
                float kk = 150f - 60f * pos, c = 2f * 0.9f * (float) Math.sqrt(kk);   // neredeyse kritik sönümlü, uca doğru yumuşak
                float breeze = 2.2f * (float) Math.sin(t * 1.9f + i * 0.55f) + 1.2f * (float) Math.sin(t * 3.3f + i * 0.9f);
                float wind = (rootPitch - 6f) * (0.04f + 0.012f * i) + flare * 2.2f * (float) Math.sin(t * 9f + i * 0.85f);
                float target = 0.65f * s.a[i - 1] + 0.35f * s.a[0] + wind + breeze * (0.5f + 0.5f * pos);
                float acc = kk * (target - s.a[i]) - c * s.av[i] - 55f * (float) Math.sin(Math.toRadians(s.a[i])) * pos;
                s.av[i] += acc * h; s.a[i] += s.av[i] * h;
                float rel = clamp(s.a[i] - s.a[i - 1], -20f, 20f);               // aşırı katlanma yok
                s.a[i] = s.a[i - 1] + rel;
                if (s.a[i] < 1.5f) { s.a[i] = 1.5f; if (s.av[i] < 0f) s.av[i] = 0f; }  // vücuda girmesin
                float tb = s.b[i - 1] + flare * 2.4f * (float) Math.sin(t * 8f + i * 0.7f + 1.3f) + 0.5f * (float) Math.sin(t * 1.4f + i * 0.5f);
                float accb = kk * 0.85f * (tb - s.b[i]) - c * s.bv[i];
                s.bv[i] += accb * h; s.b[i] += s.bv[i] * h;
                s.b[i] = s.b[i - 1] + clamp(s.b[i] - s.b[i - 1], -22f, 22f);
            }
        }
        outP[0] = 0f; outR[0] = 0f;
        for (int i = 1; i < N; i++) { outP[i] = s.a[i] - s.a[i - 1]; outR[i] = s.b[i] - s.b[i - 1]; }
    }

    /** Pelerinin tek parça salınımı (derece): dururken bile yavaşça sallanır; hem açık hem kapalı modda geçerli. */
    public static float sway(int id) {
        float t = System.nanoTime() / 1.0e9f + (id * 0.7311f) % 6.283f;
        return 4.5f * (float) Math.sin(t * 1.7f) + 2.2f * (float) Math.sin(t * 2.9f + 1.1f);
    }

    public static void rigid(float[] outP, float[] outR) { for (int i = 0; i < N; i++) { outP[i] = 0f; outR[i] = 0f; } }
}
