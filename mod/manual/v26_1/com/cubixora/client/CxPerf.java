package com.cubixora.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.Options;
import net.minecraft.client.OptionInstance;

import java.util.Map;

/**
 * Cubixora Performans Modu: görsel kaliteyi düşürür, FPS sınırlarını kaldırır. Kapatınca önceki değerler geri gelir.
 * Eski değerler client.json yanındaki ayar dosyasında (perfSaved) saklanır, oyun yeniden açılsa da kaybolmaz.
 */
public final class CxPerf {
    private CxPerf() {}

    public static boolean on() { return CxClient.settings.perfMode; }

    public static void set(boolean enable) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.options == null) return;
        CxClient.Settings s = CxClient.settings;
        if (enable == s.perfMode && (!enable || !s.perfSaved.isEmpty())) return;
        if (enable) {
            s.perfSaved.clear();
            apply(mc.options);
            s.perfMode = true;
        } else {
            restore(mc.options);
            s.perfSaved.clear();
            s.perfMode = false;
        }
        try { mc.options.save(); } catch (Throwable ignored) {}
        try { CxClient.save(); } catch (Throwable ignored) {}
    }

    @SuppressWarnings({ "unchecked", "rawtypes" })
    private static void put(String key, OptionInstance o, Object v) {
        try {
            Object old = o.get();
            if (old == null || old.equals(v)) return;
            CxClient.settings.perfSaved.put(key, enc(old));
            o.set(v);
        } catch (Throwable ignored) {}
    }

    /** Sıralı enum: en düşük kalite = verilen indeks. */
    @SuppressWarnings({ "unchecked", "rawtypes" })
    private static void putEnum(String key, OptionInstance o, int idx) {
        try {
            Object[] all = ((Enum) o.get()).getDeclaringClass().getEnumConstants();
            put(key, o, all[Math.min(idx, all.length - 1)]);
        } catch (Throwable ignored) {}
    }

    private static void apply(Options o) {
        put("fps", o.framerateLimit(), 260);                 // 260 = sınırsız
        put("vsync", o.enableVsync(), false);
        putEnum("cloud", o.cloudStatus(), 0);    // KAPALI
        putEnum("particles", o.particles(), 2);      // MİNİMUM
        put("shadows", o.entityShadows(), false);
        put("blend", o.biomeBlendRadius(), 0);
        put("view", o.renderDistance(), Math.min(o.renderDistance().get(), 8));
        put("sim", o.simulationDistance(), Math.min(o.simulationDistance().get(), 6));
        put("entdist", o.entityDistanceScaling(), Math.min(o.entityDistanceScaling().get(), 0.75));
        //GFX-BEGIN
        putEnum("gfx", o.graphicsPreset(), 0);         // HIZLI
        //GFX-END
    }

    @SuppressWarnings({ "unchecked", "rawtypes" })
    private static void restore(Options o) {
        Map<String, String> m = CxClient.settings.perfSaved;
        r(m, "fps", o.framerateLimit()); r(m, "vsync", o.enableVsync()); r(m, "cloud", o.cloudStatus()); r(m, "particles", o.particles());
        r(m, "shadows", o.entityShadows()); r(m, "blend", o.biomeBlendRadius()); r(m, "view", o.renderDistance()); r(m, "sim", o.simulationDistance());
        r(m, "entdist", o.entityDistanceScaling());
        //GFX2-BEGIN
        r(m, "gfx", o.graphicsPreset());
        //GFX2-END
    }

    @SuppressWarnings({ "unchecked", "rawtypes" })
    private static void r(Map<String, String> m, String key, OptionInstance o) {
        String v = m.get(key);
        if (v == null) return;
        try {
            Object cur = o.get(), val = null;
            if (cur instanceof Enum) { for (Object e : ((Enum) cur).getDeclaringClass().getEnumConstants()) if (((Enum) e).name().equals(v)) val = e; }
            else if (cur instanceof Integer) val = Integer.parseInt(v);
            else if (cur instanceof Double) val = Double.parseDouble(v);
            else if (cur instanceof Boolean) val = Boolean.parseBoolean(v);
            if (val != null) o.set(val);
        } catch (Throwable ignored) {}
    }

    private static String enc(Object v) { return v instanceof Enum ? ((Enum<?>) v).name() : String.valueOf(v); }
}
