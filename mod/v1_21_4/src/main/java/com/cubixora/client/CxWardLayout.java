package com.cubixora.client;

/** Gardrop yerleşimi (Minecraft'tan bağımsız; her ekran boyutunda taşma olmadığı test edilir). */
public final class CxWardLayout {
    public static final int TABS = 7;
    public final int px, py, pw, ph, bx, by, bw, bh, catX, catW, catRow, catTop, catTitle, gx, gy, gw, gh;
    public final boolean labels;

    public CxWardLayout(int W, int H) {
        pw = Math.min(W - 16, 640); ph = Math.min(H - 16, 360);
        px = (W - pw) / 2; py = (H - ph) / 2;
        bw = Math.round(pw * 0.27f); bh = ph - 62; bx = px + 12; by = py + 50;
        labels = pw >= 520;
        catX = bx + bw + 10; catW = labels ? 112 : 38;
        catTitle = bh >= 170 ? 22 : 6;
        int gap = 2;
        catRow = Math.max(10, Math.min(28, (bh - catTitle - 6 - gap * (TABS - 1)) / TABS));
        catTop = by + catTitle;
        gx = catX + catW + 10; gy = by; gw = px + pw - 12 - gx; gh = py + ph - 12 - gy;
    }

    public int rowY(int i) { return catTop + i * (catRow + 2); }
}
