package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxClient;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.entity.layers.CapeLayer;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Ayarlardan açılırsa pelerin bayrak gibi savrulup dalgalanır (durduğunda bile). */
@Mixin(CapeLayer.class)
public abstract class CapeFlagMixin {
    @Inject(method = "submit(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;ILnet/minecraft/client/renderer/entity/state/AvatarRenderState;FF)V", at = @At("HEAD"), require = 0)
    private void cubixora$flag(PoseStack poseStack, SubmitNodeCollector q, int light, AvatarRenderState p, float a, float b, CallbackInfo ci) {
        if (!CxClient.enabled || !CxClient.settings.capeFlag) return;
        float t = System.nanoTime() / 1.0e9f + p.id * 1.7f;
        poseStack.mulPose(Axis.XP.rotationDegrees(7f * (float) Math.sin(t * 3.1f) + 4f * (float) Math.sin(t * 5.3f + 1f)));
        poseStack.mulPose(Axis.YP.rotationDegrees(6f * (float) Math.sin(t * 2.2f + 0.5f)));
        poseStack.mulPose(Axis.ZP.rotationDegrees(4f * (float) Math.sin(t * 2.7f)));
    }
}
