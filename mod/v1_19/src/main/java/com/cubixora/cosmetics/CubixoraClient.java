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
        hookGameMessages();
        KeyBinding wingsKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.cubixora.wings", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_K, "category.cubixora"));
        KeyBinding reloadKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.cubixora.reload", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_UNKNOWN, "category.cubixora"));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            AutoLogin.tick();
            while (wingsKey.wasPressed()) {
                if (client.player == null) continue;
                Boolean open = Cubixora.toggleSelfWings(client.player.getGameProfile().getName());
                client.player.sendMessage(Text.literal(open == null
                        ? "\u00a77Kanat se\u00e7ili de\u011fil. Cubixora Launcher > Kozmetik'ten se\u00e7ebilirsin."
                        : open ? "\u00a7fKanatlar \u00a7aa\u00e7\u0131ld\u0131" : "\u00a7fKanatlar \u00a7ckapand\u0131"), true);
            }
            while (reloadKey.wasPressed()) {
                CosmeticsManager.reloadAll();
                if (client.player != null) client.player.sendMessage(Text.literal("\u00a7fCubixora kozmetikleri yenilendi"), true);
            }
        });

        LivingEntityFeatureRendererRegistrationCallback.EVENT.register((entityType, entityRenderer, helper, context) -> {
            if (entityRenderer instanceof PlayerEntityRenderer) {
                helper.register(new CubixoraFeatureRenderer((PlayerEntityRenderer) entityRenderer, context));
            }
        });
        Cubixora.LOG.info("Cubixora Cosmetics haz\u0131r (1.19.2)");
    }

    /** 1.19.2 Fabric API'sinde ClientReceiveMessageEvents olmayabilir; varsa yansıma ile bağlanır. */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static void hookGameMessages() {
        try {
            Class<?> ev = Class.forName("net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents");
            Class<?> game = Class.forName("net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents$Game");
            Object event = ev.getField("GAME").get(null);
            Object listener = java.lang.reflect.Proxy.newProxyInstance(game.getClassLoader(), new Class<?>[]{game}, (proxy, m, args) -> {
                if (m.getDeclaringClass() == Object.class) {
                    switch (m.getName()) {
                        case "hashCode": return System.identityHashCode(proxy);
                        case "equals": return proxy == args[0];
                        default: return "CubixoraGameListener";
                    }
                }
                if (args != null && args.length >= 2 && args[0] instanceof Text t && !Boolean.TRUE.equals(args[1])) AutoLogin.onMessage(t.getString());
                return null;
            });
            ((net.fabricmc.fabric.api.event.Event) event).register(listener);
        } catch (Throwable t) {
            Cubixora.LOG.info("Sohbet olayı bu sürümde yok; otomatik giriş mesaj takibi kapalı");
        }
    }
}
