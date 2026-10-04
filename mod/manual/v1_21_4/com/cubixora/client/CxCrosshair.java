package com.cubixora.client;

import net.minecraft.client.gui.DrawContext;

/** Özel nişangah çizimi (oyun içi ve editör önizlemesi). */
public final class CxCrosshair {
    private CxCrosshair() {}

    public static final String[] COLOR_NAMES = {"YEŞİL", "KIRMIZI", "BEYAZ", "SARI", "MAVİ", "CAMGÖBEĞİ", "PEMBE"};
    public static final int[] COLORS = {0x00FF00, 0xFF3B3B, 0xFFFFFF, 0xFFE03B, 0x3B8BFF, 0x3BFFF0, 0xFF5AD2};

    public static String colorName(int rgb) {
        for (int i = 0; i < COLORS.length; i++) if (COLORS[i] == (rgb & 0xFFFFFF)) return COLOR_NAMES[i];
        return "ÖZEL";
    }
    public static int nextColor(int rgb) {
        for (int i = 0; i < COLORS.length; i++) if (COLORS[i] == (rgb & 0xFFFFFF)) return COLORS[(i + 1) % COLORS.length];
        return COLORS[0];
    }

    /** Ayarlara göre (cx, cy) merkezine nişangah çizer. s: ölçek (piksel çarpanı). */
    public static void draw(DrawContext c, int cx, int cy, CxClient.Settings st, int s) {
        int col = 0xFF000000 | (st.crossColor & 0xFFFFFF);
        int gap = st.crossGap * s, len = st.crossLength * s, th = Math.max(1, st.crossThick * s), o = st.crossOutline ? Math.max(1, st.crossOutlineThick * s) : 0;
        int half = th / 2;
        // sol, sağ, alt, üst (T tipinde üst çizgi yok)
        rect(c, cx - gap - len, cy - half, len, th, col, o);
        rect(c, cx + gap + (th % 2), cy - half, len, th, col, o);
        rect(c, cx - half, cy + gap + (th % 2), th, len, col, o);
        if (!st.crossT) rect(c, cx - half, cy - gap - len, th, len, col, o);
        if (st.crossDot) rect(c, cx - half, cy - half, th, th, col, o);
    }

    private static void rect(DrawContext c, int x, int y, int w, int h, int col, int o) {
        if (o > 0) c.fill(x - o, y - o, x + w + o, y + h + o, 0xC0000000);
        c.fill(x, y, x + w, y + h, col);
    }

    public static boolean active() { return CxClient.enabled && CxClient.settings != null && CxClient.settings.crossOn; }

    public static String code(CxClient.Settings st) {
        int c = st.crossColor & 0xFFFFFF;
        return ((c >> 16) & 255) + "," + ((c >> 8) & 255) + "," + (c & 255) + "," + st.crossGap + "," + st.crossLength + "," + st.crossThick + ","
                + (st.crossDot ? 1 : 0) + "," + (st.crossOutline ? 1 : 0) + "," + st.crossOutlineThick + "," + (st.crossT ? 1 : 0);
    }

    public static boolean load(CxClient.Settings st, String code) {
        try {
            String[] p = code.trim().split(",");
            if (p.length < 10) return false;
            int[] v = new int[10];
            for (int i = 0; i < 10; i++) v[i] = Integer.parseInt(p[i].trim());
            st.crossColor = (clamp(v[0], 0, 255) << 16) | (clamp(v[1], 0, 255) << 8) | clamp(v[2], 0, 255);
            st.crossGap = clamp(v[3], 0, 10); st.crossLength = clamp(v[4], 0, 15); st.crossThick = clamp(v[5], 1, 5);
            st.crossDot = v[6] != 0; st.crossOutline = v[7] != 0; st.crossOutlineThick = clamp(v[8], 1, 3); st.crossT = v[9] != 0;
            return true;
        } catch (Exception e) { return false; }
    }
    private static int clamp(int v, int a, int b) { return Math.max(a, Math.min(b, v)); }
}
