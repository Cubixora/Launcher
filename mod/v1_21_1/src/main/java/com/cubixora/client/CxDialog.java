package com.cubixora.client;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Ayarlar ekranının üstünde açılan küçük pencereler (vurgu rengi, nişangah editörü, ses cihazları). */
public abstract class CxDialog {
    protected final MinecraftClient mc = MinecraftClient.getInstance();
    protected final CxClient.Settings st;
    protected int x, y, w, h;
    protected final long opened = System.currentTimeMillis();
    protected float dt;
    private long last;
    public boolean closed;
    private final Map<String, Float> hov = new HashMap<>();

    protected CxDialog(CxClient.Settings st) { this.st = st; }

    public abstract void layout(int sw, int sh);
    protected abstract void draw(DrawContext c, TextRenderer tr, int mx, int my, float a);
    public boolean click(double mx, double my) { return false; }
    public void drag(double mx, double my) {}
    public void release() {}
    public boolean scroll(double mx, double my, double amount) { return false; }
    public boolean key(int keyCode) { return false; }
    public void onEscape() { closed = true; }

    public final void render(DrawContext c, TextRenderer tr, int sw, int sh, int mx, int my) {
        long now = System.currentTimeMillis();
        dt = last == 0 ? 0 : Math.min(0.1f, (now - last) / 1000f);
        last = now;
        float a = CxUi.easeOut((now - opened) / 180f);
        c.fill(0, 0, sw, sh, CxUi.alpha(0x8C000000, a));
        int oy = Math.round((1 - a) * 8);
        y += oy;
        CxUi.sheet(c, x, y, w, h, 8, a);
        draw(c, tr, mx, my, a);
        y -= oy;
    }

    /** Animasyonlu küçük düğme; tıklama kontrolü için aynı dikdörtgeni over() ile sor. */
    protected void btn(DrawContext c, TextRenderer tr, String id, String label, int bx, int by, int bw, int bh, int mx, int my, float a) {
        float v = hov.getOrDefault(id, 0f);
        v = CxUi.approach(v, CxUi.inside(mx, my, bx, by, bw, bh) ? 1 : 0, 18, dt);
        hov.put(id, v);
        CxUi.button(c, tr, label, bx, by, bw, bh, v, a);
    }

    protected float hv(String id, boolean over) {
        float v = CxUi.approach(hov.getOrDefault(id, 0f), over ? 1 : 0, 18, dt);
        hov.put(id, v);
        return v;
    }

    public static String keyName(int key) {
        if (key <= 0) return "—";
        String n = null;
        try { n = GLFW.glfwGetKeyName(key, 0); } catch (Throwable ignored) {}
        if (n != null && !n.isEmpty()) return n.toUpperCase(java.util.Locale.ROOT);
        switch (key) {
            case GLFW.GLFW_KEY_LEFT_SHIFT: return "SOL SHIFT";
            case GLFW.GLFW_KEY_RIGHT_SHIFT: return "SAĞ SHIFT";
            case GLFW.GLFW_KEY_LEFT_CONTROL: return "SOL CTRL";
            case GLFW.GLFW_KEY_RIGHT_CONTROL: return "SAĞ CTRL";
            case GLFW.GLFW_KEY_LEFT_ALT: return "SOL ALT";
            case GLFW.GLFW_KEY_RIGHT_ALT: return "SAĞ ALT";
            case GLFW.GLFW_KEY_TAB: return "TAB";
            case GLFW.GLFW_KEY_CAPS_LOCK: return "CAPS";
            case GLFW.GLFW_KEY_SPACE: return "BOŞLUK";
            case GLFW.GLFW_KEY_ENTER: return "ENTER";
            case GLFW.GLFW_KEY_BACKSPACE: return "SİL";
            case GLFW.GLFW_KEY_INSERT: return "INSERT";
            case GLFW.GLFW_KEY_DELETE: return "DELETE";
            case GLFW.GLFW_KEY_HOME: return "HOME";
            case GLFW.GLFW_KEY_END: return "END";
            case GLFW.GLFW_KEY_PAGE_UP: return "PGUP";
            case GLFW.GLFW_KEY_PAGE_DOWN: return "PGDN";
            case GLFW.GLFW_KEY_UP: return "YUKARI";
            case GLFW.GLFW_KEY_DOWN: return "AŞAĞI";
            case GLFW.GLFW_KEY_LEFT: return "SOL";
            case GLFW.GLFW_KEY_RIGHT: return "SAĞ";
            default:
                if (key >= GLFW.GLFW_KEY_F1 && key <= GLFW.GLFW_KEY_F25) return "F" + (key - GLFW.GLFW_KEY_F1 + 1);
                if (key >= GLFW.GLFW_KEY_KP_0 && key <= GLFW.GLFW_KEY_KP_9) return "NUM " + (key - GLFW.GLFW_KEY_KP_0);
                return "#" + key;
        }
    }

