package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxTheme;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.function.Function;

/** Vanilla arayüz kaplamalarını (düğme, kutu, kaydırıcı, ayırıcı...) Cubixora görünümüyle değiştirir. */
@Mixin(DrawContext.class)
public abstract class DrawContextMixin {
    @Inject(method = "drawGuiTexture(Ljava/util/function/Function;Lnet/minecraft/util/Identifier;IIII)V", at = @At("HEAD"), cancellable = true, require = 0)
    private void cubixora$sprite(Function<Identifier, RenderLayer> layer, Identifier id, int x, int y, int w, int h, CallbackInfo ci) {
        if (CxTheme.sprite((DrawContext) (Object) this, id, x, y, w, h, 1f)) ci.cancel();
    }

    @Inject(method = "drawGuiTexture(Ljava/util/function/Function;Lnet/minecraft/util/Identifier;IIIII)V", at = @At("HEAD"), cancellable = true, require = 0)
    private void cubixora$spriteColor(Function<Identifier, RenderLayer> layer, Identifier id, int x, int y, int w, int h, int color, CallbackInfo ci) {
        if (CxTheme.sprite((DrawContext) (Object) this, id, x, y, w, h, ((color >>> 24) & 255) / 255f)) ci.cancel();
    }

    @Inject(method = "drawTexture(Ljava/util/function/Function;Lnet/minecraft/util/Identifier;IIFFIIII)V", at = @At("HEAD"), cancellable = true, require = 0)
    private void cubixora$texture(Function<Identifier, RenderLayer> layer, Identifier id, int x, int y, float u, float v, int w, int h, int tw, int th, CallbackInfo ci) {
        if (CxTheme.texture((DrawContext) (Object) this, id, x, y, w, h)) ci.cancel();
    }
}
