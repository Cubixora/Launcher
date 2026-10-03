package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxClient;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.entity.feature.CapeFeatureRenderer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.RotationAxis;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Ayarlardan açılırsa pelerin bayrak gibi savrulup dalgalanır (durduğunda bile). */
@Mixin(CapeFeatureRenderer.class)
public abstract class CapeFlagMixin {
    @Inject(method = "render(Lnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/command/OrderedRenderCommandQueue;ILnet/minecraft/client/render/entity/state/PlayerEntityRenderState;FF)V", at = @At("HEAD"), require = 0)
    private void cubixora$flag(MatrixStack matrices, OrderedRenderCommandQueue q, int light, PlayerEntityRenderState p, float a, float b, CallbackInfo ci) {
        if (!CxClient.enabled || !CxClient.settings.capeFlag) return;
        float t = System.nanoTime() / 1.0e9f + p.id * 1.7f;
        matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(7f * (float) Math.sin(t * 3.1f) + 4f * (float) Math.sin(t * 5.3f + 1f)));
        matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(6f * (float) Math.sin(t * 2.2f + 0.5f)));
        matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(4f * (float) Math.sin(t * 2.7f)));
    }
}
