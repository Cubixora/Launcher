package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxChest;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Sandık ekranına "Hepsini Al" / "Hepsini Koy" düğmeleri. */
@Mixin(AbstractContainerScreen.class)
public abstract class HandledScreenMixin extends Screen {
    @Shadow protected int leftPos;
    @Shadow protected int topPos;
    @Shadow protected int imageWidth;
    protected HandledScreenMixin(Component title) { super(title); }

    @Inject(method = "init", at = @At("TAIL"), require = 0)
    private void cubixora$chestButtons(CallbackInfo ci) {
        CxChest.install((AbstractContainerScreen<?>) (Object) this, this.leftPos, this.topPos, this.imageWidth, w -> this.addRenderableWidget(w));
    }
}
