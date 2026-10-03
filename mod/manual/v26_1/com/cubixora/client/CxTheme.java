package com.cubixora.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.resources.Identifier;
import net.minecraft.util.Util;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * Tüm vanilla (ve diğer modların) arayüzlerini Cubixora görünümüne çevirir.
 * Düğme, yazı kutusu, kaydırıcı, onay kutusu, sekme, kaydırma çubuğu kaplamaları ve
 * liste/başlık arka planları burada yeniden çizilir. Ekranların kendisine dokunulmaz;
 * yalnızca çizim çağrıları yakalanır, bu yüzden her ekranda çalışır ve ek yük getirmez.
 */
public final class CxTheme {
    private CxTheme() {}

    public static boolean on() { return CxClient.enabled; }

    private static boolean inWorld() {
        Minecraft mc = Minecraft.getInstance();
        return mc != null && mc.level != null;
    }

    // ---- üzerine gelme animasyonu: konuma göre küçük bir tablo ----
    private static final class Anim { float v; long seen; }
    private static final Map<Long, Anim> ANIM = new HashMap<>();
    private static long lastPrune;

    private static float anim(int x, int y, int w, int h, boolean target, float speed) {
        long now = Util.getMillis();
        long key = ((long) (x & 0xFFFF) << 48) | ((long) (y & 0xFFFF) << 32) | ((long) (w & 0xFFFF) << 16) | (h & 0xFFFF);
        Anim a = ANIM.get(key);
        if (a == null) { a = new Anim(); a.v = target ? 1 : 0; a.seen = now; ANIM.put(key, a); }
        float dt = Math.min(0.1f, (now - a.seen) / 1000f);
        a.seen = now;
        a.v = CxUi.approach(a.v, target ? 1 : 0, speed, dt);
        if (now - lastPrune > 2000) {
            lastPrune = now;
            for (Iterator<Anim> it = ANIM.values().iterator(); it.hasNext(); ) if (now - it.next().seen > 3000) it.remove();
        }
        return a.v;
    }

    // kaydırıcının son çizilen yolu (tutamaç dolgusu için)
    private static int sx, sy, sw, sh;

    /** GUI sprite çizimi. true dönerse vanilla çizimi iptal edilir. */
    public static boolean sprite(GuiGraphicsExtractor c, Identifier id, int x, int y, int w, int h, float alpha) {
        if (!on() || id == null || !"minecraft".equals(id.getNamespace())) return false;
        String p = id.getPath();
        if (!p.startsWith("widget/") && !p.startsWith("toast/")) return false;
        switch (p) {
            case "widget/button": button(c, x, y, w, h, false, true, alpha); return true;
            case "widget/button_highlighted": button(c, x, y, w, h, true, true, alpha); return true;
            case "widget/button_disabled": button(c, x, y, w, h, false, false, alpha); return true;
            case "widget/text_field": field(c, x, y, w, h, false, alpha); return true;
            case "widget/text_field_highlighted": field(c, x, y, w, h, true, alpha); return true;
            case "widget/slider": slider(c, x, y, w, h, false, alpha); return true;
            case "widget/slider_highlighted": slider(c, x, y, w, h, true, alpha); return true;
            case "widget/slider_handle": handle(c, x, y, w, h, false, alpha); return true;
            case "widget/slider_handle_highlighted": handle(c, x, y, w, h, true, alpha); return true;
            case "widget/checkbox": check(c, x, y, w, h, false, false, alpha); return true;
            case "widget/checkbox_highlighted": check(c, x, y, w, h, false, true, alpha); return true;
            case "widget/checkbox_selected": check(c, x, y, w, h, true, false, alpha); return true;
            case "widget/checkbox_selected_highlighted": check(c, x, y, w, h, true, true, alpha); return true;
            case "widget/tab": tab(c, x, y, w, h, false, false, alpha); return true;
            case "widget/tab_highlighted": tab(c, x, y, w, h, false, true, alpha); return true;
            case "widget/tab_selected": tab(c, x, y, w, h, true, false, alpha); return true;
            case "widget/tab_selected_highlighted": tab(c, x, y, w, h, true, true, alpha); return true;
            case "widget/scroller": CxUi.round(c, x + 1, y, Math.max(2, w - 2), h, 2, CxUi.alpha(0x88FFFFFF, alpha)); return true;
            case "widget/scroller_background": CxUi.round(c, x + 1, y, Math.max(2, w - 2), h, 2, CxUi.alpha(0x26000000, alpha)); return true;
            default: return false;
        }
    }

    /** Tam doku çizimi (ayırıcılar, liste/menü arka planları). true dönerse vanilla çizimi iptal edilir. */
    public static boolean texture(GuiGraphicsExtractor c, Identifier id, int x, int y, int w, int h) {
        if (!on() || id == null || !"minecraft".equals(id.getNamespace())) return false;
        String p = id.getPath();
        if (!p.startsWith("textures/gui/")) return false;
        switch (p) {
            case "textures/gui/header_separator.png":
            case "textures/gui/footer_separator.png":
            case "textures/gui/inworld_header_separator.png":
            case "textures/gui/inworld_footer_separator.png":
                separator(c, x, y, w); return true;
            case "textures/gui/menu_list_background.png":
            case "textures/gui/inworld_menu_list_background.png":
                return true;
            case "textures/gui/menu_background.png":
            case "textures/gui/inworld_menu_background.png":
                c.fill(x, y, x + w, y + h, inWorld() ? 0x99050507 : 0x33000000); return true;
            case "textures/gui/tab_header_background.png":
                c.fill(x, y, x + w, y + h, 0xB308090C); return true;
            default: return false;
        }
    }

