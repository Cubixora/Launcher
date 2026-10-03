package com.cubixora.client;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.util.Util;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Çark düzenleyici: solda sahip olunan emote/spreyler, sağda 8 numaralı çark slotu.
 * Sürükle-bırak ya da tıkla-tıkla ile yerleştirilir. Dolu slota yerleştirme reddedilir;
 * dolu slota tıklayınca "Slotu Boşalt / Geri" açılır.
 */
public final class CxWheelEditor extends Screen {
    private int cat;
    private int px, py, pw, ph, lx, lw, listY, listH, rx, rw;
    private float scroll, scrollT, popA;
    private String sel;                         // tıkla-tıkla seçili eşya
    private String dragId; private boolean dragging; private double dx0, dy0;
    private double cmx, cmy;
    private int popup = -1;
    private String status = ""; private long statusAt; private boolean statusBad;
    private final float[] shake = new float[8], slotHv = new float[8];
    private final Map<String, Float> hov = new HashMap<>();
    private final long opened = Util.getMillis();
    private long last = opened;
    private static final int ROW = 26;

    public CxWheelEditor(Screen parent, int cat) {
        super(Component.literal("Çark Düzenleyici"));
        this.cat = cat;
        CxEmote.ensure();
        CxScale.sync(net.minecraft.client.Minecraft.getInstance(), this);
    }

    @Override protected void init() {
        pw = Math.min(width - 16, 452); ph = Math.min(height - 16, 300);
        px = (width - pw) / 2; py = (height - ph) / 2;
        lx = px + 12; lw = (pw - 36) * 46 / 100; rx = lx + lw + 12; rw = px + pw - 12 - rx;
        listY = py + 62; listH = ph - 62 - 40;
    }

    private float h(String id, boolean over, float dt) { float v = CxUi.approach(hov.getOrDefault(id, 0f), over ? 1 : 0, 18, dt); hov.put(id, v); return v; }
    private void say(String s, boolean bad) { status = s; statusAt = Util.getMillis(); statusBad = bad; }
    private boolean inWheel(String id) { for (String s : CxEmote.slots(cat)) if (id.equals(s)) return true; return false; }

