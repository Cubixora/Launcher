package com.cubixora.client;

/**
 * Cubixora arayüz paleti. Koyu ve açık (buzlu cam) tema; vurgu rengi oyuncunun seçimidir.
 * Marka rengi (logo, ana menü) her zaman Cubixora altınıdır.
 */
public final class CxStyle {
    private CxStyle() {}

    public static boolean light() { return CxClient.settings.lightTheme; }
    public static int accent() { return 0xFF000000 | (CxClient.settings.accent & 0xFFFFFF); }
    public static int accent(float a) { return CxUi.alpha(accent(), a); }

    public static int panel() { return light() ? 0x99DCE2E8 : 0xE00D1116; }
    public static int panelBorder() { return light() ? 0x66FFFFFF : 0x1FFFFFFF; }
    public static int text() { return light() ? 0xFF1B2126 : 0xFFEEF1F3; }
    public static int muted() { return light() ? 0xFF56645C : 0xFF86968F; }
    public static int header() { return light() ? CxUi.mix(accent(), 0xFF1B2126, 0.25f) : CxUi.mix(accent(), 0xFFFFFFFF, 0.25f); }
    public static int divider() { return light() ? 0x33000000 : 0x1FFFFFFF; }
    public static int hover() { return light() ? 0x33FFFFFF : 0x0FFFFFFF; }
    public static int selected() { return light() ? 0x80FFFFFF : 0x17FFFFFF; }
    public static int button() { return light() ? 0xCCF4F6F8 : 0xCC1A2026; }
    public static int buttonHover() { return light() ? 0xF2FFFFFF : 0xE6262E36; }
    public static int buttonText() { return light() ? 0xFF1B2126 : 0xFFEEF1F3; }
    public static int field() { return light() ? 0xB3FFFFFF : 0xB3080B0E; }
    public static int switchOff() { return light() ? 0xFFC9D0D5 : 0xFF3A4148; }
    public static int track() { return light() ? 0x40000000 : 0x33FFFFFF; }
    public static int scrim() { return light() ? 0x33000000 : 0x66000000; }
}
