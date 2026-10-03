package com.cubixora.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.util.Window;

/**
 * Cubixora ekranları çok büyük GUI ölçeğinde (4+) devasa görünür. Bu ekranlar açıkken ölçek en çok CAP olur;
 * ekran kapanınca oyuncunun kendi ölçeği geri gelir. Ayar dosyasına dokunulmaz, yalnız pencere ölçeği değişir.
 */
public final class CxScale {
    public static final int CAP = 2;
    private CxScale() {}

    private static boolean wants(Screen s) {
        if (s == null || !CxClient.enabled) return false;
        if (s instanceof CxHudEditor) return false;   // editör oyunun gerçek ölçeğinde çalışmalı
        if (s instanceof net.minecraft.client.gui.screen.GameMenuScreen) return true;
        return s.getClass().getName().startsWith("com.cubixora.client.");
    }

    /** Her tikte ve Cubixora ekranı oluşturulurken çağrılır. */
    public static void sync(MinecraftClient mc, Screen s) {
        if (mc == null) return;
        Window w = mc.getWindow();
        int vanilla = w.calculateScaleFactor(mc.options.getGuiScale().getValue(), mc.forcesUnicodeFont());
        int target = wants(s) ? Math.min(vanilla, CAP) : vanilla;
        if ((int) w.getScaleFactor() == target) return;
        w.setScaleFactor(target);
        Screen cur = mc.currentScreen;
        if (cur != null) cur.resize(mc, w.getScaledWidth(), w.getScaledHeight());
    }

    public static void sync(MinecraftClient mc) { sync(mc, mc.currentScreen); }
}
