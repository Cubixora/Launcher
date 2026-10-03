package com.cubixora.client;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.Identifier;

import java.util.ArrayList;
import java.util.List;

/**
 * Dünyasız ekranlarda (ana menü, skin ekranı, gardrop) gerçek 3B görünümlü karakter + pelerin.
 * Her küp yüzü, dikey eksen etrafında döndürülüp (ortografik) doku şeridi olarak çizilir; arkadan öne sıralanır.
 * Böylece pelerin düz bir levha gibi değil, karakterle birlikte gerçekten dönen ağırlıklı bir kumaş gibi görünür
 * ve gövdenin arkasında kalınca saklanır. Yalnız CxUi.tex kullanır: her sürümde aynı çalışır.
 */
public final class CxSoftPlayer {
    private CxSoftPlayer() {}

    private static final class Face {
        float depth; int x0, x1, y0, y1; float u, v; int rw, rh, tw, th; int color; Identifier tex;
    }
    private static final List<Face> POOL = new ArrayList<>();
    private static final List<Face> OUT = new ArrayList<>();
    private static int used;
    private static final java.util.Comparator<Face> BY_DEPTH = (a, b) -> Float.compare(a.depth, b.depth);

    private static Face next() {
        if (used >= POOL.size()) POOL.add(new Face());
        return POOL.get(used++);
    }

    /** Kutu: x0..x1, y0..y1 (yukarı doğru), z0..z1 (z+ = ön). u,v: doku başlangıcı. inf: katman şişmesi (piksel). */
    private static void box(Identifier tex, int tw, int th, float bx0, float bx1, float by0, float by1, float bz0, float bz1,
                            float u, float v, int w, int h, int d, float inf, float cos, float sin, float cx, float feet, float sp, float eps, int mode) {
        bx0 -= inf; bx1 += inf; by0 -= inf; by1 += inf; bz0 -= inf; bz1 += inf;
        // [normal x, normal z, tangent x, tangent z, yüz sol kenarı x, z, genişlik, doku u, doku v, kaynak w, kaynak h]
        float[][] f = {
            { 0,  1,  1,  0, bx0, bz1, bx1 - bx0, u + d,         v + d, w, h },   // ön
            { 0, -1, -1,  0, bx1, bz0, bx1 - bx0, u + 2 * d + w, v + d, w, h },   // arka
            {-1,  0,  0,  1, bx0, bz0, bz1 - bz0, u,             v + d, d, h },   // sağ (karakterin sağı)
            { 1,  0,  0, -1, bx1, bz1, bz1 - bz0, u + d + w,     v + d, d, h },   // sol
        };
        for (int i = 0; i < 4; i++) {
            float[] q = f[i];
            float nz = -q[0] * sin + q[1] * cos;              // yüzün ekrana bakışı
            if (nz <= 0.001f) continue;                        // arka yüz: çizme
            float tx = q[2] * cos + q[3] * sin;                // doku sol->sağ ekran yönü (>= 0)
            float lx = q[4] * cos + q[5] * sin;                // sol kenarın ekran x'i
            float rx = lx + q[6] * tx;
            int xa = Math.round(cx + lx * sp), xb = Math.round(cx + rx * sp);
            if (xb - xa < 1) continue;
            Face o = next();
            o.tex = tex; o.tw = tw; o.th = th;
            o.x0 = xa; o.x1 = xb;
            o.y0 = Math.round(feet - by1 * sp); o.y1 = Math.round(feet - by0 * sp);
            o.u = q[7]; o.v = q[8]; o.rw = (int) q[9]; o.rh = (int) q[10];
            float cxm = (q[4] + (q[4] + q[6] * q[2])) * 0.5f, czm = (q[5] + (q[5] + q[6] * q[3])) * 0.5f;
            o.depth = -cxm * sin + czm * cos + eps;
            float sh = 0.66f + 0.34f * nz;                      // yan yüzler biraz koyu
            int g = Math.min(255, Math.round(255 * sh));
            o.color = 0xFF000000 | (g << 16) | (g << 8) | g;
            OUT.add(o);
        }
    }

