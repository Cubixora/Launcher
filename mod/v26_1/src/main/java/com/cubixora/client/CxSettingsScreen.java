package com.cubixora.client;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.components.toasts.SystemToast;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Util;

/**
 * Cubixora Ayarları (Solaris düzeni): solda "CUBIXORA AYARLAR" ve sekmeler
 * (Sesli Sohbet, Sesler, Bildirimler, Görseller, Kozmetikler, Giriş), sağda satırlar,
 * sol altta "Kaydet ve Kapat", sağ üstte açık/koyu tema düğmesi.
 * Değişiklikler anında önizlenir; ESC ile vazgeçilir, "Kaydet ve Kapat" ile kaydedilir.
 */
public final class CxSettingsScreen extends Screen {
    static final String[] TABS = {"Sesli Sohbet", "Sesler", "Bildirimler", "Görseller", "Kozmetikler", "Giriş"};
    private final Screen parent;
    private final CxClient.Settings original;
    private final long opened = Util.getMillis();
    private long last = Util.getMillis();
    private final CxForm form = new CxForm();
    private final float[] tabHover = new float[TABS.length];
    private int tab;
    private float tabAnim, saveHover, themeHover, themeSpin;
    private CxDialog dialog;
    private int px, py, pw, ph, navW;

    public CxSettingsScreen(Screen parent) { this(parent, 0); }
    public CxSettingsScreen(Screen parent, int tab) {
        super(Component.translatable("cx.settings.title"));
        this.parent = parent;
        CxScale.sync(net.minecraft.client.Minecraft.getInstance(), this);
        this.original = CxClient.settings.copy();
        this.tab = tab;
        this.tabAnim = tab;
        build();
    }

    private static CxClient.Settings s() { return CxClient.settings; }
    private static final String[] MIC = { "Kapalı", "Ses Algılama", "Bas-Konuş" }, HEAR = { "Sadece Arkadaşlar", "Herkes", "Kimse" };
    private static String pct(int v) { return v + "%"; }

