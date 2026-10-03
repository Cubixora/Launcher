package com.cubixora.client;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Util;

import java.util.ArrayList;
import java.util.List;

/**
 * Cubixora ana menüsü (Solaris düzeni):
 * üstte büyük CX logosu ve "CUBIXORA CLIENT", ortada yalnız yazıdan oluşan menü
 * (üzerine gelince solda altın çubuk, yarı saydam şerit ve kısayol harfi), sağ üstte arkadaşlar,
 * sağ altta haberler, sol altta "CUBIXORA AYARLARI" ve en altta oyuncu/sürüm çubuğu.
 * "Ana Menü Ortalı" ayarı kapalıysa menü sola yaslanır. Tüm ölçüler ekran boyutundan hesaplanır;
 * öğeler birbirinin üstüne binmez.
 */
public final class CxTitleScreen extends Screen {
    private static final String VERSION = "1.0";
    private final long opened = Util.getMillis();
    private long last = Util.getMillis();
    private float logoHover, friendScroll, friendScrollTarget, newsScroll, newsScrollTarget, pillHover;

    private static final class Item {
        final String key, hint; final Runnable action; float hover; int x, y, w, h;
        Item(String key, String hint, Runnable action) { this.key = key; this.hint = hint; this.action = action; }
    }
    private final List<Item> items = new ArrayList<>();

    // yerleşim
    private int barH, logoH, logoY, menuX, menuY, menuW, gap, quitGap;
    private int fx, fy, fw, fh, nx, ny, nw, nh, px, py, pw, ph, friendsContentH, newsContentH;
    private boolean showFriends, showNews;

    public CxTitleScreen() { this(false); }
    public CxTitleScreen(boolean fadeIn) { super(Component.literal("Cubixora Client")); CxScale.sync(net.minecraft.client.Minecraft.getInstance(), this); }