    // ------------------------------------------------------------------ Vurgu rengi
    public static final class Accent extends CxDialog {
        static final int[] SW = {0x547A58, 0x4A7BD0, 0x7B5CD6, 0xD05C9A, 0xE07B39, 0xC9A227, 0x2FA39A, 0x6B7785};
        private final int original;
        private int drag = -1;
        private float pv = 1;

        public Accent(CxClient.Settings st) { super(st); original = st.accent; }

        @Override public void layout(int sw, int sh) { w = Math.min(260, sw - 30); h = Math.min(214, sh - 20); x = (sw - w) / 2; y = (sh - h) / 2; }

        private int rgb(int i) { return (st.accent >> (16 - i * 8)) & 255; }
        private void setRgb(int i, int v) { int sh = 16 - i * 8; st.accent = (st.accent & ~(255 << sh)) | (Math.max(0, Math.min(255, v)) << sh); }

        @Override protected void draw(DrawContext c, TextRenderer tr, int mx, int my, float a) {
            c.drawText(tr, "Vurgu rengi", x + 14, y + 12, CxUi.alpha(CxStyle.text(), a), false);
            int n = SW.length, gap = 5, sw = (w - 28 - gap * (n - 1)) / n;
            for (int i = 0; i < n; i++) {
                int sx = x + 14 + i * (sw + gap), sy = y + 28;
                boolean sel = (st.accent & 0xFFFFFF) == SW[i];
                float v = hv("sw" + i, CxUi.inside(mx, my, sx, sy, sw, 14));
                CxUi.round(c, sx, sy, sw, 14, 4, CxUi.alpha(0xFF000000 | SW[i], a));
                if (sel || v > 0.01f) CxUi.outline(c, sx - 1, sy - 1, sw + 2, 16, 5, CxUi.alpha(sel ? 0xFFFFFFFF : 0x88FFFFFF, a * (sel ? 1 : v)));
            }
            // HEX
            int fy = y + 52;
            c.drawText(tr, "HEX", x + 14, fy + 4, CxUi.alpha(CxStyle.muted(), a), false);
            CxUi.round(c, x + 44, fy, w - 58, 15, 4, CxUi.alpha(CxStyle.field(), a));
            c.drawText(tr, String.format("#%06X", st.accent & 0xFFFFFF), x + 50, fy + 4, CxUi.alpha(CxStyle.text(), a), false);
            // R G B
            String[] lab = {"R", "G", "B"};
            for (int i = 0; i < 3; i++) {
                int ry = y + 76 + i * 15;
                c.drawText(tr, lab[i], x + 14, ry, CxUi.alpha(CxStyle.muted(), a), false);
                CxUi.slider(c, x + 30, ry - 1, w - 80, rgb(i) / 255f, drag == i ? 1 : hv("s" + i, CxUi.inside(mx, my, x + 26, ry - 4, w - 72, 12)), a);
                String v = String.valueOf(rgb(i));
                c.drawText(tr, v, x + w - 14 - tr.getWidth(v), ry, CxUi.alpha(CxStyle.muted(), a), false);
            }
            // önizleme kartı
            int py = y + 124;
            CxUi.round(c, x + 14, py, w - 28, 36, 6, CxUi.alpha(CxStyle.selected(), a));
            c.drawText(tr, "Cubixora Client", x + 22, py + 8, CxUi.alpha(CxStyle.text(), a), false);
            c.drawText(tr, "Sana ait bir görünüm", x + 22, py + 21, CxStyle.accent(a), false);
            pv = CxUi.approach(pv, 1, 10, dt);
            CxUi.toggle(c, x + w - 44, py + 12, pv, 0, a);
            // düğmeler
            int bw = (w - 28 - 12) / 3, by = y + h - 28;
            btn(c, tr, "def", "Varsayılan", x + 14, by, bw, 16, mx, my, a);
            btn(c, tr, "cancel", "Vazgeç", x + 20 + bw, by, bw, 16, mx, my, a);
            btn(c, tr, "ok", "Uygula", x + 26 + bw * 2, by, bw, 16, mx, my, a);
        }

