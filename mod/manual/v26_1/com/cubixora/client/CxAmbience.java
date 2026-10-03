package com.cubixora.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.resources.Identifier;
import net.minecraft.util.Util;

/** Menü ortam sesi: yağmur döngüsü + şimşekten sonra gök gürültüsü. Oyuna girince yavaşça susar. */
public final class CxAmbience {
    private static CxRainSound rain;
    private static final Identifier THUNDER = Identifier.fromNamespaceAndPath("cubixora", "thunder");

    private CxAmbience() {}

    public static void tick(Minecraft mc) {
        boolean want = CxClient.enabled && CxClient.settings.rainSound && mc.level == null && mc.getOverlay() == null && mc.screen != null;
        if (rain != null && rain.finished()) rain = null;
        if (want && rain == null) {
            rain = new CxRainSound();
            mc.getSoundManager().play(rain);
        }
        if (rain != null) rain.target = want ? 0.5f : 0f;
        long at = CxBackground.thunderAt;
        if (at > 0 && Util.getMillis() >= at) {
            CxBackground.thunderAt = 0;
            if (want && CxClient.settings.rain && !CxClient.settings.perfMode)
                mc.getSoundManager().play(SimpleSoundInstance.forUI(SoundEvent.createVariableRangeEvent(THUNDER), 0.8f + (float) Math.random() * 0.3f, 0.45f));
        }
    }
}
