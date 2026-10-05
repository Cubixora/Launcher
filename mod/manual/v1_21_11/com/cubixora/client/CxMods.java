package com.cubixora.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.util.hit.HitResult;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayList;
import java.util.Locale;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Cubixora Client modülleri (HUD göstergeleri). Her modül: ad, sekme, açıklama, varsayılan konum ve seçenekler.
 * Konumlar ekranın oransal (0..1) sol-üst köşesidir, böylece çözünürlük değişince bozulmaz.
 * Çizim yalnız etkin modüller için yapılır; veriler karede en fazla bir kez okunur.
 */
public final class CxMods {
    private CxMods() {}

    public static final String[] TABS = { "Arayüz", "Oynanış", "Görünüm", "Genel" };

    /** Kayıtlı (kullanıcıya ait) modül ayarı. */
    public static final class Cfg {
        public boolean on;
        public float x = -1, y = -1, scale = 1f;
        public Map<String, Integer> o = new HashMap<>();
        public int key;   // GLFW tuşu: basınca modülü aç/kapat (0 = yok)
        public int v;     // ayar sürümü (tek seferlik düzeltmeler için)
    }

    public static final class Opt {
        public static final int TOGGLE = 0, SLIDER = 1, CHOICE = 2, BUTTON = 3;
        public final String key, label; public final int type, def, min, max; public final String[] choices; public int div = 1;
        Opt(String key, String label, int type, int def, int min, int max, String[] choices) { this.key = key; this.label = label; this.type = type; this.def = def; this.min = min; this.max = max; this.choices = choices; }
        Opt div(int d) { this.div = d; return this; }
        static Opt toggle(String k, String l, boolean d) { return new Opt(k, l, TOGGLE, d ? 1 : 0, 0, 1, null); }
        static Opt slider(String k, String l, int d, int min, int max) { return new Opt(k, l, SLIDER, d, min, max, null); }
        static Opt choice(String k, String l, int d, String... c) { return new Opt(k, l, CHOICE, d, 0, c.length - 1, c); }
        static Opt button(String k, String l, String text) { return new Opt(k, l, BUTTON, 0, 0, 0, new String[] { text }); }
    }

    public abstract static class Mod {
        public final String id, name, tab, desc; public final float dx, dy; public final Opt[] opts;
        public int w = 60, h = 15, defKey; public boolean plus; float sx, sy, sc = 1f;
        void m(int w, int h) { this.w = w; this.h = h; }
        Mod key(int k) { this.defKey = k; return this; }
        Mod(String id, String name, String tab, String desc, float dx, float dy, Opt... opts) { this.id = id; this.name = name; this.tab = tab; this.desc = desc; this.dx = dx; this.dy = dy; this.opts = opts; }
        /** (0,0) noktasından çizer, w/h alanlarını günceller. preview: örnek veriyle (menüde). */
        abstract void draw(DrawContext c, TextRenderer tr, boolean preview);
        /** Dünyada görünmeyen (ayar yapan) modüller çizim yapmaz. */
        boolean visual() { return true; }
        void tick(MinecraftClient mc) {}
    }

    // ------------------------------------------------------------------ kayıt
    public static final List<Mod> ALL = new ArrayList<>();
    private static final Map<String, Mod> BY_ID = new HashMap<>();

    private static void add(Mod m) { ALL.add(m); BY_ID.put(m.id, m); }
    public static Mod get(String id) { return BY_ID.get(id); }

    // ------------------------------------------------------------------ ayar erişimi
    public static Cfg cfg(String id) {
        Map<String, Cfg> m = CxClient.settings.mods;
        Cfg c = m.get(id);
        if (c == null) {
            c = new Cfg();
            c.on = id.equals("fps") || id.equals("cps") || id.equals("ping") || id.equals("voice") || id.equals("zoom");
            Mod dm = BY_ID.get(id); if (dm != null) c.key = dm.defKey;
            m.put(id, c);
        }
        return c;
    }
    public static boolean on(String id) { Mod m = BY_ID.get(id); return cfg(id).on && (m == null || !m.plus || CxClient.plus); }
    /** Cubixora+ gerektiren modül ve oyuncu Plus değil. */
    public static boolean locked(Mod m) { return m != null && m.plus && !CxClient.plus; }
    /** Plus süresi dolduysa Plus'a özel modüller otomatik kapanır. */
    public static void enforcePlus() { if (CxClient.plus) return; for (Mod m : ALL) if (m.plus) cfg(m.id).on = false; }
    public static float posX(Mod m) { Cfg c = cfg(m.id); return c.x >= 0 ? c.x : m.dx; }
    public static float posY(Mod m) { Cfg c = cfg(m.id); return c.y >= 0 ? c.y : m.dy; }
    public static int opt(Mod m, String key) {
        Integer v = cfg(m.id).o.get(key);
        if (v != null) return v;
        for (Opt o : m.opts) if (o.key.equals(key)) return o.def;
        return 0;
    }
    public static boolean flag(Mod m, String key) { return opt(m, key) != 0; }
    public static void setOpt(Mod m, String key, int v) { cfg(m.id).o.put(key, v); if (m.id.equals("chat")) applyChat(); }
    public static int enabledCount() { int n = 0; for (Mod m : ALL) if (on(m.id)) n++; return n; }
    public static void reset(Mod m) { CxClient.settings.mods.remove(m.id); }

    // ------------------------------------------------------------------ canlı veri
    private static final long START = System.currentTimeMillis();
    private static long joined;
    private static final long[] clicksL = new long[64], clicksR = new long[64];
    private static int hL, hR;
    private static long plusChk; private static boolean vPtt, vHeld; private static double vLevel, vPeerLevel; private static float vSmMe, vSmPeer; private static boolean vMon; private static long vHold;
    private static boolean prevL, prevR, prevRs, prevG, prevVk, prevInit;
    private static final Map<String, Boolean> prevKey = new HashMap<>();
    private static int combo; private static long lastHit; private static double reach;
    private static double speed, lastX, lastZ; private static long lastSpeedAt;
    private static long swStart, swElapsed; private static boolean swRun;
    private static boolean vOn, vMuted, vSpeaking, vPeerSpeaking; private static String vPeer = "";
    private static final java.util.Set<String> cxNames = java.util.concurrent.ConcurrentHashMap.newKeySet();
    private static volatile java.util.List<String> vSpkN = new ArrayList<>(); private static volatile java.util.List<Double> vSpkL = new ArrayList<>(); private static volatile java.util.List<Boolean> vSpkS = new ArrayList<>();
    private static final Map<String, float[]> spk = new java.util.LinkedHashMap<>();
    /** Launcher'ın Cubixora hesabı olarak doğruladığı oyuncu mu? */
    public static volatile String vStatus = ""; public static volatile long vStatusAt;
    public static boolean speaking(String n) { if (n == null) return false; for (String x : vSpkN) if (x.equalsIgnoreCase(n)) return true; return false; }
    public static boolean isCx(String n) { return n != null && cxNames.contains(n.toLowerCase(Locale.ROOT)); }
    private static void spkTarget(String n, float lv, java.util.Set<String> live) { float[] a = spk.computeIfAbsent(n, k -> new float[3]); a[2] = lv; live.add(n); } private static long vPoll, vSeen, vDrawAt; private static boolean vBusy; private static float vFadeMe, vFadePeer;
    private static String mediaTitle = "", mediaArtist = ""; private static boolean mediaPlaying, mediaAd; private static long mediaPoll; private static double mediaPos, mediaDur; private static long mediaAt;
    private static final Map<String, Float> keyAnim = new HashMap<>();
    private static long frameAt = System.currentTimeMillis(); private static float dt = 0.016f;
    private static String ramA = "", ramB = ""; private static float ramFrac; private static long ramAt;
    private static Object savedSidebar; private static boolean sidebarHidden, chunkOn;

    public static void stopwatch(boolean toggle) {
        long now = System.currentTimeMillis();
        if (toggle) { if (swRun) { swElapsed += now - swStart; swRun = false; } else { swStart = now; swRun = true; } }
        else { swElapsed = 0; swStart = now; }
    }
    public static boolean stopwatchRunning() { return swRun; }

