package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxMods;
import net.minecraft.client.render.Camera;
import net.minecraft.client.render.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Zoom: dünya görüş açısını çarpanla daraltır (seçenekteki 30 derece sınırının ötesine geçer). El görüşü etkilenmez. */
@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {
    @Inject(method = "getFov", at = @At("RETURN"), cancellable = true, require = 0)
    private void cubixora$zoom(Camera camera, float tickProgress, boolean changingFov, CallbackInfoReturnable<Float> cir) {
        float m = CxMods.zoomFactor();
        if (changingFov && m != 1f) cir.setReturnValue(cir.getReturnValue() * m);
    }
}
