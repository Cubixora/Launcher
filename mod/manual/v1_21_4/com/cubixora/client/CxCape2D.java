package com.cubixora.client;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.Identifier;

/**
 * Ana menü önizlemesinde pelerin: dönen karakterle birlikte genişliği değişen düz bir levha olarak çizilir.
 * (Gerçek 3B pelerin yalnız oyun içi gardropta, dünyadaki oyuncu üzerinde görünür.)
 */
public final class CxCape2D {
    private CxCape2D() {}

    /** @param cx karakter ekseni, feetY ayakların y'si, s bir blok kaç piksel; behind: pelerin gövdenin arkasında (öne bakarken). */
    public static void draw(DrawContext c, float cx, float feetY, float s, float yawDeg, Identifier tex, boolean behind) {
        double rad = Math.toRadians(yawDeg);
        float cos = (float) Math.cos(rad), sin = (float) Math.sin(rad);
        float w = Math.max(2f, 10f / 16f * s * Math.abs(cos));
        float h = s * (1f - 0.05f * Math.abs(sin));
        float top = feetY - 1.5f * s + 0.02f * s;
        float off = 2.6f / 16f * s * sin;
        int x = Math.round(cx + off - w / 2f), y = Math.round(top), iw = Math.round(w), ih = Math.round(h);
        if (iw < 2 || ih < 4) return;
        int col = behind ? 0xFFA9A9B2 : 0xFFFFFFFF;
        int k = com.cubixora.cosmetics.CosmeticsManager.SCALE.getOrDefault(tex, 1);
        CxUi.tex(c, tex, x, y, (behind ? 12 : 1) * k, k, iw, ih, 10 * k, 16 * k, 64 * k, 32 * k, col);
    }

    /** Karakterin önü bize dönükse (yaw ≈ 0) pelerin gövdenin arkasında kalır. */
    public static boolean behind(float yawDeg) { return Math.cos(Math.toRadians(yawDeg)) > 0; }
}
