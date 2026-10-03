package com.cubixora.client;

import com.cubixora.cosmetics.Compat;
import net.minecraft.client.Minecraft;
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.resources.Identifier;

import java.io.ByteArrayInputStream;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Mağaza/gardrop kartı simgeleri (64x64). Admin bir eşyaya simge yüklediyse o (data URL) dokuya çevrilir,
 * yoksa moddaki hazır simge kullanılır; ikisi de yoksa null (harfli kutu çizilir).
 */
public final class CxIcons {
    private CxIcons() {}
    private static final Set<String> BUILTIN = Set.of("emote_kiss", "spray_logo", "hat_kask", "hat_buyucu", "fpet_ejder", "effect_ates", "effect_ruh");
    private static final Map<String, Identifier> DYN = new HashMap<>();
    private static final Map<String, Boolean> BAD = new HashMap<>();

    public static Identifier of(CxBridge.Item it) {
        if (it.icon != null && it.icon.startsWith("data:image/png;base64,")) {
            String key = it.id + "#" + it.icon.hashCode();
            Identifier id = DYN.get(key);
            if (id != null) return id;
            if (BAD.containsKey(key)) return builtin(it);
            try {
                byte[] bytes = Base64.getDecoder().decode(it.icon.substring(22));
                NativeImage img = NativeImage.read(new ByteArrayInputStream(bytes));
                if (img.getWidth() != 64 || img.getHeight() != 64) { BAD.put(key, true); return builtin(it); }
                Identifier nid = Compat.id("cubixora", "dyn/icon_" + Integer.toHexString(key.hashCode() & 0xfffffff));
                Compat.registerTexture(nid, img);
                DYN.put(key, nid);
                return nid;
            } catch (Throwable t) { BAD.put(key, true); }
        }
        return builtin(it);
    }

    private static Identifier builtin(CxBridge.Item it) {
        String k = it.type + "_" + it.ref;
        if (!BUILTIN.contains(k)) k = it.type + "_" + it.ref.replace('-', '_');
        return BUILTIN.contains(k) ? Compat.id("cubixora", "textures/gui/item/" + k + ".png") : null;
    }

    // ---- mağazada admin'in yüklediği pelerin dokusu (HD olabilir) ve dönen 3B eşya şeritleri ----
    private static final Map<String, Identifier> CAPE = new HashMap<>();
    private static final Map<String, Integer> CAPE_K = new HashMap<>();
    private static final Set<String> SPIN = Set.of("hat_kask", "hat_buyucu", "fpet_ejder");
    public static final int SPIN_FRAMES = 36, SPIN_COLS = 6, SPIN_PX = 64;

    /** Admin'in yüklediği pelerin dokusu (varsa). Çözünürlük katsayısı için {@link #capeScale}. */
    public static Identifier capeTex(CxBridge.Item it) {
        if (it.tex == null || !it.tex.startsWith("data:image/png;base64,")) return null;
        String key = it.id + "#" + it.tex.hashCode();
        Identifier id = CAPE.get(key);
        if (id != null) return id;
        if (BAD.containsKey(key)) return null;
        try {
            byte[] bytes = Base64.getDecoder().decode(it.tex.substring(22));
            NativeImage img = NativeImage.read(new ByteArrayInputStream(bytes));
            int w = img.getWidth(), h = img.getHeight();
            if (w < 64 || w % 64 != 0 || w > 1024 || (h != w / 2 && h != w)) { BAD.put(key, true); return null; }
            Identifier nid = Compat.id("cubixora", "dyn/shopcape_" + Integer.toHexString(key.hashCode() & 0xfffffff));
            Compat.registerTexture(nid, img);
            CAPE.put(key, nid); CAPE_K.put(key, w / 64);
            return nid;
        } catch (Throwable t) { BAD.put(key, true); return null; }
    }
    public static int capeScale(CxBridge.Item it) {
        Integer k = CAPE_K.get(it.id + "#" + it.tex.hashCode());
        return k == null ? 1 : k;
    }
    /** Şapka/kask/uçan pet için 36 kareli dönüş şeridi (launcher'daki 3B kartın aynısı); yoksa null. */
    public static Identifier spin(CxBridge.Item it) {
        String k = it.type + "_" + it.ref.replace('-', '_');
        return SPIN.contains(k) ? Compat.id("cubixora", "textures/gui/item/spin_" + k + ".png") : null;
    }
}
