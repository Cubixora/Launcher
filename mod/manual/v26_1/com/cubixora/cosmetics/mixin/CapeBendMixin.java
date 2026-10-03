package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxCapePhys;
import com.cubixora.client.CxClient;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeDeformation;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.PartDefinition;
import net.minecraft.client.model.player.PlayerCapeModel;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Pelerini 8 eklemli parçaya böler; fizik her karede eklem açılarını ayarlar (kapalıysa hepsi 0 = tek parça). */
@Mixin(PlayerCapeModel.class)
public abstract class CapeBendMixin {
    @Shadow @Final private ModelPart cape;
    private ModelPart[] cx$seg; private boolean cx$logged;
    private final float[] cx$p = new float[CxCapePhys.N], cx$r = new float[CxCapePhys.N];

    @Redirect(method = "createCapeLayer", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/model/geom/builders/PartDefinition;addOrReplaceChild(Ljava/lang/String;Lnet/minecraft/client/model/geom/builders/CubeListBuilder;Lnet/minecraft/client/model/geom/PartPose;)Lnet/minecraft/client/model/geom/builders/PartDefinition;"), require = 0)
    private static PartDefinition cubixora$segments(PartDefinition parent, String name, CubeListBuilder vanilla, PartPose pose) {
        if (!"cape".equals(name)) return parent.addOrReplaceChild(name, vanilla, pose);
        PartDefinition cur = parent.addOrReplaceChild(name, seg(0), pose);
        for (int i = 1; i < CxCapePhys.N; i++) cur = cur.addOrReplaceChild("cx" + i, seg(i), PartPose.offset(0f, 2f, 0f));
        return cur;
    }

    private static CubeListBuilder seg(int i) {
        return CubeListBuilder.create().texOffs(0, 2 * i).addBox(-5f, 0f, -1f, 10f, 2f, 1f, CubeDeformation.NONE, 1f, 0.5f);
    }

    @Inject(method = "setupAnim(Lnet/minecraft/client/renderer/entity/state/AvatarRenderState;)V", at = @At("TAIL"), require = 0)
    private void cubixora$bend(AvatarRenderState s, CallbackInfo ci) {
        try {
            if (cx$seg == null) {
                ModelPart[] a = new ModelPart[CxCapePhys.N]; ModelPart c = cape; a[0] = c;
                for (int i = 1; i < CxCapePhys.N; i++) { c = c.getChild("cx" + i); a[i] = c; }
                cx$seg = a;
            }
            float sw = CxClient.enabled ? CxCapePhys.sway(s.id) : 0f;
            if (sw != 0f) cape.xRot += (float) Math.toRadians(sw);
            if (CxClient.enabled && CxClient.settings.capeBend) CxCapePhys.step(s.id, 6f + s.capeLean / 2f + s.capeFlap + sw, s.capeLean2 / 2f, cx$p, cx$r);
            else CxCapePhys.rigid(cx$p, cx$r);
            if (!cx$logged) { cx$logged = true; System.out.println("[Cubixora] pelerin fiziği aktif (parça=" + cx$seg.length + ")"); }
            for (int i = 1; i < CxCapePhys.N; i++) { cx$seg[i].xRot = (float) Math.toRadians(cx$p[i]); cx$seg[i].zRot = (float) Math.toRadians(cx$r[i]); }
        } catch (Throwable ignored) { }
    }
}