    private static int cps(long[] a) {
        long now = System.currentTimeMillis(); int n = 0;
        for (long t : a) if (t != 0 && now - t < 1000) n++;
        return n;
    }
    private static void click(long[] a, boolean left) {
        int i = left ? hL++ : hR++;
        a[i & 63] = System.currentTimeMillis();
    }

    /** Her karede bir kez: fare, tuş ve hareket verisini işler. */
    private static void sample(MinecraftClient mc) {
        long now = System.currentTimeMillis();
        dt = Math.min(0.1f, (now - frameAt) / 1000f); frameAt = now;
        if (mc.player == null) { joined = 0; return; }
        if (joined == 0) { joined = now; applyChat(); }
        fullbrightKeys(mc);
        long h = mc.getWindow().getHandle();
        if (mc.currentScreen == null) {
            boolean l = GLFW.glfwGetMouseButton(h, 0) == 1, r = GLFW.glfwGetMouseButton(h, 1) == 1;
            if (l && !prevL) {
                click(clicksL, true);
                if (mc.crosshairTarget != null && mc.crosshairTarget.getType() == HitResult.Type.ENTITY) {
                    combo++; lastHit = now;
                    reach = mc.player.getEyePos().distanceTo(mc.crosshairTarget.getPos());
                }
            }
            if (r && !prevR) click(clicksR, false);
            prevL = l; prevR = r;
            boolean rs = GLFW.glfwGetKey(h, GLFW.GLFW_KEY_RIGHT_SHIFT) == 1;
            if (rs && !prevRs) mc.setScreen(new CxModsScreen(null));
            prevRs = rs;
            boolean g = GLFW.glfwGetKey(h, CxClient.settings.wardrobeKey) == 1;
            if (g && !prevG) mc.setScreen(new CxWardrobeScreen(null, false));
            prevG = g;
            boolean vk = GLFW.glfwGetKey(h, CxClient.settings.voiceKey) == 1;
            if (vk && !prevVk) mc.setScreen(new CxPlayersScreen(null));
            prevVk = vk;
            vHeld = CxClient.settings.ptt() && GLFW.glfwGetKey(h, CxClient.settings.pttKey) == 1;
            for (Mod m : ALL) {
                Cfg cf = cfg(m.id);
                if (cf.key == 0 || m.id.equals("zoom") || m.id.equals("fullbright")) continue;   // Fullbright gerçek tuş atamasıyla çalışır (fullbrightKeys)
                if (reservedKey(cf.key)) {
                    // Dolap/ses/kanat/bas-konuş tuşuyla çakışan modül tuşu: modül tuşu boşa alınır 
                    int alt = 0;
                    CxEmote.msg(mc, "§e" + m.name + " tuşu başka bir Cubixora tuşuyla çakışıyordu" + (alt != 0 ? "; Y tuşuna taşındı." : "; tuş atamasını Modlar menüsünden seç."));
                    cf.key = alt; prevKey.put(m.id, true);
                    continue;
                }
                boolean k = GLFW.glfwGetKey(h, cf.key) == 1;
                if (k && !prevKey.getOrDefault(m.id, true)) { cf.on = !cf.on; toggled(mc, m, cf.on); }
                prevKey.put(m.id, k);
            }
            zoom(mc, h, true);
        } else { vHeld = false; prevL = prevR = false; prevRs = prevG = prevVk = true; for (Mod m : ALL) prevKey.put(m.id, true); zoom(mc, h, false); }
        if (combo > 0 && (mc.player.hurtTime > 0 || now - lastHit > comboWindow())) combo = 0;
        if (now - lastSpeedAt >= 100) {
            double dx = mc.player.getX() - lastX, dz = mc.player.getZ() - lastZ;
            double v = Math.sqrt(dx * dx + dz * dz) / ((now - lastSpeedAt) / 1000.0);
            speed = lastSpeedAt == 0 ? 0 : speed + (v - speed) * 0.4;
            if (speed < 0.02) speed = 0;
            lastX = mc.player.getX(); lastZ = mc.player.getZ(); lastSpeedAt = now;
        }
        // önceki istek dönmeden yenisi gönderilmez (launcher meşgulken istekler birikip takılma yapmasın)
        if (now - vPoll > 100 && CxBridge.available() && (!vBusy || now - vPoll > 2000)) {
            vPoll = now; vBusy = true;
            CxClient.Settings vs = CxClient.settings;
            com.google.gson.JsonObject cfgJ = new com.google.gson.JsonObject();
            cfgJ.addProperty("mic", Math.max(0, vs.micMode)); cfgJ.addProperty("hear", vs.hearMode); cfgJ.addProperty("prox", vs.proximity); cfgJ.addProperty("range", vs.proximityRange);
            cfgJ.addProperty("vad", vs.vadThreshold); cfgJ.addProperty("outVol", vs.outVolume); cfgJ.addProperty("micVol", vs.micVolume); cfgJ.addProperty("bitrate", vs.bitrate);
            cfgJ.addProperty("micDev", vs.micDevice == null ? "" : vs.micDevice); cfgJ.addProperty("outDev", vs.outDevice == null ? "" : vs.outDevice);
            cfgJ.addProperty("aec", vs.aec); cfgJ.addProperty("ans", vs.ans); cfgJ.addProperty("agc", vs.agc);
            String body = "{\"mute\":" + CxPlayersScreen.mutedJson() + ",\"ptt\":" + vHeld + ",\"s\":" + cfgJ + ",\"peers\":" + CxEmoteNet.voicePeersJson() + ",\"d\":{\"held\":" + vHeld + ",\"ptt\":" + vs.ptt() + ",\"cx\":" + cxNames.size() + ",\"von\":" + vOn + ",\"spk\":" + vSpkN.size() + ",\"age\":" + (vSeen == 0 ? -1 : System.currentTimeMillis() - vSeen) + ",\"hud\":" + on("voice") + "},\"srv\":\"" + srvJson(mc) + "\"}";
            CxBridge.raw("/voice", body, o -> {
                vBusy = false;
                if (o == null) return;
                if (o.has("cx") && o.get("cx").isJsonArray()) { cxNames.clear(); for (var e : o.getAsJsonArray("cx")) cxNames.add(e.getAsString().toLowerCase(Locale.ROOT)); }
                java.util.List<String> sn = new ArrayList<>(); java.util.List<Double> sl = new ArrayList<>(); java.util.List<Boolean> spf = new ArrayList<>();
                if (o.has("speakers") && o.get("speakers").isJsonArray()) for (var e : o.getAsJsonArray("speakers")) { var so = e.getAsJsonObject(); sn.add(so.get("n").getAsString()); sl.add(so.has("lv") ? so.get("lv").getAsDouble() : 0.1); spf.add(!so.has("sp") || so.get("sp").getAsBoolean()); }
                vSpkN = sn; vSpkL = sl; vSpkS = spf;
                vStatus = o.has("status") && !o.get("status").isJsonNull() ? o.get("status").getAsString() : (o.has("on") ? "" : "Launcher ses hizmeti yanıt vermiyor"); vStatusAt = System.currentTimeMillis();
                vOn = o.has("on") && o.get("on").getAsBoolean();
                vMuted = o.has("muted") && o.get("muted").getAsBoolean();
                vMon = o.has("mon") && o.get("mon").getAsBoolean();
                vLevel = o.has("level") ? o.get("level").getAsDouble() : 0;
                vPeerLevel = o.has("peerLevel") ? o.get("peerLevel").getAsDouble() : 0;
                vSpeaking = vOn && !vMon && o.has("speaking") && o.get("speaking").getAsBoolean();
                vPeerSpeaking = vOn && o.has("peerSpeaking") && o.get("peerSpeaking").getAsBoolean();
                vPeer = o.has("peer") && !o.get("peer").isJsonNull() ? o.get("peer").getAsString() : "";
                if (!o.has("speakers") && vPeerSpeaking && !vPeer.isEmpty()) { vSpkN = new ArrayList<>(java.util.List.of(vPeer)); vSpkL = new ArrayList<>(java.util.List.of(vPeerLevel)); }
                vSeen = System.currentTimeMillis();
                if (o.has("toast") && o.get("toast").isJsonObject()) { var to = o.getAsJsonObject("toast"); CxToast.push(to.has("t") ? to.get("t").getAsString() : "", to.has("s") ? to.get("s").getAsString() : ""); }
            });
        }
        if (now - mediaPoll > 3000 && on("media") && CxBridge.available()) {
            mediaPoll = now;
            CxBridge.raw("/media", "{}", o -> {
                if (o == null) return;
                mediaTitle = o.has("title") && !o.get("title").isJsonNull() ? o.get("title").getAsString() : "";
                mediaArtist = o.has("artist") && !o.get("artist").isJsonNull() ? o.get("artist").getAsString() : "";
                mediaPlaying = o.has("playing") && o.get("playing").getAsBoolean();
                mediaAd = o.has("ad") && o.get("ad").getAsBoolean();
                mediaPos = o.has("pos") ? o.get("pos").getAsDouble() : 0;
                mediaDur = o.has("dur") ? o.get("dur").getAsDouble() : 0;
                mediaAt = System.currentTimeMillis();
            });
        }
    }

