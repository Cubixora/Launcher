package com.cubixora.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import org.lwjgl.glfw.GLFW;

/** Cubixora yazı kutusu: yuvarlak zemin, odakta vurgu çerçevesi, imleç yanıp söner. */
public final class CxText {
    public String value = "";
    public final String hint;
    public final int max;
    public boolean focused;
    public int x, y, w, h = 16;
    private int cur;
    private float focus;
    private long last = System.currentTimeMillis();

    public CxText(String hint, int max) { this.hint = hint; this.max = max; }

    public void set(String s) { value = s == null ? "" : s; cur = value.length(); }

    public void render(GuiGraphicsExtractor c, Font tr, int mx, int my, float a) {
        long now = System.currentTimeMillis();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        focus = CxUi.approach(focus, focused ? 1 : 0, 18, dt);
        CxUi.round(c, x, y, w, h, 4, CxUi.alpha(CxStyle.field(), a));
        CxUi.outline(c, x, y, w, h, 4, CxUi.alpha(CxUi.mix(CxStyle.panelBorder(), CxStyle.accent(), focus), a));
        int ty = y + (h - 7) / 2;
        String shown = value;
        int off = 0;
        while (tr.width(shown.substring(0, Math.min(cur, shown.length())) ) > w - 12 && off < shown.length()) { off++; shown = value.substring(off); }
        String vis = tr.plainSubstrByWidth(shown, w - 12);
        if (value.isEmpty() && !focused) c.text(tr, hint, x + 6, ty, CxUi.alpha(CxStyle.muted(), a * 0.8f), false);
        else c.text(tr, vis, x + 6, ty, CxUi.alpha(CxStyle.text(), a), false);
        if (focused && (now / 500) % 2 == 0) {
            int cx = x + 6 + tr.width(value.substring(off, Math.max(off, Math.min(cur, value.length()))));
            c.fill(cx, y + 3, cx + 1, y + h - 3, CxUi.alpha(CxStyle.text(), a));
        }
    }

    public boolean click(double mx, double my) {
        focused = CxUi.inside(mx, my, x, y, w, h);
        if (focused) cur = value.length();
        return focused;
    }

    public boolean charTyped(char ch) {
        if (!focused || ch < 32 || ch == 127 || value.length() >= max) return focused;
        value = value.substring(0, cur) + ch + value.substring(cur);
        cur++;
        return true;
    }

    public boolean key(int keyCode, int modifiers) {
        if (!focused) return false;
        boolean ctrl = (modifiers & GLFW.GLFW_MOD_CONTROL) != 0;
        switch (keyCode) {
            case GLFW.GLFW_KEY_BACKSPACE: if (cur > 0) { value = value.substring(0, cur - 1) + value.substring(cur); cur--; } return true;
            case GLFW.GLFW_KEY_DELETE: if (cur < value.length()) value = value.substring(0, cur) + value.substring(cur + 1); return true;
            case GLFW.GLFW_KEY_LEFT: cur = Math.max(0, cur - 1); return true;
            case GLFW.GLFW_KEY_RIGHT: cur = Math.min(value.length(), cur + 1); return true;
            case GLFW.GLFW_KEY_HOME: cur = 0; return true;
            case GLFW.GLFW_KEY_END: cur = value.length(); return true;
            case GLFW.GLFW_KEY_V:
                if (ctrl) {
                    String clip = Minecraft.getInstance().keyboardHandler.getClipboard();
                    if (clip != null) { clip = clip.replaceAll("[\\r\\n\\t]", " "); int room = max - value.length(); if (clip.length() > room) clip = clip.substring(0, Math.max(0, room)); value = value.substring(0, cur) + clip + value.substring(cur); cur += clip.length(); }
                    return true;
                }
                return false;
            default: return false;
        }
    }
}
