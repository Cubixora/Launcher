package com.cubixora.cosmetics.mixin;

import com.cubixora.cosmetics.CosmeticsManager;
import com.cubixora.cosmetics.PlayerCosmetics;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Eski sürümler: skin, pelerin ve kol modeli ayrı metotlardan gelir; üçü de Cubixora'ya göre değişir. */
@Mixin(AbstractClientPlayerEntity.class)
public abstract class AbstractClientPlayerEntityMixin {
    private PlayerCosmetics cubixora$get() {
        return CosmeticsManager.get(((AbstractClientPlayerEntity) (Object) this).getGameProfile().getName());
    }

    @Inject(method = "getSkinTexture", at = @At("RETURN"), cancellable = true)
    private void cubixora$skin(CallbackInfoReturnable<Identifier> cir) {
        PlayerCosmetics c = cubixora$get();
        if (c != null && c.skinTexture != null) cir.setReturnValue(c.skinTexture);
    }

    @Inject(method = "getModel", at = @At("RETURN"), cancellable = true)
    private void cubixora$model(CallbackInfoReturnable<String> cir) {
        PlayerCosmetics c = cubixora$get();
        if (c != null && c.skinTexture != null) cir.setReturnValue(c.slim ? "slim" : "default");
    }

    @Inject(method = "getCapeTexture", at = @At("RETURN"), cancellable = true)
    private void cubixora$cape(CallbackInfoReturnable<Identifier> cir) {
        PlayerCosmetics c = cubixora$get();
        if (c != null && c.capeTexture != null) cir.setReturnValue(c.capeTexture);
    }

    @Inject(method = "canRenderCapeTexture", at = @At("RETURN"), cancellable = true)
    private void cubixora$canCape(CallbackInfoReturnable<Boolean> cir) {
        PlayerCosmetics c = cubixora$get();
        if (c != null && c.capeTexture != null) cir.setReturnValue(true);
    }
}