    // slot geometri: 2 sütun x 4 satır
    private int slotW() { return (rw - 8) / 2; }
    private int slotH() { return Math.min(44, (listH - 3 * 6) / 4); }
    private int slotX(int i) { return rx + (i % 2) * (slotW() + 8); }
    private int slotY(int i) { return listY + (i / 2) * (slotH() + 6); }
    private int slotAt(double x, double y) {
        for (int i = 0; i < 8; i++) if (CxUi.inside(x, y, slotX(i), slotY(i), slotW(), slotH())) return i;
        return -1;
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor c, int mouseX, int mouseY, float delta) {
        cmx = mouseX; cmy = mouseY;
        long now = Util.getMillis();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        float a = CxUi.easeOut((now - opened) / 200f);
        if (minecraft.level == null) CxBackground.render(c, width, height, 1f);
        c.fill(0, 0, width, height, CxUi.alpha(0xFF05070A, 0.55f * a));
        int oy = Math.round((1 - a) * 10), y = py + oy;
        CxUi.sheet(c, px, y, pw, ph, 12, a);
        String title = (cat == 0 ? "Emote" : "Sprey") + " Çarkını Düzenle";
        CxUi.caps(c, font, title, px + 14, y + 12, CxUi.alpha(CxStyle.header(), a));
        CxUi.caps(c, font, "Eşyayı sürükle ya da seç, sonra boş bir slota tıkla", px + 14, y + 25, CxUi.alpha(CxStyle.muted(), a));
        // kategori hapları
        for (int i = 0; i < 2; i++) {
            String n = CxEmote.CAT_NAMES[i]; int w = CxUi.capsW(font, n) + 18, x = px + pw - 12 - (2 - i) * 0 - (i == 0 ? w + 4 + CxUi.capsW(font, CxEmote.CAT_NAMES[1]) + 18 : w);
            boolean on = i == cat; float hv = h("cat" + i, CxUi.inside(cmx, cmy, x, y + 10, w, 16), dt);
            CxUi.round(c, x, y + 10, w, 16, 8, CxUi.alpha(on ? CxStyle.accent(0.30f) : CxUi.mix(CxStyle.button(), CxStyle.buttonHover(), hv), a));
            CxUi.outline(c, x, y + 10, w, 16, 8, CxUi.alpha(on ? CxStyle.accent() : CxStyle.panelBorder(), a));
            CxUi.capsBox(c, font, n, x, y + 10, w, 16, CxUi.alpha(on ? CxStyle.header() : CxStyle.text(), a));
        }
        // sol panel: sahip olunanlar
        int ly = listY + oy;
        CxUi.round(c, lx, y + 40, lw, ph - 40 - 40, 8, CxUi.alpha(0x66000000, a));
        CxUi.caps(c, font, "Sahip olduğun " + (cat == 0 ? "emotelar" : "spreyler"), lx + 10, y + 46, CxUi.alpha(CxStyle.text(), a));
        List<CxEmote.Entry> items = CxEmote.owned(cat);
        int total = items.size() * ROW, view = listH - 4;
        scrollT = Math.max(0, Math.min(Math.max(0, total - view), scrollT)); scroll = CxUi.approach(scroll, scrollT, 16, dt);
        c.enableScissor(lx, ly - 2, lx + lw, ly + listH);
        for (int i = 0; i < items.size(); i++) {
            CxEmote.Entry e = items.get(i);
            int ry = Math.round(ly + i * ROW - scroll), rw2 = lw - 16, rxx = lx + 8;
            if (ry + ROW < ly - 2 || ry > ly + listH) continue;
            boolean in = inWheel(e.id), over = !dragging && CxUi.inside(cmx, cmy, rxx, ry, rw2, ROW - 3) && cmy >= listY && cmy < listY + listH;
            float hv = h("it" + e.id, over, dt);
            boolean isSel = e.id.equals(sel), isDrag = dragging && e.id.equals(dragId);
            int rc = CxBridge.rarityColor(e.rarity);
            float al = (in ? 0.5f : 1f) * a;
            CxUi.round(c, rxx, ry, rw2, ROW - 3, 6, CxUi.alpha(isSel ? CxStyle.accent(0.28f) : CxUi.mix(CxStyle.button(), CxStyle.buttonHover(), hv), al * (isDrag ? 0.4f : 1f)));
            CxUi.outline(c, rxx, ry, rw2, ROW - 3, 6, CxUi.alpha(isSel ? CxStyle.accent() : CxStyle.panelBorder(), al));
            CxUi.round(c, rxx + 4, ry + 5, 3, ROW - 13, 1, CxUi.alpha(rc, al));
            CxUi.tex(c, Identifier.fromNamespaceAndPath("cubixora", "textures/gui/icon/" + CxEmote.CATS[cat] + ".png"), rxx + 12, ry + (ROW - 3 - 14) / 2, 0, 0, 14, 14, 64, 64, 64, 64, CxUi.alpha(0xFFFFFFFF, al));
            String nm = font.plainSubstrByWidth(e.name, rw2 - 36 - (in ? 40 : 0));
            c.text(font, nm, rxx + 32, ry + 3, CxUi.alpha(CxStyle.text(), al), false);
            String sub = CxBridge.rarityName(e.rarity);
            CxUi.caps(c, font, sub, rxx + 32, ry + 13, CxUi.alpha(e.demo ? CxStyle.muted() : rc, al));
            if (in) { String t = "ÇARKTA"; CxUi.caps(c, font, t, rxx + rw2 - CxUi.capsW(font, t) - 8, ry + 8, CxUi.alpha(CxUi.ONLINE, a)); }
        }
        c.disableScissor();
        // sağ panel: slotlar
        CxUi.round(c, rx - 6, y + 40, rw + 12, ph - 40 - 40, 8, CxUi.alpha(0x66000000, a));
        CxUi.caps(c, font, "Çark slotları", rx + 4, y + 46, CxUi.alpha(CxStyle.text(), a));
        String[] slots = CxEmote.slots(cat);
        int hovSlot = popup >= 0 ? -1 : slotAt(cmx, cmy - oy);
        for (int i = 0; i < 8; i++) {
            shake[i] = Math.max(0, shake[i] - dt * 3.2f);
            slotHv[i] = CxUi.approach(slotHv[i], (i == hovSlot && (sel != null || dragging || slots[i] != null)) ? 1 : 0, 18, dt);
            int sx = slotX(i) + Math.round((float) Math.sin(shake[i] * 38) * 4 * shake[i]), sy = slotY(i) + oy, sw = slotW(), sh = slotH();
            CxEmote.Entry e = CxEmote.find(cat, slots[i]);
            boolean canDrop = (sel != null || dragging) && i == hovSlot;
            int fill = e == null ? 0x55080B0E : CxUi.mix(CxStyle.button(), CxStyle.buttonHover(), slotHv[i]);
            int border = shake[i] > 0 ? CxUi.mix(CxStyle.panelBorder(), CxUi.DND, Math.min(1f, shake[i] * 2)) : canDrop && e == null ? CxStyle.accent() : e != null ? CxUi.mix(CxStyle.panelBorder(), CxStyle.accent(), slotHv[i]) : CxStyle.panelBorder();
            CxUi.round(c, sx, sy, sw, sh, 7, CxUi.alpha(canDrop && e == null ? CxUi.mix(fill, CxStyle.accent(0.28f), 0.5f) : fill, a));
            CxUi.outline(c, sx, sy, sw, sh, 7, CxUi.alpha(border, a));
            // numara
            CxUi.round(c, sx + 6, sy + (sh - 14) / 2, 14, 14, 7, CxUi.alpha(e != null ? CxStyle.accent(0.35f) : 0x33FFFFFF, a));
            String num = String.valueOf(i + 1);
            c.text(font, num, sx + 13 - font.width(num) / 2, sy + (sh - 8) / 2 + 0, CxUi.alpha(e != null ? CxStyle.header() : CxStyle.muted(), a), false);
            if (e != null) {
                CxUi.tex(c, Identifier.fromNamespaceAndPath("cubixora", "textures/gui/icon/" + CxEmote.CATS[cat] + ".png"), sx + 26, sy + (sh - 16) / 2, 0, 0, 16, 16, 64, 64, 64, 64, CxUi.alpha(0xFFFFFFFF, a));
                String nm = font.plainSubstrByWidth(e.name, sw - 50);
                c.text(font, nm, sx + 46, sy + sh / 2 - 8 + 1, CxUi.alpha(CxStyle.text(), a), false);
                CxUi.caps(c, font, "Slotu yönet", sx + 46, sy + sh / 2 + 3, CxUi.alpha(CxStyle.muted(), a * 0.9f));
            } else {
                CxUi.caps(c, font, canDrop ? "Buraya bırak" : "Boş", sx + 28, sy + (sh - 7) / 2, CxUi.alpha(canDrop ? CxStyle.header() : CxStyle.muted(), a * 0.9f));
            }
        }
        // alt: durum + geri
        long age = now - statusAt;
        if (!status.isEmpty() && age < 2600) {
            float sa = a * (age > 2200 ? (2600 - age) / 400f : 1f);
            c.text(font, font.plainSubstrByWidth(status, pw - 120), px + 14, y + ph - 26, CxUi.alpha(statusBad ? CxUi.DND : CxUi.ONLINE, sa), false);
        }
        int bw = 74, bx = px + pw - 12 - bw, by = y + ph - 32;
        CxUi.button(c, font, "Geri", bx, by, bw, 18, h("back", popup < 0 && CxUi.inside(cmx, cmy, bx, by, bw, 18), dt), a);
        // sürüklenen eşya
        if (dragging) {
            CxEmote.Entry e = CxEmote.find(cat, dragId);
            if (e != null) {
                int gw = font.width(e.name) + 34;
                CxUi.round(c, (int) cmx - gw / 2, (int) cmy - 11, gw, 22, 7, CxUi.alpha(0xF0202A33, a));
                CxUi.outline(c, (int) cmx - gw / 2, (int) cmy - 11, gw, 22, 7, CxUi.alpha(CxStyle.accent(), a));
                CxUi.tex(c, Identifier.fromNamespaceAndPath("cubixora", "textures/gui/icon/" + CxEmote.CATS[cat] + ".png"), (int) cmx - gw / 2 + 6, (int) cmy - 7, 0, 0, 14, 14, 64, 64, 64, 64, CxUi.alpha(0xFFFFFFFF, a));
                c.text(font, e.name, (int) cmx - gw / 2 + 24, (int) cmy - 4, CxUi.alpha(CxStyle.text(), a), false);
            }
        }
        // açılır pencere
        popA = CxUi.approach(popA, popup >= 0 ? 1 : 0, 20, dt);
        if (popA > 0.01f) drawPopup(c, dt, a * popA, oy);
        super.extractRenderState(c, mouseX, mouseY, delta);
    }

