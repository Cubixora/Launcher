package com.cubixora.client;

import net.fabricmc.loader.api.FabricLoader;
import net.fabricmc.loader.api.ModContainer;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Util;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Yüklü Modlar: mods klasöründeki modları listeler. Ayarı olan modun ayar ekranı açılır (Mod Menu uyumlu),
 * modlar açılıp kapatılır (oyun açıkken kullanılan dosya değiştirilemediği için değişiklik bir sonraki açılışta
 * launcher tarafından uygulanır), klasör açılır. Liste bir kez hazırlanır; her karede yalnız çizim yapılır.
 */
public final class CxFabricModsScreen extends Screen {
    private static final class Entry {
        String id = "", name = "", version = "", desc = "", file = "";
        boolean loaded, enabled, wantOn, cfg;
    }

    private final Screen parent;
    private final List<Entry> list = new ArrayList<>();
    private final Map<String, Float> hov = new HashMap<>(), sw = new HashMap<>();
    private final long opened = Util.getMillis();
    private long last = opened;
    private int pw, ph, listTop, listH, scroll, maxScroll, rows;
    private float fit = 1f;
    private boolean modMenu, dirty;
    private String toast = ""; private long toastAt;
    private static final int ROW = 30;

    public CxFabricModsScreen(Screen parent) {
        super(Component.literal("Yüklü Modlar"));
        this.parent = parent;
        CxScale.sync(Minecraft.getInstance(), this);
    }

    private static Path modsDir() { return FabricLoader.getInstance().getGameDir().resolve("mods"); }
    private static Path pendingFile() { return FabricLoader.getInstance().getConfigDir().resolve("cubixora").resolve("mods-pending.json"); }

    private void load() {
        list.clear();
        FabricLoader fl = FabricLoader.getInstance();
        modMenu = fl.isModLoaded("modmenu");
        Set<String> cfgIds = new HashSet<>();
        try { for (var ec : fl.getEntrypointContainers("modmenu", Object.class)) cfgIds.add(ec.getProvider().getMetadata().getId()); } catch (Throwable ignored) {}
        Map<String, Boolean> pending = readPending();
        Path mods = modsDir();
        Set<String> seen = new HashSet<>();
        for (ModContainer m : fl.getAllMods()) {
            String file = jarOf(m, mods);
            if (file == null) continue;                                    // yerleşik / iç içe / Cubixora'nın kendisi listelenmez
            String id = m.getMetadata().getId();
            if (id.startsWith("cubixora")) continue;
            Entry e = new Entry();
            e.id = id; e.name = m.getMetadata().getName(); e.version = m.getMetadata().getVersion().getFriendlyString();
            e.desc = m.getMetadata().getDescription() == null ? "" : m.getMetadata().getDescription().replace('\n', ' ');
            e.file = file; e.loaded = true; e.enabled = true;
            e.wantOn = pending.getOrDefault(file, true);
            e.cfg = cfgIds.contains(id);
            list.add(e); seen.add(file);
        }
        try (var s = Files.list(mods)) {                                    // kapatılmış modlar (.jar.disabled)
            s.forEach(p -> {
                String n = p.getFileName().toString();
                if (!n.endsWith(".jar.disabled")) return;
                String base = n.substring(0, n.length() - ".disabled".length());
                if (seen.contains(base)) return;
                Entry e = new Entry();
                e.file = base; e.name = base.replaceAll("\\.jar$", "").replaceAll("[-_]+", " "); e.version = "kapalı";
                e.loaded = false; e.enabled = false; e.wantOn = pending.getOrDefault(base, false);
                list.add(e);
            });
        } catch (Exception ignored) {}
        list.sort((a, b) -> a.name.compareToIgnoreCase(b.name));
    }

    /** Mod doğrudan mods klasöründeki bir jar'dan geldiyse jar adı, değilse null. */
    private static String jarOf(ModContainer m, Path mods) {
        try {
            var o = m.getOrigin();
            if (o.getKind() != net.fabricmc.loader.api.metadata.ModOrigin.Kind.PATH) return null;
            for (Path p : o.getPaths()) {
                String n = p.getFileName() == null ? "" : p.getFileName().toString();
                if (n.toLowerCase(Locale.ROOT).endsWith(".jar") && p.getParent() != null && p.getParent().toAbsolutePath().normalize().equals(mods.toAbsolutePath().normalize())) return n;
            }
        } catch (Throwable ignored) {}
        return null;
    }

