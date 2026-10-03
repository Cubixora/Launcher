package com.cubixora.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.PlayerSkinDrawer;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.util.SkinTextures;

/** Oyuncunun kendi kafası (alt çubuk, menüler). */
public final class CxHead {
    private CxHead() {}

    private static SkinTextures skin() {
        MinecraftClient client = MinecraftClient.getInstance();
        return client.getSkinProvider().getSkinTextures(client.getGameProfile());
    }

    public static void draw(DrawContext c, int pcx, int pcy, int s, float a) {
        PlayerSkinDrawer.draw(c, skin(), pcx - s / 2, pcy - s / 2, s);
    }

    /** Sunucudaki başka bir oyuncunun kafası (isme göre). */
    public static void drawEntry(DrawContext c, String name, int x, int y, int s, float a) {
        MinecraftClient mc = MinecraftClient.getInstance();
        var h = mc.getNetworkHandler();
        PlayerListEntry e = h == null ? null : h.getPlayerListEntry(name);
        if (e == null) return;
        PlayerSkinDrawer.draw(c, e.getSkinTextures(), x, y, s);
    }
}
