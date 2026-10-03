package com.cubixora.client;

import com.cubixora.cosmetics.Compat;
import com.cubixora.cosmetics.CosmeticsManager;
import com.cubixora.cosmetics.PlayerCosmetics;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.toast.SystemToast;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import net.minecraft.util.Util;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Skin stüdyosu: oyuncu adıyla ara, PNG klasöründen seç, adlandır/kaydet, uygula. */
public final class CxSkinScreen extends Screen {
    private final Screen parent;
    private final CxText nameBox = new CxText("Oyuncu adı", 16), skinName = new CxText("Skin adı", 32);
    private List<File> files = new ArrayList<>();
    private int sel = -1;
    private float listScroll, listTarget, yaw = 160;
    private byte[] curPng; private boolean curSlim;
    private Identifier curTex; private int texN;
    private String status = "", statusKind = "";
    private long statusAt;
    private final long opened = Util.getMeasuringTimeMs();
    private long last = opened;
    private boolean dragging, busy;
    private int px, py, pw, ph, lx, ly, lw, lh, rx, rw, listY, listH;
    private final Map<String, Float> hov = new HashMap<>();
    private final Map<String, int[]> rects = new HashMap<>();

    public CxSkinScreen(Screen parent) { super(Text.literal("Skin stüdyosu")); this.parent = parent; CxScale.sync(net.minecraft.client.MinecraftClient.getInstance(), this); }

    @Override
    protected void init() {
        pw = Math.min(width - 20, 620); ph = Math.min(height - 20, 360);
        px = (width - pw) / 2; py = Math.max(8, (height - ph) / 2);
        lw = Math.round(pw * 0.32f); lx = px + 12; ly = py + 40; lh = ph - 52;
        rx = lx + lw + 12; rw = px + pw - 12 - rx;
        files = CxSkins.list();
        String me = client.getSession().getUsername();
        if (nameBox.value.isEmpty()) nameBox.set(me);
    }

    private void say(String s, String kind) { status = s; statusKind = kind; statusAt = Util.getMeasuringTimeMs(); }

    private void setCurrent(byte[] png, boolean slim) {
        curPng = png; curSlim = slim;
        try {
            NativeImage img = NativeImage.read(new ByteArrayInputStream(png));
            Identifier id = Identifier.of("cubixora", "studio/skin_" + (texN++));
            Compat.registerTexture(id, img);
            if (curTex != null) client.getTextureManager().destroyTexture(curTex);
            curTex = id;
        } catch (Exception e) { say("Skin yüklenemedi.", "err"); }
    }

    private boolean btn(DrawContext c, String id, String label, int x, int y, int w, int h, int mx, int my, float dt, float a, boolean enabled) {
        boolean over = enabled && CxUi.inside(mx, my, x, y, w, h);
        float v = CxUi.approach(hov.getOrDefault(id, 0f), over ? 1 : 0, 18, dt);
        hov.put(id, v);
        CxUi.button(c, textRenderer, textRenderer.trimToWidth(label, w - 6), x, y, w, h, v, enabled ? a : a * 0.45f);
        rects.put(id, new int[] { x, y, w, h });
        return over;
    }

