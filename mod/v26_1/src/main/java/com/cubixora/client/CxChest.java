package com.cubixora.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.contents.TranslatableContents;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ShulkerBoxMenu;
import net.minecraft.world.inventory.Slot;

import java.util.Set;
import java.util.function.Consumer;

/**
 * Sandık / varil / shulker / ender sandığı açılınca üstte iki düğme:
 * "Hepsini Al" sandıktakileri envantere, "Hepsini Koy" envanterdekileri sandığa taşır (vanilla shift+tık ile).
 * Sunucu menüleri de sandık ekranı kullandığı için düğmeler yalnız başlığı Minecraft'ın kendi sandık başlığı olan ekranlarda çıkar.
 */
public final class CxChest {
    private CxChest() {}
    private static final Set<String> TITLES = Set.of("container.chest", "container.chestDouble", "container.barrel", "container.shulkerBox", "container.enderchest");

    static boolean eligible(Component title, AbstractContainerMenu h) {
        if (!CxClient.enabled) return false;
        if (!(h instanceof ChestMenu) && !(h instanceof ShulkerBoxMenu)) return false;
        return title.getContents() instanceof TranslatableContents t && TITLES.contains(t.getKey());
    }

    public static void install(AbstractContainerScreen<?> s, int left, int top, int bgW, Consumer<AbstractWidget> add) {
        AbstractContainerMenu h = s.getMenu();
        if (!eligible(s.getTitle(), h)) return;
        int bw = 64, bh = 13, gap = 3;
        int x = left + bgW - 2 * bw - gap, y = Math.max(2, top - bh - 3);
        add.accept(new CxFlatButton(x, y, bw, bh, "Hepsini Al", () -> move(h, true)));
        add.accept(new CxFlatButton(x + bw + gap, y, bw, bh, "Hepsini Koy", () -> move(h, false)));
    }

    static void move(AbstractContainerMenu h, boolean take) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || mc.gameMode == null) return;
        var inv = mc.player.getInventory();
        for (Slot sl : new java.util.ArrayList<>(h.slots)) {
            boolean mine = sl.container == inv;
            if (mine == take || !sl.hasItem()) continue;
            quickMove(mc, h.containerId, sl.index);
        }
    }

    // 26.x'te tıklama türünün adı değişti (ClickType -> ContainerInput, handleInventoryMouseClick -> handleContainerInput).
    // İki adla da çalışsın diye metot oyun içinde bulunur: (int, int, int, <QUICK_MOVE içeren enum>, Player).
    private static java.lang.reflect.Method clickM; private static Object quickV;
    private static void quickMove(Minecraft mc, int containerId, int slot) {
        try {
            if (clickM == null) {
                for (java.lang.reflect.Method m : mc.gameMode.getClass().getMethods()) {
                    Class<?>[] p = m.getParameterTypes();
                    if (p.length != 5 || p[0] != int.class || p[1] != int.class || p[2] != int.class || !p[3].isEnum()) continue;
                    for (Object c : p[3].getEnumConstants()) if (((Enum<?>) c).name().equals("QUICK_MOVE")) { clickM = m; quickV = c; }
                    if (clickM != null) break;
                }
                if (clickM == null) return;
            }
            clickM.invoke(mc.gameMode, containerId, slot, 0, quickV, mc.player);
        } catch (Throwable ignored) {}
    }
}
