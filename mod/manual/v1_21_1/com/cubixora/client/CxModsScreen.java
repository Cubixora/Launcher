package com.cubixora.client;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;
import net.minecraft.util.Util;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Cubixora Client Ayarları (Sağ Shift / ESC > Modlar). Solaris düzeni:
 * üstte başlık + "HUD düzenle" / "Kapat", sekmeler, solda arama ve modül listesi,
 * sağda seçili modülün önizlemesi, "Tuş" ve "Yerleşimi düzenle" düğmeleri ve seçenekleri.
 * Değişiklikler anında uygulanır; kapatınca kaydedilir.
 */
public final class CxModsScreen extends Screen {
    private final Screen parent;
    private final long opened = Util.getMeasuringTimeMs();
    private long last = Util.getMeasuringTimeMs();
    private final CxText search = new CxText("Modül ara", 24);
    private final CxForm form = new CxForm();
    private final List<CxMods.Mod> shown = new ArrayList<>();
    private final float[] rowHover = new float[32], rowSel = new float[32], rowOn = new float[32];
    private final float[] tabHover = new float[CxMods.TABS.length];
    private int tab; private long selAt;
    private CxMods.Mod mod;
    private float listScroll, listTarget, rScroll, rTarget, tabAnim, onPos, hudHover, closeHover, keyHover, layHover;
    private boolean capturing;
    private CxModsLayout L;
    private int descLines = 1, pvH = 70;

    public CxModsScreen(Screen parent) {
        super(Text.literal("Cubixora Client Ayarları"));
        this.parent = parent;
        CxScale.sync(net.minecraft.client.MinecraftClient.getInstance(), this);
        filter();
        if (!shown.isEmpty()) select(shown.get(0));
    }

    private void filter() {
        shown.clear();
        String q = search.value.trim().toLowerCase(new Locale("tr"));
        String t = CxMods.TABS[tab];
        for (CxMods.Mod m : CxMods.ALL) {
            if (!t.equals("Arayüz") && !m.tab.equals(t)) continue;   // "Arayüz" tüm modülleri listeler
            if (!q.isEmpty() && !m.name.toLowerCase(new Locale("tr")).contains(q)) continue;
            shown.add(m);
        }
        listScroll = listTarget = 0;
        if (mod != null && !shown.contains(mod) && !shown.isEmpty()) select(shown.get(0));
    }

    private static String fmt(int v, int div) { return div <= 1 ? String.valueOf(v) : String.format(Locale.ROOT, "%.2f", v / (double) div); }

    private void select(CxMods.Mod m) {
        mod = m; capturing = false; rScroll = rTarget = 0; selAt = Util.getMeasuringTimeMs();
        form.clear(); form.dividers = true;
        if (m == null) return;
        CxMods.Cfg cf = CxMods.cfg(m.id);
        net.minecraft.client.MinecraftClient mcx = net.minecraft.client.MinecraftClient.getInstance();
        int sw = Math.max(100, mcx.getWindow().getScaledWidth()), sh = Math.max(100, mcx.getWindow().getScaledHeight());
        for (CxMods.Opt o : m.opts) {
            switch (o.type) {
                case CxMods.Opt.TOGGLE: form.toggleL(o.label, "", () -> CxMods.flag(m, o.key), v -> CxMods.setOpt(m, o.key, v ? 1 : 0)); break;
                case CxMods.Opt.SLIDER: { final int d = o.div; form.slider(o.label, "", () -> CxMods.opt(m, o.key), v -> CxMods.setOpt(m, o.key, v), o.min, o.max, o.max - o.min > 400 ? 100 : 1, v -> fmt(v, d)); break; }
                default: form.button(o.label, "", () -> o.choices[Math.max(0, Math.min(o.max, CxMods.opt(m, o.key)))] + "  >", () -> CxMods.setOpt(m, o.key, (CxMods.opt(m, o.key) + 1) % o.choices.length));
            }
        }
        if (m.id.equals("stopwatch")) {
            form.toggleL("Çalışıyor", "", CxMods::stopwatchRunning, v -> CxMods.stopwatch(true));
            form.toggleL("Sıfırla", "", () -> false, v -> CxMods.stopwatch(false));
        }
        if (m.visual()) {
            form.slider("X kayması", "", () -> Math.round(CxMods.posX(m) * sw), v -> cf.x = v / (float) sw, 0, sw, 1, v -> String.valueOf(v));
            form.slider("Y kayması", "", () -> Math.round(CxMods.posY(m) * sh), v -> cf.y = v / (float) sh, 0, sh, 1, v -> String.valueOf(v));
            form.slider("Ölçek", "", () -> Math.round(cf.scale * 100), v -> cf.scale = v / 100f, 50, 200, 5, v -> fmt(v, 100));
        }
        if (m.opts.length == 0 && !m.visual()) form.info("Ek ayar bulunmuyor.", "");
    }

