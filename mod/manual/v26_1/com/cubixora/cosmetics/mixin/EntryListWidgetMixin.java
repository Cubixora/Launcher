package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxTheme;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.AbstractSelectionList;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

/** Listelerde (dünyalar, sunucular, paketler) seçili satır Cubixora vurgusuyla çizilir. */
@Mixin(AbstractSelectionList.class)
public abstract class EntryListWidgetMixin {
    @Redirect(method = "extractSelection", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/gui/GuiGraphicsExtractor;fill(IIIII)V", ordinal = 0), require = 0)
    private void cubixora$border(GuiGraphicsExtractor c, int x1, int y1, int x2, int y2, int color) {
        if (CxTheme.on()) CxTheme.selection(c, x1, y1, x2 - x1, y2 - y1, color == -1);
        else c.fill(x1, y1, x2, y2, color);
    }

    @Redirect(method = "extractSelection", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/gui/GuiGraphicsExtractor;fill(IIIII)V", ordinal = 1), require = 0)
    private void cubixora$inner(GuiGraphicsExtractor c, int x1, int y1, int x2, int y2, int color) {
        if (!CxTheme.on()) c.fill(x1, y1, x2, y2, color);
    }
}
