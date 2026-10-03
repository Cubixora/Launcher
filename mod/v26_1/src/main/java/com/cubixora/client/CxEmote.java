package com.cubixora.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.CameraType;
import net.minecraft.network.chat.Component;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayList;
import java.util.List;

/**
 * Emote / sprey çarkının oyun tarafı: tuşla açma, seçili emotenin oynatılması (kamera önden),
 * hareket edince iptal ve kamerayı eski haline döndürme. Emote/sprey içeriği henüz yok; sistem hazır.
 */
public final class CxEmote {
    private CxEmote() {}

    public static final String[] CATS = { "emote", "spray" };
    public static final String[] CAT_NAMES = { "Emotelar", "Spreyler" };

    /** Çarkta/düzenleyicide gösterilen eşya. demo: gerçek içerik yokken arayüzü denemek için örnek. */
    public static final class Entry {
        public final String id, name, rarity, ref; public final boolean demo = false;
        Entry(String id, String name, String rarity, String ref) { this.id = id; this.name = name; this.rarity = rarity; this.ref = ref; }
    }

    public static List<Entry> owned(int cat) {
        List<Entry> l = new ArrayList<>();
        for (CxBridge.Item it : CxBridge.last.items) if (it.owned && CATS[cat].equals(it.type)) l.add(new Entry(it.id, it.name, it.rarity, it.ref));
        return l;
    }

    public static Entry find(int cat, String id) {
        if (id == null) return null;
        for (Entry e : owned(cat)) if (e.id.equals(id)) return e;
        return null;
    }

    public static String[] slots(int cat) { return cat == 0 ? CxClient.settings.emoteSlots : CxClient.settings.spraySlots; }

    static { /* Gson eski dosyalarda null/kısa dizi verebilir */ }
    public static void ensure() {
        CxClient.Settings s = CxClient.settings;
        if (s.emoteSlots == null || s.emoteSlots.length != 8) s.emoteSlots = java.util.Arrays.copyOf(s.emoteSlots == null ? new String[0] : s.emoteSlots, 8);
        if (s.spraySlots == null || s.spraySlots.length != 8) s.spraySlots = java.util.Arrays.copyOf(s.spraySlots == null ? new String[0] : s.spraySlots, 8);
    }

    // ------------------------------------------------------------------ kamera / oynatma
    private static boolean viewing, prevKey = true;
    private static long nextState;
    private static CameraType prevPersp;
    private static String active;
    private static double sx, sz; private static long startAt;

    public static boolean isViewing() { return viewing; }

    public static void beginView(Minecraft mc) {
        if (viewing) return;
        prevPersp = mc.options.getCameraType();
        mc.options.setCameraType(CameraType.THIRD_PERSON_FRONT);
        viewing = true;
    }

    private static String selfName = "";

    public static void endView(Minecraft mc) {
        if (active != null) { CxEmoteAnim.stop(selfName); CxEmoteNet.send(""); }
        active = null;
        if (!viewing) return;
        viewing = false;
        if (prevPersp != null) mc.options.setCameraType(prevPersp);
        prevPersp = null;
    }

    /** Seçilen çark öğesini uygular. */
    public static void apply(Minecraft mc, int cat, String id) {
        Entry e = find(cat, id);
        if (e == null) { endView(mc); return; }
        if (cat == 0) {
            active = e.id; startAt = System.currentTimeMillis();
            if (mc.player != null) { sx = mc.player.getX(); sz = mc.player.getZ(); selfName = mc.player.getName().getString(); }
            CxEmoteAnim.start(selfName, e.ref);
            CxEmoteNet.send(e.ref);
            beginView(mc);
            msg(mc, "§7Emote: §f" + e.name + " §8· §7hareket edince durur");
        } else {
            endView(mc);   // sprey: baktığın yere atılır, karakter gösterilmez
            CxSpray.use(mc);
        }
    }

    public static void msg(Minecraft mc, String t) {
        try { if (mc.player != null) mc.player.sendOverlayMessage(Component.literal(t)); } catch (Throwable ignored) {}
    }

    /** Her istemci tikinde: çark tuşu ve hareketle iptal. */
    private static boolean prevWings = true;
    private static void pollWings(Minecraft mc) {
        if (mc.player == null || mc.screen != null) { prevWings = true; return; }
        boolean k = GLFW.glfwGetKey(mc.getWindow().handle(), CxClient.settings.wingsKey) == 1;
        if (k && !prevWings) {
            Boolean open = com.cubixora.cosmetics.Cubixora.toggleSelfWings(mc.player.getName().getString());
            msg(mc, open == null ? "§7Kanat seçili değil. Cubixora Launcher > Kozmetik'ten seçebilirsin." : open ? "§fKanatlar §aaçıldı" : "§fKanatlar §ckapandı");
        }
        prevWings = k;
    }

    public static void tick(Minecraft mc) {
        pollWings(mc);
        if (!CxClient.enabled || mc.player == null) { if (viewing) endView(mc); prevKey = true; return; }
        long nowMs = System.currentTimeMillis();
        if (nowMs > nextState) { nextState = nowMs + (CxBridge.last.items.isEmpty() ? 15000 : 120000); CxBridge.state(st -> {}); }
        CxEmoteNet.tick(mc);
        CxSpray.tick(mc);
        if (active != null && viewing && mc.screen == null && nowMs - startAt > 400 && CxEmoteAnim.time(selfName) < 0) { active = null; endView(mc); }
        if (mc.screen == null) {
            boolean k = GLFW.glfwGetKey(mc.getWindow().handle(), CxClient.settings.wheelKey) == 1;
            if (k && !prevKey) { ensure(); mc.setScreen(new CxWheelScreen()); }
            prevKey = k;
        } else prevKey = true;
        if (active != null && viewing && System.currentTimeMillis() - startAt > 300 && mc.screen == null) {
            double dx = mc.player.getX() - sx, dz = mc.player.getZ() - sz;
            boolean moved = dx * dx + dz * dz > 0.0025 || mc.player.getDeltaMovement().y > 0.05
                    || mc.options.keyUp.isDown() || mc.options.keyDown.isDown() || mc.options.keyLeft.isDown() || mc.options.keyRight.isDown()
                    || mc.options.keyJump.isDown() || mc.options.keyShift.isDown() || mc.options.keyAttack.isDown() || mc.options.keyUse.isDown();
            if (moved) endView(mc);
        }
    }
}
