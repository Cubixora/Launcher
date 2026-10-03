package com.cubixora.cosmetics;

import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.feature.FeatureRenderer;
import net.minecraft.client.render.entity.feature.FeatureRendererContext;
import net.minecraft.client.render.entity.model.EntityModelLayers;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.item.Items;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;

/** 1.21.4 (render state sistemi): sırta eklemli kanat, omza mini kopya. */
public final class CubixoraFeatureRenderer extends FeatureRenderer<PlayerEntityRenderState, PlayerEntityModel> {

    private final WingModel wings = new WingModel();
    private final PlayerEntityModel miniWide, miniSlim;
    private final PlayerEntityRenderState neutral = new PlayerEntityRenderState();

    public CubixoraFeatureRenderer(FeatureRendererContext<PlayerEntityRenderState, PlayerEntityModel> ctx,
                                   EntityRendererFactory.Context context) {
        super(ctx);
        this.miniWide = new PlayerEntityModel(context.getPart(EntityModelLayers.PLAYER), false);
        this.miniSlim = new PlayerEntityModel(context.getPart(EntityModelLayers.PLAYER_SLIM), true);
    }

    @Override
    public void render(MatrixStack matrices, VertexConsumerProvider vertices, int light, PlayerEntityRenderState state,
                       float limbAngle, float limbDistance) {
        if (state.invisible) return;
        String name = state.name;
        PlayerCosmetics c = CosmeticsManager.get(name);
        if (c == null) return;
        float t = state.age / 20f;

        if (c.wingsTexture != null && !state.equippedChestStack.isOf(Items.ELYTRA)) {
            boolean flying = state.isGliding;
            float open = WingModel.openAmount(name, flying || Cubixora.wantWingsOpen(name, c));
            matrices.push();
            this.getContextModel().body.rotate(matrices);
            wings.render(matrices, vertices.getBuffer(RenderLayer.getEntityCutoutNoCull(c.wingsTexture)),
                    light, open, t, c.wingSpeed, flying ? 0.6f : 0f);
            matrices.pop();
        }

        if (c.pet) {
            SkinTextures skin = state.skinTextures;
            PlayerEntityModel mini = skin.model() == SkinTextures.Model.SLIM ? miniSlim : miniWide;
            float k = 0.32f, side = c.petRight ? -1f : 1f;
            float bob = Math.abs(MathHelper.sin(t * 3f)) * 0.03f;
            final float hang = Cubixora.petHang(name, state.isInSneakingPose); // eğilince omuzdan sarkar
            neutral.age = state.age;
            neutral.yawDegrees = MathHelper.sin(t * 1.3f) * 30f;
            neutral.pitch = MathHelper.sin(t * 0.9f) * 8f;
            mini.setAngles(neutral);
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
            }
            matrices.push();
            this.getContextModel().body.rotate(matrices);
            matrices.translate(Cubixora.lerp(side * Cubixora.petOffsetPx(state.yawDegrees) / 16f, side * 5.5f / 16f, Math.max(0f, Math.min(1f, Math.abs(hang) * 4f))), Cubixora.lerp(-1.5f * k - bob, 0.5f * k, Cubixora.dropY(name)), Cubixora.backZ(name, k));
            matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(MathHelper.sin(t * 0.8f) * 8f * (1f - Math.max(0f, Math.min(1f, Math.abs(hang) * 4f)))));
            matrices.translate(0f, Cubixora.hangPivot(name, k), 0f); // kayarken ayakları, asılıyken elleri etrafında devrilir
            matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(Cubixora.hangPitch(name, t)));
            matrices.translate(0f, -Cubixora.hangPivot(name, k), 0f);
            matrices.scale(k, k, k);
            mini.head.xScale = 1.9f; mini.head.yScale = 1.9f; mini.head.zScale = 1.9f; // büyük kafa (setAngles sıfırlıyor, o yüzden çizimden hemen önce)
            mini.render(matrices, vertices.getBuffer(RenderLayer.getEntityCutoutNoCull(skin.texture())), light, OverlayTexture.DEFAULT_UV);
            matrices.pop();
        }

        // --- cx-props
        if (!c.hat.isEmpty()) {
            final CxProps.Model hm = CxProps.get(c.hat);
            if (hm != null) {
                matrices.push();
                this.getContextModel().head.rotate(matrices);
                hm.root.render(matrices, vertices.getBuffer(RenderLayer.getEntityCutoutNoCull(hm.tex)), light, OverlayTexture.DEFAULT_UV);
                matrices.pop();
            }
        }
        if (!c.fly.isEmpty()) {
            final CxProps.Model fm = CxProps.get(c.fly);
            if (fm != null) {
                matrices.push();
                CxProps.Pose fp = CxProps.placeFly(matrices, name, t, limbDistance, state.isInSneakingPose, state.bodyYaw);
                CxProps.pose(fm, fp);
                fm.root.render(matrices, vertices.getBuffer(RenderLayer.getEntityCutoutNoCull(fm.tex)), light, OverlayTexture.DEFAULT_UV);
                matrices.pop();
            }
        }

        // --- cx-flames
        // ateş efekti: ayakların çevresinden yükselen alevler (CxFlames); tam parlaklık, yarı saydam
        if (c.effect != null && CxFlames.model(c.effect) != null) {
            final CxProps.Model fl = CxProps.get(CxFlames.model(c.effect));
            if (fl != null) {
                for (float[] q : CxFlames.update(name, c.effect)) {
                    matrices.push();
                    matrices.translate(q[0], 1.5f - q[1], q[2]);
                    matrices.scale(q[3], q[3] * q[5], q[3]);
                    fl.root.render(matrices, vertices.getBuffer(RenderLayer.getEntityTranslucent(fl.tex)), 15728880, OverlayTexture.DEFAULT_UV, CxFlames.color(q[4]));
                    matrices.pop();
                }
            }
        }
    }
}
