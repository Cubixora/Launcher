package com.cubixora.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;

/** Ortak çizim yardımcıları: renkler, yumuşak geçişler, köşeleri yuvarlatılmış paneller. */
public final class CxUi {
    public static final int ACCENT = 0xFFF5C542;     // Cubixora altın
    public static final int ACCENT_SOFT = 0x33F5C542;
    public static final int TEXT = 0xFFFFFFFF;
    public static final int MUTED = 0xFF9A9AA6;
    public static final int PANEL = 0xCC0E0F13;
    public static final int PANEL_LINE = 0x33FFFFFF;
    public static final int ONLINE = 0xFF3DDC84, IDLE = 0xFFF5B13D, DND = 0xFFFF5D5D, OFFLINE = 0xFF6B6B75;

    public static final Identifier LOGO = Identifier.fromNamespaceAndPath("cubixora", "textures/gui/logo.png");
    public static final Identifier MIC = Identifier.fromNamespaceAndPath("cubixora", "textures/gui/mic.png"), MIC_OFF = Identifier.fromNamespaceAndPath("cubixora", "textures/gui/mic_off.png");
    public static final Identifier GLOW = Identifier.fromNamespaceAndPath("cubixora", "textures/gui/glow.png");
    public static final int LOGO_W = 512, LOGO_H = 228;

    private CxUi() {}

