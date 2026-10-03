package com.cubixora.client;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;
import net.minecraft.util.Util;

import java.util.ArrayList;
import java.util.List;

/**
 * HUD düzenleyici: modülleri sürükleyerek yerleştir, fare tekerleğiyle ölçekle.
 * Üstte Kaydet / Sıfırla / İptal / Izgara / Kenetle; kaydedince "Kaydedildi" bildirimi çıkar.
 */
public final class CxHudEditor extends Screen {
    private final Screen parent;
    private final CxClient.Settings original;
    private final long opened = Util.getMeasuringTimeMs();
    private long last = Util.getMeasuringTimeMs(), savedAt;
    private boolean grid = true, snap = true, closing, saved;
    private CxMods.Mod drag, sel;
    private float offX, offY;
    private int guideX = -1, guideY = -1;
    private final float[] hover = new float[5];
    private static final String[] BTN = { "Kaydet", "Sıfırla", "İptal", "Izgara", "Kenetle" };

    public CxHudEditor(Screen parent) {
        super(Text.literal("HUD Düzenle"));
        this.parent = parent;
        this.original = CxClient.settings.copy();
    }

    private int bw() { return 62; }
    private int bx(int i) { int total = BTN.length * bw() + (BTN.length - 1) * 6; return (width - total) / 2 + i * (bw() + 6); }

    private List<CxMods.Mod> active() {
        List<CxMods.Mod> out = new ArrayList<>();
        for (CxMods.Mod m : CxMods.ALL) if (CxMods.on(m.id) && m.visual()) out.add(m);
        return out;
    }

    private boolean isOn(int i) { return i == 3 ? grid : i == 4 ? snap : false; }

    @Override
    public void render(DrawContext c, int mouseX, int mouseY, float delta) {
        long now = Util.getMeasuringTimeMs();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        float a = CxUi.easeOut((now - opened) / 200f);
        c.fill(0, 0, width, height, CxUi.alpha(0x99080A0D, a));
        if (grid) {
            int gcol = CxUi.alpha(0x22FFFFFF, a);
            for (int x = 0; x < width; x += 16) c.fill(x, 0, x + 1, height, gcol);
            for (int y = 0; y < height; y += 16) c.fill(0, y, width, y + 1, gcol);
            c.fill(width / 2, 0, width / 2 + 1, height, CxUi.alpha(0x44FFFFFF, a));
            c.fill(0, height / 2, width, height / 2 + 1, CxUi.alpha(0x44FFFFFF, a));
        }
        for (CxMods.Mod m : active()) {
            CxMods.Cfg cf = CxMods.cfg(m.id);
            float x = CxMods.posX(m) * width, y = CxMods.posY(m) * height;
            CxMods.drawLive(c, textRenderer, m, x, y, cf.scale);
            if (m.w <= 0 || m.h <= 0) continue;   // görünmeyen modülün çerçevesi/tıklama alanı olmaz
            int w = Math.max(14, Math.round(m.w * cf.scale)), h = Math.max(10, Math.round(m.h * cf.scale));
            boolean over = CxUi.inside(mouseX, mouseY, Math.round(x), Math.round(y), w, h);
            int col = m == drag || m == sel ? CxStyle.accent() : over ? 0xCCFFFFFF : 0x66FFFFFF;
            CxUi.outline(c, Math.round(x) - 2, Math.round(y) - 2, w + 4, h + 4, 5, CxUi.alpha(col, a));
        }
        if (drag != null) {
            if (guideX >= 0) c.fill(guideX, 0, guideX + 1, height, CxStyle.accent(a));
            if (guideY >= 0) c.fill(0, guideY, width, guideY + 1, CxStyle.accent(a));
        }
        // araç çubuğu
        CxUi.round(c, bx(0) - 8, 6, BTN.length * (bw() + 6) + 2, 28, 9, CxUi.alpha(0xE60E1116, a));
        for (int i = 0; i < BTN.length; i++) {
            boolean over = CxUi.inside(mouseX, mouseY, bx(i), 10, bw(), 20);
            hover[i] = CxUi.approach(hover[i], over ? 1 : 0, 18, dt);
            if (i >= 3) {
                CxUi.round(c, bx(i), 10, bw(), 20, 6, CxUi.alpha(CxUi.mix(isOn(i) ? CxUi.alpha(CxStyle.accent(), 0.35f) : CxStyle.button(), CxStyle.buttonHover(), hover[i] * 0.5f), a));
                if (isOn(i)) CxUi.outline(c, bx(i), 10, bw(), 20, 6, CxStyle.accent(a));
                c.drawText(textRenderer, BTN[i], bx(i) + (bw() - textRenderer.getWidth(BTN[i])) / 2, 17, CxUi.alpha(isOn(i) ? CxStyle.text() : CxStyle.muted(), a), false);
            } else CxUi.button(c, textRenderer, BTN[i], bx(i), 10, bw(), 20, hover[i], a);
        }
        if (active().isEmpty()) {
            String m = "Etkin modül yok. Modlar menüsünden bir modülü aç.";
            c.drawText(textRenderer, m, (width - textRenderer.getWidth(m)) / 2, height / 2 - 4, CxUi.alpha(CxStyle.muted(), a), false);
        }
        String hint = "Sürükle: taşı  ·  Ok tuşları: 1 px (Shift: 8 px)  ·  Tekerlek: ölçekle  ·  Sağ tık: sıfırla";
        c.drawText(textRenderer, hint, (width - textRenderer.getWidth(hint)) / 2, 40, CxUi.alpha(CxStyle.muted(), a), false);
        // "Kaydedildi" bildirimi
        if (savedAt != 0) {
            float t = (now - savedAt) / 900f;
            float k = CxUi.easeOut(Math.min(1, t * 4)) * (1 - CxUi.clamp01((t - 0.75f) * 4));
            String s = "Kaydedildi";
            int w = textRenderer.getWidth(s) + 40, x = (width - w) / 2, y = Math.round(height / 2f - 10 + (1 - k) * 10);
            CxUi.round(c, x, y, w, 26, 13, CxUi.alpha(0xF00E1116, k));
            CxUi.outline(c, x, y, w, 26, 13, CxStyle.accent(k));
            CxUi.round(c, x + 9, y + 8, 10, 10, 5, CxStyle.accent(k));
            c.drawText(textRenderer, s, x + 26, y + 9, CxUi.alpha(0xFFFFFFFF, k), false);
            if (t >= 1 && !closing) { closing = true; leave(); }
        }
        super.render(c, mouseX, mouseY, delta);
    }

