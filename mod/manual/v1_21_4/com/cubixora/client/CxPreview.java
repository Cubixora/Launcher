package com.cubixora.client;

import com.cubixora.cosmetics.CosmeticsManager;
import com.cubixora.cosmetics.PlayerCosmetics;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.DiffuseLighting;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.entity.model.EntityModelLayers;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.RotationAxis;

/** Dünyasız ekranlarda karakter önizlemesi: skin modeli; pelerin dönüşe göre düz levha olarak çizilir. */
public final class CxPreview {
    private static PlayerEntityModel wide, slim;
    private CxPreview() {}

    private static void init(MinecraftClient mc) {
        if (wide != null) return;
        wide = new PlayerEntityModel(mc.getLoadedEntityModels().getModelPart(EntityModelLayers.PLAYER), false);
        slim = new PlayerEntityModel(mc.getLoadedEntityModels().getModelPart(EntityModelLayers.PLAYER_SLIM), true);
    }

    public static Identifier vanillaTex() { return MinecraftClient.getInstance().getSkinProvider().getSkinTextures(MinecraftClient.getInstance().getGameProfile()).texture(); }
    public static boolean vanillaSlim() { return MinecraftClient.getInstance().getSkinProvider().getSkinTextures(MinecraftClient.getInstance().getGameProfile()).model() == SkinTextures.Model.SLIM; }

    public static void drawSelf(DrawContext c, int x1, int y1, int x2, int y2, float yaw, float pitch) {
        MinecraftClient mc = MinecraftClient.getInstance();
        Identifier tex = vanillaTex(); boolean thin = vanillaSlim(); Identifier capeTex = null;
        PlayerCosmetics pc = CosmeticsManager.get(mc.getSession().getUsername());
        if (pc != null) {
            if (pc.skinTexture != null) { tex = pc.skinTexture; thin = pc.slim; }
            capeTex = pc.capeTexture;
        }
        draw(c, x1, y1, x2, y2, tex, thin, capeTex, yaw, pitch);
    }

    public static void draw(DrawContext c, int x1, int y1, int x2, int y2, Identifier skin, boolean thin, Identifier capeTex, float yaw, float pitch) {
float s = 0.97f * (y2 - y1) / 2.125f;
        float cx = (x1 + x2) / 2f, feet = y2 - 0.0625f * s;
        CxSoftPlayer.draw(c, skin, thin, capeTex, cx, feet, s, yaw);   // gerçek 3B: pelerin gövdenin arkasında kalır, döndükçe birlikte döner
    }
}
