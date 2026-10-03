package com.cubixora.client;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.util.Util;
import org.lwjgl.glfw.GLFW;

/**
 * Emote / sprey çarkı. Tuşa basılı tutulunca açılır, fareyle dilim seçilir, tuş bırakılınca uygulanır.
 * Ortaya (boş daireye) bırakmak iptaldir. Karakter önden görünür (kamera CxEmote tarafından çevrilir).
 */
public final class CxWheelScreen extends Screen {
    private static final Identifier[] W = new Identifier[8];
    private static final Identifier RING = Identifier.fromNamespaceAndPath("cubixora", "textures/gui/wheel/ring.png");
    static { for (int i = 0; i < 8; i++) W[i] = Identifier.fromNamespaceAndPath("cubixora", "textures/gui/wheel/w" + i + ".png"); }

    private int cat;
    private int hover = -1;
    private final float[] hv = new float[8];
    private float catSlide, editHover;
    private final long opened = Util.getMillis();
    private long last = opened;
    private boolean applied;

    public CxWheelScreen() {
        super(Component.literal("Çark"));
        CxScale.sync(net.minecraft.client.Minecraft.getInstance(), this);
    }

    @Override protected void init() { if (cat == 0) CxEmote.beginView(minecraft); else CxEmote.endView(minecraft); }

    private int cx() { return width / 2; }
    private int cy() { return height / 2 - 4; }
    private int radius() { return Math.max(60, Math.min(112, (height - 100) / 2)); }

    private int slotAt(double mx, double my) {
        double dx = mx - cx(), dy = my - cy(), d = Math.sqrt(dx * dx + dy * dy);
        if (d < radius() * 0.46) return -1;
        double a = (Math.toDegrees(Math.atan2(dy, dx)) + 90 + 360) % 360;
        return (int) Math.round(a / 45.0) % 8;
    }

    private void setCat(int c) { if (c == cat) return; cat = (c + 2) % 2; CxUi.click(); if (cat == 0) CxEmote.beginView(minecraft); else CxEmote.endView(minecraft); }

    @Override
    public void extractRenderState(GuiGraphicsExtractor c, int mouseX, int mouseY, float delta) {
        long now = Util.getMillis();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        float a = CxUi.easeOut((now - opened) / 180f), pop = 0.9f + 0.1f * CxUi.easeOutBack((now - opened) / 260f);
        // tuş bırakıldı mı?
        if (now - opened > 120 && GLFW.glfwGetKey(minecraft.getWindow().handle(), CxClient.settings.wheelKey) != 1) { finish(true); return; }
        hover = slotAt(mouseX, mouseY);
        int R = radius(), cx = cx(), cy = cy();
        // yumuşak kenar karartması (karakter görünür kalır)
        c.fillGradient(0, 0, width, height / 4, CxUi.alpha(0xFF05070A, 0.55f * a), 0);
        c.fillGradient(0, height - height / 3, width, height, 0, CxUi.alpha(0xFF05070A, 0.65f * a));
        c.fill(0, 0, width, height, CxUi.alpha(0xFF05070A, 0.18f * a));
        int D = Math.round(2 * R * pop);
        int x0 = cx - D / 2, y0 = cy - D / 2;
        int acc = CxStyle.accent();
        String[] slots = CxEmote.slots(cat);
        for (int i = 0; i < 8; i++) {
            hv[i] = CxUi.approach(hv[i], i == hover ? 1 : 0, 20, dt);
            CxEmote.Entry e = CxEmote.find(cat, slots[i]);
            int base = e != null ? CxUi.mix(0xFF141A21, 0xFF1D262F, 0f) : 0xFF10151B;
            int col = CxUi.mix(base, CxUi.mix(acc, 0xFF1B232B, 0.55f), hv[i]);
            float al = (0.78f + 0.14f * hv[i]) * a;
            CxUi.tex(c, W[i], x0, y0, 0, 0, D, D, 256, 256, 256, 256, CxUi.alpha(col, al));
        }
        CxUi.tex(c, RING, x0, y0, 0, 0, D, D, 256, 256, 256, 256, CxUi.alpha(0xFFFFFFFF, 0.22f * a));
        // dilim içerikleri
        for (int i = 0; i < 8; i++) {
            double ang = Math.toRadians(i * 45 - 90);
            float mr = R * 0.74f * pop, push = 1 + 0.03f * hv[i];
            int sx = Math.round(cx + (float) Math.cos(ang) * mr * push), sy = Math.round(cy + (float) Math.sin(ang) * mr * push);
            CxEmote.Entry e = CxEmote.find(cat, slots[i]);
            if (e == null) {
                int tc = CxUi.alpha(CxStyle.muted(), (0.35f + 0.4f * hv[i]) * a);
                CxUi.round(c, sx - 1, sy - 6, 3, 13, 1, tc); CxUi.round(c, sx - 6, sy - 1, 13, 3, 1, tc);
            } else {
                int s = 18;
                CxUi.tex(c, CxEmote.CATS[cat].equals("emote") ? ICON_E : ICON_S, sx - s / 2, sy - s / 2 - 5, 0, 0, s, s, 64, 64, 64, 64, CxUi.alpha(CxUi.mix(0xFFFFFFFF, acc, hv[i] * 0.3f), a));
                String nm = font.plainSubstrByWidth(CxUi.caps(e.name), Math.round(R * 0.48f / CxUi.CAPS_SCALE));
                CxUi.caps(c, font, nm, sx - CxUi.capsW(font, nm) / 2f, sy + 7, CxUi.alpha(CxUi.mix(CxStyle.text(), 0xFFFFFFFF, hv[i]), a));
            }
            // numara
            String num = String.valueOf(i + 1);
            c.text(font, num, Math.round(cx + (float) Math.cos(ang) * R * 0.93f * pop) - font.width(num) / 2, Math.round(cy + (float) Math.sin(ang) * R * 0.93f * pop) - 4, CxUi.alpha(CxStyle.muted(), 0.5f * a), false);
        }
        // merkez: kategori adı
        String cn = CxEmote.CAT_NAMES[cat];
        boolean center = hover < 0 && Math.hypot(mouseX - cx, mouseY - cy) < R * 0.46;
        CxUi.caps(c, font, "‹  " + cn + "  ›", cx - CxUi.capsW(font, "‹  " + cn + "  ›") / 2f, cy - 4, CxUi.alpha(CxStyle.header(), a));
        String sub = center ? "İPTAL" : hover >= 0 && CxEmote.find(cat, slots[hover]) != null ? CxEmote.find(cat, slots[hover]).name : "";
        if (!sub.isEmpty()) CxUi.caps(c, font, sub, cx - CxUi.capsW(font, sub) / 2f, cy + 8, CxUi.alpha(center ? CxUi.DND : CxStyle.muted(), a));
        // üst başlık + kategori ipuçları
        CxUi.caps(c, font, "Emote & Sprey Çarkı", cx - CxUi.capsW(font, "Emote & Sprey Çarkı") / 2f, 10, CxUi.alpha(CxStyle.header(), a));
        // alt: düzenle düğmesi + ipucu
        int bw = 96, bh = 18, bx = cx - bw / 2, by = height - 46;
        boolean eo = CxUi.inside(mouseX, mouseY, bx, by, bw, bh);
        editHover = CxUi.approach(editHover, eo ? 1 : 0, 18, dt);
        CxUi.button(c, font, "Çarkı Düzenle", bx, by, bw, bh, editHover, a);
        String hint = "Bırak → uygula  ·  Tekerlek / ← → kategori  ·  Merkez → iptal";
        CxUi.caps(c, font, hint, cx - CxUi.capsW(font, hint) / 2f, height - 20, CxUi.alpha(CxStyle.muted(), 0.9f * a));
        super.extractRenderState(c, mouseX, mouseY, delta);
    }

