package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxCapePhys;
import com.cubixora.client.CxClient;
import com.cubixora.cosmetics.CxCloakAccess;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.entity.feature.CapeFeatureRenderer;
import net.minecraft.client.render.entity.feature.FeatureRenderer;
import net.minecraft.client.render.entity.feature.FeatureRendererContext;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.MathHelper;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Pelerin fiziği (1.21.1): kök açıyı oyunun formülüyle hesaplar, eklem açılarını cloak zincirine yazar. */
@Mixin(CapeFeatureRenderer.class)
public abstract class CapeBendFeatureMixin extends FeatureRenderer<AbstractClientPlayerEntity, PlayerEntityModel<AbstractClientPlayerEntity>> {
    private ModelPart[] cx$seg; private boolean cx$logged;
    private final float[] cx$p = new float[CxCapePhys.N], cx$r = new float[CxCapePhys.N];

    public CapeBendFeatureMixin(FeatureRendererContext<AbstractClientPlayerEntity, PlayerEntityModel<AbstractClientPlayerEntity>> ctx) { super(ctx); }

    @Inject(method = "render(Lnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/VertexConsumerProvider;ILnet/minecraft/client/network/AbstractClientPlayerEntity;FFFFFF)V", at = @At("HEAD"), require = 0)
    private void cubixora$bend(MatrixStack matrices, VertexConsumerProvider vc, int light, AbstractClientPlayerEntity p, float a, float b, float h, float c, float d, float e, CallbackInfo ci) {
        try {
            ModelPart root = ((CxCloakAccess) (Object) getContextModel()).cubixora$cloak();
            if (cx$seg == null || cx$seg[0] != root) {
                ModelPart[] arr = new ModelPart[CxCapePhys.N]; ModelPart cur = root; arr[0] = cur;
                for (int i = 1; i < CxCapePhys.N; i++) { cur = cur.getChild("cx" + i); arr[i] = cur; }
                cx$seg = arr;
            }
            float sw = CxClient.enabled ? CxCapePhys.sway(p.getId()) : 0f;
            cx$seg[0].pitch = (float) -Math.toRadians(sw);   // tek parça salınım (çerçeve ters: eksi)
            if (CxClient.enabled && CxClient.settings.capeBend) {
                double dx = MathHelper.lerp(h, p.prevCapeX, p.capeX) - MathHelper.lerp(h, p.prevX, p.getX());
                double dy = MathHelper.lerp(h, p.prevCapeY, p.capeY) - MathHelper.lerp(h, p.prevY, p.getY());
                double dz = MathHelper.lerp(h, p.prevCapeZ, p.capeZ) - MathHelper.lerp(h, p.prevZ, p.getZ());
                float yaw = MathHelper.lerpAngleDegrees(h, p.prevBodyYaw, p.bodyYaw);
                double sn = MathHelper.sin(yaw * 0.017453292f), cs = -MathHelper.cos(yaw * 0.017453292f);
                float flap = MathHelper.clamp((float) dy * 10f, -6f, 32f);
                float lean = MathHelper.clamp((float) (dx * sn + dz * cs) * 100f, 0f, 150f);
                float lean2 = MathHelper.clamp((float) (dx * cs - dz * sn) * 100f, -20f, 20f);
                flap += MathHelper.sin(MathHelper.lerp(h, p.prevHorizontalSpeed, p.horizontalSpeed) * 6f) * 32f * MathHelper.lerp(h, p.prevStrideDistance, p.strideDistance);
                if (p.isInSneakingPose()) flap += 25f;
                CxCapePhys.step(p.getId(), 6f + lean / 2f + flap + sw, lean2 / 2f, cx$p, cx$r);
            } else CxCapePhys.rigid(cx$p, cx$r);
            for (int i = 1; i < CxCapePhys.N; i++) { cx$seg[i].pitch = (float) -Math.toRadians(cx$p[i]); cx$seg[i].roll = (float) Math.toRadians(cx$r[i]); }   // 1.21.1'de çerçeve ters: eksi
            if (!cx$logged) { cx$logged = true; System.out.println("[Cubixora] pelerin fiziği aktif (parça=" + cx$seg.length + ")"); }
        } catch (Throwable ignored) { }
    }
}
