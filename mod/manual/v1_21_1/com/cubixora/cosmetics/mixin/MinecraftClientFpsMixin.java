package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxClient;
import net.minecraft.client.MinecraftClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Vanilla menülerde FPS'i 60'a sabitler; Cubixora'da menüler oyuncunun FPS ayarıyla akıcı çalışır. */
@Mixin(MinecraftClient.class)
public abstract class MinecraftClientFpsMixin {
    @Inject(method = "getFramerateLimit", at = @At("RETURN"), cancellable = true, require = 0)
    private void cubixora$menuFps(CallbackInfoReturnable<Integer> cir) {
        MinecraftClient mc = (MinecraftClient) (Object) this;
        if (CxClient.enabled && cir.getReturnValueI() == 60 && mc.world == null && mc.options != null)
            cir.setReturnValue(Math.max(60, mc.options.getMaxFps().getValue()));
    }
}