    private static int fbSynced = Integer.MIN_VALUE;
    /**
     * Fullbright tuşu Seçenekler > Kontroller > Cubixora altında "Fullbright" olarak görünür (varsayılan Y).
     * Kontroller menüsünde ya da Cubixora Modlar menüsünde değiştirilen tuş diğerine de yansır.
     */
    private static void fullbrightKeys(MinecraftClient mc) {
        net.minecraft.client.option.KeyBinding kb = CxKeys.fullbright;
        if (kb == null) return;
        Cfg cf = cfg("fullbright");
        if (cf.v < 1) {                       // eski sürümlerde B (emote çarkı) ile çakışıp silinen tuşu Y'ye taşı
            if (cf.key == 0 || cf.key == GLFW.GLFW_KEY_B || reservedKey(cf.key)) cf.key = GLFW.GLFW_KEY_Y;
            cf.v = 1; CxClient.save();
        }
        int bound = net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper.getBoundKeyOf(kb).getCode();
        int want = cf.key == 0 ? -1 : cf.key;
        if (fbSynced == Integer.MIN_VALUE || want != fbSynced) {   // ilk açılış ya da Modlar menüsünde değişti
            if (bound != want) { kb.setBoundKey(want < 0 ? net.minecraft.client.util.InputUtil.UNKNOWN_KEY : net.minecraft.client.util.InputUtil.Type.KEYSYM.createFromCode(want)); net.minecraft.client.option.KeyBinding.updateKeysByCode(); try { mc.options.write(); } catch (Throwable ignored) {} }
            fbSynced = want;
        } else if (bound != want) {                                // Kontroller menüsünde değişti
            cf.key = bound < 0 ? 0 : bound; fbSynced = bound; CxClient.save();
        }
        while (kb.wasPressed()) {
            if (mc.currentScreen != null) continue;
            cf.on = !cf.on; toggled(mc, get("fullbright"), cf.on); CxClient.save();
        }
    }

    /** Bağlı olunan sunucu adresi (partner sunucu süresi için); JSON'a güvenli. */
    private static final java.util.regex.Pattern SRV_BAD = java.util.regex.Pattern.compile("[^a-z0-9._:\\-\\[\\]]");
    private static String srvRaw, srvOut = "";
    private static String srvJson(MinecraftClient mc) {   // saniyede 10 kez çağrılır: adres değişmedikçe hazır sonuç
        try {
            String a = com.cubixora.cosmetics.Compat.serverAddress(mc);
            if (a == null) return "";
            if (!a.equals(srvRaw)) { srvOut = SRV_BAD.matcher(a.toLowerCase(java.util.Locale.ROOT)).replaceAll(""); srvRaw = a; }
            return srvOut;
        } catch (Throwable t) { return ""; }
    }

    private static boolean reservedKey(int k) {
        return k == CxClient.settings.wardrobeKey || k == CxClient.settings.voiceKey || k == CxClient.settings.wingsKey
            || k == CxClient.settings.wheelKey || (CxClient.settings.ptt() && k == CxClient.settings.pttKey);
    }

    private static void toggled(MinecraftClient mc, Mod m, boolean now) {
        if (!(m.id.equals("fullbright") || m.id.equals("sprint")) || mc.player == null) return;
        CxEmote.msg(mc, "§7" + m.name + ": " + (now ? "§aAçık" : "§cKapalı"));
    }

    private static boolean zoomOn, zoomHook, zoomHeld; private static int zoomBase; private static float zoomCur = 1f, zoomTgt = 1f; private static double zoomWheel, sensBase = -1;
    private static volatile long mixinSeen;
    /** GameRenderer mixin'i çağırır: görüş açısı çarpanı (1 = zoom yok). Mixin çalışıyorsa seçenekteki FOV'a dokunulmaz. */
    public static float zoomFactor() { mixinSeen = System.currentTimeMillis(); return zoomCur > 1.001f ? 1f / zoomCur : 1f; }
    /** Zoom: tuşa basılı tutarken fare tekerleği yakınlığı değiştirir (çok daha fazla yakınlaşır), bırakınca eski haline döner. */
    private static void zoom(MinecraftClient mc, long h, boolean allowed) {
        zoomHeld = allowed && mc.currentScreen == null && on("zoom") && cfg("zoom").key != 0 && GLFW.glfwGetKey(h, cfg("zoom").key) == 1;
        if (!zoomHook) {
            zoomHook = true;
            try {
                var prev = GLFW.glfwSetScrollCallback(h, null);
                GLFW.glfwSetScrollCallback(h, (w, x, y) -> { if (zoomHeld) zoomWheel += y; else if (prev != null) prev.invoke(w, x, y); });
            } catch (Throwable ignored) {}
        }
        try {
            boolean viaMixin = System.currentTimeMillis() - mixinSeen < 800;
            var fov = mc.options.getFov();
            var sens = mc.options.getMouseSensitivity();
            if (zoomHeld && !zoomOn) {
                zoomOn = true; zoomBase = fov.getValue(); zoomCur = 1f; zoomWheel = 0;
                zoomTgt = 1.8f + opt(get("zoom"), "lvl") * 0.6f;
                sensBase = sens.getValue();
            }
            if (!zoomOn) return;
            float maxMul = viaMixin ? 24f : Math.max(1.2f, zoomBase / 30f);
            if (zoomHeld) {
                if (zoomWheel != 0) { zoomTgt *= (float) Math.pow(1.18, zoomWheel); zoomWheel = 0; }
                zoomTgt = Math.max(1.15f, Math.min(maxMul, zoomTgt));
            }
            float tgt = zoomHeld ? zoomTgt : 1f;
            zoomCur *= (float) Math.pow(tgt / zoomCur, Math.min(1f, dt * 14f));
            if (Math.abs(tgt - zoomCur) < 0.01f) zoomCur = tgt;
            // yakınlaştıkça fare hassasiyeti düşer (nişan almak kolay olsun)
            if (sensBase >= 0) { double want = zoomCur > 1.01f ? sensBase / Math.pow(zoomCur, 0.8) : sensBase; if (Math.abs(sens.getValue() - want) > 0.004) sens.setValue(Math.max(0.0, Math.min(1.0, want))); }
            if (!viaMixin) {
                int v = Math.round(zoomBase / zoomCur);
                if (fov.getValue() != v) fov.setValue(v);
            }
            if (!zoomHeld && zoomCur <= 1.005f) {
                zoomCur = 1f; zoomOn = false;
                if (sensBase >= 0) { sens.setValue(sensBase); sensBase = -1; }
                if (!viaMixin && fov.getValue() != zoomBase) fov.setValue(zoomBase);
            }
        } catch (Throwable ignored) { zoomOn = false; zoomCur = 1f; }
    }

    private static boolean fbApplied, spApplied;
    private static void gameplay(MinecraftClient mc) {
        if (mc.player == null) { fbApplied = false; return; }
        boolean fb = on("fullbright");
        if (fb) {
            if (!mc.player.hasStatusEffect(StatusEffects.NIGHT_VISION)) mc.player.addStatusEffect(new StatusEffectInstance(StatusEffects.NIGHT_VISION, -1, 0, true, false, false));
            fbApplied = true;
        } else if (fbApplied) {
            fbApplied = false;
            var e = mc.player.getStatusEffect(StatusEffects.NIGHT_VISION);
            if (e != null && e.isInfinite()) mc.player.removeStatusEffect(StatusEffects.NIGHT_VISION);
        }
        boolean sp = on("sprint");
        if (sp) { if (mc.currentScreen == null && mc.options.forwardKey.isPressed()) mc.options.sprintKey.setPressed(true); spApplied = true; }
        else if (spApplied) { spApplied = false; mc.options.sprintKey.setPressed(false); }
    }