    @Override
    protected void init() {
        items.clear();
        items.add(new Item("cx.menu.single", "", () -> minecraft.setScreen(new SelectWorldScreen(this))));
        items.add(new Item("cx.menu.multi", "", () -> minecraft.setScreen(new JoinMultiplayerScreen(this))));
        items.add(new Item("cx.menu.cosmetics", CxSettingsScreen.keyName(CxClient.settings.wardrobeKey), () -> minecraft.setScreen(new CxWardrobeScreen(this, false))));
        items.add(new Item("cx.menu.options", "", () -> minecraft.setScreen(new OptionsScreen(this, minecraft.options, false))));
        items.add(new Item("cx.menu.quit", "", () -> minecraft.stop()));

        barH = Math.max(16, Math.min(22, Math.round(height * 0.042f)));
        int m = Math.max(8, Math.round(width * 0.025f));

        logoH = Math.max(26, Math.min(64, Math.round(height * 0.115f)));
        logoY = Math.max(8, Math.round(height * 0.06f));
        int titleBottom = logoY + logoH + 6 + 9;

        // sağ paneller
        pw = Math.max(120, Math.min(220, Math.round(width * 0.22f)));
        fx = width - pw - m; fy = Math.max(titleBottom - 30, Math.round(height * 0.155f));
        nw = pw; nx = fx;
        showFriends = width >= 420;
        showNews = showFriends && height >= 220;

        // sol alt düğme
        ph = 16; pw = Math.max(110, Math.min(160, Math.round(width * 0.155f)));
        px = m; py = height - barH - ph - Math.max(6, Math.round(height * 0.02f));

        // menü
        gap = Math.max(16, Math.min(28, Math.round(height * 0.054f)));
        quitGap = Math.round(gap * 0.5f);
        int menuH = gap * 4 + quitGap + 12;
        int area = py - titleBottom;
        menuY = titleBottom + Math.max(10, (area - menuH) / 2 + Math.round(area * 0.06f));
        if (menuY + menuH > py - 6) menuY = Math.max(titleBottom + 6, py - 6 - menuH);
        boolean centered = CxClient.settings.menuCentered;
        menuW = Math.max(120, Math.min(180, Math.round(width * 0.2f)));
        menuX = centered ? Math.round(width * 0.415f) : m + Math.round(width * 0.06f);
        int right = showFriends ? fx - 10 : width - m;
        if (menuX + menuW > right) menuX = Math.max(m, right - menuW);
        int y = menuY;
        for (int i = 0; i < items.size(); i++) {
            Item it = items.get(i);
            if (i == items.size() - 1) y += quitGap;
            it.x = menuX - 10; it.y = y - 6; it.w = menuW + 10; it.h = 19;
            y += gap;
        }
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor c, int mouseX, int mouseY, float delta) {
        long now = Util.getMillis();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        float t = (now - opened) / 1000f;

        CxBackground.render(c, width, height, 1f);
        c.fillGradient(0, 0, width, height, 0x22050507, 0x66050507);

        // logo + CUBIXORA CLIENT
        float lh = logoH, lw = lh * CxUi.LOGO_W / CxUi.LOGO_H, lcx = width / 2f, lcy = logoY + lh / 2;
        boolean overLogo = Math.abs(mouseX - lcx) < lw / 2 && Math.abs(mouseY - lcy) < lh / 2 + 8;
        logoHover = CxUi.approach(logoHover, overLogo ? 1 : 0, 12, dt);
        float appear = CxUi.easeOut(t / 0.45f);
        CxUi.glow(c, lcx, lcy, lw * (1.4f + logoHover * 0.4f), CxUi.alpha(CxUi.ACCENT, (0.08f + logoHover * 0.18f) * appear));
        CxUi.logo(c, lcx, lcy - logoHover * 1.5f + (1 - appear) * 6, lw * (1 + logoHover * 0.05f), appear);
        String a1 = "CUBIXORA", a2 = Component.translatable("cx.client").getString();
        int w1 = font.width(CxFont.pixel(a1)), w2 = font.width(CxFont.pixel(a2)), sp = 5;
        int tx = Math.round(lcx - (w1 + sp + w2) / 2f), ty = logoY + logoH + 6;
        c.text(font, CxFont.pixel(a1), tx, ty, CxUi.alpha(0xFFFFFFFF, appear), true);
        c.text(font, CxFont.pixel(a2), tx + w1 + sp, ty, CxUi.alpha(CxUi.ACCENT, appear), true);

        // menü
        for (int i = 0; i < items.size(); i++) {
            Item it = items.get(i);
            float ap = CxUi.easeOut((t - 0.08f - i * 0.04f) / 0.25f);
            if (ap <= 0) continue;
            boolean over = CxUi.inside(mouseX, mouseY, it.x, it.y, it.w, it.h);
            it.hover = CxUi.approach(it.hover, over ? 1 : 0, 18, dt);
            float hv = CxUi.easeOut(it.hover);
            int ox = Math.round((1 - ap) * -8);
            if (hv > 0.01f) {
                int bw = Math.round(it.w * (0.55f + 0.45f * hv));
                CxUi.round(c, it.x + ox, it.y, bw, it.h, 3, CxUi.alpha(0x59160F08, hv * ap));
                CxUi.outline(c, it.x + ox, it.y, bw, it.h, 3, CxUi.alpha(0x4DF5C542, hv * ap));
                c.fill(it.x + ox, it.y + 1, it.x + ox + 3, it.y + it.h - 1, CxUi.alpha(CxUi.ACCENT, hv * ap));
                if (!it.hint.isEmpty()) c.text(font, CxFont.pixel(it.hint), it.x + ox + bw - 14, it.y + 6, CxUi.alpha(0xFF9A9AA6, hv * ap), true);
            }
            int col = CxUi.mix(0xFFFFFFFF, CxUi.ACCENT, hv);
            c.text(font, CxFont.pixel(Component.translatable(it.key).getString()), menuX + ox + Math.round(hv * 4), it.y + 6, CxUi.alpha(col, ap), true);
        }

        // sağ paneller
        float pa = CxUi.easeOut((t - 0.12f) / 0.35f);
        int slide = Math.round((1 - pa) * 14);
        if (showFriends) {
            fw = pw(); int maxH = (showNews ? height / 2 - fy : height - barH - 10 - fy);
            fh = Math.min(maxH, 42 + Math.max(12, friendsContentH));
            drawFriends(c, fx + slide, fy, fw, fh, pa, dt);
        }
        if (showNews) {
            nw = pw(); nh = Math.min(Math.round(height * 0.32f), 30 + Math.max(12, newsContentH));
            ny = height - barH - Math.max(6, Math.round(height * 0.025f)) - nh;
            if (ny < fy + fh + 8) { nh -= (fy + fh + 8 - ny); ny = fy + fh + 8; }
            if (nh > 34) drawNews(c, nx + slide, ny, nw, nh, pa, dt);
        }

        // sol alt: Cubixora Ayarları
        boolean overPill = CxUi.inside(mouseX, mouseY, px, py, pw, ph);
        pillHover = CxUi.approach(pillHover, overPill ? 1 : 0, 18, dt);
        CxUi.round(c, px, py, pw, ph, 8, CxUi.alpha(CxUi.mix(0xCC151A22, 0xE6202733, pillHover), pa));
        CxUi.outline(c, px, py, pw, ph, 8, CxUi.alpha(CxUi.mix(0x40FFFFFF, CxUi.ACCENT, pillHover * 0.7f), pa));
        String ps = Component.translatable("cx.menu.cxsettings").getString();
        CxUi.capsBox(c, font, ps, px, py, pw, ph, CxUi.alpha(CxUi.ACCENT, pa));

        // alt çubuk
        int by = height - barH;
        c.fill(0, by, width, height, 0xE6040507);
        c.fill(0, by, width, by + 1, 0x14FFFFFF);
        int hs = Math.min(12, barH - 6);
        CxHead.draw(c, 8 + hs / 2, by + barH / 2, hs, 1f);
        String name = CxClient.playerName.isEmpty() ? minecraft.getUser().getName() : CxClient.playerName;
        c.text(font, name, 8 + hs + 6, by + (barH - 7) / 2, 0xFFFFFFFF, false);
        int cx0 = 8 + hs + 6 + font.width(name) + 10;
        int cs = Math.min(11, barH - 4);
        CxUi.coin(c, cx0, by + (barH - cs) / 2, cs, 1f);
        c.text(font, String.valueOf(CxClient.coins), cx0 + cs + 4, by + (barH - 7) / 2, 0xFFFFE08A, false);
        String ver = "Cubixora Client " + VERSION + " • Minecraft " + mcVersion();
        c.text(font, ver, width - 8 - font.width(ver), by + (barH - 7) / 2, 0xFF8A8F99, false);

        super.extractRenderState(c, mouseX, mouseY, delta);
    }