    @Override
    protected void init() {
        L = new CxModsLayout(width, height);
        search.x = L.lx; search.y = L.searchY; search.w = L.lw; search.h = 18;
        form.x = L.rx; form.w = L.rw;
    }

    private void saveAndClose() { CxClient.save(); client.setScreen(parent); }

    private int previewH() { return Math.max(46, Math.min(84, (L.vh - 60) / 3)); }

    @Override
    public void render(DrawContext c, int mouseX, int mouseY, float delta) {
        long now = Util.getMeasuringTimeMs();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        float a = CxUi.easeOut((now - opened) / 220f);
        int oy = Math.round((1 - a) * 10);
        if (client.world == null) CxBackground.render(c, width, height, 1f);
        c.fill(0, 0, width, height, CxUi.alpha(CxStyle.scrim(), a));
        CxUi.sheet(c, L.px, L.py + oy, L.pw, L.ph, 12, a);

        // başlık
        CxUi.tex(c, CxUi.LOGO, L.px + 16, L.py + 11 + oy, 0, 0, 34, 15, CxUi.LOGO_W, CxUi.LOGO_H, CxUi.LOGO_W, CxUi.LOGO_H, CxUi.alpha(0xFFFFFFFF, a));
        c.drawText(textRenderer, "Cubixora", L.px + 58, L.py + 12 + oy, CxUi.alpha(CxStyle.text(), a), false);
        c.drawText(textRenderer, "CLIENT AYARLARI", L.px + 58, L.py + 23 + oy, CxUi.alpha(CxStyle.muted(), a), false);
        int bhY = L.py + 12 + oy, kw = 48, hw = Math.min(86, Math.max(60, textRenderer.getWidth("HUD düzenle") + 22));
        int kx = L.px + L.pw - 14 - kw, hx = kx - 6 - hw;
        hudHover = CxUi.approach(hudHover, CxUi.inside(mouseX, mouseY, hx, L.py + 12, hw, 20) ? 1 : 0, 18, dt);
        closeHover = CxUi.approach(closeHover, CxUi.inside(mouseX, mouseY, kx, L.py + 12, kw, 20) ? 1 : 0, 18, dt);
        fieldBtn(c, "HUD düzenle", hx, bhY, hw, 20, hudHover, a);
        fieldBtn(c, "Kapat", kx, bhY, kw, 20, closeHover, a);

        // sekmeler
        int tw = Math.max(40, Math.min(66, (L.pw - 28) / CxMods.TABS.length));
        tabAnim = CxUi.approach(tabAnim, tab, 18, dt);
        CxUi.round(c, L.lx + Math.round(tabAnim * tw), L.tabY + oy, tw - 4, 18, 7, CxUi.alpha(CxStyle.selected(), a));
        for (int i = 0; i < CxMods.TABS.length; i++) {
            boolean over = CxUi.inside(mouseX, mouseY, L.lx + i * tw, L.tabY, tw, 18);
            tabHover[i] = CxUi.approach(tabHover[i], over ? 1 : 0, 18, dt);
            String t = textRenderer.trimToWidth(CxMods.TABS[i], tw - 8);
            int col = i == tab ? CxStyle.text() : CxUi.mix(CxStyle.muted(), CxStyle.text(), tabHover[i] * 0.7f);
            c.drawText(textRenderer, t, L.lx + i * tw + (tw - 4 - textRenderer.getWidth(t)) / 2, L.tabY + 5 + oy, CxUi.alpha(col, a), false);
        }
        c.fill(L.px + 12, L.divY + oy, L.px + L.pw - 12, L.divY + 1 + oy, CxUi.alpha(CxStyle.divider(), a));

        // sol: arama + liste
        search.y = L.searchY + oy;
        search.render(c, textRenderer, mouseX, mouseY, a);
        listScroll = CxUi.approach(listScroll, listTarget, 16, dt);
        int rowH = 24;
        float max = Math.max(0, shown.size() * rowH - L.listH);
        listTarget = Math.max(0, Math.min(listTarget, max));
        c.enableScissor(L.lx, L.listY + oy, L.lx + L.lw, L.listY + L.listH + oy);
        if (shown.isEmpty()) c.drawText(textRenderer, "Eşleşen modül yok.", L.lx + 8, L.listY + 8 + oy, CxUi.alpha(CxStyle.muted(), a), false);
        for (int i = 0; i < shown.size() && i < 32; i++) {
            CxMods.Mod m = shown.get(i);
            int y = L.listY + i * rowH - Math.round(listScroll);
            if (y + rowH < L.listY || y > L.listY + L.listH) continue;
            boolean over = CxUi.inside(mouseX, mouseY, L.lx, y, L.lw, rowH) && mouseY >= L.listY && mouseY < L.listY + L.listH;
            rowHover[i] = CxUi.approach(rowHover[i], over ? 1 : 0, 16, dt);
            rowSel[i] = CxUi.approach(rowSel[i], m == mod ? 1 : 0, 14, dt);
            rowOn[i] = CxUi.approach(rowOn[i], CxMods.on(m.id) ? 1 : 0, 16, dt);
            int bg = CxUi.mix(CxStyle.hover(), CxStyle.selected(), rowSel[i]);
            CxUi.round(c, L.lx, y + 1 + oy, L.lw - 6, rowH - 3, 7, CxUi.alpha(bg, a * Math.max(rowHover[i] * 0.7f, rowSel[i])));
            c.drawText(textRenderer, textRenderer.trimToWidth(m.name, L.lw - 36), L.lx + 10, y + (rowH - 8) / 2 + oy, CxUi.alpha(CxUi.mix(CxStyle.muted(), CxStyle.text(), Math.max(rowSel[i], rowHover[i] * 0.7f)), a), false);
            CxUi.round(c, L.lx + L.lw - 20, y + rowH / 2 - 2 + oy, 4, 4, 2, CxUi.alpha(CxUi.mix(0x55FFFFFF, CxUi.ONLINE, rowOn[i]), a));
        }
        c.disableScissor();
        if (max > 0) {
            int bh = Math.max(14, Math.round(L.listH * L.listH / (float) (shown.size() * rowH)));
            int by = L.listY + Math.round((L.listH - bh) * (listScroll / max));
            CxUi.round(c, L.lx + L.lw - 2, by + oy, 2, bh, 1, CxUi.alpha(0x55FFFFFF, a));
        }
        c.drawText(textRenderer, CxMods.enabledCount() + " modül etkin", L.lx + 4, L.countY + oy, CxUi.alpha(CxStyle.muted(), a), false);
        c.fill(L.lx + L.lw + 6, L.ct + oy, L.lx + L.lw + 7, L.py + L.ph - 12 + oy, CxUi.alpha(CxStyle.divider(), a));

        if (mod != null) renderRight(c, mouseX, mouseY, a, dt, oy);
        super.render(c, mouseX, mouseY, delta);
    }

