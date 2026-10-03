package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxPause;
import net.minecraft.client.gui.screen.GameMenuScreen;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ClickableWidget;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** ESC menüsüne Cubixora satırı (Cubixora/Gardrop/Mağaza/Skin) ve "Hata Bildir" ekler. */
@Mixin(GameMenuScreen.class)
public abstract class GameMenuScreenMixin extends Screen {
    protected GameMenuScreenMixin(Text title) { super(title); }

    @Inject(method = "init", at = @At("TAIL"), require = 0)
    private void cubixora$extras(CallbackInfo ci) {
        CxPause.install(this, w -> this.addDrawableChild((ClickableWidget) w));
    }
}
