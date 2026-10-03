package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxEmoteAnim;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.player.PlayerEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Emote yapan oyuncunun gövde pozunu ayarlar (başkaları da görür). */
@Mixin(PlayerEntityModel.class)
public abstract class PlayerEntityModelMixin {
    @Inject(method = "setAngles(Lnet/minecraft/entity/LivingEntity;FFFFF)V", at = @At("TAIL"), require = 0)
    private void cubixora$emote(LivingEntity entity, float limbAngle, float limbDistance, float animationProgress, float headYaw, float headPitch, CallbackInfo ci) {
        if (!CxEmoteAnim.any() || !(entity instanceof PlayerEntity)) return;
        PlayerEntityModel<?> m = (PlayerEntityModel<?>) (Object) this;
        CxEmoteAnim.pose(entity.getName().getString(), m.head, m.hat, m.body, m.rightArm, m.leftArm, m.rightLeg, m.leftLeg, m.rightSleeve, m.leftSleeve, m.rightPants, m.leftPants, m.jacket);
    }
}
