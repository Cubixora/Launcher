package com.cubixora.client;

import net.minecraft.client.gui.GuiGraphicsExtractor;

/** Oyun içi Cubixora göstergeleri: etkin modülleri çizer (bkz. CxMods). */
public final class CxHud {
    private CxHud() {}

    public static void render(GuiGraphicsExtractor c) { CxMods.render(c); }
}
