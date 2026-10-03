package com.cubixora.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import com.mojang.blaze3d.platform.Window;

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
        if (s instanceof net.minecraft.client.gui.screens.PauseScreen) return true;
        return s.getClass().getName().startsWith("com.cubixora.client.");
    }

    /** Her tikte ve Cubixora ekranı oluşturulurken çağrılır. */
    public static void sync(Minecraft mc, Screen s) {
        if (mc == null) return;
        Window w = mc.getWindow();
        int vanilla = w.calculateScale(mc.options.guiScale().get(), mc.isEnforceUnicode());
        int target = wants(s) ? Math.min(vanilla, CAP) : vanilla;
        if (w.getGuiScale() == target) return;
        w.setGuiScale(target);
        Screen cur = mc.screen;
        if (cur != null) cur.resize(w.getGuiScaledWidth(), w.getGuiScaledHeight());
    }

    public static void sync(Minecraft mc) { sync(mc, mc.screen); }
}
