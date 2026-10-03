package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxBackground;
import com.cubixora.client.CxTheme;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Menülerde Minecraft panoraması yerine Cubixora yağmurlu arka planı; bulanıklık gereksiz olduğu için atlanır. */
@Mixin(Screen.class)
public abstract class ScreenMixin {
    @Shadow protected MinecraftClient client;
    @Shadow public int width;
    @Shadow public int height;

    @Inject(method = "renderPanoramaBackground", at = @At("HEAD"), cancellable = true, require = 0)
    private void cubixora$panorama(DrawContext c, float delta, CallbackInfo ci) {
        if (!CxTheme.on()) return;
        CxBackground.render(c, width, height, 1f);
        ci.cancel();
    }

    @Inject(method = "applyBlur", at = @At("HEAD"), cancellable = true, require = 0)
    private void cubixora$blur(DrawContext c, CallbackInfo ci) {
        if (CxTheme.on() && client != null && client.world == null) ci.cancel();
    }
}
