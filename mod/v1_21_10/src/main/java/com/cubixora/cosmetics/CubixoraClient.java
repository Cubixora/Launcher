package com.cubixora.cosmetics;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.LivingEntityFeatureRendererRegistrationCallback;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.render.entity.PlayerEntityRenderer;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

public final class CubixoraClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        CosmeticsManager.init();
        AutoLogin.init();
        AutoLogin.sender = Compat::sendCommand;
        net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> AutoLogin.onJoin(Compat.serverAddress(client)));
        net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> AutoLogin.onDisconnect());
        net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents.GAME.register((message, overlay) -> { if (!overlay) AutoLogin.onMessage(message.getString()); });
        KeyBinding.Category cat = KeyBinding.Category.create(Compat.id("cubixora", "main"));
        KeyBinding wingsKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.cubixora.wings", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_K, cat));
        KeyBinding reloadKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.cubixora.reload", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_UNKNOWN, cat));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            AutoLogin.tick();
            while (wingsKey.wasPressed()) {
                if (client.player == null) continue;
                Boolean open = Cubixora.toggleSelfWings(client.player.getNameForScoreboard());
                client.player.sendMessage(Text.literal(open == null
                        ? "§7Kanat seçili değil. Cubixora Launcher > Kozmetik'ten seçebilirsin."
                        : open ? "§fKanatlar §aaçıldı" : "§fKanatlar §ckapandı"), true);
            }
            while (reloadKey.wasPressed()) {
                CosmeticsManager.reloadAll();
                if (client.player != null) client.player.sendMessage(Text.literal("§fCubixora kozmetikleri yenilendi"), true);
            }
        });

        LivingEntityFeatureRendererRegistrationCallback.EVENT.register((entityType, entityRenderer, helper, context) -> {
            if (entityRenderer instanceof PlayerEntityRenderer<?> playerRenderer) {
                helper.register(new CubixoraFeatureRenderer(playerRenderer, context));
            }
        });
        Cubixora.LOG.info("Cubixora Cosmetics hazır (1.21.9+)");
    }
}
