package com.cubixora.client;

import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

/** Cubixora yazı tipleri: "ui" (küçük, yuvarlak TTF) varsayılan yazının yerine geçer; "pixel" Minecraft'ın piksel yazısıdır. */
public final class CxFont {
    public static final Identifier DEFAULT = Identifier.of("minecraft", "default");
    public static final Identifier PIXEL = Identifier.of("cubixora", "pixel");
    public static final Identifier LOGO = Identifier.of("cubixora", "logo");
    private static final java.util.HashMap<String, Identifier> CACHE = new java.util.HashMap<>();
    private static Identifier get(String kind) {
        String p = CxFonts.path(kind);
        if (!kind.equals("ui") && !CxFontFilter.loaded(p)) p = CxFonts.path("ui");   // bu boy henüz yüklenmediyse (stil yeni değişti) aynı stilin yazı boyu
        return CACHE.computeIfAbsent(p, q -> Identifier.of("cubixora", q));
    }
    public static Identifier fUi() { return get("ui"); }
    public static Identifier fCaps() { return get("caps"); }
    public static Identifier fTitle() { return get("title"); }
    public static Identifier forId(String id, String kind) { return Identifier.of("cubixora", CxFonts.pathOf(id, kind)); }
    private CxFont() {}

    public static Identifier map(Identifier id) { return CxClient.enabled && DEFAULT.equals(id) ? fUi() : id; }

    /** Piksel (Minecraft) yazı tipiyle metin — ana menü başlıkları için. */
    public static MutableText pixel(String s) { return Text.literal(s.toUpperCase(java.util.Locale.forLanguageTag("tr"))).styled(st -> st.withFont(fTitle())); }
    public static MutableText caps(String s) { return Text.literal(s).styled(st -> st.withFont(fCaps())); }
    /** TAB listesinde Cubixora Client kullanıcılarının adının başına CX logosu. */
    public static Text logoName(Text orig) { return Text.empty().append(Text.literal("\uE000").styled(st -> st.withFont(LOGO).withColor(0xFFFFFF))).append(Text.literal(" ")).append(orig); }
    public static MutableText sample(String s, String id) { return Text.literal(s).styled(st -> st.withFont(forId(id, "ui"))); }
}