        @Override public boolean click(double mx, double my) {
            int n = SW.length, gap = 5, sw = (w - 28 - gap * (n - 1)) / n;
            for (int i = 0; i < n; i++) if (CxUi.inside(mx, my, x + 14 + i * (sw + gap), y + 28, sw, 14)) { st.accent = SW[i]; CxUi.click(); return true; }
            for (int i = 0; i < 3; i++) if (CxUi.inside(mx, my, x + 26, y + 72 + i * 15, w - 72, 12)) { drag = i; drag(mx, my); return true; }
            int bw = (w - 28 - 12) / 3, by = y + h - 28;
            if (CxUi.inside(mx, my, x + 14, by, bw, 16)) { st.accent = 0x547A58; CxUi.click(); return true; }
            if (CxUi.inside(mx, my, x + 20 + bw, by, bw, 16)) { st.accent = original; closed = true; CxUi.click(); return true; }
            if (CxUi.inside(mx, my, x + 26 + bw * 2, by, bw, 16)) { closed = true; CxUi.click(); return true; }
            return CxUi.inside(mx, my, x, y, w, h);
        }
        @Override public void drag(double mx, double my) { if (drag >= 0) setRgb(drag, Math.round(CxUi.clamp01((float) ((mx - (x + 30)) / (w - 80))) * 255)); }
        @Override public void release() { drag = -1; }
        @Override public void onEscape() { st.accent = original; closed = true; }
    }

    // ------------------------------------------------------------------ Nişangah editörü
    public static final class Crosshair extends CxDialog {
        static final String[] TABS = {"Genel", "Nokta", "Kenarlık", "Çizgi"};
        private int tab;
        private boolean lightBg;
        private final CxForm form = new CxForm();
        private String toast = ""; private long toastAt;

        public Crosshair(CxClient.Settings st) { super(st); build(); }

