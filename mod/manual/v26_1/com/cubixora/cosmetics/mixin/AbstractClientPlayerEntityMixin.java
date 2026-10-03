package com.cubixora.cosmetics.mixin;

import com.cubixora.cosmetics.CosmeticsManager;
import com.cubixora.cosmetics.PlayerCosmetics;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.core.ClientAsset;
import net.minecraft.world.entity.player.PlayerModelType;
import net.minecraft.world.entity.player.PlayerSkin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Cubixora skinini ve pelerinini oyuncunun normal skin bilgisinin yerine koyar (26.x). */
@Mixin(AbstractClientPlayer.class)
public abstract class AbstractClientPlayerEntityMixin {
    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void cubixora$overrideSkin(CallbackInfoReturnable<PlayerSkin> cir) {
        AbstractClientPlayer self = (AbstractClientPlayer) (Object) this;
        PlayerCosmetics c = CosmeticsManager.get(self.getScoreboardName());
        if (c == null || (c.skinTexture == null && c.capeTexture == null)) return;
        PlayerSkin o = cir.getReturnValue();
        ClientAsset.Texture body = c.skinTexture != null ? new ClientAsset.ResourceTexture(c.skinTexture, c.skinTexture) : o.body();
        PlayerModelType model = c.skinTexture != null ? (c.slim ? PlayerModelType.SLIM : PlayerModelType.WIDE) : o.model();
        ClientAsset.Texture cape = c.capeTexture != null ? new ClientAsset.ResourceTexture(c.capeTexture, c.capeTexture) : o.cape();
        cir.setReturnValue(new PlayerSkin(body, cape, o.elytra(), model, o.secure()));
    }
}
