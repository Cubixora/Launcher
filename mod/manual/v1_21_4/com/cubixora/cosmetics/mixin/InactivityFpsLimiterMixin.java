package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxClient;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.InactivityFpsLimiter;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Vanilla menülerde FPS'i 60'a sabitler; Cubixora'da menüler oyuncunun FPS ayarıyla akıcı çalışır. */
@Mixin(InactivityFpsLimiter.class)
public abstract class InactivityFpsLimiterMixin {
    @Shadow private int maxFps;

    @Inject(method = "update", at = @At("RETURN"), cancellable = true, require = 0)
    private void cubixora$menuFps(CallbackInfoReturnable<Integer> cir) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (CxClient.enabled && cir.getReturnValueI() == 60 && mc != null && mc.world == null && !mc.getWindow().isMinimized())
            cir.setReturnValue(Math.max(60, maxFps));
    }
}