    public static float clamp01(float v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    public static float easeOut(float t) { t = clamp01(t); return 1 - (1 - t) * (1 - t) * (1 - t); }
    public static float easeInOut(float t) { t = clamp01(t); return t < .5f ? 4 * t * t * t : 1 - (float) Math.pow(-2 * t + 2, 3) / 2; }
    public static float easeOutBack(float t) { t = clamp01(t); float c1 = 1.70158f, c3 = c1 + 1; return 1 + c3 * (float) Math.pow(t - 1, 3) + c1 * (float) Math.pow(t - 1, 2); }
    /** Bir değeri hedefe doğru kare hızından bağımsız yumuşakça yaklaştırır. */
    public static float approach(float cur, float target, float speed, float dt) { return cur + (target - cur) * (1 - (float) Math.exp(-speed * dt)); }

    public static int alpha(int argb, float a) {
        int al = Math.round(((argb >>> 24) & 0xFF) * clamp01(a));
        return (al << 24) | (argb & 0xFFFFFF);
    }
    public static int mix(int a, int b, float t) {
        t = clamp01(t);
        int aa = (a >>> 24) & 0xFF, ar = (a >> 16) & 0xFF, ag = (a >> 8) & 0xFF, ab = a & 0xFF;
        int ba = (b >>> 24) & 0xFF, br = (b >> 16) & 0xFF, bg = (b >> 8) & 0xFF, bb = b & 0xFF;
        return (Math.round(aa + (ba - aa) * t) << 24) | (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
    }

    /** Köşeleri yuvarlatılmış dolu dikdörtgen (r = 2..6 piksel). */
    public static void panel(GuiGraphicsExtractor c, int x, int y, int w, int h, float a) {
        round(c, x, y, w, h, 6, alpha(PANEL, a));
        c.fill(x + 6, y, x + w - 6, y + 1, alpha(PANEL_LINE, a));
    }

    /** Doku çizimi (sürüme özel). u,v,rw,rh: dokudaki bölge; w,h: ekrandaki boyut. */
    public static void tex(GuiGraphicsExtractor c, Identifier id, int x, int y, float u, float v, int w, int h, int rw, int rh, int tw, int th, int color) {
        c.blit(RenderPipelines.GUI_TEXTURED, id, x, y, u, v, w, h, rw, rh, tw, th, color);
    }

    public static void text(GuiGraphicsExtractor c, Font tr, String s, int x, int y, int color) { c.text(tr, s, x, y, color, false); }

    /** Ölçekli yazı (x,y sol üst). */
    public static void textScaled(GuiGraphicsExtractor c, Font tr, String s, float x, float y, float scale, int color, boolean shadow) {
        c.pose().pushMatrix();
        c.pose().translate(x, y);
        c.pose().scale(scale, scale);
        c.text(tr, s, 0, 0, color, shadow);
        c.pose().popMatrix();
    }

    /** (x,y) noktasına taşıyıp ölçekleyerek çizdirir. */
    public static void scaled(GuiGraphicsExtractor c, float x, float y, float scale, Runnable r) {
        c.pose().pushMatrix();
        c.pose().translate(x, y);
        c.pose().scale(scale, scale);
        r.run();
        c.pose().popMatrix();
    }

    // ---- küçük büyük harf (small caps) yazı stili: büyük harfe çevrilip küçültülür
    private static final java.util.Map<String, String> CAPS = new java.util.HashMap<>();
    public static final float CAPS_SCALE = 1f;
    public static String caps(String s) { String r = CAPS.get(s); if (r == null) { r = s.toUpperCase(new java.util.Locale("tr")); if (CAPS.size() > 600) CAPS.clear(); CAPS.put(s, r); } return r; }
    private static final java.util.Map<String, Component> CAPST = new java.util.HashMap<>();
    /** Küçük büyük harf yazı: ayrı "caps" yazı tipiyle (ölçekleme yok, keskin) üretilir. */
    private static String capsFont = "";
    public static Component capsText(String s) {
        String f = CxFonts.current() + "#" + CxFontFilter.gen;   // stil değişince ya da yazı tipleri yeniden yüklenince
        if (!f.equals(capsFont)) { CAPST.clear(); capsFont = f; }   // yazı stili değişince eski yazı tipindeki hazır metinler atılır
        Component t = CAPST.get(s);
        if (t == null) { t = CxFont.caps(caps(s)); if (CAPST.size() > 600) CAPST.clear(); CAPST.put(s, t); }
        return t;
    }
    public static int capsW(Font tr, String s) { return tr.width(capsText(s)); }
    public static void caps(GuiGraphicsExtractor c, Font tr, String s, float x, float y, int color) { c.text(tr, capsText(s), Math.round(x), Math.round(y), color, !CxStyle.light()); }
    /** Kutu içinde yatay + dikey ortalar; sığmazsa küçültür. Gölgeli. */
    public static void capsBox(GuiGraphicsExtractor c, Font tr, String s, int x, int y, int w, int h, int color) {
        Component t = capsText(s); int raw = Math.max(1, tr.width(t));
        int ty = y + Math.round(h / 2f - 4.4f);
        if (raw <= w - 6) { c.text(tr, t, x + Math.round((w - raw) / 2f), ty, color, !CxStyle.light()); return; }
        float sc = (w - 6f) / raw; final Component tt = t;
        scaled(c, x + (w - raw * sc) / 2f, y + h / 2f - 4.4f * sc, sc, () -> c.text(tr, tt, 0, 0, color, !CxStyle.light()));
    }

    /** Harf aralıklı, ortalanmış başlık. */
    public static void spaced(GuiGraphicsExtractor c, Font tr, String s, float cx, float y, float scale, float spacing, int color) {
        float w = 0;
        for (int i = 0; i < s.length(); i++) w += tr.width(String.valueOf(s.charAt(i))) * scale + (i < s.length() - 1 ? spacing : 0);
        float x = cx - w / 2f;
        for (int i = 0; i < s.length(); i++) {
            String ch = String.valueOf(s.charAt(i));
            textScaled(c, tr, ch, x, y, scale, color, false);
            x += tr.width(ch) * scale + spacing;
        }
    }

    /** Logoyu verilen genişlikte, merkezinden ölçekleyerek çizer. */
    public static void logo(GuiGraphicsExtractor c, float cx, float cy, float width, float alpha) {
        if (alpha <= 0.01f) return;
        int w = Math.round(width), h = Math.round(width * LOGO_H / LOGO_W);
        tex(c, LOGO, Math.round(cx - w / 2f), Math.round(cy - h / 2f), 0, 0, w, h, LOGO_W, LOGO_H, LOGO_W, LOGO_H, alpha(0xFFFFFFFF, alpha));
    }

    public static void glow(GuiGraphicsExtractor c, float cx, float cy, float size, int color) {
        int s = Math.round(size);
        tex(c, GLOW, Math.round(cx - s / 2f), Math.round(cy - s / 2f), 0, 0, s, s, 256, 256, 256, 256, color);
    }

    /** 1 piksellik yuvarlak köşeli çerçeve. */
    private static int cov(int color, double k) {
        if (k <= 0) return 0;
        if (k >= 1) return color;
        int al = Math.round(((color >>> 24) & 0xFF) * (float) k);
        return al == 0 ? 0 : (al << 24) | (color & 0xFFFFFF);
    }
    private static void px4(GuiGraphicsExtractor c, int x, int y, int w, int h, int r, int i, int j, int col) {
        if (col == 0) return;
        c.fill(x + j, y + i, x + j + 1, y + i + 1, col);
        c.fill(x + w - j - 1, y + i, x + w - j, y + i + 1, col);
        c.fill(x + j, y + h - i - 1, x + j + 1, y + h - i, col);
        c.fill(x + w - j - 1, y + h - i - 1, x + w - j, y + h - i, col);
    }
    /** Kenarları yumuşatılmış (kısmi saydamlıklı) yuvarlak dikdörtgen. */
    private static void roundSlow(GuiGraphicsExtractor c, int x, int y, int w, int h, int r, int color) {
        if (w <= 0 || h <= 0) return;
        r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        if (r == 0) { c.fill(x, y, x + w, y + h, color); return; }
        c.fill(x + r, y, x + w - r, y + h, color);
        c.fill(x, y + r, x + r, y + h - r, color);
        c.fill(x + w - r, y + r, x + w, y + h - r, color);
        for (int i = 0; i < r; i++) {
            double dy = r - i - 0.5;
            double edge = r - Math.sqrt(Math.max(0, r * r - dy * dy));
            int from = (int) Math.ceil(edge - 0.5);
            from = Math.max(0, Math.min(r, from));
            if (from < r) {
                c.fill(x + from, y + i, x + r, y + i + 1, color);
                c.fill(x + w - r, y + i, x + w - from, y + i + 1, color);
                c.fill(x + from, y + h - i - 1, x + r, y + h - i, color);
                c.fill(x + w - r, y + h - i - 1, x + w - from, y + h - i, color);
            }
            for (int j = Math.max(0, from - 1); j < from + 1 && j < r; j++) {
                if (j >= from) continue;
                double d = Math.hypot(r - (j + 0.5), dy);
                px4(c, x, y, w, h, r, i, j, cov(color, r - d + 0.5));
            }
        }
    }

    private static final Identifier[] RR_F = new Identifier[17], RR_O = new Identifier[17];
    static {
        for (int i = 1; i <= 16; i++) { RR_F[i] = Identifier.fromNamespaceAndPath("cubixora", "textures/gui/rr/f" + i + ".png"); RR_O[i] = Identifier.fromNamespaceAndPath("cubixora", "textures/gui/rr/o" + i + ".png"); }
    }
    /** Köşe dokuları 4 kat çözünürlüklü ve doğrusal süzgeçli: her GUI ölçeğinde pürüzsüz yay. */
    private static void corners(GuiGraphicsExtractor c, Identifier t, int x, int y, int w, int h, int r, int color) {
        final int k = 4, q = r * k, d = q * 2;
        tex(c, t, x, y, 0, 0, r, r, q, q, d, d, color);
        tex(c, t, x + w - r, y, q, 0, r, r, q, q, d, d, color);
        tex(c, t, x, y + h - r, 0, q, r, r, q, q, d, d, color);
        tex(c, t, x + w - r, y + h - r, q, q, r, r, q, q, d, d, color);
    }
    /** Kenarları yumuşatılmış yuvarlak dikdörtgen: 4 köşe dokusu + 3 düz dolgu (eskiden onlarca dolgu çiziliyordu). */
    public static void round(GuiGraphicsExtractor c, int x, int y, int w, int h, int r, int color) {
        if (w <= 0 || h <= 0 || (color >>> 24) == 0) return;
        r = Math.max(0, Math.min(Math.min(r, 16), Math.min(w, h) / 2));
        if (r == 0) { c.fill(x, y, x + w, y + h, color); return; }
        if (r > 16) { roundSlow(c, x, y, w, h, r, color); return; }
        c.fill(x + r, y, x + w - r, y + h, color);
        if (h > 2 * r) { c.fill(x, y + r, x + r, y + h - r, color); c.fill(x + w - r, y + r, x + w, y + h - r, color); }
        corners(c, RR_F[r], x, y, w, h, r, color);
    }
    /** 1 piksellik yumuşatılmış çerçeve: 4 köşe dokusu + 4 çizgi. */
    public static void outline(GuiGraphicsExtractor c, int x, int y, int w, int h, int r, int color) {
        if (w <= 1 || h <= 1 || (color >>> 24) == 0) return;
        r = Math.max(0, Math.min(Math.min(r, 16), Math.min(w, h) / 2));
        if (r == 0) {
            c.fill(x, y, x + w, y + 1, color); c.fill(x, y + h - 1, x + w, y + h, color);
            c.fill(x, y + 1, x + 1, y + h - 1, color); c.fill(x + w - 1, y + 1, x + w, y + h - 1, color);
            return;
        }
        if (r > 16) { outlineSlow(c, x, y, w, h, r, color); return; }
        c.fill(x + r, y, x + w - r, y + 1, color);
        c.fill(x + r, y + h - 1, x + w - r, y + h, color);
        if (h > 2 * r) { c.fill(x, y + r, x + 1, y + h - r, color); c.fill(x + w - 1, y + r, x + w, y + h - r, color); }
        corners(c, RR_O[r], x, y, w, h, r, color);
    }

    /** 1 piksellik yumuşatılmış çerçeve. */
    private static void outlineSlow(GuiGraphicsExtractor c, int x, int y, int w, int h, int r, int color) {
        if (w <= 1 || h <= 1) return;
        r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        c.fill(x + r, y, x + w - r, y + 1, color);
        c.fill(x + r, y + h - 1, x + w - r, y + h, color);
        c.fill(x, y + r, x + 1, y + h - r, color);
        c.fill(x + w - 1, y + r, x + w, y + h - r, color);
        for (int i = 0; i < r; i++) {
            double dy = r - i - 0.5;
            double xo = r - Math.sqrt(Math.max(0, r * r - dy * dy));
            double xi = dy < r - 1 ? r - Math.sqrt((r - 1) * (r - 1) - dy * dy) : r;
            int j0 = Math.max(0, (int) Math.floor(xo - 0.5)), j1 = Math.min(r - 1, (int) Math.ceil(xi + 0.5));
            for (int j = j0; j <= j1; j++) {
                double d = Math.hypot(r - (j + 0.5), dy);
                double ring = Math.max(0, Math.min(1, r - d + 0.5)) - Math.max(0, Math.min(1, r - 1 - d + 0.5));
                px4(c, x, y, w, h, r, i, j, cov(color, ring));
            }
        }
    }

    /** Cubixora kartı: yarı saydam koyu zemin + ince çerçeve + üstte ortadan parlayan marka çizgisi. */
    public static void card(GuiGraphicsExtractor c, int x, int y, int w, int h, int r, float a, boolean topGlow) {
        round(c, x, y, w, h, r, alpha(0xC2111821, a));
        outline(c, x, y, w, h, r, alpha(0x2EFFFFFF, a));
        if (topGlow) {
            int cx = x + w / 2, half = w / 2 - r - 2;
            for (int i = 0; i < 4; i++) {
                int seg = Math.round(half * (1 - i * 0.22f));
                c.fill(cx - seg, y + 1, cx + seg, y + 3, alpha(ACCENT, a * (0.10f + i * 0.08f)));
            }
        }
    }

    /** Cubixora ayar paneli zemini (temaya göre). */
    public static void sheet(GuiGraphicsExtractor c, int x, int y, int w, int h, int r, float a) {
        round(c, x, y, w, h, r, alpha(CxStyle.panel(), a));
        outline(c, x, y, w, h, r, alpha(CxStyle.panelBorder(), a));
    }

    /** Anahtar (switch). pos: 0 kapalı .. 1 açık. */
    public static void toggle(GuiGraphicsExtractor c, int x, int y, float pos, float hover, float a) {
        int w = 22, h = 12;
        round(c, x, y, w, h, 6, alpha(mix(CxStyle.switchOff(), CxStyle.accent(), pos), a));
        if (hover > 0.01f) round(c, x, y, w, h, 6, alpha(0x18FFFFFF, hover * a));
        int kx = x + 2 + Math.round(easeOut(pos) * (w - 12));
        round(c, kx, y + 2, 8, 8, 4, alpha(0xFFF7F8F9, a));
    }

    /** Kaydırıcı çizgisi + tutamaç. v: 0..1 */
    public static void slider(GuiGraphicsExtractor c, int x, int y, int w, float v, float hover, float a) {
        c.fill(x, y + 3, x + w, y + 5, alpha(CxStyle.track(), a));
        int fw = Math.round(w * clamp01(v));
        c.fill(x, y + 3, x + fw, y + 5, alpha(CxStyle.accent(), a));
        int k = 3 + Math.round(hover);
        round(c, x + fw - k, y + 4 - k, k * 2, k * 2, k, alpha(mix(CxStyle.accent(), 0xFFFFFFFF, 0.25f + hover * 0.25f), a));
    }

    /** Küçük düğme (Aç, Kaydet ve Kapat...). */
    public static void button(GuiGraphicsExtractor c, Font tr, String label, int x, int y, int w, int h, float hover, float a) {
        round(c, x, y, w, h, 4, alpha(mix(CxStyle.button(), CxStyle.buttonHover(), hover), a));
        outline(c, x, y, w, h, 4, alpha(CxStyle.panelBorder(), a * (0.6f + hover * 0.4f)));
        capsBox(c, tr, label, x, y, w, h, alpha(CxStyle.buttonText(), a));
    }

    public static final Identifier COIN = Identifier.fromNamespaceAndPath("cubixora", "textures/gui/coin.png");
    /** Launcher'daki gibi altın coin simgesi (sz x sz). */
    public static void coin(GuiGraphicsExtractor c, int x, int y, int sz, float a) {
        tex(c, COIN, x, y, 0, 0, sz, sz, 128, 128, 128, 128, alpha(0xFFFFFFFF, a));
    }

    private static java.util.List<Identifier> PRE; private static int preAt;
    /** Doku yüklemelerini kareler arasına yayar: ilk açılışta takılma (ilk kullanımda senkron yükleme) olmaz. */
    public static void preloadStep(Minecraft mc) {
        if (PRE == null) {
            PRE = new java.util.ArrayList<>();
            for (String n : new String[] { "bg/bg_sky", "bg/bg_far", "bg/bg_mid", "bg/bg_near", "bg/rain", "bg/warm", "coin", "glow", "logo" }) PRE.add(Identifier.fromNamespaceAndPath("cubixora", "textures/gui/" + n + ".png"));
            for (String n : new String[] { "cape", "wings", "hat", "pet", "effect", "emote", "spray" }) PRE.add(Identifier.fromNamespaceAndPath("cubixora", "textures/gui/icon/" + n + ".png"));
            for (int i = 1; i <= 16; i++) { PRE.add(RR_F[i]); PRE.add(RR_O[i]); }
        }
        // Zaman bütçeli: büyük dokular (arka plan) karede tek tek, küçükler birlikte yüklenir. Bir kare ~2 ms'den fazla
        // harcamaz; böylece açılış animasyonu sırasında hiçbir karede sıçrama (takılma) olmaz.
        long t0 = System.nanoTime();
        int big = 0;
        while (preAt < PRE.size()) {
            Identifier id = PRE.get(preAt);
            boolean heavy = id.getPath().contains("/bg/");
            if (heavy && big >= 1) break;
            try { mc.getTextureManager().getTexture(id); } catch (Throwable ignored) {}
            preAt++;
            if (heavy) big++;
            if (System.nanoTime() - t0 > 2_000_000L) break;
        }
    }

    /** Arayüz tıklama sesi. */
    public static void click() {
        Minecraft mc = Minecraft.getInstance();
        if (mc != null) mc.getSoundManager().play(SimpleSoundInstance.forUI(SoundEvents.UI_BUTTON_CLICK, 1f));
    }

    public static boolean inside(double mx, double my, int x, int y, int w, int h) { return mx >= x && mx < x + w && my >= y && my < y + h; }

    public static int statusColor(String s) {
        switch (s == null ? "" : s) {
            case "online": return ONLINE;
            case "idle": return IDLE;
            case "dnd": return DND;
            default: return OFFLINE;
        }
    }
}
