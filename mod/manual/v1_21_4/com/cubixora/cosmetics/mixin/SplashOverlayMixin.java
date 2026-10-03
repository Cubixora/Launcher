package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxClient;
import com.cubixora.client.CxLoading;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.SplashOverlay;
import net.minecraft.util.Util;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Mojang yükleme ekranının üstüne (aynı geçiş zamanlamasıyla) Cubixora açılışı çizilir. */
@Mixin(SplashOverlay.class)
public abstract class SplashOverlayMixin {
    @Shadow @Final private boolean reloading;
    @Shadow private float progress;
    @Shadow private long reloadCompleteTime;
    @Shadow private long reloadStartTime;

    @Inject(method = "<init>", at = @At("TAIL"), require = 0)
    private void cubixora$init(CallbackInfo ci) { CxLoading.reset(); }

    /**
     * Cubixora kapanış ekranı sönerken Mojang ekranı arkada görünmesin: Mojang'ın kendi sönmesi bitmek üzere
     * (görünmez) bir noktada tutulur, söndürmeyi Cubixora kendi zamanlamasıyla yapar, sonra bırakır.
     */
    @Inject(method = "render", at = @At("HEAD"), require = 0)
    private void cubixora$hold(DrawContext c, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        if (CxClient.enabled && CxLoading.holdStart > 0) reloadCompleteTime = Util.getMeasuringTimeMs() - 1990L;
    }

    @Inject(method = "render", at = @At("TAIL"), require = 0)
    private void cubixora$render(DrawContext c, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        if (!CxClient.enabled) return;
        long now = Util.getMeasuringTimeMs();
        float f = reloadCompleteTime > -1L ? (now - reloadCompleteTime) / 1000f : -1f;
        float g = reloadStartTime > -1L ? (now - reloadStartTime) / 500f : -1f;
        float a = f >= 1f ? 1f - Math.max(0f, Math.min(1f, f - 1f)) : reloading ? Math.max(0f, Math.min(1f, g)) : 1f;
        if (CxLoading.holdStart == 0 && f >= 1f) CxLoading.holdStart = now;   // kapanış başladı: Mojang'ı görünmez noktada tut
        if (CxLoading.holdStart > 0) {
            float t = (now - CxLoading.holdStart) / 700f;
            a = 1f - CxLoading.easeOut(t);
            if (t >= 1f) { CxLoading.holdStart = -1; reloadCompleteTime = now - 2100L; a = 0f; }   // bitti: Mojang katmanı kalksın
        } else if (CxLoading.holdStart < 0) a = 0f;
        CxLoading.render(c, c.getScaledWindowWidth(), c.getScaledWindowHeight(), progress, a, !reloading);
    }
}
