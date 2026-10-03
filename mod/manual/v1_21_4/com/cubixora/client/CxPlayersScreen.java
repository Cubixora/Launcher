package com.cubixora.client;

import com.cubixora.cosmetics.CosmeticsManager;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.text.Text;
import net.minecraft.util.Util;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Oyun içi ses paneli: sunucudaki Cubixora Client oyuncuları listelenir, tek tek susturulabilir. */
public final class CxPlayersScreen extends Screen {
    private final Screen parent;
    private int px, py, pw, ph, listTop, listH, scroll, maxScroll;
    private final long opened = Util.getMeasuringTimeMs();
    private long last = opened;
    private final Map<String, Float> sw = new HashMap<>(), hov = new HashMap<>();
    private List<String> names = new ArrayList<>();
    private long refreshAt;
    private static final int ROW = 34;
    private final Map<String, Float> spkA = new HashMap<>();

    public CxPlayersScreen(Screen parent) {
        super(Text.literal("Oyuncu Sesleri"));
        this.parent = parent;
        CxScale.sync(MinecraftClient.getInstance(), this);
    }

    public static boolean muted(String name) {
        for (String m : CxClient.settings.muted) if (m.equalsIgnoreCase(name)) return true;
        return false;
    }
    public static void setMuted(String name, boolean on) {
        String k = name.toLowerCase(Locale.ROOT);
        CxClient.settings.muted.removeIf(m -> m.equalsIgnoreCase(name));
        if (on) CxClient.settings.muted.add(k);
        CxClient.save();
    }
    /** Köprüye gönderilecek küçük harfli susturma listesi (JSON dizisi). */
    public static String mutedJson() {
        StringBuilder b = new StringBuilder("[");
        for (int i = 0; i < CxClient.settings.muted.size(); i++) { if (i > 0) b.append(','); b.append('"').append(CxClient.settings.muted.get(i).replaceAll("[^a-z0-9_]", "")).append('"'); }
        return b.append(']').toString();
    }

