package com.cubixora.client;

import net.minecraft.client.model.ModelPart;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Oynayan emote'ların kaydı ve gövde pozu. Kendi emotemiz de başkalarınınki de aynı yoldan çizilir. */
public final class CxEmoteAnim {
    private CxEmoteAnim() {}

    public static final float KISS_LEN = 3.4f;

    public static final class Active { public final String id; public final long start; Active(String id, long start) { this.id = id; this.start = start; } }
    private static final Map<String, Active> ACTIVE = new ConcurrentHashMap<>();

    public static void start(String name, String id) { if (name != null && !name.isEmpty() && id != null && !id.isEmpty()) ACTIVE.put(name.toLowerCase(Locale.ROOT), new Active(id, System.currentTimeMillis())); }
    public static void stop(String name) { if (name != null) ACTIVE.remove(name.toLowerCase(Locale.ROOT)); }
    public static boolean any() { return !ACTIVE.isEmpty(); }
    public static Map<String, Active> all() { return ACTIVE; }

    /** Saniye cinsinden ilerleme; oynamıyorsa ya da bittiyse -1 (bitmişse kaydı da siler). */
    public static float time(String name) {
        if (name == null) return -1f;
        String k = name.toLowerCase(Locale.ROOT);
        Active a = ACTIVE.get(k);
        if (a == null) return -1f;
        float u = (System.currentTimeMillis() - a.start) / 1000f;
        if (u > KISS_LEN) { ACTIVE.remove(k); return -1f; }
        return u;
    }
    public static String idOf(String name) { Active a = name == null ? null : ACTIVE.get(name.toLowerCase(Locale.ROOT)); return a == null ? null : a.id; }

    private static float ease(float x) { x = Math.max(0f, Math.min(1f, x)); return x * x * (3f - 2f * x); }
    private static float q(float a, float b, float u) { return ease((u - a) / (b - a)); }

    /** Model çizilmeden hemen önce çağrılır; ilgili oyuncu emote yapıyorsa uzuvları ayarlar. */
    public static void pose(String name, ModelPart head, ModelPart hat, ModelPart body, ModelPart rarm, ModelPart larm, ModelPart rleg, ModelPart lleg,
                            ModelPart rsleeve, ModelPart lsleeve, ModelPart rpants, ModelPart lpants, ModelPart jacket) {
        float u = time(name);
        if (u < 0f) return;
        // öpücük: el ağza gelir, öpücük savrulur, el iner (önizlemedeki zamanlamayla aynı)
        float up = q(0.35f, 0.9f, u) - q(2.6f, 3.2f, u);
        float blow = q(1.4f, 1.75f, u) - q(1.75f, 2.3f, u);
        float nod = q(1.0f, 1.4f, u) - q(1.4f, 1.8f, u);
        rarm.pitch = -1.95f * up - 0.4f * blow;
        rarm.yaw = -0.5f * up + 0.65f * blow;
        rarm.roll = 0.05f;
        head.pitch = 0.14f * nod - 0.09f * blow;
        head.roll = -0.14f * up;
        lleg.pitch = 0.3f * blow;
        larm.roll = -0.05f - 0.1f * up;
        body.pitch = -0.07f * blow;
        copy(hat, head); copy(rsleeve, rarm); copy(lsleeve, larm); copy(rpants, rleg); copy(lpants, lleg); copy(jacket, body);
    }

    private static void copy(ModelPart to, ModelPart from) { if (to != null) { to.pitch = from.pitch; to.yaw = from.yaw; to.roll = from.roll; } }
}
