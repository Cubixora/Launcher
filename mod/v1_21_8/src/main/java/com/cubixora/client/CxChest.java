package com.cubixora.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.ingame.HandledScreen;
import net.minecraft.client.gui.widget.ClickableWidget;
import net.minecraft.screen.GenericContainerScreenHandler;
import net.minecraft.screen.ScreenHandler;
import net.minecraft.screen.ShulkerBoxScreenHandler;
import net.minecraft.screen.slot.Slot;
import net.minecraft.screen.slot.SlotActionType;
import net.minecraft.text.Text;
import net.minecraft.text.TranslatableTextContent;

import java.util.Set;
import java.util.function.Consumer;

/**
 * Sandık / varil / shulker / ender sandığı açılınca üstte iki düğme:
 * "Hepsini Al" sandıktakileri envantere, "Hepsini Koy" envanterdekileri sandığa taşır (vanilla shift+tık ile).
 * Sunucu menüleri (ItemsAdder, DeluxeMenus vb.) de sandık ekranı kullandığı için düğmeler yalnız
 * başlığı Minecraft'ın kendi sandık başlığı olan ekranlarda çıkar; menülerde yanlışlıkla bir şeye tıklanmaz.
 */
public final class CxChest {
    private CxChest() {}
    private static final Set<String> TITLES = Set.of("container.chest", "container.chestDouble", "container.barrel", "container.shulkerBox", "container.enderchest");

    static boolean eligible(Text title, ScreenHandler h) {
        if (!CxClient.enabled) return false;
        if (!(h instanceof GenericContainerScreenHandler) && !(h instanceof ShulkerBoxScreenHandler)) return false;
        return title.getContent() instanceof TranslatableTextContent t && TITLES.contains(t.getKey());
    }

    public static void install(HandledScreen<?> s, int left, int top, int bgW, Consumer<ClickableWidget> add) {
        ScreenHandler h = s.getScreenHandler();
        if (!eligible(s.getTitle(), h)) return;
        int bw = 64, bh = 13, gap = 3;
        int x = left + bgW - 2 * bw - gap, y = Math.max(2, top - bh - 3);
        add.accept(new CxFlatButton(x, y, bw, bh, "Hepsini Al", () -> move(h, true)));
        add.accept(new CxFlatButton(x + bw + gap, y, bw, bh, "Hepsini Koy", () -> move(h, false)));
    }

    /** take: sandık -> envanter, değilse envanter -> sandık. */
    static void move(ScreenHandler h, boolean take) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player == null || mc.interactionManager == null) return;
        var inv = mc.player.getInventory();
        for (Slot sl : new java.util.ArrayList<>(h.slots)) {
            boolean mine = sl.inventory == inv;
            if (mine == take || !sl.hasStack()) continue;
            mc.interactionManager.clickSlot(h.syncId, sl.id, 0, SlotActionType.QUICK_MOVE, mc.player);
        }
    }
}
