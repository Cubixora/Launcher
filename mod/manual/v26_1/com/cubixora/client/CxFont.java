package com.cubixora.client;

import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.FontDescription;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.resources.Identifier;

/** Cubixora yazı tipleri: "ui" (küçük, yuvarlak TTF) varsayılan yazının yerine geçer; "pixel" Minecraft'ın piksel yazısıdır. */
public final class CxFont {
    public static final FontDescription PIXEL = new FontDescription.Resource(Identifier.fromNamespaceAndPath("cubixora", "pixel"));
    public static final FontDescription LOGO = new FontDescription.Resource(Identifier.fromNamespaceAndPath("cubixora", "logo"));
    private static final java.util.HashMap<String, FontDescription> CACHE = new java.util.HashMap<>();
    private static FontDescription get(String kind) { return CACHE.computeIfAbsent(CxFonts.path(kind), p -> new FontDescription.Resource(Identifier.fromNamespaceAndPath("cubixora", p))); }
    /** Varsayılan yazının yerine geçen yazı tipi; her harfte çağrıldığı için stil değişmedikçe hazır nesne döner. */
    private static String uiFor; private static FontDescription uiVal;
    public static FontDescription fUi() {
        String f = CxFonts.current();
        FontDescription v = uiVal;
        if (v == null || f != uiFor) { v = get("ui"); uiVal = v; uiFor = f; }
        return v;
    }
    public static FontDescription fCaps() { return get("caps"); }
    public static FontDescription fTitle() { return get("title"); }
    public static FontDescription forId(String id, String kind) { return new FontDescription.Resource(Identifier.fromNamespaceAndPath("cubixora", CxFonts.pathOf(id, kind))); }
    private CxFont() {}

    public static FontDescription map(FontDescription src) { return CxClient.enabled && FontDescription.DEFAULT.equals(src) ? fUi() : src; }

    public static MutableComponent pixel(String s) { return Component.literal(s.toUpperCase(java.util.Locale.forLanguageTag("tr"))).withStyle(st -> st.withFont(fTitle())); }
    public static MutableComponent caps(String s) { return Component.literal(s).withStyle(st -> st.withFont(fCaps())); }
    public static MutableComponent sample(String s, String id) { return Component.literal(s).withStyle(st -> st.withFont(forId(id, "ui"))); }
    public static Component logoName(Component orig) { return Component.empty().append(Component.literal("").withStyle(st -> st.withFont(LOGO).withColor(0xFFFFFF))).append(Component.literal(" ")).append(orig); }
}