    private void fieldBtn(DrawContext c, String label, int x, int y, int w, int h, float hv, float a) {
        CxUi.round(c, x, y, w, h, 8, CxUi.alpha(CxUi.mix(CxStyle.button(), CxStyle.buttonHover(), hv), a));
        c.drawText(textRenderer, textRenderer.trimToWidth(label, w - 12), x + 10, y + (h - 8) / 2, CxUi.alpha(CxStyle.text(), a), false);
    }

    private void renderRight(DrawContext c, int mouseX, int mouseY, float a, float dt, int oy) {
        CxMods.Cfg cf = CxMods.cfg(mod.id);
        a *= CxUi.easeOut((Util.getMeasuringTimeMs() - selAt) / 220f);
        int rx = L.rx, rw = L.rw;
        // sabit üst: başlık + Açık/Kapalı + açıklama
        c.drawText(textRenderer, mod.name, rx, L.vy + 3 + oy, CxUi.alpha(CxStyle.text(), a), false);
        boolean locked = CxMods.locked(mod), isOn = CxMods.on(mod.id);
        onPos = CxUi.approach(onPos, isOn ? 1 : 0, 18, dt);
        boolean overT = CxUi.inside(mouseX, mouseY, rx + rw - 30, L.vy, 30, 16);
        CxUi.toggle(c, rx + rw - 24, L.vy + oy, onPos, overT ? 1 : 0, a);
        String st = locked ? "Cubixora+ gerekli" : isOn ? "Açık" : "Kapalı";
        c.drawText(textRenderer, st, rx + rw - 32 - textRenderer.getWidth(st), L.vy + 3 + oy, CxUi.alpha(locked ? 0xFFF5C542 : isOn ? CxStyle.accent() : CxStyle.muted(), a), false);
        var dl = textRenderer.wrapLines(Text.literal(mod.desc), rw);
        descLines = Math.max(1, Math.min(2, dl.size()));
        for (int i = 0; i < descLines; i++) c.drawText(textRenderer, dl.get(i), rx, L.vy + 20 + i * 10 + oy, CxUi.alpha(CxStyle.muted(), a), false);
        int top = L.vy + 24 + descLines * 10;
        int viewH = L.vy + L.vh - top;

        // kaydırılan alan
        pvH = previewH();
        if (mod.visual()) pvH = Math.min(130, Math.max(pvH, mod.h + 34));
        int btnH = 22;
        int contentH = pvH + 8 + btnH + 6 + form.contentHeight() + 4;
        float max = Math.max(0, contentH - viewH);
        rTarget = Math.max(0, Math.min(rTarget, max));
        rScroll = CxUi.approach(rScroll, rTarget, 16, dt);
        int y0 = top - Math.round(rScroll) + oy;
        c.enableScissor(rx, top + oy, rx + rw, top + viewH + oy);
        // önizleme
        CxUi.round(c, rx, y0, rw, pvH, 9, CxUi.alpha(CxStyle.field(), a));
        c.drawText(textRenderer, "ÖNİZLEME", rx + 10, y0 + 7, CxUi.alpha(CxStyle.muted(), a * 0.9f), false);
        c.enableScissor(Math.max(rx, rx + 1), Math.max(top + oy, y0 + 1), rx + rw - 1, Math.min(top + viewH + oy, y0 + pvH - 1));
        drawPreview(c, rx, y0, rw, pvH, a);
        c.disableScissor();
        // düğmeler
        int by = y0 + pvH + 8;
        int kb = mod.visual() ? Math.max(72, Math.round(rw * 0.28f)) : rw;
        keyHover = CxUi.approach(keyHover, CxUi.inside(mouseX, mouseY, rx, by, kb, btnH) && mouseY >= top && mouseY < top + viewH ? 1 : 0, 18, dt);
        String kl = capturing ? "Bir tuşa bas..." : "Tuş: " + (cf.key == 0 ? "—" : CxSettingsScreen.keyName(cf.key));
        CxUi.round(c, rx, by, kb, btnH, 8, CxUi.alpha(capturing ? CxUi.alpha(CxStyle.accent(), 0.3f) : CxUi.mix(CxStyle.button(), CxStyle.buttonHover(), keyHover), a));
        c.drawText(textRenderer, textRenderer.trimToWidth(kl, kb - 16), rx + 10, by + (btnH - 8) / 2, CxUi.alpha(CxStyle.text(), a), false);
        if (mod.visual()) {
            int lx2 = rx + kb + 6, lw2 = rw - kb - 6;
            layHover = CxUi.approach(layHover, CxUi.inside(mouseX, mouseY, lx2, by, lw2, btnH) && mouseY >= top && mouseY < top + viewH ? 1 : 0, 18, dt);
            fieldBtn(c, "Yerleşimi düzenle", lx2, by, lw2, btnH, layHover, a);
        }
        // seçenekler
        form.y = by + btnH + 6; form.h = form.contentHeight();
        boolean in = mouseY >= top && mouseY < top + viewH;
        form.render(c, textRenderer, in ? mouseX : -1000, in ? mouseY : -1000, a);
        c.disableScissor();
        if (max > 0) {
            int bh = Math.max(14, Math.round(viewH * viewH / (float) contentH));
            int sy = top + Math.round((viewH - bh) * (rScroll / max));
            CxUi.round(c, rx + rw + 3, sy + oy, 2, bh, 1, CxUi.alpha(0x55FFFFFF, a));
        }
    }

