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
    private static Identifier get(String kind) { return CACHE.computeIfAbsent(CxFonts.path(kind), p -> Identifier.of("cubixora", p)); }
    /** Varsayılan yazının yerine geçen yazı tipi; her harfte çağrıldığı için stil değişmedikçe hazır nesne döner. */
    private static String uiFor; private static Identifier uiVal;
    public static Identifier fUi() {
        String f = CxFonts.current();
        Identifier v = uiVal;
        if (v == null || f != uiFor) { v = get("ui"); uiVal = v; uiFor = f; }
        return v;
    }
    public static Identifier fCaps() { return get("caps"); }
    public static Identifier fTitle() { return get("title"); }
    public static Identifier forId(String id, String kind) { return Identifier.of("cubixora", CxFonts.pathOf(id, kind)); }
    private CxFont() {}

    public static Identifier map(Identifier id) { return CxClient.enabled && DEFAULT.equals(id) ? fUi() : id; }

    /** Piksel (Minecraft) yazı tipiyle metin — ana menü başlıkları için. */
    public static MutableText pixel(String s) { return Text.literal(s.toUpperCase(java.util.Locale.forLanguageTag("tr"))).styled(st -> st.withFont(fTitle())); }
    public static MutableText caps(String s) { return Text.literal(s).styled(st -> st.withFont(fCaps())); }
    public static MutableText sample(String s, String id) { return Text.literal(s).styled(st -> st.withFont(forId(id, "ui"))); }
    /** TAB listesinde Cubixora Client kullanıcılarının adının başına CX logosu. */
    public static Text logoName(Text orig) { return Text.empty().append(Text.literal("").styled(st -> st.withFont(LOGO).withColor(0xFFFFFF))).append(Text.literal(" ")).append(orig); }
}