    private void build() {
        form.clear();
        CxClient.Settings s = s();
        switch (tab) {
            case 0:
                form.toggleL("Yakınlık Sohbeti", "Aynı sunucudaki yakın oyuncularla konuş ve onları duy.", () -> s().proximity, v -> s().proximity = v);
                form.toggleL("Çağrıda Yakınlık", "Aramadaki arkadaşın aynı dünyadaysa sesi bulunduğu yerden gelir; başka bir dünyadaysa normal duyulur.", () -> s().callProximity, v -> s().callProximity = v);
                form.slider("Yakınlık Menzili", "Kaç blok öteden duyulacağın. Çağrıda yakınlık için de geçerli.", () -> s().proximityRange, v -> s().proximityRange = v, 8, 128, 4, v -> v + " blok");
                form.button("Mikrofon Modu", "Kapalı: mikrofon hiç açılmaz. Ses Algılama: konuşunca otomatik gider. Bas-Konuş: tuşa basılı tutunca gider.", () -> MIC[Math.max(0, Math.min(2, s().micMode))] + "  >", () -> { s().micMode = (s().micMode + 1) % 3; s().pushToTalk = s().micMode == 2; s().micChosen = true; capture = 0; rebuild(); });
                if (s().micMode == 2) form.button("Bas-Konuş Tuşu", "Basılı tutarken konuşursun. Değiştirmek için tıkla, sonra yeni tuşa bas.", () -> capture == 1 ? "Bir tuşa bas..." : keyName(s().pttKey), () -> capture = capture == 1 ? 0 : 1);
                if (s().micMode == 1) form.slider("Ses Algılama Eşiği", "Daha yüksek değer, arka plan gürültüsünü daha çok eler.", () -> s().vadThreshold, v -> s().vadThreshold = v, 0, 100, 1, CxSettingsScreen::pct);
                form.button("Kimi Duyayım?", "Sadece arkadaş eklediğin kişileri, herkesi ya da kimseyi duyabilirsin.", () -> HEAR[Math.max(0, Math.min(2, s().hearMode))] + "  >", () -> s().hearMode = (s().hearMode + 1) % 3);
                form.slider("Çıkış Ses Seviyesi", "Diğerlerinin sesi.", () -> s().outVolume, v -> s().outVolume = v, 0, 200, 5, CxSettingsScreen::pct);
                form.slider("Ses Kalitesi", "Daha yüksek bit hızı daha net ses, daha çok bant genişliği.", () -> s().bitrate, v -> s().bitrate = v, 8, 64, 8, v -> v + " kbps");
                form.button("Ses Cihazları", "Mikrofon ve hoparlör seçimi.", () -> "Aç", () -> open(new CxDialog.Voice(s())));
                break;
            case 1:
                form.slider("Pet Ses Seviyesi", "", () -> s().petVol, v -> s().petVol = v, 0, 100, 5, CxSettingsScreen::pct);
                form.slider("Bildirim Ses Seviyesi", "", () -> s().notifVol, v -> s().notifVol = v, 0, 100, 5, CxSettingsScreen::pct);
                form.slider("Öldürme Ses Efektleri", "", () -> s().killVol, v -> s().killVol = v, 0, 100, 5, CxSettingsScreen::pct);
                form.slider("Aura Ses Efektleri", "", () -> s().auraVol, v -> s().auraVol = v, 0, 100, 5, CxSettingsScreen::pct);
                form.slider("Sprey Ses Seviyesi", "", () -> s().sprayVol, v -> s().sprayVol = v, 0, 100, 5, CxSettingsScreen::pct);
                form.slider("Emote Ses Seviyesi", "", () -> s().emoteVol, v -> s().emoteVol = v, 0, 100, 5, CxSettingsScreen::pct);
                form.toggle("Çark Seslerini Kapat", "", () -> s().wheelMute, v -> s().wheelMute = v);
                form.toggle("Menü Yağmur Sesi", "Ana menüde yağmur ve gök gürültüsü sesi.", () -> s().rainSound, v -> s().rainSound = v);
                form.toggle("Açılış Sesi", "Açılış animasyonu sırasında Cubixora sesi.", () -> s().introSound, v -> s().introSound = v);
                break;
            case 2:
                form.toggle("Arama Bildirimleri", "", () -> s().callNotif, v -> s().callNotif = v);
                form.toggle("Mesaj Bildirimleri", "", () -> s().msgNotif, v -> s().msgNotif = v);
                form.toggle("Bildirim Sesleri", "", () -> s().notifSound, v -> s().notifSound = v);
                break;
            case 3:
                form.button("Yazı Stili", "Oyundaki tüm yazıların stilini seç (menüler, ayarlar, HUD).", () -> CxFonts.nameOf(CxFonts.current()) + "  >", () -> open(new CxDialog.Fonts(s())));
                form.button("İmleç", "Menülerdeki fare imlecinin tasarımı. Tıkladıkça sıradakine geçer; launcher ile eşitlenir.", () -> CxCursor.name() + "  >", CxCursor::next);
                form.button("Vurgu rengi", "Switch, sekme ve arayüz vurgularının rengini seç.", () -> "Aç", () -> open(new CxDialog.Accent(s())));
                form.toggle("Açılış Videosu", "Oyun ilk açıldığında Cubixora introsunu oynat.", () -> s().intro, v -> s().intro = v);
                form.slider("Efekt Partikül Seviyesi", "", () -> s().particles, v -> s().particles = v, 0, 100, 5, CxSettingsScreen::pct);
                form.toggle("Arka Planda FPS'i Kısıtla", "Pencere odakta değilken güç tasarrufu.", () -> s().bgFpsLimit, v -> s().bgFpsLimit = v);
                form.toggle("3D Cilt Katmanları", "", () -> s().skin3d, v -> s().skin3d = v);
                form.toggle("Ana Menü Ortalı", "", () -> s().menuCentered, v -> s().menuCentered = v);
                form.toggle("Yağmurlu Arka Plan", "Menülerde yağmur damlaları ve şimşek animasyonu.", () -> s().rain, v -> s().rain = v);
                form.button("Nişangah Editörü", "", () -> "Aç", () -> open(new CxDialog.Crosshair(s())));
                break;
            case 4:
                form.toggle("Dalgalanan Pelerinler", "", () -> s().capeWave, v -> s().capeWave = v);
                form.toggle("Giriş/Çıkış Animasyonları", "", () -> s().joinAnim, v -> s().joinAnim = v);
                form.toggle("Sinematik Giriş Kamerası", "", () -> s().cinematicJoin, v -> s().cinematicJoin = v);
                form.toggle("Pet Saldırı Animasyonları", "", () -> s().petAttack, v -> s().petAttack = v);
                form.toggle("Öldürme Animasyonları", "", () -> s().killAnim, v -> s().killAnim = v);
                form.button("Emote / Sprey Çarkı Tuşu", "Basılı tutunca çark açılır. Değiştirmek için tıkla, sonra yeni tuşa bas.", () -> capture == 2 ? "Bir tuşa bas..." : keyName(s().wheelKey), () -> capture = capture == 2 ? 0 : 2);
                form.button("Oyuncu Sesleri Tuşu", "Sunucudaki Cubixora oyuncularını listeler; seslerini tek tek kapatabilirsin.", () -> capture == 4 ? "Bir tuşa bas..." : keyName(s().voiceKey), () -> capture = capture == 4 ? 0 : 4);
                form.button("Gardrop Tuşu", "Oyundayken gardropu açar. Değiştirmek için tıkla, sonra yeni tuşa bas.", () -> capture == 3 ? "Bir tuşa bas..." : keyName(s().wardrobeKey), () -> capture = capture == 3 ? 0 : 3);
                form.button("Kanat Aç/Kapat Tuşu", "Takılı kanatları açar ya da kapatır.", () -> capture == 5 ? "Bir tuşa bas..." : keyName(s().wingsKey), () -> capture = capture == 5 ? 0 : 5);
                break;
            default:
                form.toggle("Otomatik Giriş", "Kayıtlı şifreyle sunucuya otomatik giriş.", () -> s().autoLogin, v -> s().autoLogin = v);
                form.button("Yayıncı Modu", "Komut yazarken pencereyi yayında gizler.", () -> s().streamerMode ? "Kapat" : "Aç", () -> s().streamerMode = !s().streamerMode);
                form.button("Hata Bildir", "Bir sorunu ya da önerini ekibe ilet.", () -> "Aç", () -> minecraft.setScreen(new CxReportScreen(this)));
                form.button("Şifre Klasörünü Aç", "", () -> "Aç", () -> Util.getPlatform().openFile(FabricLoader.getInstance().getConfigDir().resolve("cubixora").toFile()));
        }
    }

