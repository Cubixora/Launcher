package com.cubixora.client;

import net.minecraft.client.gui.DrawContext;

/** Oyun içi Cubixora göstergeleri: etkin modülleri çizer (bkz. CxMods). */
public final class CxHud {
    private CxHud() {}

    public static void render(DrawContext c) { CxMods.render(c); }
}
