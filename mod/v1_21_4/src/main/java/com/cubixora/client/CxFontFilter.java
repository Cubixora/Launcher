package com.cubixora.client;

/**
 * Açılış hızı: 24 yazı stilinin her biri 3 boyda (yazı / büyük harf / başlık) tanımlı = 72 TrueType yazı tipi.
 * Minecraft açılırken hepsini yükler. Seçili olmayan stillerin "büyük harf" ve "başlık" boyları yüklenmez
 * (yazı boyu, stil seçicideki önizlemeler için kalır). Stil değişince oyun kaynakları bir kez yeniden yükler.
 */
public final class CxFontFilter {
    private CxFontFilter() {}
    /** Bu yüklemede gerçekten yüklenen cubixora yazı tipi adları (örn. "f_inter", "f_inter_caps"). */
    public static final java.util.Set<String> LOADED = java.util.concurrent.ConcurrentHashMap.newKeySet();
    public static volatile int gen;
    public static volatile boolean active;

    /** namespace + yol ("font/f_inter_caps.json") -> yüklensin mi? */
    public static boolean keep(String ns, String path) {
        if (!"cubixora".equals(ns) || !path.startsWith("font/f_") || !path.endsWith(".json")) return true;
        String name = path.substring(5, path.length() - 5);          // f_inter_caps
        String rest = name.substring(2);                              // inter_caps
        String id = rest, kind = "ui";
        if (rest.endsWith("_caps")) { id = rest.substring(0, rest.length() - 5); kind = "caps"; }
        else if (rest.endsWith("_title")) { id = rest.substring(0, rest.length() - 6); kind = "title"; }
        boolean k;
        try { k = kind.equals("ui") || id.equals(CxFonts.current()); } catch (Throwable t) { k = true; }
        return k;
    }

    public static void begin() { LOADED.clear(); active = true; }
    public static void kept(String ns, String path) { if ("cubixora".equals(ns) && path.startsWith("font/") && path.endsWith(".json")) LOADED.add(path.substring(5, path.length() - 5)); }
    public static void end() { gen++; }

    /** Bu ad yüklü mü? Filtre hiç çalışmadıysa (eski sürüm vb.) her şey yüklü sayılır. */
    public static boolean loaded(String name) { return !active || LOADED.contains(name); }
}
