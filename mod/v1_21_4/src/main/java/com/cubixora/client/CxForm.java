package com.cubixora.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.IntConsumer;
import java.util.function.IntFunction;
import java.util.function.IntSupplier;
import java.util.function.Supplier;

/**
 * Ayar satırları (başlık + açıklama + sağda anahtar / kaydırıcı / düğme) için ortak, kaydırılabilir liste.
 * Cubixora Ayarları, modül ayarları ve iletişim pencereleri bunu kullanır.
 */
public final class CxForm {
    public abstract static class Row {
        final String title, desc;
        float hover;
        int y, h;
        Row(String title, String desc) { this.title = title; this.desc = desc == null ? "" : desc; }
        int height() { return desc.isEmpty() ? 22 : 30; }
        abstract void control(CxForm f, DrawContext c, TextRenderer tr, int right, int cy, int mx, int my, float a);
        boolean click(CxForm f, int right, int cy, double mx, double my) { return false; }
        void drag(CxForm f, int right, double mx) {}
    }

    public static final class Toggle extends Row {
        final BooleanSupplier get; final Consumer<Boolean> set; final boolean label; float pos;
        Toggle(String t, String d, BooleanSupplier get, Consumer<Boolean> set, boolean label) { super(t, d); this.get = get; this.set = set; this.label = label; pos = get.getAsBoolean() ? 1 : 0; }
        @Override void control(CxForm f, DrawContext c, TextRenderer tr, int right, int cy, int mx, int my, float a) {
            pos = CxUi.approach(pos, get.getAsBoolean() ? 1 : 0, 18, f.dt);
            CxUi.toggle(c, right - 22, cy - 6, pos, hover, a);
            if (label) {
                String s = get.getAsBoolean() ? "Açık" : "Kapalı";
                c.drawText(tr, s, right - 30 - tr.getWidth(s), cy - 3, CxUi.alpha(get.getAsBoolean() ? CxStyle.accent() : CxStyle.muted(), a), false);
            }
        }
        @Override boolean click(CxForm f, int right, int cy, double mx, double my) { set.accept(!get.getAsBoolean()); CxUi.click(); return true; }
    }

    public static final class Slider extends Row {
        final IntSupplier get; final IntConsumer set; final int min, max, step; final IntFunction<String> fmt;
        float shown = -1;
        Slider(String t, String d, IntSupplier get, IntConsumer set, int min, int max, int step, IntFunction<String> fmt) { super(t, d); this.get = get; this.set = set; this.min = min; this.max = max; this.step = Math.max(1, step); this.fmt = fmt; }
        int sw(CxForm f) { return Math.max(60, Math.min(110, f.w / 5)); }
        @Override void control(CxForm f, DrawContext c, TextRenderer tr, int right, int cy, int mx, int my, float a) {
            int sw = sw(f), vw = 42, sx = right - vw - sw;
            float v = (get.getAsInt() - min) / (float) (max - min);
            shown = shown < 0 ? v : CxUi.approach(shown, v, 22, f.dt);
            CxUi.slider(c, sx, cy - 4, sw, shown, f.dragging == this ? 1 : hover, a);
            String s = fmt.apply(get.getAsInt());
            c.drawText(tr, s, right - tr.getWidth(s), cy - 3, CxUi.alpha(CxStyle.muted(), a), false);
        }
        @Override boolean click(CxForm f, int right, int cy, double mx, double my) {
            int sw = sw(f), vw = 42, sx = right - vw - sw;
            if (mx < sx - 6 || mx > sx + sw + 6) return false;
            f.dragging = this; drag(f, right, mx); return true;
        }
        @Override void drag(CxForm f, int right, double mx) {
            int sw = sw(f), vw = 42, sx = right - vw - sw;
            float t = CxUi.clamp01((float) ((mx - sx) / sw));
            int v = min + Math.round(t * (max - min) / step) * step;
            set.accept(Math.max(min, Math.min(max, v)));
        }
    }

    public static final class Button extends Row {
        final Supplier<String> label; final Runnable run; float bh;
        Button(String t, String d, Supplier<String> label, Runnable run) { super(t, d); this.label = label; this.run = run; }
        int bw(TextRenderer tr) { return Math.max(52, tr.getWidth(label.get()) + 22); }
        @Override void control(CxForm f, DrawContext c, TextRenderer tr, int right, int cy, int mx, int my, float a) {
            int bw = bw(tr);
            boolean over = CxUi.inside(mx, my, right - bw, cy - 8, bw, 16);
            bh = CxUi.approach(bh, over ? 1 : 0, 18, f.dt);
            CxUi.button(c, tr, label.get(), right - bw, cy - 8, bw, 16, bh, a);
        }
        @Override boolean click(CxForm f, int right, int cy, double mx, double my) {
            int bw = bw(MinecraftClient.getInstance().textRenderer);
            if (!CxUi.inside(mx, my, right - bw, cy - 8, bw, 16)) return false;
            CxUi.click(); run.run(); return true;
        }
    }

