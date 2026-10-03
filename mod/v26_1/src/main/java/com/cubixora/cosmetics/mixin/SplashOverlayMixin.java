package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxClient;
import com.cubixora.client.CxLoading;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.LoadingOverlay;
import net.minecraft.util.Util;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Mojang yükleme ekranının üstüne (aynı geçiş zamanlamasıyla) Cubixora açılışı çizilir. */
@Mixin(LoadingOverlay.class)
public abstract class SplashOverlayMixin {
    @Shadow @Final private boolean fadeIn;
    @Shadow private float currentProgress;
    @Shadow private long fadeOutStart;
    @Shadow private long fadeInStart;

    @Inject(method = "<init>", at = @At("TAIL"), require = 0)
    private void cubixora$init(CallbackInfo ci) { CxLoading.reset(); }

    @Inject(method = "extractRenderState", at = @At("HEAD"), require = 0)
    private void cubixora$hold(GuiGraphicsExtractor c, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        if (CxClient.enabled && CxLoading.holdStart > 0) fadeOutStart = Util.getMillis() - 1990L;
    }

    @Inject(method = "extractRenderState", at = @At("TAIL"), require = 0)
    private void cubixora$render(GuiGraphicsExtractor c, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        if (!CxClient.enabled) return;
        long now = Util.getMillis();
        float f = fadeOutStart > -1L ? (now - fadeOutStart) / 1000f : -1f;
        float g = fadeInStart > -1L ? (now - fadeInStart) / 500f : -1f;
        float a = f >= 1f ? 1f - Math.max(0f, Math.min(1f, f - 1f)) : fadeIn ? Math.max(0f, Math.min(1f, g)) : 1f;
        if (CxLoading.holdStart == 0 && f >= 1f) CxLoading.holdStart = now;
        if (CxLoading.holdStart > 0) {
            float t = (now - CxLoading.holdStart) / 700f;
            a = 1f - CxLoading.easeOut(t);
            if (t >= 1f) { CxLoading.holdStart = -1; fadeOutStart = now - 2100L; a = 0f; }
        } else if (CxLoading.holdStart < 0) a = 0f;
        CxLoading.render(c, c.guiWidth(), c.guiHeight(), currentProgress, a, !fadeIn);
    }}