    private static Map<String, Boolean> readPending() {
        Map<String, Boolean> out = new HashMap<>();
        try {
            Path f = pendingFile();
            if (!Files.exists(f)) return out;
            var o = new com.google.gson.JsonParser().parse(Files.readString(f)).getAsJsonObject();
            for (var e : o.entrySet()) out.put(e.getKey(), e.getValue().getAsBoolean());
        } catch (Exception ignored) {}
        return out;
    }

    private void writePending() {
        try {
            com.google.gson.JsonObject o = new com.google.gson.JsonObject();
            for (Entry e : list) if (e.wantOn != e.enabled) o.addProperty(e.file, e.wantOn);
            Path f = pendingFile();
            Files.createDirectories(f.getParent());
            if (o.size() == 0) Files.deleteIfExists(f); else Files.writeString(f, o.toString());
        } catch (Exception ignored) {}
    }

    private void toggle(Entry e) {
        e.wantOn = !e.wantOn;
        // kapalı modu açmak hemen yapılabilir (dosya kullanımda değil); açık modu kapatmak bir sonraki açılışta
        if (!e.loaded && e.wantOn) {
            try { Files.move(modsDir().resolve(e.file + ".disabled"), modsDir().resolve(e.file)); e.enabled = true; e.version = "sonraki açılışta yüklenir"; } catch (Exception ignored) {}
        } else if (!e.loaded && !e.wantOn && e.enabled) {
            try { Files.move(modsDir().resolve(e.file), modsDir().resolve(e.file + ".disabled")); e.enabled = false; e.version = "kapalı"; } catch (Exception ignored) {}
        }
        dirty = true; writePending();
        say(e.wantOn == e.enabled ? (e.wantOn ? e.name + " açık" : e.name + " kapalı") : "Oyunu yeniden başlatınca uygulanır");
    }

    private void openConfig(Entry e) {
        Screen s = null;
        try {
            for (var ec : FabricLoader.getInstance().getEntrypointContainers("modmenu", Object.class)) {
                if (!ec.getProvider().getMetadata().getId().equals(e.id)) continue;
                Object api = ec.getEntrypoint();
                Object factory = api.getClass().getMethod("getModConfigScreenFactory").invoke(api);
                if (factory == null) continue;
                java.lang.reflect.Method cm = null;
                for (var m : factory.getClass().getMethods()) if (m.getName().equals("create") && m.getParameterCount() == 1) { cm = m; break; }
                if (cm == null) continue;
                cm.setAccessible(true);
                Object r = cm.invoke(factory, this);
                if (r instanceof Screen sc) { s = sc; break; }
            }
        } catch (Throwable t) { Cubixora_log(t); }
        if (s != null) minecraft.setScreen(s);
        else say(modMenu ? "Bu modun ayar ekranı açılamadı" : "Ayar ekranı için Mod Menu modu kurulu olmalı");
    }

    private static void Cubixora_log(Throwable t) { try { com.cubixora.cosmetics.Cubixora.LOG.warn("mod ayarı açılamadı", t); } catch (Throwable ignored) {} }

    private void say(String s) { toast = s; toastAt = Util.getMillis(); }

    private void layout() {
        pw = 330; listTop = 52;
        rows = Math.max(3, Math.min(8, list.size()));
        listH = rows * ROW;
        ph = listTop + listH + 58;
        fit = Math.min(1f, Math.min((width - 12f) / pw, (height - 12f) / ph));
        maxScroll = Math.max(0, list.size() - rows) * ROW;
        scroll = Math.max(0, Math.min(maxScroll, scroll / ROW * ROW));
    }

    @Override protected void init() { load(); layout(); }

    private float h(String id, boolean over, float dt) { float v = CxUi.approach(hov.getOrDefault(id, 0f), over ? 1 : 0, 16, dt); hov.put(id, v); return v; }
    private float sc() { float pop = CxUi.easeOutBack((Util.getMillis() - opened) / 260f); return fit * (0.94f + 0.06f * Math.min(1f, pop)); }

