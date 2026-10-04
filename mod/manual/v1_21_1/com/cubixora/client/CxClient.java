package com.cubixora.client;

import com.cubixora.cosmetics.Cubixora;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Cubixora Client durumu. Launcher, "Cubixora" profiliyle açılan oyunlarda config/cubixora/client.json yazar
 * (arkadaşlar, haberler, coin). Bu dosya yoksa client özellikleri kapalıdır ve oyun vanilla görünür.
 * Oyuncu ayarları config/cubixora/client-settings.json içinde saklanır.
 */
public final class CxClient {
    public static final class Friend { public String name = "", status = "offline", game = ""; }
    public static final class News { public String title = "", text = ""; public long at; }
    /** Tüm Cubixora ayarları (client-settings.json). Yeni alanlar eski dosyalarda varsayılan değerini alır. */
    public static final class Settings {
        // görseller
        public int accent = 0x547A58;
        public boolean lightTheme = false, intro = true, introSound = true, rain = true, rainSound = true;
        public int particles = 100;
        public boolean bgFpsLimit = false, skin3d = true, menuCentered = true;
        // nişangah
        public String cursor = "";   // Cubixora imleci (boş = sistem imleci)
        public boolean crossOn = false, crossDot = false, crossOutline = true, crossT = false;
        public int crossColor = 0x00FF00, crossGap = 2, crossLength = 5, crossThick = 1, crossOutlineThick = 1;
        // sesli sohbet
        public boolean proximity = true, callProximity = true, pushToTalk = false, aec = true, ans = true, agc = true;
        public int proximityRange = 48, vadThreshold = 5, outVolume = 100, micVolume = 100, bitrate = 24, pttKey = 86;
        public String micDevice = "", outDevice = "";
        /** Mikrofon: 0 kapalı, 1 ses algılama (otomatik), 2 bas-konuş. Duyma: 0 yalnız arkadaşlar, 1 herkes, 2 kimse. */
        public int micMode = -1, hearMode = 0;
        /** Oyuncu mikrofon modunu kendisi seçti mi? Seçmediyse mikrofon kapalı başlar (ilk girişte ses cihazı açılıp takılmasın). */
        public boolean micChosen = false;
        public boolean ptt() { return micMode == 2; }
        public boolean micOn() { return micMode > 0; }
        // sesler
        public int petVol = 100, notifVol = 100, killVol = 100, auraVol = 100, sprayVol = 100, emoteVol = 80;
        public boolean wheelMute = false;
        // bildirimler
        public boolean callNotif = true, msgNotif = true, notifSound = true;
        // kozmetikler
        public String font = "exo2"; public int voiceVer = 0;
        public boolean capeWave = true, joinAnim = true, cinematicJoin = true, petAttack = true, killAnim = true;
        // giriş
        public boolean autoLogin = true, streamerMode = false;
        // performans
        public boolean perfMode = false;
        public int wardrobeKey = 71;   // G
        public int wingsKey = 75;      // K: kanatları aç/kapat
        public int wheelKey = 66;      // B: emote / sprey çarkı
        public int voiceKey = 73;      // I: oyuncu sesleri paneli
        public java.util.List<String> muted = new java.util.ArrayList<>();
        public String[] emoteSlots = new String[8], spraySlots = new String[8];
        public java.util.Map<String, String> perfSaved = new java.util.HashMap<>();
        // HUD modülleri
        public java.util.Map<String, CxMods.Cfg> mods = new java.util.HashMap<>();
        public boolean fps = true, ping = true;

        public Settings copy() { return GSON.fromJson(GSON.toJson(this), Settings.class); }
    }

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    public static boolean enabled;
    public static boolean introShown;
    public static String playerName = "";
    public static long coins;
    /** Kurucu ya da süresi dolmamış Cubixora+ üyesi (launcher client.json içinde bildirir). */
    public static boolean plus;
    public static final List<Friend> FRIENDS = new ArrayList<>();
    public static final List<News> NEWS = new ArrayList<>();
    public static Settings settings = new Settings();
    public static int bridgePort;
    public static String bridgeToken = "";

    private CxClient() {}

