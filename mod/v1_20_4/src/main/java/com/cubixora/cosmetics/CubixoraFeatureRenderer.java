package com.cubixora.cosmetics;

import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.feature.FeatureRenderer;
import net.minecraft.client.render.entity.feature.FeatureRendererContext;
import net.minecraft.client.render.entity.model.EntityModelLayers;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.item.Items;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;

/** Minecraft 1.20.2, 1.20.3, 1.20.4: sırta eklemli kanat, omza mini kopya. */
public final class CubixoraFeatureRenderer
        extends FeatureRenderer<AbstractClientPlayerEntity, PlayerEntityModel<AbstractClientPlayerEntity>> {

    private final WingModel wings = new WingModel();
    private final PlayerEntityModel<AbstractClientPlayerEntity> miniWide, miniSlim;

    public CubixoraFeatureRenderer(FeatureRendererContext<AbstractClientPlayerEntity, PlayerEntityModel<AbstractClientPlayerEntity>> ctx,
                                   EntityRendererFactory.Context context) {
        super(ctx);
        this.miniWide = new PlayerEntityModel<>(context.getPart(EntityModelLayers.PLAYER), false);
        this.miniSlim = new PlayerEntityModel<>(context.getPart(EntityModelLayers.PLAYER_SLIM), true);
    }

    @Override
    public void render(MatrixStack matrices, VertexConsumerProvider vertices, int light, AbstractClientPlayerEntity player,
                       float limbAngle, float limbDistance, float tickDelta, float animationProgress, float headYaw, float headPitch) {
        if (player.isInvisible()) return;
        String name = player.getGameProfile().getName();
        PlayerCosmetics c = CosmeticsManager.get(name);
        if (c == null) return;
        float t = (player.age + tickDelta) / 20f;

        if (c.wingsTexture != null && !player.getEquippedStack(EquipmentSlot.CHEST).isOf(Items.ELYTRA)) {
            boolean flying = player.getAbilities().flying || player.isFallFlying();
            float open = WingModel.openAmount(name, flying || Cubixora.wantWingsOpen(name, c));
            matrices.push();
            this.getContextModel().body.rotate(matrices);
            wings.render(matrices, vertices.getBuffer(RenderLayer.getEntityCutoutNoCull(c.wingsTexture)),
                    light, open, t, c.wingSpeed, flying ? 0.6f : 0f);
            matrices.pop();
        }

        if (c.pet) {
            PlayerEntityModel<AbstractClientPlayerEntity> mini = player.getSkinTextures().model() == SkinTextures.Model.SLIM ? miniSlim : miniWide;
            float k = 0.36f, side = c.petRight ? -1f : 1f;
            float bob = Math.abs(MathHelper.sin(t * 3f)) * 0.03f;
            final float hang = Cubixora.petHang(name, player.isInSneakingPose()); // eğilince omuzdan sarkar
            mini.setAngles(player, 0f, 0f, animationProgress, MathHelper.sin(t * 1.3f) * 30f, MathHelper.sin(t * 0.9f) * 8f);
            mini.rightArm.roll = 0.1f + MathHelper.sin(t * 5f) * 0.08f;
            mini.leftArm.roll = -0.1f - MathHelper.sin(t * 5f) * 0.08f;
            if (Math.abs(hang) > 0.001f || Cubixora.armsUp(name, 0f) > 0f) { // ellerini kaldırıp tutunur, bacaklarını çırpar
                float h = Math.max(0f, Math.min(1f, hang));
                mini.rightArm.pitch = Cubixora.lerp(mini.rightArm.pitch, -2.95f, Cubixora.armsUp(name, h));
                mini.leftArm.pitch = Cubixora.lerp(mini.leftArm.pitch, -2.95f, Cubixora.armsUp(name, h));
                mini.rightArm.roll = Cubixora.lerp(mini.rightArm.roll, 0.18f, h);
                mini.leftArm.roll = Cubixora.lerp(mini.leftArm.roll, -0.18f, h);
                mini.rightLeg.pitch = Cubixora.flail(name, t, 0);
                mini.leftLeg.pitch = Cubixora.flail(name, t, 1);
                mini.head.pitch = Cubixora.lerp(mini.head.pitch, 0.4f, h);
                mini.rightPants.copyTransform(mini.rightLeg);
                mini.leftPants.copyTransform(mini.leftLeg);
                mini.hat.copyTransform(mini.head);
            }
            mini.rightSleeve.copyTransform(mini.rightArm);
            mini.leftSleeve.copyTransform(mini.leftArm);
            matrices.push();
            this.getContextModel().body.rotate(matrices);
            matrices.translate(Cubixora.lerp(side * Cubixora.petOffsetPx(headYaw) / 16f, side * 5.5f / 16f, Math.max(0f, Math.min(1f, Math.abs(hang) * 4f))), Cubixora.lerp(-1.5f * k - bob, 0.5f * k, Cubixora.dropY(name)), Cubixora.backZ(name, k));
            matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(MathHelper.sin(t * 0.8f) * 8f * (1f - Math.max(0f, Math.min(1f, Math.abs(hang) * 4f)))));
            matrices.translate(0f, Cubixora.hangPivot(name, k), 0f); // kayarken ayakları, asılıyken elleri etrafında devrilir
            matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(Cubixora.hangPitch(name, t)));
            matrices.translate(0f, -Cubixora.hangPivot(name, k), 0f);
            matrices.scale(k, k, k);
            mini.render(matrices, vertices.getBuffer(RenderLayer.getEntityTranslucent(player.getSkinTextures().texture())), light, OverlayTexture.DEFAULT_UV, 1f, 1f, 1f, 1f);
            matrices.pop();
        }
    }
}