    /** Seçili modülün örnek verili önizlemesi (kutunun ortasında). */
    private void drawPreview(DrawContext c, int rx, int y0, int rw, int pvH, float a) {
        int cx = rx + rw / 2, cy = y0 + pvH / 2 + 5;
        switch (mod.id) {
            case "chunk": {
                int w = 76, h = 36, x = cx - w / 2, y = cy - h / 2;
                c.fill(x, y, x + w, y + h * 2 / 3, 0xFF6C93B3);
                c.fill(x, y + h * 2 / 3, x + w, y + h, 0xFF5E7B48);
                CxUi.outline(c, cx - 8, y + 2, 16, h - 4, 2, 0xFFF5C542);
                c.fill(cx - 5, y + 8, cx + 5, y + h - 6, 0xFFE9E4D6);
                return;
            }
            case "bossbar": {
                String n = "Ender Ejderhası";
                int w = textRenderer.getWidth(n) + 20, x = cx - w / 2;
                CxUi.round(c, x, cy - 14, w, 17, 6, 0xD0131A2A);
                c.drawText(textRenderer, n, x + 10, cy - 10, 0xFFFFFFFF, false);
                CxUi.round(c, cx - 48, cy + 8, 96, 4, 2, 0x33FFFFFF);
                CxUi.round(c, cx - 48, cy + 8, 62, 4, 2, CxStyle.accent());
                return;
            }
            case "chat": {
                String n = "Oyuncu: Merhaba!";
                int w = textRenderer.getWidth(n) + 20, x = cx - w / 2;
                CxUi.round(c, x, cy - 14, w, 17, 6, 0xD0131A2A);
                c.drawText(textRenderer, n, x + 10, cy - 10, 0xFFFFFFFF, false);
                CxUi.round(c, cx - 48, cy + 8, 96, 4, 2, 0x33FFFFFF);
                CxUi.round(c, cx - 48, cy + 8, 48, 4, 2, CxStyle.accent());
                return;
            }
            case "scoreboard": {
                int w = 80, h = 40, x = cx - w / 2, y = cy - h / 2 - 2;
                CxUi.round(c, x, y, w, h, 5, 0xB0131A2A);
                c.drawText(textRenderer, "Skor", x + (w - textRenderer.getWidth("Skor")) / 2, y + 5, 0xFFFFFFFF, false);
                c.drawText(textRenderer, "Oyuncu", x + 6, y + 17, 0xFF9AA3AD, false);
                c.drawText(textRenderer, "12", x + w - 6 - textRenderer.getWidth("12"), y + 17, 0xFFF5C542, false);
                c.drawText(textRenderer, "Takım", x + 6, y + 27, 0xFF9AA3AD, false);
                c.drawText(textRenderer, "7", x + w - 6 - textRenderer.getWidth("7"), y + 27, 0xFFF5C542, false);
                return;
            }
            default:
        }
        float fit = Math.min(1.5f, Math.min((rw - 24f) / Math.max(20, mod.w), (pvH - 26f) / Math.max(10, mod.h)));
        fit = Math.max(0.6f, fit);
        float bx = cx - mod.w * fit / 2f, by = y0 + 18 + (pvH - 18 - mod.h * fit) / 2f;
        CxMods.drawLive(c, textRenderer, mod, bx, by, fit);
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        if (button != 0) return super.mouseClicked(mx, my, button);
        if (capturing) { capturing = false; return true; }
        if (search.click(mx, my)) return true;
        int kw = 48, hw = Math.min(86, Math.max(60, textRenderer.getWidth("HUD düzenle") + 22));
        int kx = L.px + L.pw - 14 - kw, hx = kx - 6 - hw;
        if (CxUi.inside(mx, my, kx, L.py + 12, kw, 20)) { CxUi.click(); saveAndClose(); return true; }
        if (CxUi.inside(mx, my, hx, L.py + 12, hw, 20)) { CxUi.click(); client.setScreen(new CxHudEditor(this)); return true; }
        int tw = Math.max(40, Math.min(66, (L.pw - 28) / CxMods.TABS.length));
        for (int i = 0; i < CxMods.TABS.length; i++)
            if (CxUi.inside(mx, my, L.lx + i * tw, L.tabY, tw, 18)) { if (tab != i) { tab = i; filter(); CxUi.click(); } return true; }
        if (my >= L.listY && my < L.listY + L.listH && mx >= L.lx && mx < L.lx + L.lw) {
            int i = (int) ((my - L.listY + listScroll) / 24);
            if (i >= 0 && i < shown.size() && shown.get(i) != mod) { select(shown.get(i)); CxUi.click(); }
            return true;
        }
        if (mod != null && mx >= L.rx && mx < L.rx + L.rw) {
            CxMods.Cfg cf = CxMods.cfg(mod.id);
            if (CxUi.inside(mx, my, L.rx + L.rw - 34, L.vy, 34, 16)) { if (CxMods.locked(mod)) { CxUi.click(); return true; } cf.on = !cf.on; if (mod.id.equals("chat") && cf.on) CxMods.applyChat(); CxUi.click(); return true; }
            int top = L.vy + 24 + descLines * 10, viewH = L.vy + L.vh - top;
            if (my >= top && my < top + viewH) {
                int by = top - Math.round(rScroll) + pvH + 8, kb = mod.visual() ? Math.max(72, Math.round(L.rw * 0.28f)) : L.rw;
                if (CxUi.inside(mx, my, L.rx, by, kb, 22)) { capturing = true; CxUi.click(); return true; }
                if (mod.visual() && CxUi.inside(mx, my, L.rx + kb + 6, by, L.rw - kb - 6, 22)) { CxUi.click(); client.setScreen(new CxHudEditor(this)); return true; }
                if (form.mouseClicked(mx, my)) return true;
            }
        }
        return super.mouseClicked(mx, my, button);
    }