    /** Yalnız bilgi satırı (kontrolsüz). */
    public static final class Info extends Row {
        Info(String t, String d) { super(t, d); }
        @Override void control(CxForm f, DrawContext c, TextRenderer tr, int right, int cy, int mx, int my, float a) {}
    }

    public final List<Row> rows = new ArrayList<>();
    public int x, y, w, h;
    public boolean dividers;
    float scroll, scrollTarget, dt;
    Row dragging;
    private long last;

    public CxForm toggle(String t, String d, BooleanSupplier g, Consumer<Boolean> s) { rows.add(new Toggle(t, d, g, s, false)); return this; }
    public CxForm toggleL(String t, String d, BooleanSupplier g, Consumer<Boolean> s) { rows.add(new Toggle(t, d, g, s, true)); return this; }
    public CxForm slider(String t, String d, IntSupplier g, IntConsumer s, int min, int max, int step, IntFunction<String> fmt) { rows.add(new Slider(t, d, g, s, min, max, step, fmt)); return this; }
    public CxForm button(String t, String d, Supplier<String> label, Runnable r) { rows.add(new Button(t, d, label, r)); return this; }
    public CxForm info(String t, String d) { rows.add(new Info(t, d)); return this; }
    public void clear() { rows.clear(); scroll = scrollTarget = 0; dragging = null; }

    public int contentHeight() { int s = 0; for (Row r : rows) s += r.height(); return s; }
    private float maxScroll() { return Math.max(0, contentHeight() - h); }

    public void render(DrawContext c, TextRenderer tr, int mx, int my, float a) {
        long now = System.currentTimeMillis();
        dt = last == 0 ? 0 : Math.min(0.1f, (now - last) / 1000f);
        last = now;
        scrollTarget = Math.max(0, Math.min(scrollTarget, maxScroll()));
        scroll = CxUi.approach(scroll, scrollTarget, 16, dt);
        c.enableScissor(x, y, x + w, y + h);
        int cy = y - Math.round(scroll), right = x + w - 6;
        for (int i = 0; i < rows.size(); i++) {
            Row r = rows.get(i);
            r.y = cy; r.h = r.height();
            if (cy + r.h >= y && cy <= y + h) {
                boolean over = my >= Math.max(cy, y) && my < Math.min(cy + r.h, y + h) && mx >= x && mx < x + w;
                r.hover = CxUi.approach(r.hover, over ? 1 : 0, 18, dt);
                if (r.hover > 0.01f) CxUi.round(c, x, cy + 1, w, r.h - 2, 4, CxUi.alpha(CxStyle.hover(), r.hover * a));
                int mid = cy + r.h / 2;
                if (r.desc.isEmpty()) c.drawText(tr, r.title, x + 6, mid - 3, CxUi.alpha(CxStyle.text(), a), false);
                else {
                    c.drawText(tr, r.title, x + 6, cy + 6, CxUi.alpha(CxStyle.text(), a), false);
                    int dw = w - 150;
                    c.drawText(tr, tr.trimToWidth(r.desc, Math.max(40, dw)) + (tr.getWidth(r.desc) > dw ? "…" : ""), x + 6, cy + 17, CxUi.alpha(CxStyle.muted(), a), false);
                }
                r.control(this, c, tr, right, mid, mx, my, a);
                if (dividers && i < rows.size() - 1) c.fill(x + 4, cy + r.h - 1, x + w - 4, cy + r.h, CxUi.alpha(CxStyle.divider(), a * 0.6f));
            }
            cy += r.h;
        }
        c.disableScissor();
        float ms = maxScroll();
        if (ms > 0) {
            int view = h, content = contentHeight();
            int bh = Math.max(14, view * view / content);
            int by = y + Math.round((view - bh) * (scroll / ms));
            CxUi.round(c, x + w - 2, by, 2, bh, 1, CxUi.alpha(0x55FFFFFF, a));
        }
    }

    public boolean mouseClicked(double mx, double my) {
        if (!CxUi.inside(mx, my, x, y, w, h)) return false;
        for (Row r : rows) if (my >= r.y && my < r.y + r.h) return r.click(this, x + w - 6, r.y + r.h / 2, mx, my);
        return false;
    }

    public void mouseDragged(double mx) { if (dragging != null) dragging.drag(this, x + w - 6, mx); }
    public void mouseReleased() { dragging = null; }
    public boolean mouseScrolled(double mx, double my, double amount) {
        if (!CxUi.inside(mx, my, x, y, w, h)) return false;
        scrollTarget = Math.max(0, Math.min(scrollTarget - (float) amount * 20, maxScroll()));
        return true;
    }
}
