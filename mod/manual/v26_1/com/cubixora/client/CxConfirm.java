package com.cubixora.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Util;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Modern onay penceresi: altta üstündeki ekran silik görünür, ortada animasyonlu kart. */
public final class CxConfirm extends Screen {
    private final Screen parent;
    private final String title, body, yes, no;
    private final Runnable onYes;
    private final boolean warn;
    private int px, py, pw, ph;
    private final long opened = Util.getMillis();
    private long last = opened;
    private final Map<String, Float> hov = new HashMap<>();
    private List<net.minecraft.util.FormattedCharSequence> lines = List.of();

    public CxConfirm(Screen parent, String title, String body, String yes, String no, boolean warn, Runnable onYes) {
        super(Component.literal(title));
        this.parent = parent; this.title = title; this.body = body; this.yes = yes; this.no = no; this.warn = warn; this.onYes = onYes;
        CxScale.sync(Minecraft.getInstance(), this);
    }

    @Override protected void init() {
        pw = Math.min(width - 24, 250);
        lines = font.split(Component.literal(body), pw - 40);
        ph = 74 + lines.size() * 10 + 30;
        px = (width - pw) / 2; py = Math.max(6, (height - ph) / 2);
    }

    private float h(String id, boolean over, float dt) { float v = CxUi.approach(hov.getOrDefault(id, 0f), over ? 1 : 0, 18, dt); hov.put(id, v); return v; }

    @Override
    public void extractRenderState(GuiGraphicsExtractor c, int mouseX, int mouseY, float delta) {
        long now = Util.getMillis();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        float a = CxUi.easeOut((now - opened) / 200f), pop = CxUi.easeOutBack((now - opened) / 280f);
        if (parent != null) parent.extractRenderState(c, -1000, -1000, delta); else if (minecraft.level == null) CxBackground.render(c, width, height, 1f);
        c.fill(0, 0, width, height, CxUi.alpha(0xFF05070A, 0.62f * a));
        int cx = px + pw / 2, cy = py + ph / 2;
        float sc = 0.92f + 0.08f * Math.min(1f, pop);
        int accent = warn ? 0xFFF5B13D : CxStyle.accent();
        CxUi.scaled(c, cx - pw * sc / 2f, cy - ph * sc / 2f, sc, () -> {
            CxUi.sheet(c, 0, 0, pw, ph, 12, a);
            // uyarı simgesi
            int ix = pw / 2 - 14;
            CxUi.round(c, ix, 14, 28, 28, 14, CxUi.alpha(accent, 0.16f * a));
            CxUi.outline(c, ix, 14, 28, 28, 14, CxUi.alpha(accent, 0.7f * a));
            CxUi.round(c, pw / 2 - 1, 21, 3, 9, 1, CxUi.alpha(accent, a));
            CxUi.round(c, pw / 2 - 1, 33, 3, 3, 1, CxUi.alpha(accent, a));
            CxUi.capsBox(c, font, title, 0, 48, pw, 12, CxUi.alpha(CxStyle.header(), a));
            int ly = 66;
            for (var l : lines) { int lw = font.width(l); c.text(font, l, (pw - lw) / 2, ly, CxUi.alpha(CxStyle.muted(), a), false); ly += 10; }
            int bw = (pw - 40 - 8) / 2, by = ph - 30;
            int mx = (int) ((mouseX - (cx - pw * sc / 2f)) / sc), my = (int) ((mouseY - (cy - ph * sc / 2f)) / sc);
            CxUi.button(c, font, no, 20, by, bw, 18, h("no", CxUi.inside(mx, my, 20, by, bw, 18), dt), a);
            CxUi.button(c, font, yes, 28 + bw, by, bw, 18, h("yes", CxUi.inside(mx, my, 28 + bw, by, bw, 18), dt), a);
            CxUi.outline(c, 28 + bw, by, bw, 18, 6, CxUi.alpha(accent, 0.9f * a));
        });
        super.extractRenderState(c, mouseX, mouseY, delta);
    }

    @Override public boolean mouseClicked(net.minecraft.client.input.MouseButtonEvent click, boolean doubled) {
        double mx = click.x(), my = click.y(); int button = click.button();
        long now = Util.getMillis();
        float pop = CxUi.easeOutBack((now - opened) / 280f), sc = 0.92f + 0.08f * Math.min(1f, pop);
        double lx = (mx - (px + pw / 2f - pw * sc / 2f)) / sc, ly = (my - (py + ph / 2f - ph * sc / 2f)) / sc;
        int bw = (pw - 40 - 8) / 2, by = ph - 30;
        if (CxUi.inside(lx, ly, 20, by, bw, 18)) { CxUi.click(); onClose(); return true; }
        if (CxUi.inside(lx, ly, 28 + bw, by, bw, 18)) { CxUi.click(); minecraft.setScreen(parent); onYes.run(); return true; }
        return super.mouseClicked(click, doubled);
    }

    @Override public boolean keyPressed(net.minecraft.client.input.KeyEvent input) {
        int keyCode = input.key(), scanCode = input.scancode(), modifiers = input.modifiers();
        if (keyCode == 257) { minecraft.setScreen(parent); onYes.run(); return true; }
        return super.keyPressed(input);
    }
    @Override public void onClose() { minecraft.setScreen(parent); }
    @Override public boolean isPauseScreen() { return parent != null && parent.isPauseScreen(); }
    @Override public void extractBackground(GuiGraphicsExtractor context, int mouseX, int mouseY, float delta) {}
}
