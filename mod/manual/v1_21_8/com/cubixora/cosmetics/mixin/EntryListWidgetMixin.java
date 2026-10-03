package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxTheme;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.widget.EntryListWidget;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Listelerde (dünyalar, sunucular, paketler) seçili satır Cubixora vurgusuyla çizilir. */
@Mixin(EntryListWidget.class)
public abstract class EntryListWidgetMixin {
    @Inject(method = "drawSelectionHighlight", at = @At("HEAD"), cancellable = true, require = 0)
    private void cubixora$selection(DrawContext c, int y, int entryWidth, int entryHeight, int borderColor, int fillColor, CallbackInfo ci) {
        if (!CxTheme.on()) return;
        EntryListWidget<?> self = (EntryListWidget<?>) (Object) this;
        int x = self.getX() + (self.getWidth() - entryWidth) / 2;
        CxTheme.selection(c, x, y - 2, entryWidth, entryHeight + 4, borderColor == -1);
        ci.cancel();
    }
}
