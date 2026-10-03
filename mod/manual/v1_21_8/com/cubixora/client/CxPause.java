package com.cubixora.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.Element;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ClickableWidget;
import net.minecraft.util.Util;

import java.util.function.Consumer;

/**
 * Oyun içi ESC menüsüne Cubixora bölümü ekler: menünün içinde 2x2 kısayol ızgarası
 * (Cubixora / Modlar / Gardrop / Mağaza) ve altında Performans Modu + Cubixora Ayarları + Yüklü Modlar.
 */
public final class CxPause {
    private CxPause() {}

    private static Screen swept; private static long sweptAt;
    /**
     * Mod Menu gibi modlar kendi "Modlar" düğmesini menü kurulduktan SONRA ekler ve bizim düğmelerin üstüne biner.
     * Onları gizleriz: modlar Cubixora'nın kendi "Yüklü Modlar" ekranından yönetilir. Karede en çok bir kez, ucuz.
     */
    static void sweep(Screen s) {
        long now = Util.getMeasuringTimeMs();
        if (s == swept && now - sweptAt < 250) return;
        swept = s; sweptAt = now;
        for (Element e : s.children()) if (e instanceof ClickableWidget w && w.getHeight() >= 18 && !(w instanceof CxFlatButton) && w.visible
                && isModMenu(w)) { w.visible = false; w.active = false; }
    }

    /** Mod Menu'nun eklediği / dönüştürdüğü "Modlar" düğmesi mi? (sınıf adı ya da çeviri anahtarı) */
    static boolean isModMenu(ClickableWidget w) {
        if (w.getClass().getName().toLowerCase(java.util.Locale.ROOT).contains("modmenu")) return true;
        String t = w.getMessage().getString();
        return net.fabricmc.loader.api.FabricLoader.getInstance().isModLoaded("modmenu") && (t.equalsIgnoreCase("Mods") || t.equalsIgnoreCase("Modlar"));
    }

    /** Gizlenen vanilla düğmenin eylemini çalıştırır. */
    static void press(ClickableWidget w) { w.onClick(w.getX() + 1.0, w.getY() + 1.0); }

    /**
     * Sunucu kaynak paketi (ItemsAdder, Oraxen, Nexo vb.) yüklü mü? Bu sunucular ESC menüsüne kendi görsellerini
     * vanilla düğmelerin TAM konumuna göre çizer; düğmeleri kaydırmak/değiştirmek bu görselleri bozar.
     */
    static boolean serverPack(MinecraftClient mc) {
        try { for (var p : mc.getResourcePackManager().getEnabledProfiles()) { String id = p.getId(); if (id.startsWith("server") || id.startsWith("download")) return true; } } catch (Throwable ignored) {}
        return false;
    }

    /** Sunucu paketi varken: vanilla menüye hiç dokunulmaz, Cubixora sol üst köşede iki küçük düğme olur. */
    private static void installCorner(Screen s, Consumer<ClickableWidget> add, MinecraftClient mc) {
        int bw = 70, bh = 16, x = 4, y = 4;
        CxFlatButton a = new CxFlatButton(x, y, bw, bh, "Cubixora", () -> mc.setScreen(new CxSettingsScreen(s)));
        a.accent = true;
        add.accept(a);
        add.accept(new CxFlatButton(x + bw + 3, y, bw, bh, "Modlar", () -> mc.setScreen(new CxModsScreen(s))));
    }

