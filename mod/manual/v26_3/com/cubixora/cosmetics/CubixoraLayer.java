package com.cubixora.cosmetics;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import net.minecraft.client.model.geom.ModelLayers;
import net.minecraft.client.model.player.PlayerModel;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.RenderLayerParent;
import net.minecraft.client.renderer.entity.layers.RenderLayer;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import net.minecraft.client.renderer.rendertype.RenderTypes;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.resources.Identifier;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.player.PlayerModelType;
import net.minecraft.world.entity.player.PlayerSkin;
import net.minecraft.world.item.Items;

/** 26.x: sırta eklemli kanat, omza mini kopya. */
public final class CubixoraLayer extends RenderLayer<AvatarRenderState, PlayerModel> {

    private final WingModel wings = new WingModel();
    private final PlayerModel miniWide, miniSlim;
    private final AvatarRenderState neutral = new AvatarRenderState();

    public CubixoraLayer(RenderLayerParent<AvatarRenderState, PlayerModel> parent, EntityRendererProvider.Context context) {
        super(parent);
        this.miniWide = new PlayerModel(context.bakeLayer(ModelLayers.PLAYER), false);
        this.miniSlim = new PlayerModel(context.bakeLayer(ModelLayers.PLAYER_SLIM), true);
    }

    @Override
    public void submit(PoseStack poses, SubmitNodeCollector queue, int light, AvatarRenderState state, float yRot, float xRot) {
        if (state.isInvisible) return;
        String name = Compat.playerName(state.id);
        PlayerCosmetics c = CosmeticsManager.get(name);
        if (c == null) return;
        final float t = state.ageInTicks / 20f;

        Identifier wingTex = c.wingsTexture;
        if (wingTex != null && (state.chestEquipment == null || state.chestEquipment.getItem() != Items.ELYTRA)) {
            final boolean flying = state.isFallFlying;
            final float open = WingModel.openAmount(name, flying || Cubixora.wantWingsOpen(name, c));
            final float speed = c.wingSpeed;
            poses.pushPose();
            this.getParentModel().body.translateAndRotate(poses);
            queue.submitCustomGeometry(poses, RenderTypes.entityCutout(wingTex), (pose, vc) -> {
                PoseStack ps = Compat.stackFrom(pose);
                wings.pose(open, t, speed, flying ? 0.6f : 0f);
                for (int side = -1; side <= 1; side += 2) {
                    ps.pushPose();
                    WingModel.place(ps, side);
                    wings.part(side > 0).render(ps, vc, light, OverlayTexture.NO_OVERLAY);
                    ps.popPose();
                }
            });
            poses.popPose();
        }

        if (c.pet && state.skin != null) {
            PlayerSkin skin = state.skin;
            final PlayerModel mini = skin.model() == PlayerModelType.SLIM ? miniSlim : miniWide;
            float k = 0.36f, side = c.petRight ? -1f : 1f;
            float bob = Math.abs(Mth.sin(t * 3f)) * 0.03f;
            final float hang = Cubixora.petHang(name, state.isCrouching); // eğilince omuzdan sarkar
            final float headYaw = Mth.sin(t * 1.3f) * 30f, headPitch = Mth.sin(t * 0.9f) * 8f;
            final float age = state.ageInTicks;
            poses.pushPose();
            this.getParentModel().body.translateAndRotate(poses);
            poses.translate(Cubixora.lerp(side * Cubixora.petOffsetPx(state.yRot) / 16f, side * 5.5f / 16f, Math.max(0f, Math.min(1f, Math.abs(hang) * 4f))), Cubixora.lerp(-1.5f * k - bob, 0.5f * k, Cubixora.dropY(name)), Cubixora.backZ(name, k));
            poses.rotateAround(Axis.YP.rotationDegrees(Mth.sin(t * 0.8f) * 8f * (1f - Math.max(0f, Math.min(1f, Math.abs(hang) * 4f)))), 0f, 0f, 0f);
            poses.rotateAround(Axis.XP.rotationDegrees(Cubixora.hangPitch(name, t)), 0f, Cubixora.hangPivot(name, k), 0f); // ellerinden tutunup sallanır
            poses.scale(k, k, k);
            queue.submitCustomGeometry(poses, RenderTypes.entityTranslucent(skin.body().texturePath()), (pose, vc) -> {
                neutral.ageInTicks = age;
                neutral.yRot = headYaw;
                neutral.xRot = headPitch;
                mini.setupAnim(neutral);
                mini.rightArm.zRot = 0.1f + Mth.sin(t * 5f) * 0.08f;
                mini.leftArm.zRot = -0.1f - Mth.sin(t * 5f) * 0.08f;
                if (Math.abs(hang) > 0.001f || Cubixora.armsUp(name, 0f) > 0f) { // ellerini kaldırıp tutunur, bacaklarını çırpar
                    float h = Math.max(0f, Math.min(1f, hang));
                    mini.rightArm.xRot = Cubixora.lerp(mini.rightArm.xRot, -2.95f, Cubixora.armsUp(name, h));
                    mini.leftArm.xRot = Cubixora.lerp(mini.leftArm.xRot, -2.95f, Cubixora.armsUp(name, h));
                    mini.rightArm.zRot = Cubixora.lerp(mini.rightArm.zRot, 0.18f, h);
                    mini.leftArm.zRot = Cubixora.lerp(mini.leftArm.zRot, -0.18f, h);
                    mini.rightLeg.xRot = Cubixora.flail(name, t, 0);
                    mini.leftLeg.xRot = Cubixora.flail(name, t, 1);
                    mini.head.xRot = Cubixora.lerp(mini.head.xRot, 0.4f, h);
                }
                mini.renderToBuffer(Compat.stackFrom(pose), vc, light, OverlayTexture.NO_OVERLAY, -1);
            });
            poses.popPose();
        }
    }
}