    private int capture;

    private void rebuild() {
        float sc = form.scroll, st = form.scrollTarget;
        build();
        form.scroll = sc; form.scrollTarget = st;
    }

    static String keyName(int k) {
        switch (k) {
            case org.lwjgl.glfw.GLFW.GLFW_KEY_SPACE: return "BOŞLUK";
            case org.lwjgl.glfw.GLFW.GLFW_KEY_LEFT_SHIFT: return "SOL SHIFT";
            case org.lwjgl.glfw.GLFW.GLFW_KEY_RIGHT_SHIFT: return "SAĞ SHIFT";
            case org.lwjgl.glfw.GLFW.GLFW_KEY_LEFT_CONTROL: return "SOL CTRL";
            case org.lwjgl.glfw.GLFW.GLFW_KEY_RIGHT_CONTROL: return "SAĞ CTRL";
            case org.lwjgl.glfw.GLFW.GLFW_KEY_LEFT_ALT: return "SOL ALT";
            case org.lwjgl.glfw.GLFW.GLFW_KEY_RIGHT_ALT: return "SAĞ ALT";
            case org.lwjgl.glfw.GLFW.GLFW_KEY_TAB: return "TAB";
            case org.lwjgl.glfw.GLFW.GLFW_KEY_CAPS_LOCK: return "CAPS LOCK";
            case org.lwjgl.glfw.GLFW.GLFW_KEY_ENTER: return "ENTER";
            default:
        }
        if (k >= org.lwjgl.glfw.GLFW.GLFW_KEY_F1 && k <= org.lwjgl.glfw.GLFW.GLFW_KEY_F12) return "F" + (k - org.lwjgl.glfw.GLFW.GLFW_KEY_F1 + 1);
        String n = org.lwjgl.glfw.GLFW.glfwGetKeyName(k, 0);
        return n == null ? "TUŞ " + k : n.toUpperCase();
    }

    private void open(CxDialog d) { dialog = d; d.layout(width, height); }

    @Override
    protected void init() {
        pw = Math.min(width - 24, 620); ph = Math.min(height - 44, 380);
        px = (width - pw) / 2; py = Math.max(32, (height - ph) / 2);
        navW = Math.max(92, Math.min(150, Math.round(pw * 0.24f)));
        layoutForm();
        if (dialog != null) dialog.layout(width, height);
    }

