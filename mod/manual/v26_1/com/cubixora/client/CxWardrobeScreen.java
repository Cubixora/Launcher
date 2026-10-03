package com.cubixora.client;

import com.cubixora.cosmetics.CosmeticsManager;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.PlayerFaceExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.inventory.InventoryScreen;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.client.gui.components.toasts.SystemToast;
import net.minecraft.world.entity.player.PlayerSkin;
import net.minecraft.world.item.ItemStack;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.util.Util;
import org.joml.Quaternionf;
import org.joml.Vector3f;

import java.util.ArrayList;
import java.util.List;

/**
 * Gardrop (G tuşu / ana menü "Kozmetikler") ve oyun içi mağaza.
 * Solda karakter: imlece bakar, kutunun içinde sürükleyerek döndürülür. Sağda sekmeler ve eşyalar.
 * Gardropta sadece sahip olunan eşyalar listelenir; tıklayınca anında kuşanılır.
 */
public final class CxWardrobeScreen extends Screen {
    // tür, etiket
    private static final String[][] TABS = { { "cape", "Pelerin" }, { "wings", "Kanat" }, { "hat", "Şapka" }, { "pet", "Pet" }, { "effect", "Efekt" }, { "emote", "Emote" }, { "spray", "Sprey" } };
    private final Screen parent;
    private boolean shop;
    private String tab = "cape";
    private CxBridge.State st = CxBridge.last;
    private boolean loading = true, busy;
    private String error = "", pendingBuy = "";
    private final long opened = Util.getMillis();
    private long last = Util.getMillis(), lastDrag;
    private long tabAt; private float lookX, lookY, yaw = 160, scroll, scrollTarget, tabAnim;
    private boolean dragging, turnBack;
    private int px, py, pw, ph, bx, by, bw, bh, gx, gy, gw, gh, contentH;
    private int catX, catW, catRow, catTop, catTitle;
    private boolean labels;
    private int btnShop, btnSkin, btnY, btnW;
    private final List<int[]> cardRects = new ArrayList<>();
    private final List<CxBridge.Item> cardItems = new ArrayList<>();
    private final float[] hover = new float[200];
    private float hShop, hSkin;
    private final float[] catHover = new float[8], catSel = new float[8];

    public CxWardrobeScreen(Screen parent, boolean shop) {
        super(Component.literal(shop ? "Mağaza" : "Gardrop"));
        this.parent = parent; this.shop = shop;
        CxScale.sync(net.minecraft.client.Minecraft.getInstance(), this);
    }

    @Override
    protected void init() {
        CxWardLayout l = new CxWardLayout(width, height);
        pw = l.pw; ph = l.ph; px = l.px; py = l.py; bx = l.bx; by = l.by; bw = l.bw; bh = l.bh;
        catX = l.catX; catW = l.catW; catRow = l.catRow; catTop = l.catTop; catTitle = l.catTitle; labels = l.labels;
        gx = l.gx; gy = l.gy; gw = l.gw; gh = l.gh;
        btnW = pw < 520 ? 56 : 74; btnY = py + 12;
        btnShop = px + pw - 12 - btnW; btnSkin = btnShop - btnW - 6;
        refresh();
    }

    private void refresh() {
        loading = true;
        CxBridge.state(s -> { loading = false; if (s.ok) { st = s; error = ""; } else error = s.error; });
    }

    /** Uçan petler "Pet" sekmesinde, omuz arkadaşının yanında listelenir. */
    private static String tabOf(CxBridge.Item it) { return it.type.equals("fpet") ? "pet" : it.type; }
    private boolean isMine(CxBridge.Item it) { return shop || it.owned; }
    private List<CxBridge.Item> visible() {
        List<CxBridge.Item> out = new ArrayList<>();
        for (CxBridge.Item it : st.items) if (tabOf(it).equals(tab) && isMine(it)) out.add(it);
        return out;
    }
    private int count(String type) {
        int n = 0;
        for (CxBridge.Item it : st.items) if (tabOf(it).equals(type) && isMine(it)) n++;
        return n;
    }
    private boolean equipped(CxBridge.Item it) {
        switch (it.type) {
            case "cape": return it.ref.equals(st.cape);
            case "wings": return it.ref.equals(st.wings);
            case "pet": return st.pet;
            case "hat": return it.ref.equals(st.hat);
            case "fpet": return it.ref.equals(st.fly);
            case "effect": return it.ref.equals(st.effect);
            default: return false;
        }
    }