    private int pW() { return 150; }
    private void drawPopup(GuiGraphicsExtractor c, float dt, float a, int oy) {
        c.fill(0, 0, width, height, CxUi.alpha(0xFF05070A, 0.45f * a));
        int pwid = pW(), phei = 88, x = (width - pwid) / 2, y = (height - phei) / 2 + Math.round((1 - a) * 8);
        CxUi.sheet(c, x, y, pwid, phei, 10, a);
        int s = Math.max(0, popup);
        CxEmote.Entry e = CxEmote.find(cat, CxEmote.slots(cat)[s]);
        CxUi.caps(c, font, "Slot " + (s + 1), x + (pwid - CxUi.capsW(font, "Slot " + (s + 1))) / 2, y + 9, CxUi.alpha(CxStyle.header(), a));
        String nm = e == null ? "—" : font.plainSubstrByWidth(e.name, pwid - 20);
        c.text(font, nm, x + (pwid - font.width(nm)) / 2, y + 23, CxUi.alpha(CxStyle.text(), a), false);
        CxUi.button(c, font, "Slotu Boşalt", x + 12, y + 40, pwid - 24, 18, h("pe", CxUi.inside(cmx, cmy, x + 12, y + 40, pwid - 24, 18), dt), a);
        CxUi.button(c, font, "Geri", x + 12, y + 62, pwid - 24, 18, h("pb", CxUi.inside(cmx, cmy, x + 12, y + 62, pwid - 24, 18), dt), a);
    }

