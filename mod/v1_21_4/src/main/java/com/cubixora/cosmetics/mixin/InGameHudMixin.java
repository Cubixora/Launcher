package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxHud;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.client.render.RenderTickCounter;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(InGameHud.class)
public abstract class InGameHudMixin {
    @Inject(method = "render", at = @At("TAIL"))
    private void cubixora$hud(DrawContext context, RenderTickCounter tickCounter, CallbackInfo ci) {
        CxHud.render(context);
    }

    // Cubixora nişangahı açıksa oyunun kendi nişangahı çizilmez (Cubixora'nınki HUD'da çizilir)
    @Inject(method = {"renderCrosshair", "extractCrosshair"}, at = @At("HEAD"), cancellable = true, require = 0)
    private void cubixora$crosshair(CallbackInfo ci) { if (com.cubixora.client.CxCrosshair.active()) ci.cancel(); }
}
