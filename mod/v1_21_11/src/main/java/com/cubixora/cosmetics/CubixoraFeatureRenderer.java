package com.cubixora.cosmetics;

import net.minecraft.client.model.ModelPart;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.RenderLayers;
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
            queue.submitCustom(matrices, RenderLayers.entityCutoutNoCull(wingTex), (entry, vc) -> {
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
            float k = 0.32f, side = c.petRight ? -1f : 1f;
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
            queue.submitCustom(matrices, RenderLayers.entityCutoutNoCull(skin.body().texturePath()), (entry, vc) -> {
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
                mini.head.xScale = 1.9f; mini.head.yScale = 1.9f; mini.head.zScale = 1.9f; // büyük kafa (setAngles sıfırlıyor, o yüzden çizimden hemen önce)
                mini.render(Compat.stackFrom(entry), vc, light, OverlayTexture.DEFAULT_UV);
            });
            matrices.pop();
        }

        // --- cx-props
        if (!c.hat.isEmpty()) {
            final CxProps.Model hm = CxProps.get(c.hat);
            if (hm != null) {
                matrices.push();
                this.getContextModel().head.applyTransform(matrices);
                queue.submitCustom(matrices, RenderLayers.entityCutoutNoCull(hm.tex), (entry, vc) -> hm.root.render(Compat.stackFrom(entry), vc, light, OverlayTexture.DEFAULT_UV));
                matrices.pop();
            }
        }
        if (!c.fly.isEmpty()) {
            final CxProps.Model fm = CxProps.get(c.fly);
            if (fm != null) {
                matrices.push();
                final CxProps.Pose fp = CxProps.placeFly(matrices, name, t, limbDistance, state.isInSneakingPose, state.bodyYaw);
                queue.submitCustom(matrices, RenderLayers.entityCutoutNoCull(fm.tex), (entry, vc) -> { CxProps.pose(fm, fp); fm.root.render(Compat.stackFrom(entry), vc, light, OverlayTexture.DEFAULT_UV); });
                matrices.pop();
            }
        }

        // --- cx-flames
        if (c.effect != null && CxFlames.model(c.effect) != null) {
            final CxProps.Model fl = CxProps.get(CxFlames.model(c.effect));
            if (fl != null) {
                for (float[] q : CxFlames.update(name, c.effect)) {
                    final int col = CxFlames.color(q[4]);
                    matrices.push();
                    matrices.translate(q[0], 1.5f - q[1], q[2]);
                    matrices.scale(q[3], q[3] * q[5], q[3]);
                    queue.submitCustom(matrices, RenderLayers.entityTranslucent(fl.tex), (entry, vc) -> fl.root.render(Compat.stackFrom(entry), vc, 15728880, OverlayTexture.DEFAULT_UV, col));
                    matrices.pop();
                }
            }
        }
    }
}
