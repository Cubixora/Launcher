package com.cubixora.cosmetics;

import net.minecraft.client.model.ModelPart;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.feature.FeatureRenderer;
import net.minecraft.client.render.entity.feature.FeatureRendererContext;
import net.minecraft.client.render.entity.model.EntityModelLayer;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.player.PlayerSkinType;
import net.minecraft.entity.player.SkinTextures;
import net.minecraft.item.Items;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;

/** 1.21.9+ (komut kuyruğu sistemi): sırta eklemli kanat, omza mini kopya. */
public final class CubixoraFeatureRenderer extends FeatureRenderer<PlayerEntityRenderState, PlayerEntityModel> {

    private final WingModel wings = new WingModel();
    private final PlayerEntityModel miniWide, miniSlim;
    private final PlayerEntityRenderState neutral = new PlayerEntityRenderState();

    public CubixoraFeatureRenderer(FeatureRendererContext<PlayerEntityRenderState, PlayerEntityModel> ctx,
                                   EntityRendererFactory.Context context) {
        super(ctx);
        this.miniWide = new PlayerEntityModel(context.getPart(layer("player")), false);
        this.miniSlim = new PlayerEntityModel(context.getPart(layer("player_slim")), true);
    }

    private static EntityModelLayer layer(String name) {
        return new EntityModelLayer(Identifier.ofVanilla(name), "main");
    }

    @Override
    public void render(MatrixStack matrices, OrderedRenderCommandQueue queue, int light, PlayerEntityRenderState state,
                       float limbAngle, float limbDistance) {
        if (state.invisible) return;
        String name = Compat.playerName(state.id);
        PlayerCosmetics c = CosmeticsManager.get(name);
        if (c == null) return;
        final float t = state.age / 20f;

        Identifier wingTex = c.wingsTexture;
        if (wingTex != null && (state.equippedChestStack == null || !state.equippedChestStack.isOf(Items.ELYTRA))) {
            final boolean flying = state.isGliding;
            final float open = WingModel.openAmount(name, flying || Cubixora.wantWingsOpen(name, c));
            final float speed = c.wingSpeed;
            matrices.push();
            this.getContextModel().body.applyTransform(matrices);
            queue.submitCustom(matrices, RenderLayer.getEntityCutoutNoCull(wingTex), (entry, vc) -> {
                MatrixStack ms = Compat.stackFrom(entry);
                wings.pose(open, t, speed, flying ? 0.6f : 0f);
                for (int side = -1; side <= 1; side += 2) {
                    ms.push();
                    WingModel.place(ms, side);
                    wings.part(side > 0).render(ms, vc, light, OverlayTexture.DEFAULT_UV);
                    ms.pop();
                }
            });
            matrices.pop();
        }

        if (c.pet && state.skinTextures != null) {
            SkinTextures skin = state.skinTextures;
            final PlayerEntityModel mini = skin.model() == PlayerSkinType.SLIM ? miniSlim : miniWide;
            float k = 0.36f, side = c.petRight ? -1f : 1f;
            float bob = Math.abs(MathHelper.sin(t * 3f)) * 0.03f;
            final float hang = Cubixora.petHang(name, state.isInSneakingPose); // eğilince omuzdan sarkar
            final float headYaw = MathHelper.sin(t * 1.3f) * 30f, headPitch = MathHelper.sin(t * 0.9f) * 8f;
            final float age = state.age;
            matrices.push();
            this.getContextModel().body.applyTransform(matrices);
            matrices.translate(Cubixora.lerp(side * Cubixora.petOffsetPx(state.relativeHeadYaw) / 16f, side * 5.5f / 16f, Math.max(0f, Math.min(1f, Math.abs(hang) * 4f))), Cubixora.lerp(-1.5f * k - bob, 0.5f * k, Cubixora.dropY(name)), Cubixora.backZ(name, k));
            matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(MathHelper.sin(t * 0.8f) * 8f * (1f - Math.max(0f, Math.min(1f, Math.abs(hang) * 4f)))));
            matrices.translate(0f, Cubixora.hangPivot(name, k), 0f); // kayarken ayakları, asılıyken elleri etrafında devrilir
            matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(Cubixora.hangPitch(name, t)));
            matrices.translate(0f, -Cubixora.hangPivot(name, k), 0f);
            matrices.scale(k, k, k);
            queue.submitCustom(matrices, RenderLayer.getEntityTranslucent(skin.body().texturePath()), (entry, vc) -> {
                neutral.age = age;
                neutral.relativeHeadYaw = headYaw;
                neutral.pitch = headPitch;
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
                mini.render(Compat.stackFrom(entry), vc, light, OverlayTexture.DEFAULT_UV);
            });
            matrices.pop();
        }
    }
}