    private int pw() { return fw = Math.max(120, Math.min(220, Math.round(width * 0.22f))); }

    private static String mcVersion() {
        return FabricLoader.getInstance().getModContainer("minecraft").map(m -> m.getMetadata().getVersion().getFriendlyString()).orElse("");
    }

    /** Başlık; sağ metin sığmazsa alt satıra iner. Döndürdüğü değer: başlık alanının yüksekliği. */
    private int panelHeader(GuiGraphicsExtractor c, int x, int y, int w, String title, String right, float a) {
        int tw = font.width(CxFont.pixel(title));
        float k = Math.min(1f, (w - 20) / (float) Math.max(1, tw));
        if (k >= 1f) c.text(font, CxFont.pixel(title), x + 10, y + 9, CxUi.alpha(0xFFFFFFFF, a), true);
        else { tw = font.width(title); k = Math.min(1f, (w - 20) / (float) Math.max(1, tw)); CxUi.textScaled(c, font, title, x + 10, y + 9, k, CxUi.alpha(0xFFFFFFFF, a), false); }
        if (right == null) return 22;
        int rw = font.width(right);
        if (tw * k + rw + 26 <= w) { c.text(font, right, x + w - 10 - rw, y + 9, CxUi.alpha(0xFF8A8F99, a), false); return 22; }
        c.text(font, right, x + 10, y + 21, CxUi.alpha(0xFF8A8F99, a), false);
        return 34;
    }

    private void drawFriends(GuiGraphicsExtractor c, int x, int y, int w, int h, float a, float dt) {
        CxUi.card(c, x, y, w, h, 6, a, true);
        int hh = panelHeader(c, x, y, w, Component.translatable("cx.friends").getString().toUpperCase(java.util.Locale.ROOT), Component.translatable("cx.friends.online", CxClient.onlineCount()).getString(), a);
        int top = y + hh, bottom = y + h - 6;
        friendScroll = CxUi.approach(friendScroll, friendScrollTarget, 14, dt);
        c.enableScissor(x + 2, top, x + w - 2, bottom);
        int cy = top + 2 - Math.round(friendScroll);
        if (CxClient.onlineCount() == 0) {
            c.text(font, font.plainSubstrByWidth("Çevrimiçi arkadaş yok.", w - 20), x + 10, cy + 2, CxUi.alpha(0xFF8A8F99, a), false);
            cy += 12;
        } else {
            cy = section(c, x, cy, w, true, a);
        }
        c.disableScissor();
        friendsContentH = cy + Math.round(friendScroll) - top;
        scrollbar(c, x + w - 4, top, bottom, friendScroll, friendsContentH, a);
    }

