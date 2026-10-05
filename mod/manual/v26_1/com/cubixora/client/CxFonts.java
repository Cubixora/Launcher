package com.cubixora.client;

/** Seçilebilir yazı stilleri. "exo2" Cubixora'nın varsayılanı, "minecraft" oyunun kendi piksel yazısıdır. */
public final class CxFonts {
    public static final String[][] LIST = {
        {"exo2", "Exo 2"},
        {"minecraft", "Minecraft"},
        {"poppins", "Poppins"},
        {"montserrat", "Montserrat"},
        {"nunito", "Nunito"},
        {"rubik", "Rubik"},
        {"quicksand", "Quicksand"},
        {"inter", "Inter"},
        {"grotesk", "Space Grotesk"},
        {"jetbrains", "JetBrains Mono"},
        {"audiowide", "Audiowide"},
        {"russo", "Russo One"},
        {"oswald", "Oswald"},
        {"righteous", "Righteous"},
        {"cinzel", "Cinzel"},
        {"lobster", "Lobster"},
        {"vt323", "VT323"},
        {"caveat", "Caveat"},
        {"comfortaa", "Comfortaa"},
        {"bebas", "Bebas Neue"},
        {"pacifico", "Pacifico"},
        {"baloo", "Baloo 2"},
        {"chakra", "Chakra Petch"},
        {"rajdhani", "Rajdhani"}
    };
    private CxFonts() {}
    public static String nameOf(String id) { for (String[] f : LIST) if (f[0].equals(id)) return f[1]; return LIST[0][1]; }

    public static boolean known(String id) { if (id == null) return false; for (String[] f : LIST) if (f[0].equals(id)) return true; return false; }
    /** Her harf çiziminde çağrılır: ayar değişmedikçe (aynı nesne) liste taranmaz. */
    private static volatile String[] cur = { null, "exo2" };
    public static String current() {
        String f = CxClient.settings == null ? null : CxClient.settings.font;
        String[] c = cur;
        if (f == c[0] && f != null) return c[1];
        String v = known(f) ? f : "exo2";
        cur = new String[] { f, v };
        return v;
    }
    /** kind: ui | caps | title -> cubixora:<yol> yazı tipi kaynağı. */
    public static String path(String kind) { return pathOf(current(), kind); }
    public static String pathOf(String id, String kind) {
        if (!known(id) || id.equals("exo2")) return kind;
        return "f_" + id + (kind.equals("ui") ? "" : "_" + kind);
    }
}
