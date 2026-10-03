package com.cubixora.client;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.components.toasts.SystemToast;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Util;

import java.util.HashMap;
import java.util.Map;

/** Hata Bildir: kategori seç, sorunu yaz, gönder. Bildirim launcher üzerinden admin paneline düşer. */
public final class CxReportScreen extends Screen {
    private static final String[] CATS = { "Hata", "Öneri", "Hile / Kural ihlali", "Diğer" };
    private final Screen parent;
    private int cat;
    private final StringBuilder text = new StringBuilder();
    private boolean focus = true, sending;
    private String status = "";
    private int px, py, pw, ph;
    private final long opened = Util.getMillis();
    private long last = opened;
    private final Map<String, Float> hov = new HashMap<>();

    public CxReportScreen(Screen parent) { super(Component.literal("Hata Bildir")); this.parent = parent; CxScale.sync(net.minecraft.client.Minecraft.getInstance(), this); }

    @Override protected void init() {
        pw = Math.min(width - 20, 360); ph = Math.min(height - 20, 230);
        px = (width - pw) / 2; py = Math.max(8, (height - ph) / 2);
    }

    private float h(String id, boolean over, float dt) { float v = CxUi.approach(hov.getOrDefault(id, 0f), over ? 1 : 0, 18, dt); hov.put(id, v); return v; }

    @Override
    public void extractRenderState(GuiGraphicsExtractor c, int mouseX, int mouseY, float delta) {
        int mx = mouseX, my = mouseY;
        long now = Util.getMillis();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        float a = CxUi.easeOut((now - opened) / 220f);
        if (minecraft.level == null) CxBackground.render(c, width, height, 1f);
        else c.fill(0, 0, width, height, 0);
        c.fill(0, 0, width, height, CxUi.alpha(CxStyle.scrim(), a));
        int oy = Math.round((1 - a) * 10), y = py + oy;
        CxUi.sheet(c, px, y, pw, ph, 10, a);
        CxUi.tex(c, CxUi.LOGO, px + (pw - 52) / 2, y + 8, 0, 0, 52, 23, CxUi.LOGO_W, CxUi.LOGO_H, CxUi.LOGO_W, CxUi.LOGO_H, CxUi.alpha(0xFFFFFFFF, a));
        String t = "HATA BİLDİR";
        c.text(font, t, px + (pw - font.width(t)) / 2, y + 34, CxUi.alpha(CxStyle.header(), a), false);
        // kategori
        int cy = y + 50;
        c.text(font, "Kategori", px + 14, cy, CxUi.alpha(CxStyle.muted(), a), false);
        int sx = px + 14, sw = pw - 28;
        CxUi.round(c, sx, cy + 10, sw, 16, 5, CxUi.alpha(CxStyle.field(), a));
        CxUi.outline(c, sx, cy + 10, sw, 16, 5, CxUi.alpha(CxStyle.panelBorder(), a));
        float hl = h("l", CxUi.inside(mx, my, sx, cy + 10, 18, 16), dt), hr = h("r", CxUi.inside(mx, my, sx + sw - 18, cy + 10, 18, 16), dt);
        c.text(font, "<", sx + 7, cy + 14, CxUi.alpha(CxUi.mix(CxStyle.muted(), CxStyle.text(), hl), a), false);
        c.text(font, ">", sx + sw - 12, cy + 14, CxUi.alpha(CxUi.mix(CxStyle.muted(), CxStyle.text(), hr), a), false);
        c.text(font, CATS[cat], sx + (sw - font.width(CATS[cat])) / 2, cy + 14, CxUi.alpha(CxStyle.text(), a), false);
        // açıklama
        int dy = cy + 34;
        c.text(font, "Açıklama", px + 14, dy, CxUi.alpha(CxStyle.muted(), a), false);
        int bh = ph - (dy - y) - 12 - 22 - 14 - 14;
        CxUi.round(c, sx, dy + 10, sw, bh, 5, CxUi.alpha(CxStyle.field(), a));
        CxUi.outline(c, sx, dy + 10, sw, bh, 5, CxUi.alpha(focus ? CxStyle.accent() : CxStyle.panelBorder(), a));
        String body = text.toString() + (focus && (now / 500) % 2 == 0 ? "_" : "");
        int ly = dy + 15;
        if (text.length() == 0 && !focus) c.text(font, "Ne oldu? Nasıl tekrar edilir?", sx + 6, ly, CxUi.alpha(CxStyle.muted(), a * 0.8f), false);
        else for (var line : font.split(Component.literal(body), sw - 12)) { if (ly + 8 > dy + 10 + bh) break; c.text(font, line, sx + 6, ly, CxUi.alpha(CxStyle.text(), a), false); ly += 10; }
        String cnt = text.length() + "/600";
        c.text(font, cnt, sx + sw - font.width(cnt) - 4, dy + 10 + bh + 3, CxUi.alpha(CxStyle.muted(), a), false);
        if (!status.isEmpty()) c.text(font, font.plainSubstrByWidth(status, sw - 50), sx, dy + 10 + bh + 3, CxUi.alpha(status.startsWith("!") ? CxUi.DND : CxUi.ONLINE, a), false);
        // düğmeler
        int by = y + ph - 28, bw = (sw - 6) / 2;
        CxUi.button(c, font, sending ? "Gönderiliyor..." : "Gönder", sx, by, bw, 18, h("send", !sending && CxUi.inside(mx, my, sx, by, bw, 18), dt), a);
        CxUi.button(c, font, "İptal", sx + bw + 6, by, sw - bw - 6, 18, h("cancel", CxUi.inside(mx, my, sx + bw + 6, by, sw - bw - 6, 18), dt), a);
        super.extractRenderState(c, mouseX, mouseY, delta);
    }