    @Override
    public void render(DrawContext c, int mouseX, int mouseY, float delta) {
        long now = Util.getMeasuringTimeMs();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        float a = CxUi.easeOut((now - opened) / 240f);
        if (!dragging) yaw += 24f * dt;
        if (client.world == null) CxBackground.render(c, width, height, 1f);
        c.fill(0, 0, width, height, CxUi.alpha(CxStyle.scrim(), a));
        int oy = Math.round((1 - a) * 10);
        rects.clear();
        CxUi.sheet(c, px, py + oy, pw, ph, 10, a);
        c.drawText(textRenderer, "SKİN STÜDYOSU", px + 14, py + 12 + oy, CxUi.alpha(CxStyle.header(), a), false);
        c.drawText(textRenderer, "Skinini ara, kaydet ve anında uygula", px + 14, py + 24 + oy, CxUi.alpha(CxStyle.muted(), a), false);
        c.fill(px + 12, py + 36 + oy, px + pw - 12, py + 37 + oy, CxUi.alpha(CxStyle.divider(), a));

        // önizleme
        CxUi.round(c, lx, ly + oy, lw, lh, 8, CxUi.alpha(CxStyle.field(), a));
        CxUi.outline(c, lx, ly + oy, lw, lh, 8, CxUi.alpha(CxStyle.panelBorder(), a));
        Identifier tex; boolean thin; Identifier cape = null;
        if (curTex != null) { tex = curTex; thin = curSlim; }
        else { tex = CxPreview.vanillaTex(); thin = CxPreview.vanillaSlim(); }
        PlayerCosmetics pc = CosmeticsManager.get(client.getSession().getUsername());
        if (pc != null) { if (curTex == null && pc.skinTexture != null) { tex = pc.skinTexture; thin = pc.slim; } }
        c.enableScissor(lx + 1, ly + 1 + oy, lx + lw - 1, ly + lh - 1 + oy);
        CxPreview.draw(c, lx + 6, ly + 8 + oy, lx + lw - 6, ly + lh - 22 + oy, tex, thin, cape, yaw, -4f);
        c.disableScissor();
        String hint = curPng == null ? "Şu anki skinin" : "Önizleme · " + (curSlim ? "ince kol" : "klasik kol");
        c.drawText(textRenderer, hint, lx + (lw - textRenderer.getWidth(hint)) / 2, ly + lh - 14 + oy, CxUi.alpha(CxStyle.muted(), a), false);

        int mx = mouseX, my = mouseY, y = py + 44 + oy;
        // oyuncu adı + Ara
        c.drawText(textRenderer, "Oyuncu adı", rx, y, CxUi.alpha(CxStyle.muted(), a), false); y += 10;
        nameBox.x = rx; nameBox.y = y; nameBox.w = rw - 58; nameBox.render(c, textRenderer, mx, my, a);
        btn(c, "find", busy ? "..." : "Ara", rx + rw - 54, y, 54, 16, mx, my, dt, a, !busy);
        y += 22;
        int half = (rw - 6) / 2;
        btn(c, "folder", "PNG klasörü", rx, y, half, 16, mx, my, dt, a, true);
        btn(c, "refresh", "Yenile", rx + half + 6, y, half, 16, mx, my, dt, a, true);
        y += 22;

        // kayıtlı skinler
        c.drawText(textRenderer, "Kayıtlı skinler (" + files.size() + ")", rx, y, CxUi.alpha(CxStyle.muted(), a), false); y += 10;
        int fixedBelow = 10 + 16 + 6 + 16 + 6 + 16 + 6 + 12;
        listY = y; listH = Math.max(34, py + ph + oy - 12 - fixedBelow - y);
        CxUi.round(c, rx, listY, rw, listH, 6, CxUi.alpha(CxStyle.field(), a));
        listTarget = Math.max(0, Math.min(listTarget, Math.max(0, files.size() * 15 - listH + 4)));
        listScroll = CxUi.approach(listScroll, listTarget, 16, dt);
        c.enableScissor(rx, listY, rx + rw, listY + listH);
        if (files.isEmpty()) c.drawText(textRenderer, "Henüz skin yok. PNG klasörüne skin at.", rx + 8, listY + 8, CxUi.alpha(CxStyle.muted(), a), false);
        for (int i = 0; i < files.size(); i++) {
            int ry = listY + 2 + i * 15 - Math.round(listScroll);
            if (ry + 15 < listY || ry > listY + listH) continue;
            boolean over = CxUi.inside(mx, my, rx, ry, rw, 15) && my >= listY && my < listY + listH;
            float v = CxUi.approach(hov.getOrDefault("f" + i, 0f), over || i == sel ? 1 : 0, 18, dt);
            hov.put("f" + i, v);
            if (v > 0.01f) CxUi.round(c, rx + 2, ry, rw - 4, 14, 4, CxUi.alpha(i == sel ? CxStyle.selected() : CxStyle.hover(), a * Math.max(v, i == sel ? 1 : 0)));
            if (i == sel) c.fill(rx + 3, ry + 2, rx + 5, ry + 12, CxStyle.accent(a));
            String n = files.get(i).getName().replaceAll("(?i)\\.png$", "");
            c.drawText(textRenderer, textRenderer.trimToWidth(n, rw - 16), rx + 9, ry + 4, CxUi.alpha(i == sel ? CxStyle.text() : CxStyle.muted(), a), false);
        }
        c.disableScissor();
        y = listY + listH + 6;

        // skin adı + işlemler
        skinName.x = rx; skinName.y = y; skinName.w = rw; skinName.render(c, textRenderer, mx, my, a);
        y += 22;
        int q = (rw - 18) / 4;
        boolean has = curPng != null;
        btn(c, "saveas", "Farklı kaydet", rx, y, q, 16, mx, my, dt, a, has);
        btn(c, "overwrite", "Üzerine yaz", rx + (q + 6), y, q, 16, mx, my, dt, a, has && sel >= 0);
        btn(c, "edit", "Düzenle", rx + (q + 6) * 2, y, q, 16, mx, my, dt, a, sel >= 0);
        btn(c, "apply", "Uygula", rx + (q + 6) * 3, y, rw - (q + 6) * 3, 16, mx, my, dt, a, has);
        y += 22;
        int t3 = (rw - 12) / 3;
        btn(c, "reset", "Görünümü sıfırla", rx, y, t3, 16, mx, my, dt, a, true);
        btn(c, "remove", "Skin kaldır", rx + t3 + 6, y, t3, 16, mx, my, dt, a, true);
        btn(c, "close", "Kapat", rx + (t3 + 6) * 2, y, rw - (t3 + 6) * 2, 16, mx, my, dt, a, true);
        y += 20;
        if (!status.isEmpty() && now - statusAt < 6000) {
            int col = statusKind.equals("err") ? CxUi.DND : statusKind.equals("ok") ? CxUi.ONLINE : CxStyle.muted();
            c.drawText(textRenderer, textRenderer.trimToWidth(status, rw), rx, y, CxUi.alpha(col, a), false);
        }
        super.render(c, mouseX, mouseY, delta);
    }

