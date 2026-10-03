package com.cubixora.cosmetics;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.util.Identifier;

/** Minecraft 1.21.9 - 1.21.11 farkları. */
public final class Compat {
    private Compat() {}
    public static ModelTransform pivot(float x, float y, float z) { return ModelTransform.origin(x, y, z); }
    public static Identifier id(String ns, String path) { return Identifier.of(ns, path); }
    public static void registerTexture(Identifier id, NativeImage img) {
        MinecraftClient.getInstance().getTextureManager().registerTexture(id, new NativeImageBackedTexture(id::toString, img));
    }
    /** Render durumundaki varlık kimliğinden oyuncu adını bulur. */
    public static String playerName(int entityId) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.world == null) return null;
        Entity e = mc.world.getEntityById(entityId);
        return e instanceof PlayerEntity p ? p.getNameForScoreboard() : null;
    }
    /** Ertelenmiş çizim (komut kuyruğu) içinde kullanılacak yeni bir matris yığını. */
    public static MatrixStack stackFrom(MatrixStack.Entry entry) {
        MatrixStack ms = new MatrixStack();
        ms.peek().copy(entry);
        return ms;
    }

    /** Oto-giriş: sunucuya komut gönderir (başında "/" olmadan). */
    public static void sendCommand(String cmd) {
        MinecraftClient c = MinecraftClient.getInstance();
        if (c.getNetworkHandler() != null) c.getNetworkHandler().sendChatCommand(cmd);
    }
    public static String serverAddress(MinecraftClient c) {
        net.minecraft.client.network.ServerInfo s = c.getCurrentServerEntry();
        return s == null ? null : s.address;
    }
}