    /** İmlecin altındaki modül; üst üste binenlerde en küçük olan (küçük rozet büyük kutunun altında kalmasın). */
    private CxMods.Mod hit(double mx, double my) {
        CxMods.Mod best = null; long bestA = Long.MAX_VALUE;
        for (CxMods.Mod m : active()) {
            CxMods.Cfg cf = CxMods.cfg(m.id);
            if (m.w <= 0 || m.h <= 0) continue;   // boyutsuz (görünmeyen) modül sürüklemeyi çalmasın
            int x = Math.round(CxMods.posX(m) * width), y = Math.round(CxMods.posY(m) * height);
            int w = Math.max(14, Math.round(m.w * cf.scale)), h = Math.max(10, Math.round(m.h * cf.scale));
            if (CxUi.inside(mx, my, x, y, w, h) && (long) w * h <= bestA) { best = m; bestA = (long) w * h; }
        }
        return best;
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        for (int i = 0; i < BTN.length; i++) if (CxUi.inside(mx, my, bx(i), 10, bw(), 20)) {
            CxUi.click();
            switch (i) {
                case 0: CxClient.save(); saved = true; savedAt = Util.getMeasuringTimeMs(); break;
                case 1: for (CxMods.Mod m : CxMods.ALL) { boolean on = CxMods.on(m.id); CxMods.reset(m); CxMods.cfg(m.id).on = on; } break;
                case 2: saved = false; CxClient.settings = original; CxClient.save(); leave(); break;
                case 3: grid = !grid; break;
                default: snap = !snap;
            }
            return true;
        }
        CxMods.Mod m = hit(mx, my);
        if (m != null) {
            sel = m;
            if (button == 1) { CxMods.Cfg cf = CxMods.cfg(m.id); cf.x = -1; cf.y = -1; cf.scale = 1f; return true; }
            drag = m; offX = (float) mx - CxMods.posX(m) * width; offY = (float) my - CxMods.posY(m) * height;
            return true;
        }
        sel = null;
        return super.mouseClicked(mx, my, button);
    }

