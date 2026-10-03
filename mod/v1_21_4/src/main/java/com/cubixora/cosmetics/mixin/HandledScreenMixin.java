package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxChest;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.ingame.HandledScreen;
import net.minecraft.client.gui.widget.ClickableWidget;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Sandık ekranına "Hepsini Al" / "Hepsini Koy" düğmeleri. */
@Mixin(HandledScreen.class)
public abstract class HandledScreenMixin extends Screen {
    @Shadow protected int x;
    @Shadow protected int y;
    @Shadow protected int backgroundWidth;
    protected HandledScreenMixin(Text title) { super(title); }

    @Inject(method = "init", at = @At("TAIL"), require = 0)
    private void cubixora$chestButtons(CallbackInfo ci) {
        CxChest.install((HandledScreen<?>) (Object) this, this.x, this.y, this.backgroundWidth, w -> this.addDrawableChild(w));
    }
}
