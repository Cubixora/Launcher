package com.cubixora.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.font.TextRenderer;

import java.util.ArrayDeque;

/**
 * Oyun içi üst bildirim (görev tamamlandı, çekilişe katılabilirsin, çekilişi kazandın).
 * Launcher köprü yanıtıyla gelir; ekranın üstünde ortada yumuşakça kayarak iner, 4 sn kalır.
 * Kuyruk boşken çizim maliyeti yok (tek bir null kontrolü).
 */
public final class CxToast {
    private CxToast() {}

    private static final class T { final String title, sub; T(String t, String s) { title = t; sub = s; } }
    private static final ArrayDeque<T> QUEUE = new ArrayDeque<>();
    private static T cur;
    private static long start;
    private static final long IN = 380, HOLD = 4000, OUT = 320;

    /** Ana iş parçacığından çağrılır (köprü geri çağrısı). */
    public static void push(String title, String sub) {
        if (title == null || title.isEmpty()) return;
        if (QUEUE.size() >= 5) QUEUE.pollFirst();
        QUEUE.addLast(new T(title, sub == null ? "" : sub));
    }

    public static void render(DrawContext c) {
        long now = System.currentTimeMillis();
        if (cur == null) { cur = QUEUE.pollFirst(); if (cur == null) return; start = now; }
        long t = now - start;
        if (t > IN + HOLD + OUT) { cur = null; return; }
        MinecraftClient mc = MinecraftClient.getInstance();
        TextRenderer tr = mc.textRenderer;
        float k = t < IN ? CxUi.easeOutBack(t / (float) IN) : t > IN + HOLD ? 1f - CxUi.easeInOut((t - IN - HOLD) / (float) OUT) : 1f;
        float a = Math.max(0f, Math.min(1f, t < IN ? t / (float) IN * 1.6f : k));
        if (a <= 0.01f) return;
        int sw = mc.getWindow().getScaledWidth();
        String title = CxUi.caps(cur.title), sub = cur.sub;
        int tw = Math.round(tr.getWidth(title) * 0.72f), subW = tr.getWidth(sub);
        int w = Math.min(sw - 20, Math.max(tw, subW) + 46), h = sub.isEmpty() ? 22 : 31;
        int x = (sw - w) / 2, y = Math.round(-h - 6 + (h + 14) * k);
        CxUi.round(c, x, y, w, h, 8, CxUi.alpha(0xE6101418, a));
        CxUi.outline(c, x, y, w, h, 8, CxUi.alpha(CxUi.ACCENT, a * 0.55f));
        // sol rozet: altın daire + onay işareti
        int bx = x + 8, by = y + (h - 16) / 2;
        CxUi.round(c, bx, by, 16, 16, 8, CxUi.alpha(CxUi.ACCENT, a));
        CxUi.textScaled(c, tr, "\u2714", bx + 4.5f, by + 4f, 1f, CxUi.alpha(0xFF101418, a), false);
        int tx = bx + 23;
        CxUi.textScaled(c, tr, title, tx, y + (sub.isEmpty() ? 8 : 6), 0.72f, CxUi.alpha(CxUi.ACCENT, a), false);
        if (!sub.isEmpty()) CxUi.textScaled(c, tr, sub, tx, y + 16, 1f, CxUi.alpha(0xFFFFFFFF, a), true);
        // kalan süre çizgisi
        float left = t < IN ? 1f : Math.max(0f, 1f - (t - IN) / (float) HOLD);
        int bw = Math.round((w - 16) * left);
        if (bw > 1) CxUi.round(c, x + 8, y + h - 3, bw, 2, 1, CxUi.alpha(CxUi.ACCENT, a * 0.7f));
    }
}