    private static final Identifier ICON_E = Identifier.fromNamespaceAndPath("cubixora", "textures/gui/icon/emote.png"), ICON_S = Identifier.fromNamespaceAndPath("cubixora", "textures/gui/icon/spray.png");

    private void finish(boolean apply) {
        if (applied) return;
        applied = true;
        String id = apply && hover >= 0 ? CxEmote.slots(cat)[hover] : null;
        minecraft.setScreen(null);
        if (id != null) CxEmote.apply(minecraft, cat, id); else CxEmote.endView(minecraft);
    }

    @Override public boolean mouseClicked(net.minecraft.client.input.MouseButtonEvent click, boolean doubled) {
        double mx = click.x(), my = click.y(); int button = click.button();
        int bw = 96, bh = 18, bx = cx() - bw / 2, by = height - 46;
        if (CxUi.inside(mx, my, bx, by, bw, bh)) { CxUi.click(); applied = true; minecraft.setScreen(new CxWheelEditor(this, cat)); return true; }
        return true;
    }
    @Override public boolean mouseScrolled(double mouseX, double mouseY, double horizontalAmount, double v) { if (v != 0) setCat(cat + (v > 0 ? -1 : 1)); return true; }
    @Override public boolean keyPressed(net.minecraft.client.input.KeyEvent input) {
        int keyCode = input.key(), scanCode = input.scancode(), modifiers = input.modifiers();
        if (keyCode == GLFW.GLFW_KEY_LEFT || keyCode == GLFW.GLFW_KEY_RIGHT) { setCat(cat + (keyCode == GLFW.GLFW_KEY_LEFT ? -1 : 1)); return true; }
        if (keyCode == GLFW.GLFW_KEY_ESCAPE) { applied = true; minecraft.setScreen(null); CxEmote.endView(minecraft); return true; }
        return true;
    }
    @Override public void onClose() { applied = true; minecraft.setScreen(null); CxEmote.endView(minecraft); }
    @Override public boolean isPauseScreen() { return false; }
    @Override public void extractBackground(GuiGraphicsExtractor context, int mouseX, int mouseY, float delta) {}
    /** Düzenleyiciden dönüş için: çark yeniden açılmaz, kamera önde kalmaz. */
    void editorClosed() { CxEmote.endView(minecraft); }
}