    private void assign(int slot, String id) {
        String[] slots = CxEmote.slots(cat);
        if (slots[slot] != null) { shake[slot] = 1f; say("Bu slot dolu. Önce slotu boşalt.", true); return; }
        if (inWheel(id)) { say("Bu eşya zaten çarkta.", true); return; }
        slots[slot] = id; CxClient.save(); CxUi.click();
        say("Slot " + (slot + 1) + "'e yerleştirildi.", false);
    }

    @Override public boolean mouseClicked(net.minecraft.client.input.MouseButtonEvent click, boolean doubled) {
        double mx = click.x(), my = click.y(); int button = click.button();
        double x = mx, y = my;
        int oy = Math.round((1 - CxUi.easeOut((Util.getMillis() - opened) / 200f)) * 10);
        if (popup >= 0) {
            int pwid = pW(), phei = 88, bx = (width - pwid) / 2, by = (height - phei) / 2;
            if (CxUi.inside(x, y, bx + 12, by + 40, pwid - 24, 18)) { CxEmote.slots(cat)[popup] = null; CxClient.save(); CxUi.click(); say("Slot " + (popup + 1) + " boşaltıldı.", false); popup = -1; return true; }
            if (CxUi.inside(x, y, bx + 12, by + 62, pwid - 24, 18) || !CxUi.inside(x, y, bx, by, pwid, phei)) { CxUi.click(); popup = -1; return true; }
            return true;
        }
        int yy = py + oy;
        int bw = 74, bx = px + pw - 12 - bw, by = yy + ph - 32;
        if (CxUi.inside(x, y, bx, by, bw, 18)) { CxUi.click(); onClose(); return true; }
        for (int i = 0; i < 2; i++) {
            String n = CxEmote.CAT_NAMES[i]; int w = CxUi.capsW(font, n) + 18, cx = px + pw - 12 - (i == 0 ? w + 4 + CxUi.capsW(font, CxEmote.CAT_NAMES[1]) + 18 : w);
            if (CxUi.inside(x, y, cx, yy + 10, w, 16)) { if (cat != i) { cat = i; sel = null; scroll = scrollT = 0; CxUi.click(); } return true; }
        }
        int sl = slotAt(x, y - oy);
        if (sl >= 0) {
            String[] slots = CxEmote.slots(cat);
            if (sel != null) { assign(sl, sel); if (slots[sl] != null && sel.equals(slots[sl])) sel = null; return true; }
            if (slots[sl] != null) { popup = sl; CxUi.click(); }
            else say("Önce soldan bir eşya seç ya da sürükle.", true);
            return true;
        }
        if (CxUi.inside(x, y, lx, listY + oy, lw, listH)) {
            List<CxEmote.Entry> items = CxEmote.owned(cat);
            int i = (int) ((y - oy - listY + scroll) / ROW);
            if (i >= 0 && i < items.size()) { dragId = items.get(i).id; dx0 = x; dy0 = y; dragging = false; return true; }
        }
        sel = null;
        return true;
    }