        private void build() {
            form.clear(); form.dividers = true;
            switch (tab) {
                case 0:
                    form.button("Renk", "", () -> CxCrosshair.colorName(st.crossColor), () -> st.crossColor = CxCrosshair.nextColor(st.crossColor));
                    form.slider("Özel Kırmızı", "", () -> (st.crossColor >> 16) & 255, v -> st.crossColor = (st.crossColor & 0x00FFFF) | (v << 16), 0, 255, 1, String::valueOf);
                    form.slider("Özel Yeşil", "", () -> (st.crossColor >> 8) & 255, v -> st.crossColor = (st.crossColor & 0xFF00FF) | (v << 8), 0, 255, 1, String::valueOf);
                    form.slider("Özel Mavi", "", () -> st.crossColor & 255, v -> st.crossColor = (st.crossColor & 0xFFFF00) | v, 0, 255, 1, String::valueOf);
                    form.button("T Tipi", "", () -> st.crossT ? "Açık" : "Kapalı", () -> st.crossT = !st.crossT);
                    break;
                case 1:
                    form.button("Merkez Nokta", "", () -> st.crossDot ? "Açık" : "Kapalı", () -> st.crossDot = !st.crossDot);
                    break;
                case 2:
                    form.button("Kenarlık", "", () -> st.crossOutline ? "Açık" : "Kapalı", () -> st.crossOutline = !st.crossOutline);
                    form.slider("Kenarlık Kalınlığı", "", () -> st.crossOutlineThick, v -> st.crossOutlineThick = v, 1, 3, 1, String::valueOf);
                    break;
                default:
                    form.slider("Boşluk", "", () -> st.crossGap, v -> st.crossGap = v, 0, 10, 1, String::valueOf);
                    form.slider("Uzunluk", "", () -> st.crossLength, v -> st.crossLength = v, 0, 15, 1, String::valueOf);
                    form.slider("Kalınlık", "", () -> st.crossThick, v -> st.crossThick = v, 1, 5, 1, String::valueOf);
            }
        }

        @Override public void layout(int sw, int sh) {
            w = Math.min(400, sw - 24); h = Math.min(260, sh - 16); x = (sw - w) / 2; y = (sh - h) / 2;
        }

        private int leftW() { return Math.max(120, Math.round(w * 0.36f)); }

        @Override protected void draw(DrawContext c, TextRenderer tr, int mx, int my, float a) {
            c.drawText(tr, "Nişangah Editörü", x + 12, y + 10, CxStyle.accent(a), false);
            int lw = leftW();
            // önizleme
            int px = x + 12, py = y + 26, pw = lw - 12, ph = Math.max(60, h - 128);
            c.fill(px, py, px + pw, py + ph, CxUi.alpha(lightBg ? 0xFFB9C4CE : 0xFF1A1D26, a));
            c.drawText(tr, "Önizleme", px + 5, py + 5, CxUi.alpha(lightBg ? 0xFF2A2F36 : 0xFF9AA0AA, a), false);
            CxCrosshair.draw(c, px + pw / 2, py + ph / 2, st, 2);
            btn(c, tr, "bg", lightBg ? "Arka: Açık" : "Arka: Koyu", px + pw / 2 - 34, py + ph - 16, 68, 13, mx, my, a);
            int cy = py + ph + 8;
            c.drawText(tr, "Nişangah Kodu:", px, cy, CxUi.alpha(CxStyle.muted(), a), false);
            CxUi.round(c, px, cy + 10, pw, 15, 3, CxUi.alpha(CxStyle.field(), a));
            c.drawText(tr, tr.trimToWidth(CxCrosshair.code(st), pw - 8), px + 4, cy + 14, CxUi.alpha(CxStyle.text(), a), false);
            int hb = (pw - 6) / 2;
            btn(c, tr, "copy", "Kopyala", px, cy + 30, hb, 14, mx, my, a);
            btn(c, tr, "load", "Yükle", px + hb + 6, cy + 30, hb, 14, mx, my, a);
            btn(c, tr, "reset", "Varsayılana Sıfırla", px, cy + 48, pw, 14, mx, my, a);
            // sağ taraf
            int rx = x + lw + 12, rw = w - lw - 24;
            btn(c, tr, "onoff", st.crossOn ? "Nişangah Açık" : "Nişangah Kapalı", rx + rw - 100, y + 7, 100, 15, mx, my, a);
            int tw = (rw - 3 * 3) / TABS.length;
            for (int i = 0; i < TABS.length; i++) {
                int tx = rx + i * (tw + 3), ty = y + 28;
                float v = hv("tab" + i, CxUi.inside(mx, my, tx, ty, tw, 14));
                boolean on = tab == i;
                CxUi.round(c, tx, ty, tw, 14, 3, CxUi.alpha(on ? CxUi.mix(CxStyle.button(), CxStyle.accent(), 0.35f) : CxUi.mix(CxStyle.button(), CxStyle.buttonHover(), v), a));
                if (on) CxUi.outline(c, tx, ty, tw, 14, 3, CxStyle.accent(a));
                String s = TABS[i];
                c.drawText(tr, s, tx + (tw - tr.getWidth(s)) / 2, ty + 4, CxUi.alpha(on ? 0xFFFFFFFF : CxStyle.muted(), a), false);
            }
            form.x = rx; form.y = y + 48; form.w = rw; form.h = h - 48 - 34;
            form.render(c, tr, mx, my, a);
            btn(c, tr, "save", "Kaydet & Kapat", x + w / 2 - 50, y + h - 24, 100, 16, mx, my, a);
            if (!toast.isEmpty() && System.currentTimeMillis() - toastAt < 1600)
                c.drawText(tr, toast, x + w / 2 - tr.getWidth(toast) / 2, y + h - 36, CxStyle.accent(a), false);
        }