    @Override
    public void extractRenderState(GuiGraphicsExtractor c, int mouseX, int mouseY, float delta) {
        long now = Util.getMillis();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        layout();
        float a = CxUi.easeOut((now - opened) / 180f);
        if (parent != null) parent.extractRenderState(c, -1000, -1000, delta); else if (minecraft.level == null) CxBackground.render(c, width, height, 1f);
        c.fill(0, 0, width, height, CxUi.alpha(0xFF05070A, 0.55f * a));
        float sc = sc();
        float ox = width / 2f - pw * sc / 2f, oy = height / 2f - ph * sc / 2f;
        int mx = (int) ((mouseX - ox) / sc), my = (int) ((mouseY - oy) / sc);
        CxUi.scaled(c, ox, oy, sc, () -> {
            CxUi.sheet(c, 0, 0, pw, ph, 14, a);
            CxUi.capsBox(c, font, "Yüklü Modlar", 0, 12, pw, 12, CxUi.alpha(CxStyle.header(), a));
            long cfgN = list.stream().filter(e -> e.cfg).count();
            String sub = list.isEmpty() ? "Mods klasöründe mod yok" : list.size() + " mod" + (cfgN > 0 ? " · " + cfgN + " tanesinin ayarı var" : "");
            CxUi.capsBox(c, font, sub, 0, 27, pw, 10, CxUi.alpha(CxStyle.muted(), a));
            c.fill(16, 42, pw - 16, 43, CxUi.alpha(0x22FFFFFF, a));
            if (list.isEmpty()) CxUi.capsBox(c, font, "Mod eklemek için klasörü aç ve .jar dosyasını bırak", 0, listTop + listH / 2 - 5, pw, 10, CxUi.alpha(CxStyle.muted(), a));
            int first = scroll / ROW;
            for (int i = first; i < Math.min(list.size(), first + rows); i++) {
                Entry e = list.get(i);
                int y = listTop + (i - first) * ROW, rx = 12, rw = pw - 24, rh = ROW - 4;
                float ent = CxUi.easeOut((now - opened - (i - first) * 30L) / 220f), aa = a * ent;
                int dy = Math.round((1 - ent) * 6); y += dy;
                boolean in = CxUi.inside(mx, my, rx, y, rw, rh);
                float ov = h("r" + i, in, dt);
                CxUi.round(c, rx, y, rw, rh, 8, CxUi.alpha(CxUi.mix(CxStyle.button(), CxStyle.buttonHover(), ov), aa));
                CxUi.outline(c, rx, y, rw, rh, 8, CxUi.alpha(CxStyle.panelBorder(), (0.5f + 0.5f * ov) * aa));
                boolean on = e.wantOn;
                int nameCol = on ? CxStyle.text() : CxStyle.muted();
                int textW = rw - 110;
                c.text(font, font.plainSubstrByWidth(e.name, textW), rx + 8, y + 4, CxUi.alpha(nameCol, aa), false);
                String info = (e.wantOn != e.enabled ? (e.wantOn ? "Yeniden başlatınca açılır" : "Yeniden başlatınca kapanır") : (e.version + (e.desc.isEmpty() ? "" : " · " + e.desc)));
                int infoCol = e.wantOn != e.enabled ? 0xFFF5B13D : CxStyle.muted();
                CxUi.textScaled(c, font, font.plainSubstrByWidth(info, (int) (textW / 0.8f)), rx + 8, y + 15, 0.8f, CxUi.alpha(infoCol, aa), false);
                // ayarlar düğmesi
                int bx = rx + rw - 96, by = y + (rh - 16) / 2;
                if (e.cfg && e.loaded) {
                    float bo = h("c" + i, CxUi.inside(mx, my, bx, by, 52, 16), dt);
                    CxUi.round(c, bx, by, 52, 16, 6, CxUi.alpha(CxUi.mix(CxStyle.button(), CxStyle.accent(), 0.25f + 0.35f * bo), aa));
                    CxUi.capsBox(c, font, "Ayarlar", bx, by + 1, 52, 14, CxUi.alpha(CxStyle.text(), aa));
                }
                // aç/kapat anahtarı
                float t = CxUi.approach(sw.getOrDefault(e.file, on ? 1f : 0f), on ? 1f : 0f, 16, dt); sw.put(e.file, t);
                int sx = rx + rw - 36, sy = y + (rh - 14) / 2;
                CxUi.round(c, sx, sy, 28, 14, 7, CxUi.alpha(CxUi.mix(0xFF4A535C, CxUi.ONLINE, t), 0.75f * aa));
                CxUi.round(c, sx + 2 + Math.round(t * 14), sy + 2, 10, 10, 5, CxUi.alpha(0xFFFFFFFF, aa));
            }
            if (maxScroll > 0) {
                int bh = Math.max(14, listH * rows / list.size()), byy = listTop + (listH - bh) * scroll / maxScroll;
                CxUi.round(c, pw - 7, byy, 2, bh, 1, CxUi.alpha(0xFFFFFFFF, 0.25f * a));
            }
            String foot = Util.getMillis() - toastAt < 2600 && !toast.isEmpty() ? toast : (dirty ? "Değişiklikler oyunu yeniden başlatınca uygulanır" : "Tıkla: aç / kapat · Ayarlar: modun kendi ayarları");
            CxUi.capsBox(c, font, foot, 0, ph - 46, pw, 10, CxUi.alpha(dirty || Util.getMillis() - toastAt < 2600 ? CxStyle.header() : CxStyle.muted(), a));
            int bw = (pw - 24 - 8) / 2, byb = ph - 30;
            CxUi.button(c, font, "Klasörü Aç", 12, byb, bw, 18, h("_f", CxUi.inside(mx, my, 12, byb, bw, 18), dt), a);
            CxUi.button(c, font, "Kapat", 12 + bw + 8, byb, bw, 18, h("_x", CxUi.inside(mx, my, 12 + bw + 8, byb, bw, 18), dt), a);
        });
        super.extractRenderState(c, mouseX, mouseY, delta);
    }

