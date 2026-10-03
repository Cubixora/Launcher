package com.cubixora.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.PlayerSkinDrawer;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.entity.player.SkinTextures;

/** Oyuncunun kendi kafası (alt çubuk, menüler). */
public final class CxHead {
    private CxHead() {}

    private static SkinTextures skin() {
        MinecraftClient client = MinecraftClient.getInstance();
        return client.getSkinProvider().supplySkinTextures(client.getGameProfile(), false).get();
    }

    public static void draw(DrawContext c, int pcx, int pcy, int s, float a) {
        PlayerSkinDrawer.draw(c, skin(), pcx - s / 2, pcy - s / 2, s, CxUi.alpha(0xFFFFFFFF, a));
    }

    /** Sunucudaki başka bir oyuncunun kafası (isme göre). */
    public static void drawEntry(DrawContext c, String name, int x, int y, int s, float a) {
        MinecraftClient mc = MinecraftClient.getInstance();
        var h = mc.getNetworkHandler();
        PlayerListEntry e = h == null ? null : h.getPlayerListEntry(name);
        if (e == null) return;
        PlayerSkinDrawer.draw(c, e.getSkinTextures(), x, y, s, CxUi.alpha(0xFFFFFFFF, a));
    }
}
