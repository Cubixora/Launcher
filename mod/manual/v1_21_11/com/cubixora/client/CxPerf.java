package com.cubixora.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.GameOptions;
import net.minecraft.client.option.SimpleOption;

import java.util.Map;

/**
 * Cubixora Performans Modu: görsel kaliteyi düşürür, FPS sınırlarını kaldırır. Kapatınca önceki değerler geri gelir.
 * Eski değerler client.json yanındaki ayar dosyasında (perfSaved) saklanır, oyun yeniden açılsa da kaybolmaz.
 */
public final class CxPerf {
    private CxPerf() {}

    public static boolean on() { return CxClient.settings.perfMode; }

    public static void set(boolean enable) {
        MinecraftClient mc = MinecraftClient.getInstance();
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
        try { mc.options.write(); } catch (Throwable ignored) {}
        try { CxClient.save(); } catch (Throwable ignored) {}
    }

    @SuppressWarnings({ "unchecked", "rawtypes" })
    private static void put(String key, SimpleOption o, Object v) {
        try {
            Object old = o.getValue();
            if (old == null || old.equals(v)) return;
            CxClient.settings.perfSaved.put(key, enc(old));
            o.setValue(v);
        } catch (Throwable ignored) {}
    }

    /** Sıralı enum: en düşük kalite = verilen indeks. */
    @SuppressWarnings({ "unchecked", "rawtypes" })
    private static void putEnum(String key, SimpleOption o, int idx) {
        try {
            Object[] all = ((Enum) o.getValue()).getDeclaringClass().getEnumConstants();
            put(key, o, all[Math.min(idx, all.length - 1)]);
        } catch (Throwable ignored) {}
    }

    private static void apply(GameOptions o) {
        put("fps", o.getMaxFps(), 260);                 // 260 = sınırsız
        put("vsync", o.getEnableVsync(), false);
        putEnum("cloud", o.getCloudRenderMode(), 0);    // KAPALI
        putEnum("particles", o.getParticles(), 2);      // MİNİMUM
        put("shadows", o.getEntityShadows(), false);
        put("blend", o.getBiomeBlendRadius(), 0);
        put("view", o.getViewDistance(), Math.min(o.getViewDistance().getValue(), 8));
        put("sim", o.getSimulationDistance(), Math.min(o.getSimulationDistance().getValue(), 6));
        put("entdist", o.getEntityDistanceScaling(), Math.min(o.getEntityDistanceScaling().getValue(), 0.75));
        //GFX-BEGIN
        putEnum("gfx", o.getPreset(), 0);         // HIZLI
        //GFX-END
    }

    @SuppressWarnings({ "unchecked", "rawtypes" })
    private static void restore(GameOptions o) {
        Map<String, String> m = CxClient.settings.perfSaved;
        r(m, "fps", o.getMaxFps()); r(m, "vsync", o.getEnableVsync()); r(m, "cloud", o.getCloudRenderMode()); r(m, "particles", o.getParticles());
        r(m, "shadows", o.getEntityShadows()); r(m, "blend", o.getBiomeBlendRadius()); r(m, "view", o.getViewDistance()); r(m, "sim", o.getSimulationDistance());
        r(m, "entdist", o.getEntityDistanceScaling());
        //GFX2-BEGIN
        r(m, "gfx", o.getPreset());
        //GFX2-END
    }

    @SuppressWarnings({ "unchecked", "rawtypes" })
    private static void r(Map<String, String> m, String key, SimpleOption o) {
        String v = m.get(key);
        if (v == null) return;
        try {
            Object cur = o.getValue(), val = null;
            if (cur instanceof Enum) { for (Object e : ((Enum) cur).getDeclaringClass().getEnumConstants()) if (((Enum) e).name().equals(v)) val = e; }
            else if (cur instanceof Integer) val = Integer.parseInt(v);
            else if (cur instanceof Double) val = Double.parseDouble(v);
            else if (cur instanceof Boolean) val = Boolean.parseBoolean(v);
            if (val != null) o.setValue(val);
        } catch (Throwable ignored) {}
    }

    private static String enc(Object v) { return v instanceof Enum ? ((Enum<?>) v).name() : String.valueOf(v); }
}
