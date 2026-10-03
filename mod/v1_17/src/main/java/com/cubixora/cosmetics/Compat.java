package com.cubixora.cosmetics;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.util.Identifier;

/** Minecraft 1.17, 1.17.1 farkları. */
public final class Compat {
    private Compat() {}
    public static ModelTransform pivot(float x, float y, float z) { return ModelTransform.pivot(x, y, z); }
    public static Identifier id(String ns, String path) { return new Identifier(ns, path); }
    public static void registerTexture(Identifier id, NativeImage img) {
        MinecraftClient.getInstance().getTextureManager().registerTexture(id, new NativeImageBackedTexture(img));
    }

    /** Oto-giriş: sunucuya komut gönderir (başında "/" olmadan). */
    public static void sendCommand(String cmd) {
        MinecraftClient c = MinecraftClient.getInstance();
        if (c.player != null) c.player.sendChatMessage("/" + cmd);
    }
    public static String serverAddress(MinecraftClient c) {
        net.minecraft.client.network.ServerInfo s = c.getCurrentServerEntry();
        return s == null ? null : s.address;
    }
}