    private static String timer() {
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC);
        java.time.ZonedDateTime next = now.with(java.time.temporal.TemporalAdjusters.next(java.time.DayOfWeek.MONDAY)).toLocalDate().atStartOfDay(java.time.ZoneOffset.UTC);
        long m = java.time.Duration.between(now, next).toMinutes();
        return (m / 1440) + "g " + ((m / 60) % 24) + "s " + (m % 60) + "dk";
    }

    // ---- simgeler (küçük, çizimle) ----
    private static void icon(GuiGraphicsExtractor c, String type, int cx, int cy, int col, int sz) {
        CxUi.tex(c, Identifier.fromNamespaceAndPath("cubixora", "textures/gui/icon/" + type + ".png"), cx - sz / 2, cy - sz / 2, 0, 0, sz, sz, 64, 64, 64, 64, col);
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor c, int mouseX, int mouseY, float delta) {
        long now = Util.getMillis();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        float a = CxUi.easeOut((now - opened) / 260f);
        if (minecraft.level == null) CxBackground.render(c, width, height, 1f);
        c.fill(0, 0, width, height, CxUi.alpha(CxStyle.scrim(), a));
        int oy = Math.round((1 - a) * 12);
        if (turnBack) {
            float target = Math.round(yaw / 360f) * 360f;   // arka yüz (pelerin) bize dönük
            yaw = CxUi.approach(yaw, target, 7f, dt);
            if (Math.abs(yaw - target) < 1f) { turnBack = false; lastDrag = now + 1400; }
        } else if (!dragging && now - lastDrag > 1800) yaw += 26f * dt;

        CxUi.sheet(c, px, py + oy, pw, ph, 10, a);
        // başlık
        CxUi.tex(c, CxUi.LOGO, px + 14, py + 12 + oy, 0, 0, 34, 15, CxUi.LOGO_W, CxUi.LOGO_H, CxUi.LOGO_W, CxUi.LOGO_H, CxUi.alpha(0xFFFFFFFF, a));
        String coin = String.format("%,d", st.coins).replace(',', '.');
        int cw = font.width(coin) + 26, cx = btnSkin - 8 - cw;
        int room = cx - (px + 56) - 8;
        c.text(font, font.plainSubstrByWidth(shop ? "MAĞAZA" : "GARDROP", room), px + 56, py + 12 + oy, CxUi.alpha(CxStyle.header(), a), false);
        c.text(font, font.plainSubstrByWidth(shop ? "Coin ile kozmetik satın al" : "Sahip olduğun kozmetikler", room), px + 56, py + 24 + oy, CxUi.alpha(CxStyle.muted(), a), false);
        CxUi.round(c, cx, btnY + oy, cw, 18, 9, CxUi.alpha(CxStyle.field(), a));
        CxUi.outline(c, cx, btnY + oy, cw, 18, 9, CxUi.alpha(CxStyle.panelBorder(), a));
        CxUi.coin(c, cx + 3, btnY + 2 + oy, 14, a);
        c.text(font, coin, cx + 21, btnY + 5 + oy, CxUi.alpha(CxStyle.light() ? 0xFF8A5A00 : 0xFFFFE08A, a), false);
        hShop = CxUi.approach(hShop, CxUi.inside(mouseX, mouseY, btnShop, btnY, btnW, 18) ? 1 : 0, 18, dt);
        hSkin = CxUi.approach(hSkin, CxUi.inside(mouseX, mouseY, btnSkin, btnY, btnW, 18) ? 1 : 0, 18, dt);
        CxUi.button(c, font, shop ? "GARDROP" : "MAĞAZA", btnShop, btnY + oy, btnW, 18, hShop, a);
        CxUi.button(c, font, "SKİN", btnSkin, btnY + oy, btnW, 18, hSkin, a);
        c.fill(px + 12, py + 42 + oy, px + pw - 12, py + 43 + oy, CxUi.alpha(CxStyle.divider(), a));

        // karakter kutusu
        CxUi.round(c, bx, by + oy, bw, bh, 8, CxUi.alpha(CxStyle.field(), a));
        CxUi.outline(c, bx, by + oy, bw, bh, 8, CxUi.alpha(CxStyle.panelBorder(), a));
        int fx1 = bx + 6, fy1 = by + 8 + oy, fx2 = bx + bw - 6, fy2 = by + bh - 24 + oy;
        c.enableScissor(bx + 1, by + 1 + oy, bx + bw - 1, by + bh - 1 + oy);
        if (minecraft.player != null) drawPlayer(c, minecraft.player, fx1, fy1, fx2, fy2, mouseX, mouseY);
        else CxPreview.drawSelf(c, fx1, fy1, fx2, fy2, yaw - 180f, -4f);
        c.disableScissor();
        String hint = "Sürükle: döndür";
        c.text(font, hint, bx + (bw - font.width(hint)) / 2, by + bh - 14 + oy, CxUi.alpha(CxStyle.muted(), a), false);

        // kategori listesi (dikey; her ekran boyutuna sığar)
        CxUi.round(c, catX, by + oy, catW, bh, 8, CxUi.alpha(CxStyle.field(), a));
        CxUi.outline(c, catX, by + oy, catW, bh, 8, CxUi.alpha(CxStyle.panelBorder(), a));
        if (labels && catTitle > 10) CxUi.textScaled(c, font, "KATEGORİLER", catX + 10, by + 8 + oy, 0.85f, CxUi.alpha(CxStyle.muted(), a), false);
        c.enableScissor(catX + 1, by + 1 + oy, catX + catW - 1, by + bh - 1 + oy);
        for (int i = 0; i < TABS.length; i++) {
            String[] t = TABS[i];
            int ry = catTop + i * (catRow + 2);
            boolean on = tab.equals(t[0]), hov = CxUi.inside(mouseX, mouseY, catX + 3, ry, catW - 6, catRow);
            catHover[i] = CxUi.approach(catHover[i], on ? 1 : hov ? 0.6f : 0, 14, dt);
            catSel[i] = CxUi.approach(catSel[i], on ? 1 : 0, 12, dt);
            float hv = catHover[i];
            CxUi.round(c, catX + 3, ry + oy, catW - 6, catRow, 7, CxUi.alpha(CxUi.mix(0x00000000, CxStyle.selected(), hv), a * (0.2f + 0.8f * hv)));
            if (catSel[i] > 0.02f) c.fill(catX + 3, ry + 4 + oy, catX + 5, ry + catRow - 4 + oy, CxStyle.accent(a * catSel[i]));
            int chip = Math.min(20, catRow - 4);
            int chipX = labels ? catX + 10 : catX + (catW - chip) / 2;
            CxUi.round(c, chipX, ry + (catRow - chip) / 2 + oy, chip, chip, 6, CxUi.alpha(on ? CxUi.alpha(CxStyle.accent(), 0.25f) : CxStyle.button(), a));
            icon(c, t[0], chipX + chip / 2, ry + catRow / 2 + oy, CxUi.alpha(on ? CxStyle.accent() : CxStyle.muted(), a), Math.max(8, Math.min(14, chip - 4)));
            String n = String.valueOf(count(t[0]));
            if (labels) {
                int col = on ? CxStyle.text() : CxUi.mix(CxStyle.muted(), CxStyle.text(), hv);
                int tx = chipX + chip + 8;
                int nw = font.width(n) + 8;
                c.text(font, font.plainSubstrByWidth(t[1], catX + catW - 8 - nw - tx), tx, ry + (catRow - 8) / 2 + oy, CxUi.alpha(col, a), false);
                if (catRow >= 14) {
                    CxUi.round(c, catX + catW - 8 - nw, ry + (catRow - 12) / 2 + oy, nw, 12, 6, CxUi.alpha(on ? CxUi.alpha(CxStyle.accent(), 0.3f) : CxStyle.button(), a));
                    c.text(font, n, catX + catW - 8 - nw + 4, ry + (catRow - 12) / 2 + 2 + oy, CxUi.alpha(on ? CxStyle.text() : CxStyle.muted(), a), false);
                } else c.text(font, n, catX + catW - 8 - font.width(n), ry + (catRow - 8) / 2 + oy, CxUi.alpha(CxStyle.muted(), a), false);
            } else {
                CxUi.textScaled(c, font, n, catX + catW - 5 - font.width(n) * 0.7f, ry + catRow - 7 + oy, 0.7f, CxUi.alpha(on ? CxStyle.text() : CxStyle.muted(), a), false);
            }
        }
        c.disableScissor();

        // eşya alanı
        CxUi.round(c, gx, gy + oy, gw, gh, 8, CxUi.alpha(CxStyle.field(), a * 0.7f));
        cardRects.clear(); cardItems.clear();
        List<CxBridge.Item> list = visible();
        scroll = CxUi.approach(scroll, scrollTarget, 14, dt);
        if (loading && st.items.isEmpty()) centerText(c, "Yükleniyor...", a);
        else if (!error.isEmpty() && st.items.isEmpty()) centerText(c, error, a);
        else if (list.isEmpty()) {
            boolean soon = !(tab.equals("cape") || tab.equals("wings") || tab.equals("hat") || tab.equals("pet") || tab.equals("emote") || tab.equals("spray"));
            centerText(c, soon ? "Bu kategori çok yakında geliyor." : shop ? "Bu kategoride ürün yok." : "Bu kategoride henüz bir şeyin yok. Mağazadan bu haftanın vitrinine göz at.", a);
        } else {
            c.enableScissor(gx, gy + oy, gx + gw, gy + gh + oy);
            float ga = CxUi.easeOut((now - tabAt) / 260f); final float a2 = a * ga;
            int y = gy + 8 - Math.round(scroll) + oy + Math.round((1 - ga) * 10);
            int idx = 0;
            if (shop) {
                c.text(font, "Vitrin yenilenmesine " + timer(), gx + gw - 8 - font.width("Vitrin yenilenmesine " + timer()), y, CxUi.alpha(CxStyle.muted(), a2), false);
            }
            int lineEnd = shop ? gx + gw - 16 - font.width("Vitrin yenilenmesine " + timer()) : gx + gw - 10;
            List<CxBridge.Item> feat = new ArrayList<>(), rest = new ArrayList<>();
            for (CxBridge.Item it : list) if (shop && (it.rarity.equals("efsanevi") || it.rarity.equals("destansi") || it.rarity.equals("ozel"))) feat.add(it); else rest.add(it);
            if (!feat.isEmpty()) {
                c.text(font, "ÖNE ÇIKANLAR", gx + 10, y, CxUi.alpha(CxStyle.header(), a2), false); c.fill(gx + 12 + font.width("ÖNE ÇIKANLAR"), y + 4, lineEnd, y + 5, CxUi.alpha(CxStyle.divider(), a2));
                y += 14;
                int fw = 118, fh = 118, gap = 8, cols = Math.max(1, (gw - 16 + gap) / (fw + gap));
                int sx = gx + 10;
                for (int i = 0; i < feat.size(); i++) {
                    int x = sx + (i % cols) * (fw + gap), yy = y + (i / cols) * (fh + gap);
                    idx = drawOne(c, feat.get(i), x, yy, fw, fh, idx, mouseX, mouseY, dt, a2, true);
                }
                y += ((feat.size() + cols - 1) / cols) * (fh + gap) + 4;
            }
            if (!rest.isEmpty()) {
                if (shop) { c.text(font, "BU HAFTA", gx + 10, y, CxUi.alpha(CxStyle.header(), a2), false); c.fill(gx + 12 + font.width("BU HAFTA"), y + 4, feat.isEmpty() ? lineEnd : gx + gw - 10, y + 5, CxUi.alpha(CxStyle.divider(), a2)); y += 14; }
                int cwid = 78, chei = 100, gap = 8, cols = Math.max(1, (gw - 16 + gap) / (cwid + gap));
                int sx = gx + (gw - (cols * cwid + (cols - 1) * gap)) / 2;
                for (int i = 0; i < rest.size(); i++) {
                    int x = sx + (i % cols) * (cwid + gap), yy = y + (i / cols) * (chei + gap);
                    idx = drawOne(c, rest.get(i), x, yy, cwid, chei, idx, mouseX, mouseY, dt, a2, false);
                }
                y += ((rest.size() + cols - 1) / cols) * (chei + gap);
            }
            c.disableScissor();
            contentH = y + Math.round(scroll) - (gy + oy) + 4;
        }
        if (!pendingBuy.isEmpty()) {
            CxBridge.Item it = find(pendingBuy);
            if (it != null) {
                String q = "\"" + it.name + "\" " + it.price + " coin. Satın almak için tekrar tıkla.";
                int qw = font.width(q) + 20, qx = gx + (gw - qw) / 2, qy = gy + gh - 26 + oy;
                CxUi.round(c, qx, qy, qw, 18, 6, 0xEE10141A);
                c.fill(qx + 4, qy + 17, qx + qw - 4, qy + 18, CxStyle.accent());
                c.text(font, q, qx + 10, qy + 5, 0xFFFFE08A, false);
            }
        }
        super.extractRenderState(c, mouseX, mouseY, delta);
    }

    private int drawOne(GuiGraphicsExtractor c, CxBridge.Item it, int x, int y, int w, int h, int idx, int mouseX, int mouseY, float dt, float a, boolean big) {
        boolean hov = CxUi.inside(mouseX, mouseY, x, y, w, h) && mouseY >= gy && mouseY < gy + gh;
        if (idx < hover.length) hover[idx] = CxUi.approach(hover[idx], hov ? 1 : 0, 14, dt);
        float hv = idx < hover.length ? hover[idx] : 0;
        drawCard(c, it, x, y - Math.round(hv * 2), w, h, hv, a, big);
        cardRects.add(new int[] { x, y, w, h }); cardItems.add(it);
        return idx + 1;
    }

    private void centerText(GuiGraphicsExtractor c, String s, float a) {
        int y = gy + gh / 2 - 4;
        for (var line : font.split(Component.literal(s), gw - 30)) {
            c.text(font, line, gx + (gw - font.width(line)) / 2, y, CxUi.alpha(CxStyle.muted(), a), false);
            y += 11;
        }
    }

    private void drawCard(GuiGraphicsExtractor c, CxBridge.Item it, int x, int y, int w, int h, float hv, float a, boolean big) {
        int rc = CxBridge.rarityColor(it.rarity);
        boolean eq = !shop && equipped(it), sel = it.id.equals(pendingBuy);
        CxUi.round(c, x, y, w, h, 8, CxUi.alpha(CxUi.mix(CxStyle.button(), CxStyle.buttonHover(), hv), a));
        // nadirlik rengiyle üstten yumuşak ışıma
        c.fillGradient(x + 1, y + 1, x + w - 1, y + Math.round(h * 0.62f), CxUi.alpha((rc & 0xFFFFFF) | 0x38000000, a * (0.7f + 0.3f * hv)), 0);
        c.fill(x + 8, y + 5, x + (big ? 34 : 22), y + 7, CxUi.alpha(rc, a));
        if (eq || sel) CxUi.outline(c, x, y, w, h, 8, CxUi.alpha(CxStyle.accent(), a));
        else CxUi.outline(c, x, y, w, h, 8, CxUi.alpha(CxUi.mix(CxStyle.panelBorder(), rc, hv * 0.6f), a * (0.55f + hv * 0.45f)));
        if (big) { String rn = CxBridge.rarityName(it.rarity).toUpperCase(new java.util.Locale("tr")); CxUi.textScaled(c, font, rn, x + w - 8 - font.width(rn) * 0.75f, y + 5, 0.75f, CxUi.alpha(rc, a), false); }
        float k = big ? 1.5f : 1f;
        int pcx = x + w / 2, pcy = y + Math.round(34 * k);
        float sc = 1 + hv * 0.08f;
        Identifier shopCape = it.type.equals("cape") ? CxIcons.capeTex(it) : null;
        Identifier spin = (it.type.equals("hat") || it.type.equals("fpet")) && (it.icon == null || it.icon.isEmpty()) ? CxIcons.spin(it) : null;
        if (shopCape != null) {
            // mağazaya admin'in yüklediği doku, uygulamadaki hazır olanın önüne geçer (HD olabilir)
            int cw = Math.round(20 * sc * k), ch = Math.round(32 * sc * k), kk = CxIcons.capeScale(it);
            CxUi.tex(c, shopCape, pcx - cw / 2, pcy - ch / 2, kk, kk, cw, ch, 10 * kk, 16 * kk, 64 * kk, 32 * kk, CxUi.alpha(0xFFFFFFFF, a));
        } else if (spin != null) {
            // eşyanın kendisi 3B: kartta durur, imleç üstündeyken döner (pet kanat çırpar)
            int fr = hv > 0.05f ? (int) ((Util.getMillis() / 70) % CxIcons.SPIN_FRAMES) : 0;
            int s = Math.round(44 * sc * k), fs = CxIcons.SPIN_PX, tw = fs * CxIcons.SPIN_COLS;
            CxUi.tex(c, spin, pcx - s / 2, pcy - s / 2, (fr % CxIcons.SPIN_COLS) * fs, (fr / CxIcons.SPIN_COLS) * fs, s, s, fs, fs, tw, tw, CxUi.alpha(0xFFFFFFFF, a));
        } else if (it.type.equals("cape") && CosmeticsManager.knownCape(it.ref)) {
            int cw = Math.round(20 * sc * k), ch = Math.round(32 * sc * k);
            CxUi.tex(c, Identifier.fromNamespaceAndPath("cubixora", "textures/cape/" + it.ref + ".png"), pcx - cw / 2, pcy - ch / 2, 1, 1, cw, ch, 10, 16, 64, 32, CxUi.alpha(0xFFFFFFFF, a));
        } else if (it.type.equals("wings") && CosmeticsManager.knownWings(it.ref)) {
            int ww = Math.round(60 * sc * k), wh = Math.round(23 * sc * k);
            CxUi.tex(c, Identifier.fromNamespaceAndPath("cubixora", "textures/gui/wingsprev_" + it.ref + ".png"), pcx - ww / 2, pcy - wh / 2, 0, 0, ww, wh, 98, 37, 98, 37, CxUi.alpha(0xFFFFFFFF, a));
        } else if (it.type.equals("pet")) {
            int s = Math.round(24 * sc * k);
            PlayerFaceExtractor.extractRenderState(c, skin(), pcx - s / 2, pcy - s / 2, s, CxUi.alpha(0xFFFFFFFF, a));
        } else if (CxIcons.of(it) != null) {
            int s = Math.round(30 * sc * k);
            CxUi.tex(c, CxIcons.of(it), pcx - s / 2, pcy - s / 2, 0, 0, s, s, 64, 64, 64, 64, CxUi.alpha(0xFFFFFFFF, a));
        } else {
            CxUi.round(c, pcx - 14, pcy - 14, 28, 28, 7, CxUi.alpha(rc & 0x66FFFFFF, a));
            String l = it.name.isEmpty() ? "?" : it.name.substring(0, 1).toUpperCase();
            c.text(font, l, pcx - font.width(l) / 2, pcy - 4, CxUi.alpha(0xFFFFFFFF, a), false);
        }
        String name = font.plainSubstrByWidth(it.name, w - 8);
        c.text(font, name, x + (w - font.width(name)) / 2, y + h - 30, CxUi.alpha(CxStyle.text(), a), false);
        // alt rozet: fiyat (coin simgesiyle), sahiplik ya da nadirlik
        int by = y + h - 17, bh = 12;
        String sub; int subCol; boolean price = false;
        if (shop) {
            if (it.owned) { sub = "Sende"; subCol = CxUi.ONLINE; }
            else if (it.free) { sub = "Ücretsiz"; subCol = CxUi.ONLINE; }
            else { sub = String.valueOf(it.price); subCol = 0xFFFFE08A; price = true; }
        } else { sub = eq ? "Kuşanıldı" : CxBridge.rarityName(it.rarity); subCol = eq ? CxStyle.accent() : rc; }
        if (it.until > 0) { sub = CxBridge.timeLeft(it.until); subCol = it.until > System.currentTimeMillis() ? 0xFFFFB13B : CxUi.DND; price = false; }
        int tw = Math.round(font.width(sub) * 0.9f), bw2 = tw + (price ? 20 : 12), bx2 = x + (w - bw2) / 2;
        CxUi.round(c, bx2, by, bw2, bh, 6, CxUi.alpha(price ? 0x55000000 : (subCol & 0xFFFFFF) | 0x26000000, a));
        if (price) CxUi.coin(c, bx2 + 3, by + 1, 10, a);
        CxUi.textScaled(c, font, sub, bx2 + (price ? 15 : 6), by + 2.5f, 0.9f, CxUi.alpha(subCol, a), false);
    }

    private PlayerSkin skin() { return minecraft.getSkinManager().createLookup(minecraft.getGameProfile(), false).get(); }

    /** Dünyadaki gerçek oyuncu: kanat ve pet de görünür. Başı imlece bakar, gövde otomatik/sürüklemeyle döner. */
    private void drawPlayer(GuiGraphicsExtractor c, LocalPlayer e, int x1, int y1, int x2, int y2, int mouseX, int mouseY) {
        InventoryScreen.extractEntityInInventoryFollowsMouse(c, x1, y1, x2, y2, Math.round((y2 - y1) * 0.42f), 0.0625f, mouseX - (yaw - 160f) * 1.5f, mouseY, e);
    }

    private CxBridge.Item find(String id) { for (CxBridge.Item it : st.items) if (it.id.equals(id)) return it; return null; }

    private void click(CxBridge.Item it) {
        if (busy) return;
        if (shop) {
            if (it.owned || it.free) { toast("Zaten sende", it.name + " gardrobunda."); return; }
            if (!it.id.equals(pendingBuy)) { pendingBuy = it.id; return; }
            busy = true;
            CxBridge.buy(it.id, s -> {
                busy = false; pendingBuy = "";
                if (s.ok) { st = s; toast("Satın alındı", it.name + " artık senin!"); }
                else toast("Satın alınamadı", s.error);
            });
            return;
        }
        boolean on = !equipped(it);
        String json;
        switch (it.type) {
            case "cape": json = "{\"cape\":\"" + (on ? it.ref : "") + "\"}"; CosmeticsManager.setSelf(on ? it.ref : "", null, null); if (on && it.tex != null && !it.tex.isEmpty()) CosmeticsManager.setSelfCapeTex(it.tex); st.cape = on ? it.ref : ""; break;
            case "wings": json = "{\"wings\":\"" + (on ? it.ref : "") + "\"}"; CosmeticsManager.setSelf(null, on ? it.ref : "", null); st.wings = on ? it.ref : ""; break;
            case "pet": json = "{\"pet\":" + on + "}"; CosmeticsManager.setSelf(null, null, on); st.pet = on; break;
            case "hat": json = "{\"hat\":\"" + (on ? it.ref : "") + "\"}"; CosmeticsManager.setSelfProps(on ? it.ref : "", null); st.hat = on ? it.ref : ""; break;
            case "fpet": json = "{\"fly\":\"" + (on ? it.ref : "") + "\"}"; CosmeticsManager.setSelfProps(null, on ? it.ref : ""); st.fly = on ? it.ref : ""; break;
            case "effect": json = "{\"effect\":\"" + (on ? it.ref : "") + "\"}"; CosmeticsManager.setSelfEffect(on ? it.ref : ""); st.effect = on ? it.ref : ""; break;
            default: return;
        }
        if (on && it.type.equals("cape")) { turnBack = true; dragging = false; }
        toast(on ? "Kuşanıldı" : "Çıkarıldı", it.name);
        busy = true;
        CxBridge.equip(json, s -> { busy = false; if (s.ok) st = s; else toast("Kaydedilemedi", s.error); });
    }

    private void toast(String t, String d) { SystemToast.addOrUpdate(minecraft.getToastManager(), SystemToast.SystemToastId.PERIODIC_NOTIFICATION, Component.literal(t), Component.literal(d)); }

    @Override
    public boolean mouseClicked(net.minecraft.client.input.MouseButtonEvent click, boolean doubled) {
        double mx = click.x(), my = click.y(); int button = click.button();
        if (CxUi.inside(mx, my, btnShop, btnY, btnW, 18)) { CxUi.click(); shop = !shop; pendingBuy = ""; scrollTarget = 0; tabAt = Util.getMillis(); return true; }
        if (CxUi.inside(mx, my, btnSkin, btnY, btnW, 18)) { CxUi.click(); minecraft.setScreen(new CxSkinScreen(this)); return true; }
        for (int i = 0; i < TABS.length; i++) {
            int ry = catTop + i * (catRow + 2);
            if (CxUi.inside(mx, my, catX + 3, ry, catW - 6, catRow)) { if (!tab.equals(TABS[i][0])) tabAt = Util.getMillis(); tab = TABS[i][0]; pendingBuy = ""; scrollTarget = 0; CxUi.click(); return true; }
        }
        if (my >= gy && my < gy + gh) for (int i = 0; i < cardRects.size(); i++) {
            int[] r = cardRects.get(i);
            if (mx >= r[0] && mx < r[0] + r[2] && my >= r[1] && my < r[1] + r[3]) { click(cardItems.get(i)); return true; }
        }
        if (mx >= bx && mx < bx + bw && my >= by && my < by + bh) { dragging = true; return true; }
        return super.mouseClicked(click, doubled);
    }
    @Override public boolean mouseDragged(net.minecraft.client.input.MouseButtonEvent click, double dx, double dy) {
        double mx = click.x(), my = click.y(); int button = click.button();
        if (dragging) { yaw += (float) dx * 1.6f; lastDrag = Util.getMillis(); return true; }
        return super.mouseDragged(click, dx, dy);
    }
    @Override public boolean mouseReleased(net.minecraft.client.input.MouseButtonEvent click) {
        double mx = click.x(), my = click.y(); int button = click.button(); if (dragging) lastDrag = Util.getMillis(); dragging = false; return super.mouseReleased(click); }
    @Override public boolean mouseScrolled(double mx, double my, double h, double v) {
        if (mx >= gx && mx < gx + gw && my >= gy && my < gy + gh) { scrollTarget = Math.max(0, Math.min(scrollTarget - (float) v * 24, Math.max(0, contentH - gh))); return true; }
        return super.mouseScrolled(mx, my, h, v);
    }
    @Override public boolean keyPressed(net.minecraft.client.input.KeyEvent input) {
        if (input.key() == CxClient.settings.wardrobeKey) { onClose(); return true; }
        return super.keyPressed(input);
    }
    @Override public void onClose() { minecraft.setScreen(parent); }
    @Override public boolean isPauseScreen() { return false; }
    @Override public void extractBackground(GuiGraphicsExtractor context, int mouseX, int mouseY, float delta) {}
}