    private void layoutForm() {
        int cx = px + navW + 14;
        form.x = cx; form.y = py + 40; form.w = px + pw - 12 - cx; form.h = ph - 40 - 12;
    }

    private void saveAndClose() {
        CxClient.save();
        SystemToast.addOrUpdate(minecraft.getToastManager(), SystemToast.SystemToastId.PERIODIC_NOTIFICATION, Component.translatable("cx.settings.saved"), Component.translatable("cx.settings.saved.d"));
        minecraft.setScreen(parent);
        // yazı stili değiştiyse yeni stilin büyük harf / başlık boyları yüklensin (açılışta yalnız seçili stil yüklenir)
        if (!java.util.Objects.equals(original.font, CxClient.settings.font)) minecraft.reloadResourcePacks();
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor c, int mouseX, int mouseY, float delta) {
        long now = Util.getMillis();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        float a = CxUi.easeOut((now - opened) / 220f);
        int mx = dialog != null ? -1000 : mouseX, my = dialog != null ? -1000 : mouseY;
        if (minecraft.level == null) CxBackground.render(c, width, height, 1f);
        c.fill(0, 0, width, height, CxUi.alpha(CxStyle.scrim(), a));

        int oy = Math.round((1 - a) * 10);
        int x = px, y = py + oy;
        CxUi.sheet(c, x, y, pw, ph, 10, a);

        // sol menü
        c.text(font, "CUBIXORA", x + 16, y + 14, CxUi.alpha(CxStyle.header(), a), false);
        c.text(font, "AYARLAR", x + 16, y + 24, CxUi.alpha(CxStyle.header(), a), false);
        tabAnim = CxUi.approach(tabAnim, tab, 18, dt);
        int ty0 = y + 44, step = Math.max(16, Math.min(22, (ph - 44 - 40) / TABS.length));
        int selY = Math.round(ty0 + tabAnim * step);
        CxUi.round(c, x + 8, selY - 4, navW - 16, step - 2, 4, CxUi.alpha(CxStyle.selected(), a));
        c.fill(x + 8, selY - 2, x + 10, selY + step - 8, CxStyle.accent(a));
        for (int i = 0; i < TABS.length; i++) {
            int ty = ty0 + i * step;
            boolean over = CxUi.inside(mx, my, x + 8, ty - 4, navW - 16, step - 2);
            tabHover[i] = CxUi.approach(tabHover[i], over ? 1 : 0, 18, dt);
            if (tabHover[i] > 0.01f && i != tab) CxUi.round(c, x + 8, ty - 4, navW - 16, step - 2, 4, CxUi.alpha(CxStyle.hover(), tabHover[i] * a));
            int col = i == tab ? CxStyle.text() : CxUi.mix(CxStyle.muted(), CxStyle.text(), tabHover[i] * 0.6f);
            c.text(font, TABS[i], x + 16 + Math.round(tabHover[i] * 2), ty - 4 + (step - 10) / 2, CxUi.alpha(col, a), false);
        }
        int sbw = navW - 24, sby = y + ph - 28;
        saveHover = CxUi.approach(saveHover, CxUi.inside(mx, my, x + 12, sby, sbw, 17) ? 1 : 0, 18, dt);
        CxUi.button(c, font, "Kaydet ve Kapat", x + 12, sby, sbw, 17, saveHover, a);
        c.fill(x + navW, y + 10, x + navW + 1, y + ph - 10, CxUi.alpha(CxStyle.divider(), a));

        // içerik başlığı
        int cx = x + navW + 14;
        c.text(font, TABS[tab].toUpperCase(new java.util.Locale("tr")), cx, y + 16, CxUi.alpha(CxStyle.header(), a), false);
        c.fill(cx, y + 28, x + pw - 14, y + 29, CxUi.alpha(CxStyle.divider(), a));
        form.y = py + 40 + oy;
        form.render(c, font, mx, my, a);
        form.y = py + 40;

        // tema düğmesi (sağ üst)
        int tbx = width - 28, tby = 6;
        themeHover = CxUi.approach(themeHover, CxUi.inside(mx, my, tbx, tby, 18, 18) ? 1 : 0, 18, dt);
        themeSpin = CxUi.approach(themeSpin, CxStyle.light() ? 1 : 0, 10, dt);
        CxUi.round(c, tbx, tby, 18, 18, 5, CxUi.alpha(CxUi.mix(0xB3141A20, 0xE6222A33, themeHover), a));
        drawThemeIcon(c, tbx + 9, tby + 9, a);

        super.extractRenderState(c, mouseX, mouseY, delta);
        if (dialog != null) {
            dialog.render(c, font, width, height, mouseX, mouseY);
            if (dialog.closed) dialog = null;
        }
    }