        @Override public boolean click(double mx, double my) {
            int lw = leftW(), px = x + 12, py = y + 26, pw = lw - 12, ph = Math.max(60, h - 128), cy = py + ph + 8, hb = (pw - 6) / 2;
            int rx = x + lw + 12, rw = w - lw - 24, tw = (rw - 9) / TABS.length;
            if (CxUi.inside(mx, my, px + pw / 2 - 34, py + ph - 16, 68, 13)) { lightBg = !lightBg; CxUi.click(); return true; }
            if (CxUi.inside(mx, my, px, cy + 30, hb, 14)) { mc.keyboard.setClipboard(CxCrosshair.code(st)); toast = "Kopyalandı"; toastAt = System.currentTimeMillis(); CxUi.click(); return true; }
            if (CxUi.inside(mx, my, px + hb + 6, cy + 30, hb, 14)) { toast = CxCrosshair.load(st, mc.keyboard.getClipboard()) ? "Yüklendi" : "Geçersiz kod"; toastAt = System.currentTimeMillis(); CxUi.click(); return true; }
            if (CxUi.inside(mx, my, px, cy + 48, pw, 14)) { CxClient.Settings d = new CxClient.Settings(); st.crossColor = d.crossColor; st.crossGap = d.crossGap; st.crossLength = d.crossLength; st.crossThick = d.crossThick; st.crossDot = d.crossDot; st.crossOutline = d.crossOutline; st.crossOutlineThick = d.crossOutlineThick; st.crossT = d.crossT; CxUi.click(); return true; }
            if (CxUi.inside(mx, my, rx + rw - 100, y + 7, 100, 15)) { st.crossOn = !st.crossOn; CxUi.click(); return true; }
            for (int i = 0; i < TABS.length; i++) if (CxUi.inside(mx, my, rx + i * (tw + 3), y + 28, tw, 14)) { tab = i; build(); CxUi.click(); return true; }
            if (CxUi.inside(mx, my, x + w / 2 - 50, y + h - 24, 100, 16)) { closed = true; CxUi.click(); return true; }
            if (form.mouseClicked(mx, my)) return true;
            return CxUi.inside(mx, my, x, y, w, h);
        }
        @Override public void drag(double mx, double my) { form.mouseDragged(mx); }
        @Override public void release() { form.mouseReleased(); }
        @Override public boolean scroll(double mx, double my, double amount) { return form.mouseScrolled(mx, my, amount); }
    }

    // ------------------------------------------------------------------ Ses cihazları
    public static final class Voice extends CxDialog {
        private final CxForm form = new CxForm();
        private final List<String> inputs = new ArrayList<>(), outputs = new ArrayList<>();
        private boolean waitingKey;

