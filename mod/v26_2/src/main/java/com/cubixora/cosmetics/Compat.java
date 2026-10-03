package com.cubixora.cosmetics;

import com.mojang.blaze3d.platform.NativeImage;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;

/** Minecraft 26.x (resmi Mojang isimleri). */
public final class Compat {
    private Compat() {}
    public static Identifier id(String ns, String path) { return Identifier.fromNamespaceAndPath(ns, path); }
    public static void registerTexture(Identifier id, NativeImage img) {
        Minecraft.getInstance().getTextureManager().register(id, new DynamicTexture(id::toString, img));
    }
    public static String playerName(int entityId) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.level == null) return null;
        Entity e = mc.level.getEntity(entityId);
        return e instanceof Player p ? p.getScoreboardName() : null;
    }
    public static PoseStack stackFrom(PoseStack.Pose pose) {
        PoseStack ps = new PoseStack();
        ps.last().set(pose);
        return ps;
    }

    /** Oto-giriş: sunucuya komut gönderir (başında "/" olmadan). */
    public static void sendCommand(String cmd) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.getConnection() != null) mc.getConnection().sendCommand(cmd);
    }
    public static String serverAddress(Minecraft mc) {
        net.minecraft.client.multiplayer.ServerData s = mc.getCurrentServer();
        return s == null ? null : s.ip;
    }
}
