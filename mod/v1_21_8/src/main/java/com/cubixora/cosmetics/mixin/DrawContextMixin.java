package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxTheme;
import com.mojang.blaze3d.pipeline.RenderPipeline;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Vanilla arayüz kaplamalarını (düğme, kutu, kaydırıcı, ayırıcı...) Cubixora görünümüyle değiştirir. */
@Mixin(DrawContext.class)
public abstract class DrawContextMixin {
    @Inject(method = "drawGuiTexture(Lcom/mojang/blaze3d/pipeline/RenderPipeline;Lnet/minecraft/util/Identifier;IIII)V", at = @At("HEAD"), cancellable = true, require = 0)
    private void cubixora$sprite(RenderPipeline pipeline, Identifier id, int x, int y, int w, int h, CallbackInfo ci) {
        if (CxTheme.sprite((DrawContext) (Object) this, id, x, y, w, h, 1f)) ci.cancel();
    }

    @Inject(method = "drawGuiTexture(Lcom/mojang/blaze3d/pipeline/RenderPipeline;Lnet/minecraft/util/Identifier;IIIIF)V", at = @At("HEAD"), cancellable = true, require = 0)
    private void cubixora$spriteAlpha(RenderPipeline pipeline, Identifier id, int x, int y, int w, int h, float alpha, CallbackInfo ci) {
        if (CxTheme.sprite((DrawContext) (Object) this, id, x, y, w, h, alpha)) ci.cancel();
    }

    @Inject(method = "drawGuiTexture(Lcom/mojang/blaze3d/pipeline/RenderPipeline;Lnet/minecraft/util/Identifier;IIIII)V", at = @At("HEAD"), cancellable = true, require = 0)
    private void cubixora$spriteColor(RenderPipeline pipeline, Identifier id, int x, int y, int w, int h, int color, CallbackInfo ci) {
        if (CxTheme.sprite((DrawContext) (Object) this, id, x, y, w, h, ((color >>> 24) & 255) / 255f)) ci.cancel();
    }

    @Inject(method = "drawTexture(Lcom/mojang/blaze3d/pipeline/RenderPipeline;Lnet/minecraft/util/Identifier;IIFFIIII)V", at = @At("HEAD"), cancellable = true, require = 0)
    private void cubixora$texture(RenderPipeline pipeline, Identifier id, int x, int y, float u, float v, int w, int h, int tw, int th, CallbackInfo ci) {
        if (CxTheme.texture((DrawContext) (Object) this, id, x, y, w, h)) ci.cancel();
    }
}
