package com.cubixora.client;

/** Modlar ekranının yerleşim hesabı (Minecraft'tan bağımsız; her ekran boyutunda taşma olmadığı test edilir). */
public final class CxModsLayout {
    public final int px, py, pw, ph, tabY, divY, ct, lx, lw, rx, rw, searchY, listY, listH, countY, vy, vh;

    public CxModsLayout(int W, int H) {
        pw = Math.min(W - 12, Math.max(300, Math.min(640, Math.round(W * 0.88f))));
        ph = Math.min(H - 8, Math.max(150, Math.min(380, Math.round(H * 0.88f))));
        px = (W - pw) / 2; py = (H - ph) / 2;
        tabY = py + 42; divY = tabY + 21; ct = py + 68;
        lx = px + 12; lw = Math.max(96, Math.min(220, Math.round(pw * 0.30f)));
        rx = lx + lw + 14; rw = px + pw - 12 - rx;
        searchY = ct; listY = ct + 24;
        countY = py + ph - 18;
        listH = countY - 6 - listY;
        vy = ct; vh = py + ph - 10 - ct;
    }
}
