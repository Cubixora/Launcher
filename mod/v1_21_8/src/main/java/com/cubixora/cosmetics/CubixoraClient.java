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
        com.cubixora.client.CxClient.init();
        AutoLogin.init();
        AutoLogin.sender = Compat::sendCommand;
        net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> AutoLogin.onJoin(Compat.serverAddress(client)));
        net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> AutoLogin.onDisconnect());
        net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents.GAME.register((message, overlay) -> { if (!overlay) AutoLogin.onMessage(message.getString()); });
        KeyBinding reloadKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.cubixora.reload", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_UNKNOWN, "category.cubixora"));
        com.cubixora.client.CxKeys.fullbright = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.cubixora.fullbright", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_Y, "category.cubixora"));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            AutoLogin.tick();
            com.cubixora.client.CxAmbience.tick(client);
            com.cubixora.client.CxScale.sync(client);
            com.cubixora.client.CxUi.preloadStep(client);
            com.cubixora.client.CxWindow.tick(client);
            com.cubixora.client.CxEmote.tick(client);
            while (reloadKey.wasPressed()) {
                CosmeticsManager.reloadAll();
                if (client.player != null) client.player.sendMessage(Text.literal("§fCubixora kozmetikleri yenilendi"), true);
            }
        });

        LivingEntityFeatureRendererRegistrationCallback.EVENT.register((entityType, entityRenderer, helper, context) -> {
            if (entityRenderer instanceof PlayerEntityRenderer playerRenderer) {
                helper.register(new CubixoraFeatureRenderer(playerRenderer, context));
            }
        });
        Cubixora.LOG.info("Cubixora Cosmetics hazır (1.21.4)");
    }
}
