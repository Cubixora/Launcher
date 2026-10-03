package com.cubixora.client;

import com.cubixora.cosmetics.CosmeticsManager;
import com.cubixora.cosmetics.PlayerCosmetics;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.model.geom.ModelLayers;
import net.minecraft.client.model.player.PlayerModel;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.player.PlayerModelType;

/** Dünyasız ekranlarda karakter önizlemesi: skin modeli; pelerin dönüşe göre düz levha olarak çizilir. */
public final class CxPreview {
    private static PlayerModel wide, slim;
    private CxPreview() {}

    private static void init(Minecraft mc) {
        if (wide != null) return;
        wide = new PlayerModel(mc.getEntityModels().bakeLayer(ModelLayers.PLAYER), false);
        slim = new PlayerModel(mc.getEntityModels().bakeLayer(ModelLayers.PLAYER_SLIM), true);
    }

    public static Identifier vanillaTex() { return Minecraft.getInstance().getSkinManager().createLookup(Minecraft.getInstance().getGameProfile(), false).get().body().texturePath(); }
    public static boolean vanillaSlim() { return Minecraft.getInstance().getSkinManager().createLookup(Minecraft.getInstance().getGameProfile(), false).get().model() == PlayerModelType.SLIM; }

    public static void drawSelf(GuiGraphicsExtractor c, int x1, int y1, int x2, int y2, float yaw, float pitch) {
        Minecraft mc = Minecraft.getInstance();
        Identifier tex = vanillaTex(); boolean thin = vanillaSlim(); Identifier capeTex = null;
        PlayerCosmetics pc = CosmeticsManager.get(mc.getUser().getName());
        if (pc != null) {
            if (pc.skinTexture != null) { tex = pc.skinTexture; thin = pc.slim; }
            capeTex = pc.capeTexture;
        }
        draw(c, x1, y1, x2, y2, tex, thin, capeTex, yaw, pitch);
    }

    public static void draw(GuiGraphicsExtractor c, int x1, int y1, int x2, int y2, Identifier skin, boolean thin, Identifier capeTex, float yaw, float pitch) {
float s = 0.97f * (y2 - y1) / 2.125f;
        float cx = (x1 + x2) / 2f, feet = (y1 + y2) / 2f + 1.0625f * s;
        CxSoftPlayer.draw(c, skin, thin, capeTex, cx, feet, s, yaw);   // gerçek 3B: pelerin gövdenin arkasında kalır, döndükçe birlikte döner
    }
}