    /** Liste seçim vurgusu (dünya listesi, sunucu listesi vb.). */
    public static void selection(GuiGraphicsExtractor c, int x, int y, int w, int h, boolean focused) {
        float f = anim(x, y, w, h, true, 16);
        CxUi.round(c, x, y, w, h, 4, CxUi.alpha(focused ? 0x40F5C542 : 0x2EFFFFFF, f));
        c.fill(x, y + 3, x + 2, y + h - 3, CxUi.alpha(focused ? CxUi.ACCENT : 0x99FFFFFF, f));
    }

    private static void separator(GuiGraphicsExtractor c, int x, int y, int w) {
        c.fill(x, y, x + w, y + 1, 0x33FFFFFF);
    }

    // Solaris tarzı: lacivert yarı saydam hap düğme, ince açık çerçeve; üzerine gelince aydınlanır
    private static void button(GuiGraphicsExtractor c, int x, int y, int w, int h, boolean hl, boolean active, float a) {
        float hv = anim(x, y, w, h, hl, 18);
        int r = Math.min(6, h / 2 - 2);
        int bg = active ? CxUi.mix(0xD91A2230, 0xF0283345, hv) : 0x99161B24;
        CxUi.round(c, x, y, w, h, r, CxUi.alpha(bg, a));
        CxUi.outline(c, x, y, w, h, r, CxUi.alpha(active ? CxUi.mix(0x47AEB9C8, 0x99D6DEE8, hv) : 0x26AEB9C8, a));
    }

    private static void field(GuiGraphicsExtractor c, int x, int y, int w, int h, boolean focus, float a) {
        float f = anim(x, y, w, h, focus, 16);
        c.fill(x, y, x + w, y + h, CxUi.alpha(0xE6000000, a));
        int col = CxUi.alpha(CxUi.mix(0x99A0A8B4, 0xFFFFFFFF, f), a);
        c.fill(x, y, x + w, y + 1, col); c.fill(x, y + h - 1, x + w, y + h, col);
        c.fill(x, y, x + 1, y + h, col); c.fill(x + w - 1, y, x + w, y + h, col);
    }

    private static void slider(GuiGraphicsExtractor c, int x, int y, int w, int h, boolean hl, float a) {
        button(c, x, y, w, h, hl, true, a);
        sx = x; sy = y; sw = w; sh = h;
    }

    private static void handle(GuiGraphicsExtractor c, int x, int y, int w, int h, boolean hl, float a) {
        if (y == sy && h == sh && x >= sx && x <= sx + sw) {
            int end = x + w / 2;
            int r = Math.min(6, sh / 2 - 2);
            if (end - sx > r * 2) CxUi.round(c, sx + 1, sy + 1, end - sx - 1, sh - 2, r, CxStyle.accent(0.30f * a));
        }
        float hv = anim(x, y, w, h, hl, 18);
        CxUi.round(c, x + 1, y + 2, w - 2, h - 4, 3, CxUi.alpha(CxUi.mix(0xFFDCE2EA, 0xFFFFFFFF, hv), a));
    }

    private static void check(GuiGraphicsExtractor c, int x, int y, int w, int h, boolean sel, boolean hl, float a) {
        float hv = anim(x, y, w, h, hl, 18);
        float sv = anim(x + 1, y + 1, w, h, sel, 18);
        CxUi.round(c, x, y, w, h, 4, CxUi.alpha(CxUi.mix(0x40FFFFFF, CxUi.ACCENT, Math.max(sv, hv * 0.6f)), a));
        CxUi.round(c, x + 1, y + 1, w - 2, h - 2, 3, CxUi.alpha(0xF00D0E12, a));
        if (sv > 0.02f) {
            int in = Math.round(4 + (1 - CxUi.easeOutBack(sv)) * (w / 2f - 4));
            CxUi.round(c, x + in, y + in, Math.max(1, w - in * 2), Math.max(1, h - in * 2), 2, CxUi.alpha(CxUi.ACCENT, a * sv));
        }
    }

    private static void tab(GuiGraphicsExtractor c, int x, int y, int w, int h, boolean sel, boolean hl, float a) {
        float hv = anim(x, y, w, h, hl, 18);
        float sv = anim(x, y + 1, w, h, sel, 16);
        c.fill(x + 1, y, x + w - 1, y + h, CxUi.alpha(CxUi.mix(0x4D0A0D12, 0x99141A22, Math.max(sv, hv * 0.5f)), a));
        int half = Math.round((w / 2f - 6) * CxUi.easeOut(sv)), cx = x + w / 2;
        if (half > 0) c.fill(cx - half, y + h - 2, cx + half, y + h - 1, CxUi.alpha(0xFFFFFFFF, a));
        if (hv > 0.01f && sv < 0.99f) c.fill(x + 6, y + h - 2, x + w - 6, y + h - 1, CxUi.alpha(0x55FFFFFF, a * hv * (1 - sv)));
    }
}
