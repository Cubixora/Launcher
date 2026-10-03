package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxCapePhys;
import com.cubixora.cosmetics.CxCloakAccess;
import net.minecraft.client.model.Dilation;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.model.ModelPartBuilder;
import net.minecraft.client.model.ModelPartData;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

/** Pelerini (cloak) 8 eklemli parçaya böler; açıları CapeBendFeatureMixin her karede ayarlar. */
@Mixin(PlayerEntityModel.class)
public abstract class CapeBendMixin implements CxCloakAccess {
    @Shadow @Final private ModelPart cloak;

    @Override public ModelPart cubixora$cloak() { return cloak; }

    @Redirect(method = "getTexturedModelData", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/model/ModelPartData;addChild(Ljava/lang/String;Lnet/minecraft/client/model/ModelPartBuilder;Lnet/minecraft/client/model/ModelTransform;)Lnet/minecraft/client/model/ModelPartData;"), require = 0)
    private static ModelPartData cubixora$segments(ModelPartData parent, String name, ModelPartBuilder vanilla, ModelTransform tr) {
        if (!"cloak".equals(name)) return parent.addChild(name, vanilla, tr);
        ModelPartData cur = parent.addChild(name, seg(0), tr);
        for (int i = 1; i < CxCapePhys.N; i++) cur = cur.addChild("cx" + i, seg(i), ModelTransform.pivot(0f, 2f, 0f));
        return cur;
    }

    private static ModelPartBuilder seg(int i) {
        return ModelPartBuilder.create().uv(0, 2 * i).cuboid(-5f, 0f, -1f, 10f, 2f, 1f, Dilation.NONE, 1f, 0.5f);
    }
}