    @Override public boolean mouseDragged(net.minecraft.client.input.MouseButtonEvent click, double dx, double dy) {
        double mx = click.x(), my = click.y(); int button = click.button();
        double x = mx, y = my;
        if (dragId != null && !dragging && Math.hypot(x - dx0, y - dy0) > 4) { dragging = true; sel = null; }
        return true;
    }

    @Override public boolean mouseReleased(net.minecraft.client.input.MouseButtonEvent click) {
        double mx = click.x(), my = click.y(); int button = click.button();
        double x = mx, y = my;
        if (dragId != null) {
            int oy = Math.round((1 - CxUi.easeOut((Util.getMillis() - opened) / 200f)) * 10);
            if (dragging) { int sl = slotAt(x, y - oy); if (sl >= 0) assign(sl, dragId); }
            else if (inWheel(dragId)) say("Bu eşya zaten çarkta.", true);
            else { sel = dragId.equals(sel) ? null : dragId; CxUi.click(); if (sel != null) say("Şimdi boş bir slota tıkla.", false); }
        }
        dragId = null; dragging = false;
        return true;
    }

    @Override public boolean mouseScrolled(double mouseX, double mouseY, double horizontalAmount, double v) { scrollT -= (float) v * ROW; return true; }
    @Override public boolean keyPressed(net.minecraft.client.input.KeyEvent input) {
        int keyCode = input.key(), scanCode = input.scancode(), modifiers = input.modifiers();
        if (keyCode == 256) { if (popup >= 0) popup = -1; else onClose(); return true; }
        return true;
    }
    @Override public void onClose() { minecraft.setScreen(null); CxEmote.endView(minecraft); }
    @Override public boolean isPauseScreen() { return false; }
    @Override public void extractBackground(GuiGraphicsExtractor context, int mouseX, int mouseY, float delta) {}
}