        public Voice(CxClient.Settings st) {
            super(st);
            inputs.add(""); outputs.add("");
            CxBridge.raw("/voice/devices", "{}", o -> {
                if (o == null) return;
                if (o.has("inputs")) for (JsonElement e : o.getAsJsonArray("inputs")) { String s = label(e); if (!s.isEmpty() && !inputs.contains(s)) inputs.add(s); }
                if (o.has("outputs")) for (JsonElement e : o.getAsJsonArray("outputs")) { String s = label(e); if (!s.isEmpty() && !outputs.contains(s)) outputs.add(s); }
            });
            form.dividers = false;
            form.button("Giriş Cihazı (Mikrofon)", "", () -> dev(st.micDevice), () -> st.micDevice = next(inputs, st.micDevice));
            form.button("Çıkış Cihazı (Hoparlör/Kulaklık)", "", () -> dev(st.outDevice), () -> st.outDevice = next(outputs, st.outDevice));
            form.button("Konuşma Modu", "", () -> st.micMode == 2 ? "Bas-Konuş" : st.micMode == 1 ? "Ses Algılama" : "Kapalı", () -> { st.micMode = (st.micMode + 1) % 3; st.pushToTalk = st.micMode == 2; st.micChosen = true; });
            form.slider("Aktivasyon Eşiği", "", () -> st.vadThreshold, v -> st.vadThreshold = v, 0, 100, 1, v -> v + "%");
            form.button("Bas-Konuş Tuşu", "", () -> waitingKey ? "Bir tuşa bas…" : keyName(st.pttKey), () -> waitingKey = true);
            form.slider("Mikrofon Ses Seviyesi", "", () -> st.micVolume, v -> st.micVolume = v, 0, 200, 5, v -> v + "%");
            form.button("Yakınlık Sesi (Proximity)", "", () -> st.proximity ? "AÇIK" : "KAPALI", () -> st.proximity = !st.proximity);
            form.button("Yankı Engelleme (AEC)", "", () -> st.aec ? "AÇIK" : "KAPALI", () -> st.aec = !st.aec);
            form.button("Gürültü Engelleme (ANS)", "", () -> st.ans ? "AÇIK" : "KAPALI", () -> st.ans = !st.ans);
            form.button("Otomatik Ses Kazancı (AGC)", "", () -> st.agc ? "AÇIK" : "KAPALI", () -> st.agc = !st.agc);
        }

        private static String label(JsonElement e) {
            if (e.isJsonObject()) { JsonObject o = e.getAsJsonObject(); return o.has("label") ? o.get("label").getAsString() : ""; }
            return e.getAsString();
        }
        private static String dev(String s) { return s == null || s.isEmpty() ? "Varsayılan (Sistem)" : s; }
        private static String next(List<String> l, String cur) { int i = l.indexOf(cur == null ? "" : cur); return l.get((i + 1) % l.size()); }

        @Override public void layout(int sw, int sh) { w = Math.min(330, sw - 24); h = Math.min(300, sh - 16); x = (sw - w) / 2; y = (sh - h) / 2; }

        @Override protected void draw(DrawContext c, TextRenderer tr, int mx, int my, float a) {
            String t = "Cubixora Ses Ayarları";
            c.drawText(tr, t, x + (w - tr.getWidth(t)) / 2, y + 11, CxStyle.accent(a), false);
            form.x = x + 12; form.y = y + 28; form.w = w - 24; form.h = h - 28 - 34;
            form.render(c, tr, mx, my, a);
            btn(c, tr, "close", "Kapat ve Kaydet", x + w / 2 - 55, y + h - 26, 110, 17, mx, my, a);
        }
        @Override public boolean click(double mx, double my) {
            if (CxUi.inside(mx, my, x + w / 2 - 55, y + h - 26, 110, 17)) { closed = true; CxUi.click(); return true; }
            if (form.mouseClicked(mx, my)) return true;
            return CxUi.inside(mx, my, x, y, w, h);
        }
        @Override public boolean key(int keyCode) {
            if (!waitingKey) return false;
            waitingKey = false;
            if (keyCode != GLFW.GLFW_KEY_ESCAPE) st.pttKey = keyCode;
            return true;
        }
        @Override public void drag(double mx, double my) { form.mouseDragged(mx); }
        @Override public void release() { form.mouseReleased(); }
        @Override public boolean scroll(double mx, double my, double amount) { return form.mouseScrolled(mx, my, amount); }
    }

