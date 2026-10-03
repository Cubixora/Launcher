package com.cubixora.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.Identifier;
import net.minecraft.util.Util;

import java.util.Random;

/**
 * Cubixora menü arka planı: yağmurlu gece manzarası. Katmanlar (gökyüzü, uzak dağlar, orman, ön plan)
 * imlece göre hafif paralaks yapar; üzerinde iki katman yağmur kayar, ara sıra şimşek çakar.
 * Zaman tüm ekranlarda ortaktır; ekran değişince animasyon sıfırlanmaz, geçişler kesintisiz görünür.
 * Maliyeti düşüktür: kare başına ~80 doku dörtgeni.
 */
public final class CxBackground {
    private static Identifier id(String n) { return Identifier.of("cubixora", "textures/gui/bg/" + n + ".png"); }
    private static final Identifier SKY = id("bg_sky"), FAR = id("bg_far"), MID = id("bg_mid"), NEAR = id("bg_near"), RAIN = id("rain"), WARM = id("warm");
    private static final int BW = 640, BH = 360;
    private static final long START = Util.getMeasuringTimeMs();
    private static final Random RNG = new Random();
    private static float px, py;
    private static long last, flashStart = -1, nextFlash = START + 7000;
    /** Şimşekten sonra gök gürültüsünün çalınacağı an (CxAmbience okur). */
    public static volatile long thunderAt;

    private CxBackground() {}

    public static void render(DrawContext c, int w, int h, float alpha) {
        long now = Util.getMeasuringTimeMs();
        float dt = last == 0 ? 0 : Math.min(0.1f, (now - last) / 1000f);
        last = now;
        float t = (now - START) / 1000f;

        // imleç paralaksı (yumuşatılmış)
        MinecraftClient mc = MinecraftClient.getInstance();
        float mx = 0, my = 0;
        boolean perf = CxClient.settings.perfMode;
        if (perf) {   // Performans Modu: sabit, ucuz arka plan
            c.fill(0, 0, w, h, CxUi.alpha(0xFF070B14, alpha));
            float sc0 = Math.max(w / (float) BW, h / (float) BH);
            int dw0 = (int) Math.ceil(BW * sc0), dh0 = (int) Math.ceil(BH * sc0), bx0 = (w - dw0) / 2, by0 = (h - dh0) / 2, wh = CxUi.alpha(0xFFFFFFFF, alpha);
            CxUi.tex(c, SKY, bx0, by0, 0, 0, dw0, dh0, BW, BH, BW, BH, wh);
            CxUi.tex(c, MID, bx0, by0, 0, 0, dw0, dh0, BW, BH, BW, BH, wh);
            CxUi.tex(c, NEAR, bx0, by0, 0, 0, dw0, dh0, BW, BH, BW, BH, wh);
            c.fillGradient(0, h - h / 3, w, h, 0, CxUi.alpha(0xB3000000, alpha));
            return;
        }
        if (mc != null && mc.getWindow().getWidth() > 0) {
            mx = (float) (mc.mouse.getX() / mc.getWindow().getWidth()) - 0.5f;
            my = (float) (mc.mouse.getY() / mc.getWindow().getHeight()) - 0.5f;
        }
        px = CxUi.approach(px, mx, 2.5f, dt);
        py = CxUi.approach(py, my, 2.5f, dt);

        float scale = Math.max(w / (float) BW, h / (float) BH) * 1.06f;
        int dw = (int) Math.ceil(BW * scale), dh = (int) Math.ceil(BH * scale);
        int bx = (w - dw) / 2, by = (h - dh) / 2;
        int white = CxUi.alpha(0xFFFFFFFF, alpha);

        c.fill(0, 0, w, h, CxUi.alpha(0xFF070B14, alpha));
        layer(c, SKY, bx, by, dw, dh, 3, white);

        // şimşek
        boolean fx = CxClient.settings.rain;
        float flash = 0;
        if (fx) {
            if (now >= nextFlash) {
                flashStart = now;
                nextFlash = now + 9000 + RNG.nextInt(14000);
                thunderAt = now + 350 + RNG.nextInt(1100);
            }
            if (flashStart > 0) {
                float e = (now - flashStart) / 1000f;
                flash = e < 0.07f ? 1f : e < 0.15f ? 0.25f : e < 0.22f ? 0.85f : Math.max(0, 0.85f * (float) Math.exp(-(e - 0.22f) * 5));
                if (e > 2) flashStart = -1;
            }
            if (flash > 0.003f) c.fill(0, 0, w, h, CxUi.alpha(0xFFB9C9E6, flash * 0.30f * alpha));
        }

        layer(c, FAR, bx, by, dw, dh, 6, white);
        layer(c, MID, bx, by, dw, dh, 10, white);
        layer(c, NEAR, bx, by, dw, dh, 15, white);

        // kulübe penceresinin sıcak ışığı (hafif titrer)
        float flick = 0.55f + 0.12f * (float) Math.sin(t * 7.3f) + 0.06f * (float) Math.sin(t * 13.1f + 1);
        float gx = bx + 120.5f * scale - px * 15, gy = by + 293 * scale - py * 15 * 0.5f;
        CxUi.tex(c, WARM, Math.round(gx - 24 * scale), Math.round(gy - 24 * scale), 0, 0, Math.round(48 * scale), Math.round(48 * scale), 64, 64, 64, 64,
                CxUi.alpha(0xFFFFFFFF, flick * 0.55f * alpha));

        // yağmur: uzak (küçük, yavaş) ve yakın (büyük, hızlı) katmanlar
        if (fx) {
            rain(c, w, h, t, 0.55f * scale, h * 0.85f, CxUi.alpha(0xFFFFFFFF, 0.30f * alpha));
            rain(c, w, h, t + 3.1f, 1.05f * scale, h * 1.55f, CxUi.alpha(0xFFFFFFFF, 0.42f * alpha));
        }

        // vinyet
        c.fillGradient(0, 0, w, h / 3, CxUi.alpha(0x8C000000, alpha), 0);
        c.fillGradient(0, h - h / 3, w, h, 0, CxUi.alpha(0xB3000000, alpha));
    }

    private static void layer(DrawContext c, Identifier tex, int bx, int by, int dw, int dh, float depth, int color) {
        float ox = -px * depth, oy = -py * depth * 0.5f;   // kesirli kaydırma: piksel sıçraması yok
        CxUi.scaled(c, ox, oy, 1f, () -> CxUi.tex(c, tex, bx, by, 0, 0, dw, dh, BW, BH, BW, BH, color));
    }

    private static void rain(DrawContext c, int w, int h, float t, float scale, float speed, int color) {
        int ts = Math.max(24, Math.round(128 * scale));
        float oy = (t * speed) % ts, ox = (-(t * speed) * 0.22f) % ts;
        if (ox < 0) ox += ts;
        int ix = (int) Math.floor(ox), iy = (int) Math.floor(oy);
        float fx = ox - ix, fy = oy - iy;
        int startX = ix - ts, startY = iy - ts;
        CxUi.scaled(c, fx, fy, 1f, () -> {
            for (int y = startY; y < h; y += ts)
                for (int x = startX; x < w; x += ts)
                    CxUi.tex(c, RAIN, x, y, 0, 0, ts, ts, 128, 128, 128, 128, color);
        });
    }
}
