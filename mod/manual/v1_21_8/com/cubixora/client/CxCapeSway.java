package com.cubixora.client;

import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.util.Util;

/**
 * Gardrop önizlemesinde (karakter dururken) pelerinin hafifçe sallanması. Oyun, pelerini oyuncunun konumuna göre
 * "geride kalan" bir noktayla çizer; durağan karakterde bu fark sıfır olduğu için pelerin dümdüz bir levha gibi durur.
 * Çizim süresince bu noktayı çok küçük, yavaş dalgalarla kaydırırız; çizimden sonra gerçek değerleri geri yazarız.
 */
final class CxCapeSway {
    private CxCapeSway() {}

    static double[] begin(ClientPlayerEntity e) {
        double[] s = { e.capeX, e.capeY, e.capeZ, e.lastCapeX, e.lastCapeY, e.lastCapeZ };
        float t = (Util.getMeasuringTimeMs() % 600000L) / 1000f;
        double back = 0.045 + 0.035 * Math.sin(t * 1.6) + 0.015 * Math.sin(t * 2.9 + 1.0);      // geriye açılma / kapanma
        double side = 0.05 * Math.sin(t * 1.1 + 0.5) + 0.02 * Math.sin(t * 2.3);                  // yana salınım
        double lift = 0.12 * Math.sin(t * 2.1 + 0.3);                                             // hafif kabarma
        double x = e.getX() + side, y = e.getY() + lift, z = e.getZ() + back;
        e.capeX = x; e.capeY = y; e.capeZ = z;
        e.lastCapeX = x; e.lastCapeY = y; e.lastCapeZ = z;
        return s;
    }

    static void end(ClientPlayerEntity e, double[] s) {
        if (s == null) return;
        e.capeX = s[0]; e.capeY = s[1]; e.capeZ = s[2];
        e.lastCapeX = s[3]; e.lastCapeY = s[4]; e.lastCapeZ = s[5];
    }
}