    public static void install(Screen s, Consumer<ClickableWidget> add) {
        if (!CxClient.enabled) return;
        MinecraftClient mc = MinecraftClient.getInstance();
        if (serverPack(mc)) { installCorner(s, add, mc); return; }
        int bottom = 0, top = Integer.MAX_VALUE, left = Integer.MAX_VALUE, right = 0;
        java.util.List<ClickableWidget> vanilla = new java.util.ArrayList<>();
        // yalnız gerçek düğmeler (başlık yazısı gibi ekran genişliğindeki parçalar sayılmaz)
        for (Element e : s.children()) if (e instanceof ClickableWidget w && w.getHeight() >= 18 && w.getWidth() <= 320 && w.visible) {   // başka bir modun gizlediği düğme geri getirilmez
            vanilla.add(w);
            bottom = Math.max(bottom, w.getY() + w.getHeight()); top = Math.min(top, w.getY());
            left = Math.min(left, w.getX()); right = Math.max(right, w.getX() + w.getWidth());
        }
        if (bottom == 0) return;
        int total = Math.max(204, right - left), gap = 4, bh = 20, x = left + (right - left) / 2 - total / 2;
        int need = 8 + 2 * bh + gap + 6 + 3 * bh + 2 * gap;             // ızgara + boşluk + üç seçenek
        int over = bottom + need - (s.height - 6);
        if (over > 0) {                                                 // küçük ekranda vanilla düğmeleri yukarı al
            int shift = Math.min(over, Math.max(0, top - 22));
            for (ClickableWidget w : vanilla) w.setY(w.getY() - shift);
            bottom -= shift;
        }
        // vanilla düğmeleri gizle, yerine aynı yerde Cubixora stilinde (küçük harf) kopyaları çiz
        boolean modSlot = false;
        for (ClickableWidget w : vanilla) {
            if (isModMenu(w)) {
                // Mod Menu'nun "Modlar" düğmesi: yerine Cubixora'nın kendi "Yüklü Modlar" ekranı (aynı yer, aynı boyut)
                CxFlatButton c = new CxFlatButton(w.getX(), w.getY(), w.getWidth(), w.getHeight(), "Yüklü Modlar", () -> mc.setScreen(new CxFabricModsScreen(s)));
                c.owner = s;
                w.visible = false; w.active = false;
                add.accept(c);
                modSlot = true;
                continue;
            }
            CxFlatButton c = new CxFlatButton(w.getX(), w.getY(), w.getWidth(), w.getHeight(), w.getMessage().getString(), () -> press(w));
            c.mirror = w; c.owner = s;
            w.visible = false;
            add.accept(c);
        }
        int y = bottom + 8, cg = 8, bw = (total - cg) / 2;
        String[] names = { "Cubixora", "Modlar", "Gardrop", "Mağaza" };
        Runnable[] acts = {
            () -> mc.setScreen(new CxSettingsScreen(s)),
            () -> mc.setScreen(new CxModsScreen(s)),
            () -> mc.setScreen(new CxWardrobeScreen(s, false)),
            () -> mc.setScreen(new CxWardrobeScreen(s, true))
        };
        for (int i = 0; i < 4; i++) {
            CxFlatButton b = new CxFlatButton(x + (i % 2) * (bw + cg), y + (i / 2) * (bh + gap), bw, bh, names[i], acts[i]);
            if (i == 0) b.accent = true;
            add.accept(b);
        }
        int y2 = y + 2 * (bh + gap) + 6;
        CxFlatButton perf = new CxFlatButton(x, y2, total, bh, "", () -> {
            if (CxPerf.on()) CxPerf.set(false);
            else mc.setScreen(new CxConfirm(s, "Performans Modu",
                "Bu ayar oyunun görsel kalitesini düşürür: grafikler hızlı moda geçer, bulut ve parçacıklar kısılır, gölgeler kapanır, menü efektleri sadeleşir ve FPS sınırı kaldırılır. Kapatınca eski ayarların geri gelir.",
                "Onayla", "İptal", true, () -> CxPerf.set(true)));
        });
        perf.dynamic = () -> "Cubixora Performans Modu: " + (CxPerf.on() ? "AÇIK" : "KAPALI");
        perf.accentWhen = CxPerf::on;
        add.accept(perf);
        add.accept(new CxFlatButton(x, y2 + bh + gap, total, bh, "Cubixora Ayarları...", () -> mc.setScreen(new CxSettingsScreen(s))));
        if (!modSlot) add.accept(new CxFlatButton(x, y2 + 2 * (bh + gap), total, bh, "Yüklü Modlar...", () -> mc.setScreen(new CxFabricModsScreen(s))));
    }
}
