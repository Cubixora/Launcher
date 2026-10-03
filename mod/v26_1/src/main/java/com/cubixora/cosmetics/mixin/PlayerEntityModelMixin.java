package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxEmoteAnim;
import com.cubixora.cosmetics.Compat;
import net.minecraft.client.model.player.PlayerModel;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Emote yapan oyuncunun gövde pozunu ayarlar (başkaları da görür). */
@Mixin(PlayerModel.class)
public abstract class PlayerEntityModelMixin {
    @Inject(method = "setupAnim(Lnet/minecraft/client/renderer/entity/state/AvatarRenderState;)V", at = @At("TAIL"), require = 0)
    private void cubixora$emote(AvatarRenderState state, CallbackInfo ci) {
        if (!CxEmoteAnim.any()) return;
        PlayerModel m = (PlayerModel) (Object) this;
        CxEmoteAnim.pose(Compat.playerName(state.id), m.head, m.hat, m.body, m.rightArm, m.leftArm, m.rightLeg, m.leftLeg, m.rightSleeve, m.leftSleeve, m.rightPants, m.leftPants, m.jacket);
    }
}