    @Override public boolean mouseDragged(double mx, double my, int button, double dx, double dy) { form.mouseDragged(mx); return true; }
    @Override public boolean mouseReleased(double mx, double my, int button) { form.mouseReleased(); return super.mouseReleased(mx, my, button); }

    @Override
    public boolean mouseScrolled(double mouseX, double mouseY, double horizontalAmount, double verticalAmount) {
        if (mouseX >= L.lx && mouseX < L.lx + L.lw && mouseY >= L.listY && mouseY < L.listY + L.listH) { listTarget -= (float) verticalAmount * 26; return true; }
        if (mouseX >= L.rx) { rTarget -= (float) verticalAmount * 26; return true; }
        return false;
    }

    @Override
    public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
        if (capturing && mod != null) {
            CxMods.cfg(mod.id).key = keyCode == 256 || keyCode == 261 ? 0 : keyCode;
            capturing = false; CxUi.click();
            return true;
        }
        if (search.focused) {
            if (keyCode == 256) { search.focused = false; return true; }
            String before = search.value;
            boolean used = search.key(keyCode, modifiers);
            if (!before.equals(search.value)) filter();
            if (used) return true;
        }
        return super.keyPressed(keyCode, scanCode, modifiers);
    }

    @Override
    public boolean charTyped(char chr, int modifiers) {
        String before = search.value;
        boolean used = search.charTyped(chr);
        if (!before.equals(search.value)) filter();
        return used || super.charTyped(chr, modifiers);
    }

    /** Editörden dönüşte seçenekleri yeniler. */
    void refresh() { if (mod != null) select(mod); }

    @Override public void close() { saveAndClose(); }
    @Override public void renderBackground(DrawContext context, int mouseX, int mouseY, float delta) {}
}
