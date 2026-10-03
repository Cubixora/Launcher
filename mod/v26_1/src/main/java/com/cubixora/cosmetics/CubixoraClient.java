package com.cubixora.cosmetics;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.LivingEntityRenderLayerRegistrationCallback;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.renderer.entity.player.AvatarRenderer;
import net.minecraft.network.chat.Component;
import com.mojang.blaze3d.platform.InputConstants;

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
        KeyMapping.Category cat = new KeyMapping.Category(Compat.id("cubixora", "main"));
        KeyMapping reloadKey = KeyMappingHelper.registerKeyMapping(new KeyMapping(
                "key.cubixora.reload", InputConstants.UNKNOWN.getValue(), cat));
        com.cubixora.client.CxKeys.fullbright = KeyMappingHelper.registerKeyMapping(new KeyMapping(
                "key.cubixora.fullbright", InputConstants.KEY_Y, cat));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            AutoLogin.tick();
            com.cubixora.client.CxAmbience.tick(client);
            com.cubixora.client.CxScale.sync(client);
            com.cubixora.client.CxUi.preloadStep(client);
            com.cubixora.client.CxEmote.tick(client);
            com.cubixora.client.CxWindow.tick(client);
            while (reloadKey.consumeClick()) {
                CosmeticsManager.reloadAll();
                if (client.player != null) client.player.sendOverlayMessage(Component.literal("§fCubixora kozmetikleri yenilendi"));
            }
        });

        LivingEntityRenderLayerRegistrationCallback.EVENT.register((entityType, entityRenderer, helper, context) -> {
            if (entityRenderer instanceof AvatarRenderer<?> avatar) {
                helper.register(new CubixoraLayer(avatar, context));
            }
        });
        Cubixora.LOG.info("Cubixora Cosmetics hazır (26.x)");
    }
}