    private void send() {
        if (sending) return;
        String s = text.toString().trim();
        if (s.length() < 5) { status = "!Lütfen sorunu biraz daha ayrıntılı yaz."; return; }
        sending = true; status = "";
        String ver = "Cubixora Client · " + CxClient.mcVersion();
        String json = "{\"category\":" + q(CATS[cat]) + ",\"text\":" + q(s) + ",\"version\":" + q(ver) + "}";
        CxBridge.raw("/report", json, o -> {
            sending = false;
            if (o == null) { status = "!Gönderilemedi. Launcher açık ve giriş yapılmış olmalı."; return; }
            SystemToast.addOrUpdate(minecraft.getToastManager(), SystemToast.SystemToastId.PERIODIC_NOTIFICATION, Component.literal("Teşekkürler!"), Component.literal("Bildirimin ekibe iletildi."));
            onClose();
        });
    }
    private static String q(String s) { return new com.google.gson.JsonPrimitive(s).toString(); }

    @Override public boolean mouseClicked(net.minecraft.client.input.MouseButtonEvent click, boolean doubled) {
        double mx = click.x(), my = click.y(); int button = click.button();
        int cy = py + 50, sx = px + 14, sw = pw - 28, by = py + ph - 28, bw = (sw - 6) / 2;
        if (CxUi.inside(mx, my, sx, cy + 10, 18, 16)) { cat = (cat + CATS.length - 1) % CATS.length; CxUi.click(); return true; }
        if (CxUi.inside(mx, my, sx + sw - 18, cy + 10, 18, 16)) { cat = (cat + 1) % CATS.length; CxUi.click(); return true; }
        if (CxUi.inside(mx, my, sx, by, bw, 18)) { CxUi.click(); send(); return true; }
        if (CxUi.inside(mx, my, sx + bw + 6, by, sw - bw - 6, 18)) { CxUi.click(); onClose(); return true; }
        focus = CxUi.inside(mx, my, sx, cy + 44, sw, ph - 100);
        return super.mouseClicked(click, doubled);
    }
    @Override public boolean charTyped(net.minecraft.client.input.CharacterEvent input) {
        char chr = (char) input.codepoint(); int modifiers = 0;
        if (focus && chr >= 32 && text.length() < 600) { text.append(chr); return true; }
        return super.charTyped(input);
    }
    @Override public boolean keyPressed(net.minecraft.client.input.KeyEvent input) {
        int keyCode = input.key(), scanCode = input.scancode(), modifiers = input.modifiers();
        if (focus) {
            if (keyCode == 259 && text.length() > 0) { text.setLength(text.length() - 1); return true; }
            if (keyCode == 257) { if (text.length() < 600) text.append(' '); return true; }
            if (keyCode == 86 && (modifiers & 2) != 0) { String clip = minecraft.keyboardHandler.getClipboard(); if (clip != null) { clip = clip.replaceAll("[\\r\\n\\t]", " "); text.append(clip, 0, Math.min(clip.length(), 600 - text.length())); } return true; }
        }
        return super.keyPressed(input);
    }
    @Override public void onClose() { minecraft.setScreen(parent); }
    @Override public boolean isPauseScreen() { return false; }
    @Override public void extractBackground(GuiGraphicsExtractor context, int mouseX, int mouseY, float delta) {}
}
