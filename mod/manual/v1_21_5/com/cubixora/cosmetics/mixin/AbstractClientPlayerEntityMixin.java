package com.cubixora.cosmetics.mixin;

import com.cubixora.cosmetics.CosmeticsManager;
import com.cubixora.cosmetics.PlayerCosmetics;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Cubixora skinini ve pelerinini oyuncunun normal skin bilgisinin yerine koyar. */
@Mixin(AbstractClientPlayerEntity.class)
public abstract class AbstractClientPlayerEntityMixin {
    @Inject(method = "getSkinTextures", at = @At("RETURN"), cancellable = true)
    private void cubixora$overrideSkin(CallbackInfoReturnable<SkinTextures> cir) {
        AbstractClientPlayerEntity self = (AbstractClientPlayerEntity) (Object) this;
        PlayerCosmetics c = CosmeticsManager.get(self.getGameProfile().getName());
        if (c == null || (c.skinTexture == null && c.capeTexture == null)) return;
        SkinTextures o = cir.getReturnValue();
        Identifier skin = c.skinTexture != null ? c.skinTexture : o.texture();
        SkinTextures.Model model = c.skinTexture != null ? (c.slim ? SkinTextures.Model.SLIM : SkinTextures.Model.WIDE) : o.model();
        Identifier cape = c.capeTexture != null ? c.capeTexture : o.capeTexture();
        cir.setReturnValue(new SkinTextures(skin, o.textureUrl(), cape, o.elytraTexture(), model, o.secure()));
    }
}