    private static String launcherCursor;
    private static Path dir() { return FabricLoader.getInstance().getConfigDir().resolve("cubixora"); }

    @SuppressWarnings("deprecation")
    public static void init() {
        try {
            Path f = dir().resolve("client.json");
            if (Files.exists(f)) {
                JsonObject o = new JsonParser().parse(Files.readString(f)).getAsJsonObject();
                enabled = !o.has("enabled") || o.get("enabled").getAsBoolean();
                playerName = str(o, "name");
                coins = o.has("coins") ? o.get("coins").getAsLong() : 0;
                plus = o.has("plus") && o.get("plus").getAsBoolean();
                launcherCursor = o.has("cursor") ? str(o, "cursor") : null;
                if (o.has("bridge") && o.get("bridge").isJsonObject()) {
                    JsonObject b = o.getAsJsonObject("bridge");
                    bridgePort = b.has("port") ? b.get("port").getAsInt() : 0;
                    bridgeToken = str(b, "token");
                }
                FRIENDS.clear(); NEWS.clear();
                if (o.has("friends")) for (JsonElement e : o.getAsJsonArray("friends")) {
                    JsonObject x = e.getAsJsonObject(); Friend fr = new Friend();
                    fr.name = str(x, "name"); fr.status = str(x, "status"); fr.game = str(x, "game");
                    if (fr.status.isEmpty()) fr.status = "offline";
                    FRIENDS.add(fr);
                }
                if (o.has("news")) for (JsonElement e : o.getAsJsonArray("news")) {
                    JsonObject x = e.getAsJsonObject(); News n = new News();
                    n.title = str(x, "title"); n.text = str(x, "text"); n.at = x.has("at") ? x.get("at").getAsLong() : 0;
                    NEWS.add(n);
                }
            }
        } catch (Exception e) {
            Cubixora.LOG.warn("client.json okunamadı", e);
        }
        try {
            Path s = dir().resolve("client-settings.json");
            if (Files.exists(s)) settings = GSON.fromJson(Files.readString(s), Settings.class);
            if (settings == null) settings = new Settings();
            if (settings.voiceVer < 1) { settings.voiceVer = 1; settings.proximity = true; if (settings.proximityRange < 8) settings.proximityRange = 48; }   // uzaklaştıkça ses azalır
            if (settings.mods == null) settings.mods = new java.util.HashMap<>();
            if (!settings.micChosen) settings.micMode = 0;   // ayarlanmamışsa mikrofon kapalı (eskiden yakınlık açıkken kendiliğinden açılıyordu)
        } catch (Exception e) {
            settings = new Settings();
        }
        if (settings.micMode < 0) settings.micMode = 0;
        if (settings.cursor == null) settings.cursor = "";
        if (launcherCursor != null) CxCursor.fromLauncher(launcherCursor);
        if (enabled) Cubixora.LOG.info("Cubixora Client etkin ({} arkadaş, {} haber)", FRIENDS.size(), NEWS.size());
        // açılış sesi hazırlığı (ses cihazını açmak ağır): animasyon başlamadan arka planda yapılır, açılışta sadece başlatılır
        if (enabled && settings.intro && settings.introSound) CxBootSound.prepare();
    }

    public static void save() {
        try {
            Files.createDirectories(dir());
            Files.writeString(dir().resolve("client-settings.json"), GSON.toJson(settings));
        } catch (Exception e) {
            Cubixora.LOG.warn("client-settings.json yazılamadı", e);
        }
    }

    public static int onlineCount() {
        int n = 0;
        for (Friend f : FRIENDS) if (!"offline".equals(f.status)) n++;
        return n;
    }

    private static String str(JsonObject o, String k) {
        return o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsString() : "";
    }

    @SuppressWarnings("unused")
    private static JsonArray empty() { return new JsonArray(); }

    /** "1.21.8" gibi Minecraft sürümü (FabricLoader'dan; sürümler arası API farkından bağımsız). */
    public static String mcVersion() {
        return FabricLoader.getInstance().getModContainer("minecraft").map(m -> m.getMetadata().getVersion().getFriendlyString()).orElse("?");
    }
}
