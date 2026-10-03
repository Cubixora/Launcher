package com.cubixora.client;

import com.cubixora.cosmetics.CosmeticsManager;
import com.cubixora.cosmetics.PlayerCosmetics;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.particle.ParticleTypes;

/**
 * Efekt kozmetiği: kırmızı ateş (ates) ve mavi ateş (ruh); takan oyuncunun etrafında yükselen alevler (yalnız istemcide, sunucuya yük yok).
 * Bütçe: oyuncu başına 2 tikte bir 1 parçacık (~10/sn), en fazla 12 oyuncu ve 24 blok mesafe.
 * Kendi karakterinde birinci şahıs bakışta çizilmez (görüşü kapatmasın).
 */
public final class CxEffects {
    private CxEffects() {}
    private static int tick;
    private static final java.util.Random R = new java.util.Random();

    public static void tick(MinecraftClient mc) {
        if (mc.world == null || mc.player == null || mc.isPaused()) return;
        if ((++tick & 1) != 0) return;
        double t = tick / 20.0;
        int n = 0;
        for (AbstractClientPlayerEntity p : mc.world.getPlayers()) {
            if (n >= 12) break;
            if (p.isInvisible() || mc.player.squaredDistanceTo(p) > 24 * 24) continue;
            if (p == mc.player && mc.options.getPerspective().isFirstPerson()) continue;
            PlayerCosmetics c = CosmeticsManager.get(p.getName().getString());
            if (c == null || c.effect == null || c.effect.isEmpty()) continue;
            n++;
            spawn(mc, p, c.effect, t + (p.getId() % 7));
        }
    }

    private static void spawn(MinecraftClient mc, AbstractClientPlayerEntity p, String fx, double t) {
        double x = p.getX(), y = p.getY(), z = p.getZ();
        double a = R.nextDouble() * Math.PI * 2, r = 0.45 + R.nextDouble() * 0.3;
        double ox = Math.cos(a) * r, oz = Math.sin(a) * r;
        switch (fx) {
            // kırmızı / mavi ateş artık oyuncu katmanında kendi alev modeliyle çiziliyor (CxFlames); burada vanilya parçacık yok
            default -> { }
        }
    }
}
