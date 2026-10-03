package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxClient;
import com.cubixora.client.CxTitleScreen;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Cubixora profilinde vanilla ana menü yerine Cubixora ana menüsü açılır (açılış animasyonu yükleme ekranında oynar). */
@Mixin(MinecraftClient.class)
public abstract class MinecraftClientMixin {
    @Inject(method = "setScreen", at = @At("HEAD"), cancellable = true)
    private void cubixora$title(Screen screen, CallbackInfo ci) {
        if (!CxClient.enabled || !(screen instanceof TitleScreen)) return;
        ci.cancel();
        ((MinecraftClient) (Object) this).setScreen(new CxTitleScreen());
    }

    @Inject(method = "getWindowTitle", at = @At("RETURN"), cancellable = true)
    private void cubixora$windowTitle(CallbackInfoReturnable<String> cir) {
        if (CxClient.enabled) cir.setReturnValue("Cubixora Client");
    }
}
