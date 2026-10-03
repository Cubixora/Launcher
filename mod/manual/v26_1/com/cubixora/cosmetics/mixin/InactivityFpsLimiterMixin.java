package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxClient;
import com.mojang.blaze3d.platform.FramerateLimitTracker;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Vanilla menülerde FPS'i 60'a sabitler; Cubixora'da menüler oyuncunun FPS ayarıyla akıcı çalışır. */
@Mixin(FramerateLimitTracker.class)
public abstract class InactivityFpsLimiterMixin {
    @Shadow private int framerateLimit;

    @Inject(method = "getFramerateLimit", at = @At("RETURN"), cancellable = true, require = 0)
    private void cubixora$menuFps(CallbackInfoReturnable<Integer> cir) {
        if (CxClient.enabled && ((FramerateLimitTracker) (Object) this).getThrottleReason() == FramerateLimitTracker.FramerateThrottleReason.OUT_OF_LEVEL_MENU)
            cir.setReturnValue(Math.max(60, framerateLimit));
    }
}