    private int section(GuiGraphicsExtractor c, int x, int cy, int w, boolean online, float a) {
        List<CxClient.Friend> list = new ArrayList<>();
        for (CxClient.Friend f : CxClient.FRIENDS) if ("offline".equals(f.status) != online) list.add(f);
        if (list.isEmpty()) return cy;
        String head = Component.translatable(online ? "cx.friends.sec.online" : "cx.friends.sec.offline").getString() + " · " + list.size();
        c.text(font, head, x + 10, cy, CxUi.alpha(0xFF7E8590, a), false);
        int hw = font.width(head);
        c.fill(x + 14 + hw, cy + 4, x + w - 10, cy + 5, CxUi.alpha(0x22FFFFFF, a));
        cy += 11;
        for (CxClient.Friend f : list) {
            CxUi.round(c, x + 11, cy + 2, 4, 4, 2, CxUi.alpha(CxUi.statusColor(f.status), a));
            c.text(font, font.plainSubstrByWidth(f.name, w - 34), x + 20, cy, CxUi.alpha(online ? 0xFFFFFFFF : 0xFFAEB3BB, a), false);
            cy += 10;
            if (online && f.game != null && !f.game.isEmpty()) {
                c.text(font, font.plainSubstrByWidth(f.game, w - 34), x + 20, cy, CxUi.alpha(0xFF7E8590, a), false);
                cy += 10;
            }
            cy += 2;
        }
        return cy + 3;
    }

    private void drawNews(GuiGraphicsExtractor c, int x, int y, int w, int h, float a, float dt) {
        CxUi.card(c, x, y, w, h, 6, a, true);
        panelHeader(c, x, y, w, Component.translatable("cx.news").getString().toUpperCase(java.util.Locale.ROOT), null, a);
        int top = y + 22, bottom = y + h - 6;
        newsScroll = CxUi.approach(newsScroll, newsScrollTarget, 14, dt);
        c.enableScissor(x + 2, top, x + w - 2, bottom);
        int cy = top + 2 - Math.round(newsScroll);
        if (CxClient.NEWS.isEmpty()) {
            c.text(font, Component.translatable("cx.news.none").getString(), x + 10, cy + 2, CxUi.alpha(0xFF8A8F99, a), false);
            cy += 12;
        } else for (CxClient.News n : CxClient.NEWS) {
            c.text(font, font.plainSubstrByWidth(n.title, w - 20), x + 10, cy, CxUi.alpha(CxUi.ACCENT, a), false);
            cy += 10;
            for (var line : font.split(Component.literal(n.text), w - 20)) {
                c.text(font, line, x + 10, cy, CxUi.alpha(0xFFC9CDD3, a), false);
                cy += 9;
            }
            cy += 5;
        }
        c.disableScissor();
        newsContentH = cy + Math.round(newsScroll) - top;
        scrollbar(c, x + w - 4, top, bottom, newsScroll, newsContentH, a);
    }

    private void scrollbar(GuiGraphicsExtractor c, int x, int top, int bottom, float scroll, int content, float a) {
        int view = bottom - top;
        if (content <= view) return;
        int bh = Math.max(12, view * view / content);
        int by = top + Math.round((view - bh) * (scroll / (content - view)));
        CxUi.round(c, x, by, 2, bh, 1, CxUi.alpha(0x55FFFFFF, a));
    }

    @Override
    public boolean mouseClicked(net.minecraft.client.input.MouseButtonEvent click, boolean doubled) {
        double mx = click.x(), my = click.y(); int button = click.button();
        if (button == 0) {
            for (Item it : items) if (CxUi.inside(mx, my, it.x, it.y, it.w, it.h)) { CxUi.click(); it.action.run(); return true; }
            if (CxUi.inside(mx, my, px, py, pw, ph)) { CxUi.click(); minecraft.setScreen(new CxSettingsScreen(this)); return true; }
        }
        return super.mouseClicked(click, doubled);
    }

    @Override
    public boolean mouseScrolled(double mouseX, double mouseY, double horizontalAmount, double verticalAmount) {
        if (showFriends && mouseX >= fx && mouseX < fx + fw && mouseY >= fy && mouseY < fy + fh) {
            friendScrollTarget = clampScroll(friendScrollTarget - (float) verticalAmount * 16, friendsContentH, fh - 28);
            return true;
        }
        if (showNews && mouseX >= nx && mouseX < nx + nw && mouseY >= ny && mouseY < ny + nh) {
            newsScrollTarget = clampScroll(newsScrollTarget - (float) verticalAmount * 16, newsContentH, nh - 28);
            return true;
        }
        return super.mouseScrolled(mouseX, mouseY, horizontalAmount, verticalAmount);
    }
    private static float clampScroll(float v, int content, int view) { return Math.max(0, Math.min(v, Math.max(0, content - view))); }

    @Override public boolean shouldCloseOnEsc() { return false; }
    @Override public void extractBackground(GuiGraphicsExtractor context, int mouseX, int mouseY, float delta) {}
}