    /** Güneş (açık temaya geç) / ay (koyu temaya geç) simgesi. */
    private void drawThemeIcon(GuiGraphicsExtractor c, int cx, int cy, float a) {
        int col = CxUi.alpha(0xFFE9EDF1, a);
        if (!CxStyle.light()) {
            CxUi.round(c, cx - 3, cy - 3, 6, 6, 3, col);
            for (int i = 0; i < 8; i++) {
                double ang = i * Math.PI / 4 + themeSpin;
                int rx = cx + (int) Math.round(Math.cos(ang) * 6), ry = cy + (int) Math.round(Math.sin(ang) * 6);
                c.fill(rx - 1, ry - 1, rx + 1, ry + 1, col);
            }
        } else {
            CxUi.round(c, cx - 5, cy - 5, 10, 10, 5, col);
            CxUi.round(c, cx - 2, cy - 7, 10, 10, 5, CxUi.alpha(0xFF1E252D, a));
        }
    }

    @Override
    public boolean mouseClicked(net.minecraft.client.input.MouseButtonEvent click, boolean doubled) {
        double mx = click.x(), my = click.y(); int button = click.button();
        if (dialog != null) { dialog.click(mx, my); if (dialog.closed) dialog = null; return true; }
        if (button == 0) {
            int ty0 = py + 44, step = Math.max(16, Math.min(22, (ph - 44 - 40) / TABS.length));
            for (int i = 0; i < TABS.length; i++)
                if (CxUi.inside(mx, my, px + 8, ty0 + i * step - 4, navW - 16, step - 2)) { if (tab != i) { tab = i; build(); CxUi.click(); } return true; }
            if (CxUi.inside(mx, my, px + 12, py + ph - 28, navW - 24, 17)) { CxUi.click(); saveAndClose(); return true; }
            if (CxUi.inside(mx, my, width - 28, 6, 18, 18)) { s().lightTheme = !s().lightTheme; CxUi.click(); return true; }
            if (form.mouseClicked(mx, my)) return true;
        }
        return super.mouseClicked(click, doubled);
    }

    @Override
    public boolean mouseDragged(net.minecraft.client.input.MouseButtonEvent click, double dx, double dy) {
        double mx = click.x(), my = click.y(); int button = click.button();
        if (dialog != null) dialog.drag(mx, my); else form.mouseDragged(mx);
        return true;
    }

    @Override
    public boolean mouseReleased(net.minecraft.client.input.MouseButtonEvent click) {
        double mx = click.x(), my = click.y(); int button = click.button();
        if (dialog != null) dialog.release(); else form.mouseReleased();
        return super.mouseReleased(click);
    }

    @Override
    public boolean mouseScrolled(double mouseX, double mouseY, double horizontalAmount, double verticalAmount) {
        if (dialog != null) return dialog.scroll(mouseX, mouseY, verticalAmount);
        return form.mouseScrolled(mouseX, mouseY, verticalAmount);
    }

    @Override
    public boolean keyPressed(net.minecraft.client.input.KeyEvent input) {
        int keyCode = input.key(), scanCode = input.scancode(), modifiers = input.modifiers();
        if (capture != 0) {
            if (keyCode != 256) { if (capture == 1) s().pttKey = keyCode; else if (capture == 2) s().wheelKey = keyCode; else if (capture == 3) s().wardrobeKey = keyCode; else if (capture == 4) s().voiceKey = keyCode; else if (capture == 5) s().wingsKey = keyCode; }
            capture = 0; CxUi.click();
            return true;
        }
        if (dialog != null) {
            if (dialog.key(keyCode)) return true;
            if (keyCode == 256) { dialog.onEscape(); dialog = null; return true; }
            return true;
        }
        return super.keyPressed(input);
    }

    // ESC ile çıkınca da değişiklikler kaydedilir (eskiden geri alınıyordu: seçilen yazı stili vb. kayboluyordu)
    @Override public void onClose() { saveAndClose(); }
    @Override public void extractBackground(GuiGraphicsExtractor context, int mouseX, int mouseY, float delta) {}
}