    @Override
    public boolean mouseDragged(double mx, double my, int button, double dx, double dy) {
        if (drag == null) return super.mouseDragged(mx, my, button, dx, dy);
        CxMods.Cfg cf = CxMods.cfg(drag.id);
        int w = Math.round(drag.w * cf.scale), h = Math.round(drag.h * cf.scale);
        float x = (float) mx - offX, y = (float) my - offY;
        guideX = guideY = -1;
        if (snap) {
            // Ekran kenarı/ortası ve diğer modüllerin kenarlarına yapışır; aralarında 4 px boşluk bırakır.
            final float TH = 6f, GAP = 4f;
            float bestX = TH + 1, bestY = TH + 1, nx = x, ny = y; int gx = -1, gy = -1;
            java.util.List<float[]> xs = new java.util.ArrayList<>(), ys = new java.util.ArrayList<>();   // {hedef sol/üst, kılavuz çizgisi}
            xs.add(new float[] { GAP, GAP }); xs.add(new float[] { width - GAP - w, width - GAP }); xs.add(new float[] { width / 2f - w / 2f, width / 2f });
            ys.add(new float[] { GAP, GAP }); ys.add(new float[] { height - GAP - h, height - GAP }); ys.add(new float[] { height / 2f - h / 2f, height / 2f });
            for (CxMods.Mod o : active()) {
                if (o == drag) continue;
                CxMods.Cfg oc = CxMods.cfg(o.id);
                float ox = CxMods.posX(o) * width, oy = CxMods.posY(o) * height, ow = o.w * oc.scale, oh = o.h * oc.scale;
                xs.add(new float[] { ox, ox });                       // sol kenarlar hizalı
                xs.add(new float[] { ox + ow - w, ox + ow });         // sağ kenarlar hizalı
                xs.add(new float[] { ox + ow + GAP, ox + ow + GAP }); // yan yana
                xs.add(new float[] { ox - GAP - w, ox - GAP });
                ys.add(new float[] { oy, oy });                       // üst kenarlar hizalı
                ys.add(new float[] { oy + oh - h, oy + oh });         // alt kenarlar hizalı
                ys.add(new float[] { oy + oh + GAP, oy + oh + GAP }); // altına diz
                ys.add(new float[] { oy - GAP - h, oy - GAP });       // üstüne diz
            }
            for (float[] c : xs) { float d = Math.abs(x - c[0]); if (d < bestX) { bestX = d; nx = c[0]; gx = Math.round(c[1]); } }
            for (float[] c : ys) { float d = Math.abs(y - c[0]); if (d < bestY) { bestY = d; ny = c[0]; gy = Math.round(c[1]); } }
            if (bestX <= TH) { x = nx; guideX = gx; }
            if (bestY <= TH) { y = ny; guideY = gy; }
        }
        x = Math.round(x); y = Math.round(y);
        x = Math.max(0, Math.min(width - w, x)); y = Math.max(0, Math.min(height - h, y));
        cf.x = x / width; cf.y = y / height;
        return true;
    }

    @Override public boolean mouseReleased(double mx, double my, int button) { if (drag != null) { CxClient.save(); saved = true; } drag = null; guideX = guideY = -1; return super.mouseReleased(mx, my, button); }

    @Override
    public boolean mouseScrolled(double mouseX, double mouseY, double horizontalAmount, double verticalAmount) {
        CxMods.Mod m = hit(mouseX, mouseY);
        if (m == null) m = sel;
        if (m == null) return false;
        CxMods.Cfg cf = CxMods.cfg(m.id);
        cf.scale = Math.max(0.5f, Math.min(2f, Math.round((cf.scale + (float) verticalAmount * 0.05f) * 20f) / 20f));
        return true;
    }

    /** Seçili modülü ok tuşlarıyla 1 px (Shift ile 8 px) oynatır. */
    @Override
    public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
        if (sel != null && keyCode >= 262 && keyCode <= 265) {
            CxMods.Cfg cf = CxMods.cfg(sel.id);
            int step = (modifiers & 1) != 0 ? 8 : 1;
            int w = Math.round(sel.w * cf.scale), h = Math.round(sel.h * cf.scale);
            float x = CxMods.posX(sel) * width, y = CxMods.posY(sel) * height;
            if (keyCode == 262) x += step; else if (keyCode == 263) x -= step; else if (keyCode == 264) y += step; else y -= step;
            x = Math.max(0, Math.min(width - w, x)); y = Math.max(0, Math.min(height - h, y));
            cf.x = x / width; cf.y = y / height;
            CxClient.save(); saved = true;
            return true;
        }
        return super.keyPressed(keyCode, scanCode, modifiers);
    }

    private void leave() { client.setScreen(parent); if (parent instanceof CxModsScreen m) m.refresh(); }
    @Override public void close() { if (!saved) { CxClient.settings = original; CxClient.save(); } leave(); }
    @Override public boolean shouldPause() { return false; }
    @Override public void renderBackground(DrawContext context, int mouseX, int mouseY, float delta) {}
}
