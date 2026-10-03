package com.cubixora.client;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.resources.Identifier;
import net.minecraft.util.Util;

import java.util.Random;

/**
 * Mojang yükleme ekranının yerine geçen Cubixora açılışı. Oyun ilk açıldığında Minecraft'tan önce bu görünür:
 * küpler yükselir, CX logosu sekerek gelir, ışık halkası patlar, "CUBIXORA CLIENT" harf harf belirir ve
 * gerçek yükleme ilerlemesine bağlı çubuk dolar. Yükleme bitince doğrudan Cubixora ana menüsüne kararır.
 * Yazı tipi yüklenmeden önce de çizilebilmesi için yazılar piksel dokudan (wordmark.png) çizilir.
 */
public final class CxLoading {
    private static final Identifier WORD = Identifier.fromNamespaceAndPath("cubixora", "textures/gui/bg/wordmark.png");
    private static final int[][] CUBIXORA = {{0, 5}, {6, 5}, {12, 5}, {18, 3}, {22, 5}, {28, 5}, {34, 5}, {40, 5}};
    private static final int CUBIXORA_W = 45, CLIENT_W = 33;
    private static final float[][] CUBES = new float[42][5];
    private static long start = -1;
    private static float shown;
    private static long last;

    static {
        Random r = new Random(7);
        for (float[] c : CUBES) { c[0] = r.nextFloat(); c[1] = r.nextFloat(); c[2] = 2 + r.nextFloat() * 6; c[3] = 0.04f + r.nextFloat() * 0.12f; c[4] = r.nextFloat() * 6.28f; }
    }

    private CxLoading() {}

    /** @param initial oyunun ilk açılışı mı (tam animasyon + ses), yoksa kaynak paketi yeniden yüklemesi mi */
    public static void render(GuiGraphicsExtractor c, int w, int h, float progress, float alpha, boolean initial) {
        long now = Util.getMillis();
        if (start < 0) {
            start = now;
            if (initial && CxClient.settings.intro && CxClient.settings.introSound) CxBootSound.play(0.6f);
        }
        float dt = last == 0 ? 0 : Math.min(0.1f, (now - last) / 1000f);
        last = now;
        boolean anim = initial && CxClient.settings.intro;
        float t = anim ? (now - start) / 1000f : 10f;
        float a = CxUi.clamp01(alpha);
        if (a <= 0.003f) return;

        float cx = w / 2f, cy = h / 2f - 12;
        c.fill(0, 0, w, h, CxUi.alpha(0xFF050507, a));
        c.fillGradient(0, 0, w, h, CxUi.alpha(0xFF0E1018, a * CxUi.clamp01(t / 0.8f)), CxUi.alpha(0xFF050507, a));

        // yükselen küpler
        float ca = CxUi.clamp01(t / 0.6f) * a;
        for (float[] q : CUBES) {
            float y = ((q[1] - t * q[3]) % 1f + 1f) % 1f;
            int px = Math.round(q[0] * w + (float) Math.sin(t * 0.8f + q[4]) * 8), py = Math.round(y * h);
            int s = Math.round(q[2]);
            c.fill(px, py, px + s, py + s, CxUi.alpha(q[2] > 6 ? CxUi.ACCENT : 0xFFFFFFFF, ca * (0.06f + q[2] / 60f)));
        }

        // ışık halkası ve sürekli parlama
        float ring = (t - 1.0f) / 0.9f;
        if (ring > 0 && ring < 1) CxUi.glow(c, cx, cy, 80 + CxUi.easeOut(ring) * Math.max(w, h) * 0.9f, CxUi.alpha(CxUi.ACCENT, (1 - ring) * 0.5f * a));
        float pulse = 0.5f + 0.5f * (float) Math.sin(t * 3.2f);
        CxUi.glow(c, cx, cy, 200 + pulse * 30, CxUi.alpha(0xFFFFFFFF, CxUi.clamp01((t - 0.9f) / 0.4f) * (0.08f + pulse * 0.05f) * a));

        // logo
        float lp = (t - 0.25f) / 0.85f;
        float scale = 0.55f + 0.45f * CxUi.easeOutBack(lp);
        float logoW = Math.min(w * 0.32f, 210) * scale;
        CxUi.logo(c, cx, cy + (1 - CxUi.easeOut(lp)) * 30, logoW, CxUi.clamp01(lp * 1.6f) * a);

        // CUBIXORA (harf harf) + CLIENT (altın)
        int px = Math.max(1, Math.round(Math.min(w, 520) / 210f));
        float baseY = cy + Math.min(w * 0.32f, 210) * CxUi.LOGO_H / CxUi.LOGO_W / 2 + 14;
        int gap = px;
        int total = CUBIXORA_W * px + gap * 7;
        float x0 = cx - total / 2f;
        for (int i = 0; i < CUBIXORA.length; i++) {
            float p = CxUi.easeOut((t - 1.15f - i * 0.055f) / 0.35f);
            if (p <= 0) continue;
            int lx = Math.round(x0 + CUBIXORA[i][0] * px + i * gap), ly = Math.round(baseY + (1 - p) * 8);
            CxUi.tex(c, WORD, lx, ly, CUBIXORA[i][0], 0, CUBIXORA[i][1] * px, 7 * px, CUBIXORA[i][1], 7, 64, 16, CxUi.alpha(0xFFFFFFFF, p * a));
        }
        float cl = CxUi.easeOut((t - 1.75f) / 0.4f);
        if (cl > 0) {
            int sp = Math.max(1, px - 1);
            int cw = CLIENT_W * sp;
            CxUi.tex(c, WORD, Math.round(cx - cw / 2f), Math.round(baseY + 7 * px + 5 * sp), 0, 8, cw, 7 * sp, CLIENT_W, 7, 64, 16, CxUi.alpha(CxUi.ACCENT, cl * a));
        }

        // ilerleme çubuğu (gerçek yüklemeye bağlı, yumuşatılmış)
        shown = CxUi.approach(shown, Math.max(shown, CxUi.clamp01(progress)), 6, dt);
        float bw = Math.min(w * 0.3f, 220), by = h - 42;
        float ba = CxUi.clamp01((t - 1.2f) / 0.3f) * a;
        if (ba > 0) {
            int bx = Math.round(cx - bw / 2);
            CxUi.round(c, bx, Math.round(by), Math.round(bw), 3, 1, CxUi.alpha(0x26FFFFFF, ba));
            int fw = Math.max(2, Math.round(bw * shown));
            CxUi.round(c, bx, Math.round(by), fw, 3, 1, CxUi.alpha(CxUi.ACCENT, ba));
            // ucunda kayan parıltı
            CxUi.glow(c, bx + fw, by + 1.5f, 26, CxUi.alpha(CxUi.ACCENT, ba * 0.5f));
            // altında üç nokta
            for (int i = 0; i < 3; i++) {
                float d = 0.35f + 0.65f * (0.5f + 0.5f * (float) Math.sin(t * 6 - i * 0.9f));
                int dx = Math.round(cx - 8 + i * 6);
                c.fill(dx, Math.round(by + 10), dx + 2, Math.round(by + 12), CxUi.alpha(0xFFFFFFFF, ba * d * 0.6f));
            }
        }
    }

    /** Yeniden yüklemelerde animasyon baştan başlasın. */
    /** Kapanış sönmesinin başladığı an (0: başlamadı, -1: bitti). */
    public static long holdStart;
    public static float easeOut(float t) { t = Math.max(0f, Math.min(1f, t)); return 1f - (1f - t) * (1f - t) * (1f - t); }
    public static void reset() { start = -1; shown = 0; last = 0; holdStart = 0; }
}
