package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxBackground;
import com.cubixora.client.CxTheme;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Menülerde Minecraft panoraması yerine Cubixora yağmurlu arka planı; bulanıklık gereksiz olduğu için atlanır. */
@Mixin(Screen.class)
public abstract class ScreenMixin {
    @Shadow @Final protected Minecraft minecraft;
    @Shadow public int width;
    @Shadow public int height;

    @Inject(method = "extractPanorama", at = @At("HEAD"), cancellable = true, require = 0)
    private void cubixora$panorama(GuiGraphicsExtractor c, float delta, CallbackInfo ci) {
        if (!CxTheme.on()) return;
        CxBackground.render(c, width, height, 1f);
        ci.cancel();
    }

    @Inject(method = "extractBlurredBackground", at = @At("HEAD"), cancellable = true, require = 0)
    private void cubixora$blur(GuiGraphicsExtractor c, CallbackInfo ci) {
        if (CxTheme.on() && minecraft != null && minecraft.level == null) ci.cancel();
    }
}