    private static int comboWindow() { int v = opt(get("combo"), "win"); return v <= 0 ? 3000 : v; }

    /** Sohbet modülü seçeneklerini oyun ayarlarına uygular. */
    public static void applyChat() {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.options == null || !on("chat")) return;
        Mod m = get("chat");
        try {
            mc.options.getChatOpacity().setValue(opt(m, "opacity") / 100.0);
            mc.options.getChatScale().setValue(opt(m, "scale") / 100.0);
            mc.options.getChatWidth().setValue(opt(m, "width") / 100.0);
            mc.options.getChatHeightFocused().setValue(opt(m, "height") / 100.0);
            mc.options.getTextBackgroundOpacity().setValue(flag(m, "clear") ? 0.0 : opt(m, "bgop") / 100.0);
        } catch (Throwable ignored) {}
    }

    private static void setChunkBorders(MinecraftClient mc, boolean want) {
        if (want == chunkOn) return;
        chunkOn = want;
        try { mc.debugHudEntryList.setEntryVisibility(net.minecraft.client.gui.hud.debug.DebugHudEntries.CHUNK_BORDERS, want ? net.minecraft.client.gui.hud.debug.DebugHudEntryVisibility.ALWAYS_ON : net.minecraft.client.gui.hud.debug.DebugHudEntryVisibility.NEVER); } catch (Throwable ignored) {}
    }

    private static void control(MinecraftClient mc) {
        if (mc.world == null) return;
        setChunkBorders(mc, on("chunk"));
        gameplay(mc);
        try {
            var sb = mc.world.getScoreboard();
            boolean hide = on("scoreboard") && flag(get("scoreboard"), "hide");
            if (hide) {
                var cur = sb.getObjectiveForSlot(net.minecraft.scoreboard.ScoreboardDisplaySlot.SIDEBAR);
                if (cur != null) { savedSidebar = cur; sb.setObjectiveSlot(net.minecraft.scoreboard.ScoreboardDisplaySlot.SIDEBAR, null); sidebarHidden = true; }
            } else if (sidebarHidden) {
                sidebarHidden = false;
                if (savedSidebar instanceof net.minecraft.scoreboard.ScoreboardObjective o) sb.setObjectiveSlot(net.minecraft.scoreboard.ScoreboardDisplaySlot.SIDEBAR, o);
                savedSidebar = null;
            }
        } catch (Throwable ignored) {}
        try {
            if (on("bossbar") && flag(get("bossbar"), "hide")) mc.inGameHud.getBossBarHud().clear();
        } catch (Throwable ignored) {}
    }

    // ------------------------------------------------------------------ ortak çizim
    static final int PILL = 0xD0131A2A, PILL_TEXT = 0xFFFFFFFF, MUTED = 0xFF9AA3AD;

    private static void box(DrawContext c, Mod m, int w, int h) {
        m.w = w; m.h = h;
        CxUi.round(c, 0, 0, w, h, h > 24 ? 8 : 6, PILL);
    }

    /** Tek satırlık gösterge: ortalanmış metin. */
    private static void pill(DrawContext c, TextRenderer tr, Mod m, String text) { pill(c, tr, m, text, 0, PILL_TEXT); }
    private static void pill(DrawContext c, TextRenderer tr, Mod m, String text, int dot, int color) {
        int w = tr.getWidth(text) + 16 + (dot != 0 ? 9 : 0);
        box(c, m, w, 17);
        int x = 8;
        if (dot != 0) { CxUi.round(c, 8, 7, 4, 4, 2, dot); x += 9; }
        c.drawText(tr, text, x, 5, color, true);
    }

    private static String two(long v) { return v < 10 ? "0" + v : String.valueOf(v); }
    private static String hms(long sec) { return two(sec / 3600) + ":" + two((sec / 60) % 60) + ":" + two(sec % 60); }
    private static String dur(long sec) { return sec >= 3600 ? (sec / 3600) + ":" + two((sec / 60) % 60) + ":" + two(sec % 60) : (sec / 60) + ":" + two(sec % 60); }
    private static final Locale TR = new Locale("tr");
    private static String f(String fmt, Object... a) { return String.format(TR, fmt, a); }
    private static long xyzKey = Long.MIN_VALUE; private static String xyzStr = "";
    private static String xyz(double x, double y, double z) {
        long k = Math.round(x * 10) * 73856093L ^ Math.round(y * 100) * 19349663L ^ Math.round(z * 10) * 83492791L;
        if (k != xyzKey || xyzStr.isEmpty()) { xyzKey = k; xyzStr = f("XYZ: %.1f / %.2f / %.1f", x, y, z); }
        return xyzStr;
    }

    private static final String[] ITEM_NAMES = { "Altın Elma", "Ender İncisi", "Ok", "Elmas", "Ölümsüzlük Totemi", "Obsidyen", "Zümrüt", "Netherit Külçesi", "Deneyim Şişesi" };

    // ------------------------------------------------------------------ modüller
    static {
        add(new Mod("fps", "FPS Sayacı", "Arayüz", "Sol üst köşede FPS (ve opsiyonel olarak ping) gösterir.", 0.01f, 0.015f, Opt.toggle("ping", "Pingi göster", true)) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                MinecraftClient mc = MinecraftClient.getInstance();
                int fps = p ? 83 : mc.getCurrentFps();
                String s = fps + " FPS";
                if (flag(this, "ping")) { int ms = ping(mc, p); if (ms >= 0) s += " · " + ms + " ms"; }
                pill(c, tr, this, s, fps >= 60 ? CxUi.ONLINE : fps >= 30 ? CxUi.IDLE : CxUi.DND, PILL_TEXT);
            }
        });
        add(new Mod("keys", "Tuş Göstergesi", "Oynanış", "Hareket tuşlarını + fare butonlarını ekranda gösterir.", 0.01f, 0.62f) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                MinecraftClient mc = MinecraftClient.getInstance();
                var o = mc.options;
                key(c, tr, "w", 18, 0, 16, 16, !p && o.forwardKey.isPressed(), kn(o.forwardKey, "W"));
                key(c, tr, "a", 0, 18, 16, 16, !p && o.leftKey.isPressed(), kn(o.leftKey, "A"));
                key(c, tr, "s", 18, 18, 16, 16, !p && o.backKey.isPressed(), kn(o.backKey, "S"));
                key(c, tr, "d", 36, 18, 16, 16, !p && o.rightKey.isPressed(), kn(o.rightKey, "D"));
                key(c, tr, "l", 0, 36, 16, 16, !p && prevL, "L");
                key(c, tr, "sp", 18, 36, 16, 16, !p && o.jumpKey.isPressed(), "_");
                key(c, tr, "r", 36, 36, 16, 16, !p && prevR, "R");
                key(c, tr, "sh", 0, 54, 52, 11, !p && o.sneakKey.isPressed(), "SHIFT");
                w = 52; h = 65;
            }
            void key(DrawContext c, TextRenderer tr, String id, int x, int y, int kw, int kh, boolean down, String label) {
                float v = keyAnim.getOrDefault(id, 0f);
                v = CxUi.approach(v, down ? 1 : 0, 26, dt);
                keyAnim.put(id, v);
                CxUi.round(c, x, y, kw, kh, 4, CxUi.mix(PILL, CxStyle.accent(), v * 0.9f));
                int col = CxUi.mix(0xFFFFFFFF, 0xFF0B0D10, v);
                if (kh < 14) CxUi.textScaled(c, tr, label, x + (kw - tr.getWidth(label) * 0.7f) / 2f, y + (kh - 6) / 2f + 0.5f, 0.7f, col, false);
                else c.drawText(tr, label, x + (kw - tr.getWidth(label)) / 2, y + (kh - 7) / 2, col, true);
            }
            String kn(net.minecraft.client.option.KeyBinding k, String d) {
                String s = k.getBoundKeyLocalizedText().getString();
                return s.length() > 2 ? d : s.toUpperCase();
            }
        });
        add(new Mod("armor", "Zırh Göstergesi", "Oynanış", "Zırhınızı ve sol elinizdeki eşyayı dayanıklılığıyla gösterir.", 0.01f, 0.40f, Opt.toggle("hand", "Eldeki eşyayı göster", true), Opt.toggle("num", "Dayanıklılık sayısı", false), Opt.toggle("horiz", "Yatay dizilim", true)) {
            final EquipmentSlot[] SLOTS = { EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND };
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                MinecraftClient mc = MinecraftClient.getInstance();
                List<ItemStack> st = new ArrayList<>();
                for (int i = 0; i < (flag(this, "hand") ? 5 : 4); i++) {
                    ItemStack s = p ? preview(i) : mc.player == null ? ItemStack.EMPTY : mc.player.getEquippedStack(SLOTS[i]);
                    if (!s.isEmpty()) st.add(s);
                }
                if (st.isEmpty()) { w = 0; h = 0; return; }
                boolean num = flag(this, "num"), horiz = flag(this, "horiz");
                int n = st.size();
                String[] txt = new String[n];
                int tw = 0;
                for (int i = 0; i < n; i++) {
                    ItemStack s = st.get(i);
                    txt[i] = num && s.isDamageable() ? String.valueOf(s.getMaxDamage() - s.getDamage()) : "";
                    tw = Math.max(tw, tr.getWidth(txt[i]));
                }
                int cell = horiz ? Math.max(18, tw + 4) : 18;
                int W = horiz ? n * cell + 8 : 8 + 16 + (num ? tw + 6 : 0) + 4;
                int H = horiz ? (num ? 31 : 24) : n * 18 + 6;
                box(c, this, W, H);
                for (int i = 0; i < n; i++) {
                    ItemStack s = st.get(i);
                    int x = horiz ? 4 + i * cell + (cell - 16) / 2 : 4, y = horiz ? 4 : 3 + i * 18;
                    c.drawItem(s, x, y);
                    c.drawStackOverlay(tr, s, x, y);
                    if (!txt[i].isEmpty()) {
                        if (horiz) c.drawText(tr, txt[i], 4 + i * cell + (cell - tr.getWidth(txt[i])) / 2, 22, MUTED, true);
                        else c.drawText(tr, txt[i], x + 20, y + 4, MUTED, true);
                    }
                }
            }
            ItemStack preview(int i) { return new ItemStack(i == 0 ? Items.DIAMOND_HELMET : i == 1 ? Items.DIAMOND_CHESTPLATE : i == 2 ? Items.DIAMOND_LEGGINGS : i == 3 ? Items.DIAMOND_BOOTS : Items.DIAMOND_SWORD); }
        });
        add(new Mod("potion", "İksir Göstergesi", "Oynanış", "Aktif iksir etkilerinizi süresiyle gösterir.", 0.01f, 0.30f, Opt.toggle("time", "Süreyi göster", true), Opt.toggle("lvl", "Seviyeyi göster", true)) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                MinecraftClient mc = MinecraftClient.getInstance();
                List<String[]> rows = new ArrayList<>(); List<Integer> cols = new ArrayList<>();
                if (p) { rows.add(new String[] { "Hız II", "1:24" }); cols.add(0xFF7CAFC6); }
                else if (mc.player != null) {
                    for (var e : mc.player.getStatusEffects()) {
                        if (fbApplied && e.isInfinite() && e.getEffectType() == StatusEffects.NIGHT_VISION) continue;
                        String n = e.getEffectType().value().getName().getString();
                        if (flag(this, "lvl") && e.getAmplifier() > 0) n += " " + roman(e.getAmplifier() + 1);
                        rows.add(new String[] { n, e.isInfinite() ? "--" : dur(e.getDuration() / 20) });
                        cols.add(0xFF000000 | e.getEffectType().value().getColor());
                        if (rows.size() >= 8) break;
                    }
                }
                if (rows.isEmpty()) { w = 0; h = 0; return; }
                int nw = 0, tw = 0;
                for (String[] r : rows) { nw = Math.max(nw, tr.getWidth(r[0])); tw = Math.max(tw, tr.getWidth(r[1])); }
                boolean time = flag(this, "time");
                int W = 22 + nw + (time ? 12 + tw : 0), H = rows.size() * 13 + 6;
                box(c, this, W, H);
                for (int i = 0; i < rows.size(); i++) {
                    int y = 5 + i * 13;
                    CxUi.round(c, 8, y + 1, 5, 5, 2, cols.get(i));
                    c.drawText(tr, rows.get(i)[0], 18, y, PILL_TEXT, true);
                    if (time) c.drawText(tr, rows.get(i)[1], W - 8 - tr.getWidth(rows.get(i)[1]), y, MUTED, true);
                }
            }
        });
        add(new Mod("media", "Medya Oynatıcı HUD", "Arayüz", "Çalan müziğin adını, sanatçısını ve süresini ekranda gösterir.", 0.01f, 0.80f, Opt.toggle("artist", "Sanatçıyı göster", true), Opt.toggle("bar", "İlerleme çubuğu", true), Opt.toggle("state", "Duraklatma / reklam işareti", true)) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                String t = p ? "Cubixora Sessions" : mediaTitle, a = p ? "Örnek parça" : mediaArtist;
                boolean playing = p || mediaPlaying, st = flag(this, "state"), ad = !p && mediaAd && st, paused = !playing && st && !ad;
                if (t.isEmpty()) { w = 0; h = 0; return; }
                t = tr.trimToWidth(t, 130); a = tr.trimToWidth(a, 130);
                boolean art = flag(this, "artist") && !a.isEmpty(), bar = flag(this, "bar");
                int tw = Math.max(tr.getWidth(t), art ? tr.getWidth(a) : 0);
                int tagW = ad ? CxUi.capsW(tr, "Reklam") + 12 : paused ? 12 : 0;
                int W = 34 + tw + 10 + (tagW > 0 ? tagW + 6 : 0), H = (art ? 28 : 19) + (bar ? 6 : 0);
                box(c, this, W, H);
                long now = System.currentTimeMillis();
                int base = (H - (bar ? 6 : 0)) / 2 + 5;
                for (int i = 0; i < 3; i++) {
                    int bh = playing ? 3 + (int) Math.round((Math.sin(now / 160.0 + i * 1.9) * 0.5 + 0.5) * 9) : 3;
                    c.fill(9 + i * 5, base - bh, 12 + i * 5, base, ad ? 0xFFFF9F43 : paused ? CxUi.IDLE : CxStyle.accent());
                }
                if (ad) {
                    int bx = W - 8 - tagW, by = (H - (bar ? 6 : 0)) / 2 - 6;
                    CxUi.round(c, bx, by, tagW, 12, 5, 0x33FF9F43); CxUi.outline(c, bx, by, tagW, 12, 5, 0x99FF9F43);
                    CxUi.capsBox(c, tr, "Reklam", bx, by, tagW, 12, 0xFFFFB066);
                } else if (paused) {
                    int bx = W - 8 - 8, by = (H - (bar ? 6 : 0)) / 2 - 5;
                    CxUi.round(c, bx, by, 3, 10, 1, CxUi.IDLE); CxUi.round(c, bx + 5, by, 3, 10, 1, CxUi.IDLE);
                }
                c.drawText(tr, t, 29, 5, PILL_TEXT, true);
                if (art) c.drawText(tr, a, 29, 16, MUTED, true);
                if (bar) {
                    double pos = p ? 36 : mediaPos + (mediaPlaying ? (now - mediaAt) / 1000.0 : 0), dur = p ? 100 : mediaDur;
                    float f = dur > 0 ? (float) Math.max(0, Math.min(1, pos / dur)) : 0;
                    CxUi.round(c, 29, H - 8, W - 38, 3, 1, 0x33FFFFFF);
                    if (f > 0) CxUi.round(c, 29, H - 8, Math.max(2, Math.round((W - 38) * f)), 3, 1, CxStyle.accent());
                }
            }
        });
        add(new Mod("ping", "Ping Göstergesi", "Genel", "Sunucuya gecikmenizi (ms) gösterir.", 0.01f, 0.07f) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                int ms = ping(MinecraftClient.getInstance(), p);
                pill(c, tr, this, ms < 0 ? "-- ms" : ms + " ms", ms < 0 ? 0xFF6B6B75 : ms <= 80 ? CxUi.ONLINE : ms <= 160 ? CxUi.IDLE : CxUi.DND, PILL_TEXT);
            }
        });
        add(new Mod("clock", "Saat Göstergesi", "Genel", "Gerçek dünya veya oyun içi saati ekranda gösterir.", 0.01f, 0.125f, Opt.choice("type", "Zaman Tipi", 0, "Gerçek Saat", "Oyun Saati"), Opt.toggle("sec", "Saniyeyi göster", true)) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                String s;
                if (opt(this, "type") == 1) {
                    MinecraftClient mc = MinecraftClient.getInstance();
                    long t = mc.world == null ? 0 : mc.world.getTimeOfDay() % 24000L;
                    long mins = ((t + 6000L) % 24000L) * 60L / 1000L;
                    s = two(mins / 60) + ":" + two(mins % 60);
                } else {
                    java.time.LocalTime t = java.time.LocalTime.now();
                    s = two(t.getHour()) + ":" + two(t.getMinute()) + (flag(this, "sec") ? ":" + two(t.getSecond()) : "");
                }
                pill(c, tr, this, s);
            }
        });
        add(new Mod("cps", "CPS Göstergesi", "Oynanış", "Saniyede yapılan tıklama sayısını (CPS) gösterir.", 0.01f, 0.18f, Opt.toggle("right", "Sağ tık göster", true)) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                String s = "L:" + (p ? 0 : cps(clicksL)) + (flag(this, "right") ? " • R:" + (p ? 0 : cps(clicksR)) : "");
                pill(c, tr, this, s);
            }
        });
        add(new Mod("coords", "Koordinat Göstergesi", "Genel", "XYZ koordinatlarını, biyomu ve baktığınız yönü gösterir.", 0.01f, 0.235f, Opt.toggle("dir", "Yönü göster", true), Opt.toggle("biome", "Biyomu göster", true)) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                MinecraftClient mc = MinecraftClient.getInstance();
                boolean ok = !p && mc.player != null;
                double x = p ? 75.5 : ok ? mc.player.getX() : 0, y = p ? 63 : ok ? mc.player.getY() : 0, z = p ? -118.5 : ok ? mc.player.getZ() : 0;
                String s = xyz(x, y, z);
                if (flag(this, "dir")) s += " • " + dirName(p ? 135 : ok ? mc.player.getYaw() : 0);
                if (flag(this, "biome")) s += " • " + (p ? "Savanna" : ok ? biome(mc) : "-");
                pill(c, tr, this, s);
            }
        });
        add(new Mod("direction", "Yön Göstergesi", "Genel", "Ekranın üst kısmında pusula benzeri yön gösterir.", 0.5f, 0.02f, Opt.toggle("deg", "Derece göster", true)) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                MinecraftClient mc = MinecraftClient.getInstance();
                float yaw = p ? 154 : mc.player == null ? 0 : mc.player.getYaw();
                float heading = (((yaw + 180f) % 360f) + 360f) % 360f;
                int W = 130, H = 15, cx = W / 2;
                m(W, H);
                CxUi.round(c, 0, 0, W, H, 6, PILL);
                for (int d = -75; d <= 75; d += 15) {
                    float ang = Math.round(heading / 15f) * 15f + d;
                    float off = (ang - heading) * 1.0f;
                    int x = cx + Math.round(off);
                    int a = ((Math.round(ang) % 360) + 360) % 360;
                    String lab = a == 0 ? "K" : a == 90 ? "D" : a == 180 ? "G" : a == 270 ? "B" : a == 45 ? "KD" : a == 135 ? "GD" : a == 225 ? "GB" : a == 315 ? "KB" : "";
                    if (Math.abs(off) > 56) continue;
                    float fade = 1f - Math.min(1f, Math.abs(off) / 62f);
                    if (lab.isEmpty()) c.fill(x, 8, x + 1, 12, CxUi.alpha(0xFFFFFFFF, 0.35f * fade));
                    else c.drawText(tr, lab, x - tr.getWidth(lab) / 2, 4, CxUi.alpha(a % 90 == 0 ? 0xFFFFFFFF : MUTED, fade), true);
                }
                c.fill(cx, 1, cx + 1, 5, CxStyle.accent());
                h = H;
                if (flag(this, "deg")) {
                    String s = Math.round(heading) + "°";
                    int w2 = tr.getWidth(s) + 10;
                    CxUi.round(c, cx - w2 / 2, H + 2, w2, 12, 5, PILL);
                    c.drawText(tr, s, cx - tr.getWidth(s) / 2, H + 4, PILL_TEXT, true);
                    h = H + 14;
                }
            }
        });
        add(new Mod("day", "Gün Sayacı", "Genel", "Dünyada toplam kaç gün geçirdiğinizi gösterir.", 0.01f, 0.345f) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                MinecraftClient mc = MinecraftClient.getInstance();
                long d = p ? 0 : mc.world == null ? 0 : mc.world.getTimeOfDay() / 24000L;
                pill(c, tr, this, "Gün: " + d);
            }
        });
        add(new Mod("ram", "RAM Göstergesi", "Genel", "Oyunun bellek (RAM) kullanımını gösterir.", 0.01f, 0.40f, Opt.toggle("bar", "Doluluk çubuğu", true), Opt.toggle("alloc", "Ayrılan belleği göster", true)) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                long now = System.currentTimeMillis();
                if (p) { ramA = "RAM 693 MB / 4.0 GB"; ramB = "Ayrılan 1.0 GB · %17"; ramFrac = 0.17f; }
                else if (now - ramAt > 500) {
                    Runtime r = Runtime.getRuntime();
                    long used = (r.totalMemory() - r.freeMemory()) >> 20, max = r.maxMemory() >> 20, tot = r.totalMemory() >> 20;
                    ramA = f("RAM %d MB / %.1f GB", used, max / 1024.0);
                    ramB = f("Ayrılan %.1f GB · %%%d", tot / 1024.0, used * 100 / Math.max(1, max));
                    ramFrac = Math.min(1f, used / (float) Math.max(1, max));
                    ramAt = now;
                }
                boolean alloc = flag(this, "alloc"), bar = flag(this, "bar");
                int W = Math.max(tr.getWidth(ramA), alloc ? tr.getWidth(ramB) : 0) + 16;
                int H = 6 + 10 + (alloc ? 10 : 0) + (bar ? 7 : 0) + (alloc || bar ? 2 : 0) + 3;
                if (!alloc && !bar) H = 17;
                box(c, this, W, H);
                int y = 5;
                c.drawText(tr, ramA, 8, y, PILL_TEXT, true); y += 10;
                if (alloc) { c.drawText(tr, ramB, 8, y, MUTED, true); y += 10; }
                if (bar) {
                    CxUi.round(c, 8, y + 1, W - 16, 3, 1, 0x33FFFFFF);
                    CxUi.round(c, 8, y + 1, Math.max(2, Math.round((W - 16) * ramFrac)), 3, 1, ramFrac < 0.7f ? CxUi.ONLINE : ramFrac < 0.9f ? CxUi.IDLE : CxUi.DND);
                }
            }
        });
        add(new Mod("playtime", "Oynama Süresi", "Genel", "Seans boyunca oyunda ne kadar süre geçirdiğinizi gösterir.", 0.01f, 0.455f) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                long s = p ? 221 : (System.currentTimeMillis() - (joined == 0 ? START : joined)) / 1000;
                pill(c, tr, this, "Süre: " + hms(s));
            }
        });
        add(new Mod("serverip", "Sunucu IP Göstergesi", "Genel", "Bağlı olduğunuz sunucunun adresini gösterir.", 0.01f, 0.51f, Opt.toggle("port", "Portu gizle", true)) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                MinecraftClient mc = MinecraftClient.getInstance();
                String ip = p ? "play.cubixora.net" : mc.getCurrentServerEntry() == null ? "Tek Oyunculu" : mc.getCurrentServerEntry().address;
                if (flag(this, "port") && ip.contains(":")) ip = ip.substring(0, ip.indexOf(':'));
                pill(c, tr, this, "IP: " + ip);
            }
        });
        add(new Mod("speed", "Hız Göstergesi", "Oynanış", "Karakterinizin anlık hareket hızını (blok/saniye) ölçer.", 0.01f, 0.565f, Opt.choice("unit", "Birim", 0, "m/s", "km/sa")) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                double v = p ? 0 : speed;
                pill(c, tr, this, "Hız: " + (opt(this, "unit") == 0 ? f("%.2f m/s", v) : f("%.1f km/sa", v * 3.6)));
            }
        });
        add(new Mod("stopwatch", "Kronometre", "Genel", "Oyun içi işlerinizde kullanabileceğiniz bir kronometre ekler.", 0.01f, 0.69f) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                long ms = p ? 0 : swElapsed + (swRun ? System.currentTimeMillis() - swStart : 0);
                pill(c, tr, this, "Kronometre: " + two(ms / 60000) + ":" + two((ms / 1000) % 60) + "." + (ms % 1000) / 100);
            }
        });
        add(new Mod("voice", "Konuşma Göstergesi", "Genel", "Sesli sohbette konuşan kişiyi ekranın sağ kenarında, ses seviyesine göre hareket eden çubuklarla gösterir.", 1f, 0.38f, Opt.toggle("me", "Kendi adımı göster", true), Opt.toggle("idle", "Konuşmasam da göster", false), Opt.toggle("peers", "Bağlı oyuncuları her zaman göster", true)) {
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                long now = System.currentTimeMillis();
                float dt = vDrawAt == 0 ? 0 : Math.min(0.1f, (now - vDrawAt) / 1000f); vDrawAt = now;
                boolean stale = now - vSeen > 2500;
                boolean showMe = flag(this, "me"), idle = flag(this, "idle"), ptt = CxClient.settings.ptt();
                boolean talk;
                if (vMon) { double thr = Math.max(0.008, CxClient.settings.vadThreshold / 100.0 * 0.3); if (vLevel > thr) vHold = now + 350; talk = vHold > now; }
                else talk = vSpeaking;
                boolean meOn = ptt ? vHeld : (vOn && !stale && (talk || vMuted));
                float tMe = p ? 1 : (showMe && (meOn || idle)) ? 1 : 0;
                vFadeMe = CxUi.approach(vFadeMe, tMe, 14, dt);
                // diğer konuşanlar (birden çok kişi olabilir)
                java.util.Set<String> live = new java.util.HashSet<>();
                if (p) spkTarget("Arkadaş", 0.5f + 0.4f * (float) Math.sin(now / 210.0 + 1), live);
                else if (vOn && !stale) {
                    java.util.List<String> sn = vSpkN; java.util.List<Double> sl = vSpkL;
                    java.util.List<Boolean> ss = vSpkS; boolean always = flag(this, "peers");
                    for (int i = 0; i < sn.size() && i < sl.size(); i++) { boolean sp = i >= ss.size() || ss.get(i); if (sp) spkTarget(sn.get(i), (float) Math.min(1, Math.max(0.25, sl.get(i) / 0.14)), live); else if (always) spkTarget(sn.get(i), 0f, live); }
                    if (idle && !vPeer.isEmpty() && !live.contains(vPeer)) spkTarget(vPeer, 0f, live);
                }
                float lvMe = p ? 0.55f + 0.35f * (float) Math.sin(now / 260.0) : (ptt ? (vHeld ? (float) Math.min(1, vLevel / 0.16) : 0) : talk ? (float) Math.min(1, vLevel / 0.16) : 0);
                vSmMe = CxUi.approach(vSmMe, lvMe, lvMe > vSmMe ? 30 : 12, dt);
                String me = MinecraftClient.getInstance().getSession().getUsername();
                int w = tr.getWidth(me) + 58;
                for (var it = spk.entrySet().iterator(); it.hasNext(); ) {
                    var en = it.next(); float[] a2 = en.getValue(); boolean lv = live.contains(en.getKey());
                    a2[0] = CxUi.approach(a2[0], lv ? 1 : 0, 14, dt);
                    float tl = lv ? a2[2] : 0; a2[1] = CxUi.approach(a2[1], tl, tl > a2[1] ? 30 : 12, dt);
                    if (!lv && a2[0] < 0.01f) { it.remove(); continue; }
                    w = Math.max(w, tr.getWidth(en.getKey()) + 58);
                }
                boolean mActive = p || (ptt ? vHeld : talk);
                int y = 0, rows = 0;
                if (vFadeMe > 0.03f) { row(c, tr, me, mActive && !vMuted, vMuted, vSmMe, y, w, vFadeMe, now); y += 24; rows++; }
                for (var en : spk.entrySet()) {
                    float[] a2 = en.getValue();
                    if (a2[0] > 0.03f && rows < 6) { row(c, tr, en.getKey(), p || a2[1] > 0.02f, false, a2[1], y, w, a2[0], now); y += 24; rows++; }
                }
                if (rows == 0) { this.w = 0; this.h = 0; } else { this.w = w; this.h = y - 4; }
            }
            void row(DrawContext c, TextRenderer tr, String name, boolean active, boolean muted, float lv, int y, int w, float f, long now) {
                int col = muted ? 0xFFE5534B : active ? CxUi.ONLINE : 0xFF8B95A1;
                int ox = Math.round((1 - f) * 14);   // sağdan kayarak girer
                int x0 = ox, x1 = w + ox;
                CxUi.round(c, x0, y, x1 - x0, 20, 8, CxUi.alpha(0xE60D121B, f));
                c.fillGradient(x0 + 4, y + 1, x1 - 4, y + 9, CxUi.alpha(0x14FFFFFF, f), 0);
                CxUi.outline(c, x0, y, x1 - x0, 20, 8, CxUi.alpha(active || muted ? col : 0x33FFFFFF, f * (active || muted ? 0.75f : 1f)));
                // mikrofon (yumuşak, yeniden çizilmiş simge)
                int ic = CxUi.alpha(col, f);
                CxUi.tex(c, muted ? CxUi.MIC_OFF : CxUi.MIC, x0 + 7, y + 4, 0, 0, 12, 12, 64, 64, 64, 64, ic);
                c.drawText(tr, name, x0 + 24, y + 6, CxUi.alpha(PILL_TEXT, f), true);
                // ses seviyesi: küçük, yuvarlak uçlu, dikey ortalı 4 çubuk (adla aynı hizada)
                for (int i = 0; i < 4; i++) {
                    float shape = 0.55f + 0.45f * (float) Math.abs(Math.sin(now / 110.0 + i * 1.7));
                    int bh = 3 + Math.round(lv * shape * 7);
                    int bx = x1 - 10 - (4 - i) * 4 + 2;
                    CxUi.round(c, bx, y + 10 - bh / 2, 2, bh, 1, CxUi.alpha(lv > 0.02f ? col : 0xFF4A525C, f));
                }
            }
        });
        add(new Mod("combo", "Combo Sayacı", "Oynanış", "PvP sırasında üst üste kaç vuruş yaptığınızı sayar.", 0.12f, 0.015f, Opt.slider("win", "Sıfırlanma Süresi (ms)", 3000, 500, 10000)) {
            void draw(DrawContext c, TextRenderer tr, boolean p) { pill(c, tr, this, (p ? 0 : combo) + " Combo"); }
        });
        add(new Mod("reach", "Menzil Göstergesi (Reach)", "Oynanış", "PvP yaparken rakibe kaç blok uzaktan vurduğunuzu anlık gösterir.", 0.12f, 0.07f) {
            void draw(DrawContext c, TextRenderer tr, boolean p) { pill(c, tr, this, "Reach: " + f("%.2f", p ? 0.0 : reach)); }
        });
        add(new Mod("chunk", "Chunk Sınırları", "Görünüm", "F3+G kombinasyonuna gerek kalmadan chunk sınırlarını görselleştirir.", 0, 0) {
            boolean visual() { return false; }
            void draw(DrawContext c, TextRenderer tr, boolean p) {}
        });
        add(new Mod("bossbar", "Boss Bar Kontrolü", "Görünüm", "Boss can barlarını gizlemenize yarar.", 0, 0, Opt.toggle("hide", "Hepsini Gizle", false)) {
            boolean visual() { return false; }
            void draw(DrawContext c, TextRenderer tr, boolean p) {}
        });
        add(new Mod("chat", "Sohbet Özelleştirici", "Görünüm", "Minecraft sohbet penceresini şeffaflık ve boyut ayarlarıyla özelleştirir.", 0, 0,
                Opt.toggle("clear", "Şeffaf Arka Plan", false), Opt.slider("bgop", "Arka Plan Opaklığı", 50, 0, 100).div(100), Opt.slider("opacity", "Metin Opaklığı", 100, 10, 100).div(100),
                Opt.slider("scale", "Ölçek", 100, 40, 150).div(100), Opt.slider("width", "Genişlik", 100, 30, 100).div(100), Opt.slider("height", "Yükseklik", 100, 30, 100).div(100)) {
            boolean visual() { return false; }
            void draw(DrawContext c, TextRenderer tr, boolean p) {}
        });
        add(new Mod("itemtrack", "Eşya Takipçisi", "Oynanış", "Envanterinizdeki belirli eşyaların (Altın Elma, Ender İncisi, Ok) sayısını ekranda gösterir.", 0.12f, 0.125f,
                Opt.toggle("i0", ITEM_NAMES[0], true), Opt.toggle("i1", ITEM_NAMES[1], true), Opt.toggle("i2", ITEM_NAMES[2], true), Opt.toggle("i3", ITEM_NAMES[3], false), Opt.toggle("i4", ITEM_NAMES[4], false),
                Opt.toggle("i5", ITEM_NAMES[5], false), Opt.toggle("i6", ITEM_NAMES[6], false), Opt.toggle("i7", ITEM_NAMES[7], false), Opt.toggle("i8", ITEM_NAMES[8], false)) {
            final Item[] ITEMS = { Items.GOLDEN_APPLE, Items.ENDER_PEARL, Items.ARROW, Items.DIAMOND, Items.TOTEM_OF_UNDYING, Items.OBSIDIAN, Items.EMERALD, Items.NETHERITE_INGOT, Items.EXPERIENCE_BOTTLE };
            void draw(DrawContext c, TextRenderer tr, boolean p) {
                MinecraftClient mc = MinecraftClient.getInstance();
                int[] cnt = new int[ITEMS.length];
                if (!p && mc.player != null) {
                    var inv = mc.player.getInventory();
                    for (int i = 0; i < inv.size(); i++) {
                        ItemStack s = inv.getStack(i);
                        if (s.isEmpty()) continue;
                        for (int k = 0; k < ITEMS.length; k++) if (s.isOf(ITEMS[k])) cnt[k] += s.getCount();
                    }
                }
                int W = 8;
                List<Integer> sel = new ArrayList<>();
                for (int k = 0; k < ITEMS.length; k++) if (flag(this, "i" + k)) { sel.add(k); W += 20 + tr.getWidth(String.valueOf(cnt[k])) + 8; }
                if (sel.isEmpty()) { w = 0; h = 0; return; }
                box(c, this, W, 22);
                int x = 8;
                for (int k : sel) {
                    c.drawItem(new ItemStack(ITEMS[k]), x - 2, 3);
                    String s = String.valueOf(cnt[k]);
                    c.drawText(tr, s, x + 17, 7, cnt[k] == 0 ? MUTED : PILL_TEXT, true);
                    x += 20 + tr.getWidth(s) + 8;
                }
            }
        });
        add(new Mod("fullbright", "Fullbright", "Görünüm", "Karanlığı tamamen kaldırır; mağara ve geceyi gündüz gibi gösterir. Tuşa basınca açılıp kapanır.", 0, 0) {
            boolean visual() { return false; }
            void draw(DrawContext c, TextRenderer tr, boolean p) {}
        }.key(GLFW.GLFW_KEY_Y));
        add(new Mod("zoom", "Zoom", "Görünüm", "Tuşa basılı tutarken görüntüyü yakınlaştırır; basılıyken fare tekerleğiyle yakınlığı artırıp azaltırsın. Bırakınca eski haline döner.", 0, 0, Opt.slider("lvl", "Başlangıç Yakınlığı (tekerlekle değişir)", 1, 0, 4)) {
            boolean visual() { return false; }
            void draw(DrawContext c, TextRenderer tr, boolean p) {}
        }.key(GLFW.GLFW_KEY_C));
        add(new Mod("sprint", "Otomatik Koşu", "Oynanış", "İleri tuşuna basınca otomatik koşar; koşu tuşuna basman gerekmez.", 0, 0) {
            boolean visual() { return false; }
            void draw(DrawContext c, TextRenderer tr, boolean p) {}
        });
        add(new Mod("scoreboard", "Skor Tablosu", "Görünüm", "Sunucunun sağdaki skor tablosunu gizler veya gösterir.", 0, 0, Opt.toggle("hide", "Skor Tablosunu Gizle", true)) {
            boolean visual() { return false; }
            void draw(DrawContext c, TextRenderer tr, boolean p) {}
        });
    }

    private static int ping(MinecraftClient mc, boolean preview) {
        if (preview) return 32;
        if (mc.getNetworkHandler() != null && mc.player != null) {
            var e = mc.getNetworkHandler().getPlayerListEntry(mc.player.getUuid());
            if (e != null) return e.getLatency();
        }
        return -1;
    }

    private static String biome(MinecraftClient mc) {
        try {
            var key = mc.world.getBiome(mc.player.getBlockPos()).getKey();
            if (key.isPresent()) {
                String path = key.get().getValue().getPath().replace('_', ' ');
                return path.isEmpty() ? "-" : Character.toUpperCase(path.charAt(0)) + path.substring(1);
            }
        } catch (Throwable ignored) {}
        return "-";
    }

    private static String roman(int n) { switch (n) { case 2: return "II"; case 3: return "III"; case 4: return "IV"; case 5: return "V"; default: return String.valueOf(n); } }

    /** Yönü Türkçe adıyla verir (yaw 0 = güney). */
    static String dirName(float yaw) {
        float y = ((yaw % 360) + 360) % 360;
        String[] f = { "Güney", "Güneybatı", "Batı", "Kuzeybatı", "Kuzey", "Kuzeydoğu", "Doğu", "Güneydoğu" };
        return f[Math.round(y / 45f) % 8];
    }

    // ------------------------------------------------------------------ HUD çizimi
    /** InGameHud içinden çağrılır. */
    public static void render(DrawContext c) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (!CxClient.enabled || mc.player == null) return;
        sample(mc);
        control(mc);
        CxToast.render(c);   // üst bildirim (HUD gizliyken de görünür)
        if (mc.options.hudHidden || mc.getDebugHud().shouldShowDebugHud()) return;
        if (CxCrosshair.active() && mc.options.getPerspective().isFirstPerson()) CxCrosshair.draw(c, mc.getWindow().getScaledWidth() / 2, mc.getWindow().getScaledHeight() / 2, CxClient.settings, 1);
        if (mc.currentScreen instanceof CxHudEditor || mc.currentScreen instanceof CxModsScreen) return;
        int sw = mc.getWindow().getScaledWidth(), sh = mc.getWindow().getScaledHeight();
        TextRenderer tr = mc.textRenderer;
        for (Mod m : ALL) {
            Cfg cf = cfg(m.id);
            if (!on(m.id) || !m.visual()) continue;
            float px = posX(m) * sw, py = posY(m) * sh;   // ekran dışına taşmasın
            px = Math.max(0, Math.min(px, sw - m.w * cf.scale - (px > sw / 2f ? 4 : 0))); py = Math.max(0, Math.min(py, sh - m.h * cf.scale));
            drawAt(c, tr, m, px, py, cf.scale, false);
        }
    }

    /** Menü/editör için: canlı veriyle çizer; modül şu an boşsa (ör. zırh yok) örnek veriyle çizer ki düzenlenebilsin. */
    public static void drawLive(DrawContext c, TextRenderer tr, Mod m, float x, float y, float scale) {
        boolean sample = MinecraftClient.getInstance().player == null;
        drawAt(c, tr, m, x, y, scale, sample);
        if (!sample && (m.w <= 0 || m.h <= 0)) drawAt(c, tr, m, x, y, scale, true);
    }

    /** Verilen noktada, ölçekle çizer. Boyut (m.w/m.h) ölçeksizdir. */
    public static void drawAt(DrawContext c, TextRenderer tr, Mod m, float x, float y, float scale, boolean preview) {
        m.sx = x; m.sy = y; m.sc = scale;
        CxUi.scaled(c, x, y, scale, () -> m.draw(c, tr, preview));
    }
}
