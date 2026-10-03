package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxCapePhys;
import com.cubixora.client.CxClient;
import net.minecraft.client.model.Dilation;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.model.ModelPartBuilder;
import net.minecraft.client.model.ModelPartData;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.render.entity.model.PlayerCapeModel;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
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

    @Redirect(method = "getTexturedModelData", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/model/ModelPartData;addChild(Ljava/lang/String;Lnet/minecraft/client/model/ModelPartBuilder;Lnet/minecraft/client/model/ModelTransform;)Lnet/minecraft/client/model/ModelPartData;"), require = 0)
    private static ModelPartData cubixora$segments(ModelPartData parent, String name, ModelPartBuilder vanilla, ModelTransform tr) {
        if (!"cape".equals(name)) return parent.addChild(name, vanilla, tr);
        ModelPartData cur = parent.addChild(name, seg(0), tr);
        for (int i = 1; i < CxCapePhys.N; i++) cur = cur.addChild("cx" + i, seg(i), com.cubixora.cosmetics.Compat.pivot(0f, 2f, 0f));
        return cur;
    }

    private static ModelPartBuilder seg(int i) {
        return ModelPartBuilder.create().uv(0, 2 * i).cuboid(-5f, 0f, -1f, 10f, 2f, 1f, Dilation.NONE, 1f, 0.5f);
    }

    @Inject(method = "setAngles(Lnet/minecraft/client/render/entity/state/PlayerEntityRenderState;)V", at = @At("TAIL"), require = 0)
    private void cubixora$bend(PlayerEntityRenderState s, CallbackInfo ci) {
        try {
            if (cx$seg == null) {
                ModelPart[] a = new ModelPart[CxCapePhys.N]; ModelPart c = cape; a[0] = c;
                for (int i = 1; i < CxCapePhys.N; i++) { c = c.getChild("cx" + i); a[i] = c; }
                cx$seg = a;
            }
            float sw = CxClient.enabled ? CxCapePhys.sway(s.id) : 0f;
            if (sw != 0f) cape.pitch += (float) Math.toRadians(sw);
            if (CxClient.enabled && CxClient.settings.capeBend) CxCapePhys.step(s.id, 6f + s.field_53537 / 2f + s.field_53536 + sw, s.field_53538 / 2f, cx$p, cx$r);
            else CxCapePhys.rigid(cx$p, cx$r);
            if (!cx$logged) { cx$logged = true; System.out.println("[Cubixora] pelerin fiziği aktif (parça=" + cx$seg.length + ")"); }
            for (int i = 1; i < CxCapePhys.N; i++) { cx$seg[i].pitch = (float) Math.toRadians(cx$p[i]); cx$seg[i].roll = (float) Math.toRadians(cx$r[i]); }
        } catch (Throwable ignored) { }
    }
}
