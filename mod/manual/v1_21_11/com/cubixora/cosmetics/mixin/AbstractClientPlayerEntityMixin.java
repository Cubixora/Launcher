package com.cubixora.cosmetics.mixin;

import com.cubixora.cosmetics.CosmeticsManager;
import com.cubixora.cosmetics.PlayerCosmetics;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.entity.player.PlayerSkinType;
import net.minecraft.entity.player.SkinTextures;
import net.minecraft.util.AssetInfo;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Cubixora skinini ve pelerinini oyuncunun normal skin bilgisinin yerine koyar (1.21.9+). */
@Mixin(AbstractClientPlayerEntity.class)
public abstract class AbstractClientPlayerEntityMixin {
    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void cubixora$overrideSkin(CallbackInfoReturnable<SkinTextures> cir) {
        AbstractClientPlayerEntity self = (AbstractClientPlayerEntity) (Object) this;
        PlayerCosmetics c = CosmeticsManager.get(self.getNameForScoreboard());
        if (c == null || (c.skinTexture == null && c.capeTexture == null)) return;
        SkinTextures o = cir.getReturnValue();
        AssetInfo.TextureAsset body = c.skinTexture != null ? new AssetInfo.TextureAssetInfo(c.skinTexture, c.skinTexture) : o.body();
        PlayerSkinType model = c.skinTexture != null ? (c.slim ? PlayerSkinType.SLIM : PlayerSkinType.WIDE) : o.model();
        AssetInfo.TextureAsset cape = c.capeTexture != null ? new AssetInfo.TextureAssetInfo(c.capeTexture, c.capeTexture) : o.cape();
        cir.setReturnValue(new SkinTextures(body, cape, o.elytra(), model, o.secure()));
    }
}