    @Override public boolean mouseClicked(net.minecraft.client.input.MouseButtonEvent click, boolean doubled) {
        double mx = click.x(), my = click.y(); int button = click.button();
        if (button != 0) return super.mouseClicked(click, doubled);
        float sc = sc();
        double lx = (mx - (width / 2f - pw * sc / 2f)) / sc, ly = (my - (height / 2f - ph * sc / 2f)) / sc;
        int bw = (pw - 24 - 8) / 2, byb = ph - 30;
        if (CxUi.inside(lx, ly, 12, byb, bw, 18)) { CxUi.click(); try { Files.createDirectories(modsDir()); Util.getPlatform().openFile(modsDir().toFile()); } catch (Exception ignored) {} return true; }
        if (CxUi.inside(lx, ly, 12 + bw + 8, byb, bw, 18)) { CxUi.click(); onClose(); return true; }
        int first = scroll / ROW;
        for (int i = first; i < Math.min(list.size(), first + rows); i++) {
            Entry e = list.get(i);
            int y = listTop + (i - first) * ROW, rx = 12, rw = pw - 24, rh = ROW - 4;
            if (!CxUi.inside(lx, ly, rx, y, rw, rh)) continue;
            int bx = rx + rw - 96, by = y + (rh - 16) / 2;
            CxUi.click();
            if (e.cfg && e.loaded && CxUi.inside(lx, ly, bx, by, 52, 16)) openConfig(e); else toggle(e);
            return true;
        }
        return super.mouseClicked(click, doubled);
    }

    @Override public boolean mouseScrolled(double mx, double my, double horizontalAmount, double verticalAmount) {
        scroll = Math.max(0, Math.min(maxScroll, scroll - (int) Math.signum(verticalAmount) * ROW));
        return true;
    }

    @Override public boolean keyPressed(net.minecraft.client.input.KeyEvent input) {
        int keyCode = input.key(), scanCode = input.scancode(), modifiers = input.modifiers();
        if (keyCode == 256) { onClose(); return true; }
        return super.keyPressed(input);
    }

    @Override public void onClose() { minecraft.setScreen(parent); }
    @Override public boolean isPauseScreen() { return false; }
}