    /** @param cx karakter ekseni (ekran x), feet ayakların ekran y'si, sBlock: 1 blok kaç piksel, yawDeg: 0 = ön bize dönük, + = ön sağa döner. */
    public static void draw(DrawContext c, Identifier skin, boolean thin, Identifier cape, float cx, float feet, float sBlock, float yawDeg) {
        float sp = sBlock / 16f;
        double rad = Math.toRadians(yawDeg);
        float cos = (float) Math.cos(rad), sin = (float) Math.sin(rad);
        used = 0; OUT.clear();
        int aw = thin ? 3 : 4;
        // gövde parçaları (alt katmanlar önce; üst katman aynı derinlikte hemen ardından)
        float[][] parts = {
            // bx0 bx1 by0 by1 bz0 bz1 u v w h d  | katman u v | şişme
            { -4,  4, 24, 32, -4, 4,  0,  0, 8, 8, 8,  32,  0, 0.5f },   // kafa
            { -4,  4, 12, 24, -2, 2, 16, 16, 8, 12, 4, 16, 32, 0.25f },  // gövde
            { -4 - aw, -4, 12, 24, -2, 2, 40, 16, aw, 12, 4, 40, 32, 0.25f },  // sağ kol
            { 4, 4 + aw, 12, 24, -2, 2, 32, 48, aw, 12, 4, 48, 48, 0.25f },    // sol kol
            { -4,  0,  0, 12, -2, 2,  0, 16, 4, 12, 4,  0, 32, 0.25f },  // sağ bacak
            {  0,  4,  0, 12, -2, 2, 16, 48, 4, 12, 4,  0, 48, 0.25f },  // sol bacak
        };
        for (float[] p : parts) {
            box(skin, 64, 64, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], (int) p[8], (int) p[9], (int) p[10], 0f, cos, sin, cx, feet, sp, 0f, 0);
            box(skin, 64, 64, p[0], p[1], p[2], p[3], p[4], p[5], p[11], p[12], (int) p[8], (int) p[9], (int) p[10], p[13], cos, sin, cx, feet, sp, 0.002f, 0);
        }
        if (cape != null) capeFaces(cape, cos, sin, cx, feet, sp, yawDeg);
        // arkadan öne
        OUT.sort(BY_DEPTH);
        for (Face o : OUT) CxUi.tex(c, o.tex, o.x0, o.y0, o.u, o.v, o.x1 - o.x0, o.y1 - o.y0, o.rw, o.rh, o.tw, o.th, o.color);
    }

    // ---- pelerin fiziği: hafif duruş sallanması + dönüşe geç kalma (atalet)
    private static float lastYaw = Float.NaN, yawVel, lagX, lagZ;
    private static long lastNs;

    private static void stepPhysics(float yawDeg) {
        long now = System.nanoTime();
        float dt = lastNs == 0 ? 0.016f : Math.min(0.05f, (now - lastNs) / 1e9f);
        lastNs = now;
        float dy = Float.isNaN(lastYaw) ? 0 : yawDeg - lastYaw;
        lastYaw = yawDeg;
        float v = dt > 0 ? dy / dt : 0;                                   // derece / sn
        yawVel += (Math.max(-400f, Math.min(400f, v)) - yawVel) * Math.min(1f, dt * 10f);
        // hedef: dönüşün tersi yönünde yana, hızlı dönüşte biraz da dışa
        float tx = Math.max(-3.2f, Math.min(3.2f, -yawVel * 0.011f)), tz = -Math.min(2.2f, Math.abs(yawVel) * 0.0045f);
        float k = Math.min(1f, dt * 7f);
        lagX += (tx - lagX) * k; lagZ += (tz - lagZ) * k;
    }

    /** Pelerin: gövdenin arkasında (z = -2 .. -3), omuzdan 16 piksel aşağı; 16 satıra bölünüp her satır ayrı kaydırılır. */
    private static void capeFaces(Identifier cape, float cos, float sin, float cx, float feet, float sp, float yawDeg) {
        stepPhysics(yawDeg);
        int k = com.cubixora.cosmetics.CosmeticsManager.SCALE.getOrDefault(cape, 1);
        int tw = 64 * k, th = 32 * k;
        float t = (System.nanoTime() % 600_000_000_000L) / 1e9f;
        float x0 = -5, x1 = 5, y1 = 24, z0 = -3.1f, z1 = -2.1f;
        // [normal x, normal z, tangent x, tangent z, sol kenar x, z, genişlik, u, v, rw, rh]
        float[][] f = {
            { 0, -1,  -1, 0, x1, z0, 10, 1 * k, 1 * k, 10 * k, 16 * k },    // dış yüz (arkadan görünen)
            { 0,  1,   1, 0, x0, z1, 10, 12 * k, 1 * k, 10 * k, 16 * k },   // iç yüz (gövdeye bakan)
            { 1,  0,   0, -1, x1, z1, 1, 0, 1 * k, 1 * k, 16 * k },         // yan (karakterin solu)
            {-1,  0,   0, 1, x0, z0, 1, 11 * k, 1 * k, 1 * k, 16 * k },     // yan (karakterin sağı)
        };
        final int ROWS = 16;
        for (int i = 0; i < 4; i++) {
            float[] q = f[i];
            float nz = -q[0] * sin + q[1] * cos;
            if (nz <= 0.001f) continue;
            float tx = q[2] * cos + q[3] * sin;
            float sh = i == 1 ? 0.6f : (0.66f + 0.34f * nz);
            int g = Math.min(255, Math.round(255 * sh));
            int col = 0xFF000000 | (g << 16) | (g << 8) | g;
            int prevY = Math.round(feet - y1 * sp);
            float depthSum = 0;
            for (int r = 0; r < ROWS; r++) {
                float h = (r + 0.5f) / ROWS, h2 = h * h;
                // omuzda sabit, aşağı indikçe artan: sabit eğim + nefes + dalga + atalet
                float zr = -h * 1.5f + h2 * (float) Math.sin(t * 1.9f) * 0.55f + h2 * (float) Math.sin(t * 3.3f - r * 0.42f) * 0.32f + lagZ * h2;
                float xr = lagX * h2 + h2 * (float) Math.sin(t * 1.4f + r * 0.2f) * 0.25f;
                float lx = (q[4] + xr) * cos + (q[5] + zr) * sin;
                float rx = lx + q[6] * tx;
                int xa = Math.round(cx + lx * sp), xb = Math.round(cx + rx * sp);
                int ya = prevY, yb = Math.round(feet - (y1 - (r + 1)) * sp);
                prevY = yb;
                if (xb - xa < 1 || yb - ya < 1) continue;
                Face o = next();
                o.tex = cape; o.tw = tw; o.th = th;
                o.x0 = xa; o.x1 = xb; o.y0 = ya; o.y1 = yb;
                o.u = q[7]; o.v = q[8] + r * k; o.rw = (int) q[9]; o.rh = k;
                float cxm = q[4] + xr + q[6] * q[2] * 0.5f, czm = q[5] + zr + q[6] * q[3] * 0.5f;
                o.depth = -cxm * sin + czm * cos;
                o.color = col;
                OUT.add(o);
            }
        }
    }
}
