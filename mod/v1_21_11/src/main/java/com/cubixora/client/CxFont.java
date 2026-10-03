package com.cubixora.client;

import net.minecraft.text.MutableText;
import net.minecraft.text.StyleSpriteSource;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

/** Cubixora yazı tipleri: "ui" (küçük, yuvarlak TTF) varsayılan yazının yerine geçer; "pixel" Minecraft'ın piksel yazısıdır. */
public final class CxFont {
    public static final StyleSpriteSource PIXEL = new StyleSpriteSource.Font(Identifier.of("cubixora", "pixel"));
    public static final StyleSpriteSource LOGO = new StyleSpriteSource.Font(Identifier.of("cubixora", "logo"));
    private static final java.util.HashMap<String, StyleSpriteSource> CACHE = new java.util.HashMap<>();
    private static StyleSpriteSource get(String kind) { return CACHE.computeIfAbsent(CxFonts.path(kind), p -> new StyleSpriteSource.Font(Identifier.of("cubixora", p))); }
    public static StyleSpriteSource fUi() { return get("ui"); }
    public static StyleSpriteSource fCaps() { return get("caps"); }
    public static StyleSpriteSource fTitle() { return get("title"); }
    public static StyleSpriteSource forId(String id, String kind) { return new StyleSpriteSource.Font(Identifier.of("cubixora", CxFonts.pathOf(id, kind))); }
    private CxFont() {}

    public static StyleSpriteSource map(StyleSpriteSource src) { return CxClient.enabled && StyleSpriteSource.DEFAULT.equals(src) ? fUi() : src; }

    public static MutableText pixel(String s) { return Text.literal(s.toUpperCase(java.util.Locale.forLanguageTag("tr"))).styled(st -> st.withFont(fTitle())); }
    public static MutableText caps(String s) { return Text.literal(s).styled(st -> st.withFont(fCaps())); }
    public static MutableText sample(String s, String id) { return Text.literal(s).styled(st -> st.withFont(forId(id, "ui"))); }
    /** TAB listesinde Cubixora Client kullanıcılarının adının başına CX logosu. */
    public static Text logoName(Text orig) { return Text.empty().append(Text.literal("").styled(st -> st.withFont(LOGO).withColor(0xFFFFFF))).append(Text.literal(" ")).append(orig); }
}
