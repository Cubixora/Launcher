package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxPause;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** ESC menüsüne Cubixora satırı ve "Hata Bildir" ekler. */
@Mixin(PauseScreen.class)
public abstract class GameMenuScreenMixin extends Screen {
    protected GameMenuScreenMixin(Component title) { super(title); }

    @Inject(method = "init", at = @At("TAIL"), require = 0)
    private void cubixora$extras(CallbackInfo ci) {
        CxPause.install(this, w -> this.addRenderableWidget((AbstractWidget) w));
    }
}