    private void act(String id) {
        switch (id) {
            case "find": {
                String n = nameBox.value.trim();
                busy = true; say("Aranıyor...", "");
                CxSkins.lookup(n, s -> {
                    busy = false;
                    if (s.error != null) { say(s.error, "err"); return; }
                    setCurrent(s.png, s.slim); sel = -1; skinName.set(n); say(n + " skini yüklendi. Uygula ya da kaydet.", "ok");
                });
                break;
            }
            case "folder": net.minecraft.util.Util.getOperatingSystem().open(CxSkins.dir()); break;
            case "refresh": files = CxSkins.list(); sel = Math.min(sel, files.size() - 1); say("Liste yenilendi.", "ok"); break;
            case "saveas": {
                String n = CxSkins.safeName(skinName.value);
                if (n.isEmpty()) { say("Önce bir skin adı yaz.", "err"); break; }
                try {
                    File f = new File(CxSkins.dir(), n + ".png");
                    Files.write(f.toPath(), curPng);
                    files = CxSkins.list();
                    sel = -1; for (int i = 0; i < files.size(); i++) if (files.get(i).getName().equalsIgnoreCase(f.getName())) sel = i;
                    say("Kaydedildi: " + n, "ok");
                } catch (Exception e) { say("Kaydedilemedi.", "err"); }
                break;
            }
            case "overwrite": {
                if (sel < 0 || sel >= files.size()) break;
                try { Files.write(files.get(sel).toPath(), curPng); say("Üzerine yazıldı.", "ok"); } catch (Exception e) { say("Yazılamadı.", "err"); }
                break;
            }
            case "edit": if (sel >= 0 && sel < files.size()) net.minecraft.util.Util.getOperatingSystem().open(files.get(sel)); break;
            case "apply": {
                CosmeticsManager.setSelfSkin(CxSkins.dataUrl(curPng), curSlim);
                CxBridge.raw("/equip", "{\"skin\":\"" + CxSkins.dataUrl(curPng) + "\",\"slim\":" + curSlim + "}", o -> {});
                SystemToast.show(client.getToastManager(), SystemToast.Type.PERIODIC_NOTIFICATION, Text.literal("Skin uygulandı"), Text.literal(skinName.value.isEmpty() ? "Yeni görünümün hazır" : skinName.value));
                say("Skin uygulandı.", "ok");
                break;
            }
            case "reset": curPng = null; if (curTex != null) { client.getTextureManager().destroyTexture(curTex); curTex = null; } sel = -1; say("Görünüm sıfırlandı.", "ok"); break;
            case "remove": {
                CosmeticsManager.setSelfSkin(null, false);
                CxBridge.raw("/equip", "{\"skin\":\"\",\"slim\":false}", o -> {});
                curPng = null; if (curTex != null) { client.getTextureManager().destroyTexture(curTex); curTex = null; }
                say("Özel skin kaldırıldı; hesabının skini kullanılacak.", "ok");
                break;
            }
            case "close": close(); break;
            default: break;
        }
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        boolean f1 = nameBox.click(mx, my), f2 = skinName.click(mx, my);
        if (f1) skinName.focused = false;
        if (f2) nameBox.focused = false;
        if (f1 || f2) return true;
        for (Map.Entry<String, int[]> e : rects.entrySet()) {
            int[] r = e.getValue();
            if (CxUi.inside(mx, my, r[0], r[1], r[2], r[3])) {
                String id = e.getKey();
                boolean has = curPng != null;
                boolean ok = switch (id) { case "saveas", "apply" -> has; case "overwrite" -> has && sel >= 0; case "edit" -> sel >= 0; case "find" -> !busy; default -> true; };
                if (!ok) return true;
                CxUi.click(); act(id); return true;
            }
        }
        if (CxUi.inside(mx, my, rx, listY, rw, listH)) {
            int i = (int) ((my - listY - 2 + listScroll) / 15);
            if (i >= 0 && i < files.size()) {
                CxSkins.Skin s = CxSkins.load(files.get(i));
                if (s.error != null) say(s.error, "err");
                else { sel = i; setCurrent(s.png, s.slim); skinName.set(files.get(i).getName().replaceAll("(?i)\\.png$", "")); say("Seçildi. Uygula'ya bas.", ""); }
                CxUi.click();
            }
            return true;
        }
        if (CxUi.inside(mx, my, lx, ly, lw, lh)) { dragging = true; return true; }
        return super.mouseClicked(mx, my, button);
    }
    @Override public boolean mouseDragged(double mx, double my, int button, double dx, double dy) {
        if (dragging) { yaw += (float) dx * 1.6f; return true; }
        return super.mouseDragged(mx, my, button, dx, dy);
    }
    @Override public boolean mouseReleased(double mx, double my, int button) { dragging = false; return super.mouseReleased(mx, my, button); }
    @Override public boolean mouseScrolled(double mx, double my, double h, double v) {
        if (CxUi.inside(mx, my, rx, listY, rw, listH)) { listTarget -= (float) v * 22; return true; }
        return super.mouseScrolled(mx, my, h, v);
    }
    @Override public boolean charTyped(char chr, int modifiers) {
        if (nameBox.charTyped(chr) && nameBox.focused) return true;
        if (skinName.charTyped(chr) && skinName.focused) return true;
        return super.charTyped(chr, modifiers);
    }
    @Override public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
        if (keyCode == 257 && nameBox.focused && !busy) { act("find"); return true; }
        if (nameBox.key(keyCode, modifiers) || skinName.key(keyCode, modifiers)) return true;
        if (keyCode == 256 && (nameBox.focused || skinName.focused)) { nameBox.focused = false; skinName.focused = false; return true; }
        return super.keyPressed(keyCode, scanCode, modifiers);
    }
    @Override public void removed() { if (curTex != null) { client.getTextureManager().destroyTexture(curTex); curTex = null; } }
    @Override public void close() { client.setScreen(parent); }
    @Override public boolean shouldPause() { return false; }
    @Override public void renderBackground(DrawContext context, int mouseX, int mouseY, float delta) {}
}
