package com.cubixora.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.PlayerFaceExtractor;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.world.entity.player.PlayerSkin;

/** Oyuncunun kendi kafası (alt çubuk, menüler). */
public final class CxHead {
    private CxHead() {}

    private static PlayerSkin skin() {
        Minecraft client = Minecraft.getInstance();
        return client.getSkinManager().createLookup(client.getGameProfile(), false).get();
    }

    public static void draw(GuiGraphicsExtractor c, int pcx, int pcy, int s, float a) {
        PlayerFaceExtractor.extractRenderState(c, skin(), pcx - s / 2, pcy - s / 2, s, CxUi.alpha(0xFFFFFFFF, a));
    }

    /** Sunucudaki başka bir oyuncunun kafası (isme göre). */
    public static void drawEntry(GuiGraphicsExtractor c, String name, int x, int y, int s, float a) {
        Minecraft mc = Minecraft.getInstance();
        var h = mc.getConnection();
        PlayerInfo e = h == null ? null : h.getPlayerInfo(name);
        if (e == null) return;
        PlayerFaceExtractor.extractRenderState(c, e.getSkin(), x, y, s, CxUi.alpha(0xFFFFFFFF, a));
    }
}