    // ------------------------------------------------------------------ Yazı stili
    public static final class Fonts extends CxDialog {
        private int scroll, maxScroll;
        private static final int ROW = 24;
        public Fonts(CxClient.Settings st) { super(st); }

        @Override public void layout(int sw, int sh) { w = Math.min(300, sw - 24); h = Math.min(270, sh - 16); x = (sw - w) / 2; y = (sh - h) / 2; }

        @Override protected void draw(DrawContext c, TextRenderer tr, int mx, int my, float a) {
            String t = "Yazı Stili";
            c.drawText(tr, t, x + (w - tr.getWidth(t)) / 2, y + 11, CxStyle.accent(a), false);
            int lt = y + 28, lh = h - 28 - 32;
            maxScroll = Math.max(0, CxFonts.LIST.length * ROW - lh);
            scroll = Math.max(0, Math.min(maxScroll, scroll));
            String cur = CxFonts.current();
            c.enableScissor(x + 4, lt, x + w - 4, lt + lh);
            for (int i = 0; i < CxFonts.LIST.length; i++) {
                int ry = lt + i * ROW - scroll;
                if (ry + ROW < lt || ry > lt + lh) continue;
                String id = CxFonts.LIST[i][0];
                boolean sel = id.equals(cur), over = CxUi.inside(mx, my, x + 8, ry, w - 16, ROW - 3) && my >= lt && my < lt + lh;
                float hv = hv("f" + i, over);
                CxUi.round(c, x + 8, ry, w - 16, ROW - 3, 7, CxUi.alpha(CxUi.mix(CxStyle.button(), CxStyle.buttonHover(), hv), a));
                CxUi.outline(c, x + 8, ry, w - 16, ROW - 3, 7, sel ? CxStyle.accent(a) : CxUi.alpha(CxStyle.panelBorder(), a));
                c.drawText(tr, CxFont.sample(CxFonts.LIST[i][1], id), x + 16, ry + 7, CxUi.alpha(CxStyle.text(), a), true);
                if (sel) c.drawText(tr, "SEÇİLİ", x + w - 16 - tr.getWidth("SEÇİLİ"), ry + 7, CxStyle.accent(a), false);
            }
            c.disableScissor();
            if (maxScroll > 0) {
                int bh = Math.max(14, lh * lh / (CxFonts.LIST.length * ROW)), by = lt + (lh - bh) * scroll / maxScroll;
                CxUi.round(c, x + w - 6, by, 2, bh, 1, CxUi.alpha(0xFFFFFFFF, 0.25f * a));
            }
            btn(c, tr, "close", "Kapat", x + w / 2 - 45, y + h - 26, 90, 17, mx, my, a);
        }
        @Override public boolean click(double mx, double my) {
            if (CxUi.inside(mx, my, x + w / 2 - 45, y + h - 26, 90, 17)) { closed = true; CxUi.click(); return true; }
            int lt = y + 28, lh = h - 28 - 32;
            if (my >= lt && my < lt + lh) for (int i = 0; i < CxFonts.LIST.length; i++) {
                int ry = lt + i * ROW - scroll;
                if (CxUi.inside(mx, my, x + 8, ry, w - 16, ROW - 3)) { st.font = CxFonts.LIST[i][0]; CxUi.click(); return true; }
            }
            return CxUi.inside(mx, my, x, y, w, h);
        }
        @Override public boolean scroll(double mx, double my, double amount) { scroll = Math.max(0, Math.min(maxScroll, scroll - (int) Math.signum(amount) * ROW)); return true; }
    }
}