    public static String nameOf(PlayerListEntry e) { return e.getProfile().getName(); }
    /** Cubixora Client / hesabı olan oyuncu mu (TAB logosu için)? */
    public static boolean isCxUser(String n) { return n != null && (n.equalsIgnoreCase(MinecraftClient.getInstance().getSession().getUsername()) || CxMods.isCx(n) || CosmeticsManager.get(n) != null); }
    /** Sunucudaki (oyuncu listesindeki) herkes; kendi adım hariç. */
    public static List<String> tabNames() {
        List<String> out = new ArrayList<>();
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.getNetworkHandler() == null) return out;
        String me = mc.getSession().getUsername();
        for (var e : mc.getNetworkHandler().getPlayerList()) {
            String n = e.getProfile().getName();
            if (n == null || n.equalsIgnoreCase(me)) continue;
            out.add(n);
        }
        out.sort(String.CASE_INSENSITIVE_ORDER);
        return out;
    }

    private static List<String> collect() {
        List<String> tab = tabNames(), out = new ArrayList<>();
        for (String n : tab) if (CxMods.isCx(n) || CosmeticsManager.get(n) != null || CxMods.speaking(n)) out.add(n);   // launcher doğruladı ya da kozmetik belgesi var
        return out;
    }

    private float fit = 1f;
    private void layout() {
        int n = names.size();
        pw = 280; listTop = 50;
        listH = Math.max(52, Math.min(n, 6) * ROW);
        ph = listTop + listH + 48;
        fit = Math.min(1f, Math.min((width - 12f) / pw, (height - 12f) / ph));   // pencere küçülünce panel de küçülür
        px = Math.round((width - pw * fit) / 2f); py = Math.round((height - ph * fit) / 2f);
    }

    @Override protected void init() {
        names = collect(); refreshAt = Util.getMeasuringTimeMs(); layout();
    }

    @Override
    public void render(DrawContext c, int mouseX, int mouseY, float delta) {
        long now = Util.getMeasuringTimeMs();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        if (now - refreshAt > 1500) { names = collect(); refreshAt = now; }
        layout();
        float a = CxUi.easeOut((now - opened) / 180f), pop = CxUi.easeOutBack((now - opened) / 260f);
        if (parent != null) parent.render(c, -1000, -1000, delta);
        c.fill(0, 0, width, height, CxUi.alpha(0xFF05070A, 0.55f * a));
        float sc = fit * (0.94f + 0.06f * Math.min(1f, pop));
        float ox = width / 2f - pw * sc / 2f, oy = height / 2f - ph * sc / 2f;
        maxScroll = Math.max(0, names.size() * ROW - listH);
        scroll = Math.max(0, Math.min(maxScroll, scroll / ROW * ROW));
        CxUi.scaled(c, ox, oy, sc, () -> {
            CxUi.sheet(c, 0, 0, pw, ph, 14, a);
            CxUi.capsBox(c, textRenderer, "Oyuncu Sesleri", 0, 12, pw, 12, CxUi.alpha(CxStyle.header(), a));
            CxUi.capsBox(c, textRenderer, names.isEmpty() ? "Bu sunucuda Cubixora oyuncusu yok" : names.size() + " Cubixora oyuncusu · sesi kapatmak için dokun", 0, 27, pw, 10, CxUi.alpha(CxStyle.muted(), a));
            c.fill(16, 41, pw - 16, 42, CxUi.alpha(0x22FFFFFF, a));
            int mx = (int) ((mouseX - ox) / sc), my = (int) ((mouseY - oy) / sc);
            if (names.isEmpty()) {
                CxUi.round(c, pw / 2 - 18, listTop + 4, 36, 36, 18, CxUi.alpha(0x14FFFFFF, a));
                CxUi.capsBox(c, textRenderer, "?", pw / 2 - 18, listTop + 4, 36, 36, CxUi.alpha(CxStyle.muted(), a));
            }
            for (int i = 0; i < names.size(); i++) {
                String n = names.get(i);
                int y = listTop + i * ROW - scroll;
                if (y < listTop || y + ROW > listTop + listH + 4) continue;   // kesme (scissor) yok: satırlar ROW adımıyla kayar, hep tam görünür
                boolean m = muted(n), spk = !m && CxMods.speaking(n);
                float over = hov.merge(n, 0f, (o, z) -> o), t = sw.getOrDefault(n, m ? 1f : 0f), sp = spkA.getOrDefault(n, 0f);
                boolean in = CxUi.inside(mx, my, 12, y, pw - 24, ROW - 4) && my >= listTop && my < listTop + listH;
                over = CxUi.approach(over, in ? 1 : 0, 16, dt); hov.put(n, over);
                t = CxUi.approach(t, m ? 1 : 0, 16, dt); sw.put(n, t);
                sp = CxUi.approach(sp, spk ? 1 : 0, 10, dt); spkA.put(n, sp);
                float ent = CxUi.easeOut((now - opened - i * 35L) / 220f);   // sırayla kayarak gelir
                int dy = Math.round((1f - ent) * 6f);
                float aa = a * ent;
                int rx = 12, rw = pw - 24, rh = ROW - 4;
                int bg = CxUi.mix(CxStyle.button(), CxStyle.buttonHover(), over);
                CxUi.round(c, rx, y + dy, rw, rh, 9, CxUi.alpha(bg, aa));
                CxUi.outline(c, rx, y + dy, rw, rh, 9, CxUi.alpha(CxUi.mix(CxStyle.panelBorder(), CxUi.ONLINE, sp), (0.5f + 0.5f * over + 0.5f * sp) * aa));
                int hs = rh - 8;                                           // oyuncu kafası
                int hx = rx + 5, hy = y + dy + 4;
                CxUi.round(c, hx - 1, hy - 1, hs + 2, hs + 2, 5, CxUi.alpha(CxUi.mix(0xFFFFFFFF, CxUi.ONLINE, sp), (0.18f + 0.6f * sp) * aa));
                CxHead.drawEntry(c, n, hx, hy, hs, aa * (1f - 0.55f * t));
                int tx = hx + hs + 8;
                c.drawText(textRenderer, textRenderer.trimToWidth(n, pw - 130), tx, y + dy + 5, CxUi.alpha(m ? CxStyle.muted() : CxStyle.text(), aa), false);
                String sub = m ? "Susturuldu" : (spk ? "Konuşuyor" : "Dinliyorsun");
                int sc2 = m ? 0xFFE5534B : (spk ? CxUi.ONLINE : CxStyle.muted());
                CxUi.caps(c, textRenderer, sub, tx, y + dy + 5 + 11, CxUi.alpha(sc2, aa));
                int sx = rx + rw - 36, sy = y + dy + (rh - 14) / 2;           // anahtar: yeşil = duyuyorsun, kırmızı = kapalı
                CxUi.round(c, sx, sy, 28, 14, 7, CxUi.alpha(CxUi.mix(CxUi.ONLINE, 0xFFE5534B, t), 0.6f * aa));
                CxUi.round(c, sx + 2 + Math.round((1f - t) * 14), sy + 2, 10, 10, 5, CxUi.alpha(0xFFFFFFFF, aa));
            }
            if (maxScroll > 0) {
                int bh = Math.max(14, listH * listH / (names.size() * ROW)), by = listTop + (listH - bh) * scroll / maxScroll;
                CxUi.round(c, pw - 7, by, 2, bh, 1, CxUi.alpha(0xFFFFFFFF, 0.25f * a));
            }
            String stt = !CxBridge.available() ? "Launcher bağlantısı yok (oyunu launcher'dan aç)" : (System.currentTimeMillis() - CxMods.vStatusAt > 3000 ? "Ses ağı bekleniyor..." : (CxMods.vStatus.isEmpty() ? "Ses ağı hazır" : CxMods.vStatus));
            CxUi.capsBox(c, textRenderer, stt, 0, ph - 42, pw, 10, CxUi.alpha(CxStyle.muted(), a));
            int bw = 90, bx = (pw - bw) / 2, byb = ph - 28;
            CxUi.button(c, textRenderer, "Kapat", bx, byb, bw, 18, hov.merge("_x", 0f, (o, z) -> CxUi.approach(o, CxUi.inside(mx, my, bx, byb, bw, 18) ? 1 : 0, 16, dt)), a);
        });
        super.render(c, mouseX, mouseY, delta);
    }

    @Override public boolean mouseClicked(double mx, double my, int button) {
        long now = Util.getMeasuringTimeMs();
        float pop = CxUi.easeOutBack((now - opened) / 260f), sc = fit * (0.94f + 0.06f * Math.min(1f, pop));
        double lx = (mx - (width / 2f - pw * sc / 2f)) / sc, ly = (my - (height / 2f - ph * sc / 2f)) / sc;
        if (button == 0) {
            int bw = 90, bx = (pw - bw) / 2, byb = ph - 28;
            if (CxUi.inside(lx, ly, bx, byb, bw, 18)) { CxUi.click(); close(); return true; }
            if (ly >= listTop && ly < listTop + listH + 4) for (int i = 0; i < names.size(); i++) {
                int y = listTop + i * ROW - scroll;
                if (CxUi.inside(lx, ly, 12, y, pw - 24, ROW - 4)) { String n = names.get(i); setMuted(n, !muted(n)); CxUi.click(); return true; }
            }
        }
        return super.mouseClicked(mx, my, button);
    }

    @Override public boolean mouseScrolled(double mx, double my, double horizontalAmount, double verticalAmount) {
        scroll = Math.max(0, Math.min(maxScroll, scroll - (int) Math.signum(verticalAmount) * ROW));
        return true;
    }

    @Override public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
        if (keyCode == 256 || keyCode == CxClient.settings.voiceKey) { close(); return true; }
        return super.keyPressed(keyCode, scanCode, modifiers);
    }

    @Override public void close() { client.setScreen(parent); }
    @Override public boolean shouldPause() { return false; }
}
