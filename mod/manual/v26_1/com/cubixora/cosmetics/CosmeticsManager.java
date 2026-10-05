package com.cubixora.cosmetics;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.resources.Identifier;
import org.jetbrains.annotations.Nullable;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Oyuncu adına göre kozmetikleri bulur:
 *  - kendi oyuncumuz: launcher'ın yazdığı config/cubixora/self.json
 *  - diğer oyuncular: Firestore'daki herkese açık cosmetics/{ad} belgesi (config/cubixora/cloud.json)
 * Cubixora kullanmayan oyuncuların belgesi olmadığı için onlarda hiçbir şey değişmez.
 */
public final class CosmeticsManager {
    private static final long REFRESH_MS = 5 * 60 * 1000L;
    private static final long MISS_RETRY_MS = 60 * 60 * 1000L;

    private static final Map<String, PlayerCosmetics> CACHE = new ConcurrentHashMap<>();
    private static final Map<String, Long> MISSES = new ConcurrentHashMap<>();
    private static final Set<String> PENDING = ConcurrentHashMap.newKeySet();
    /** Aynı anda en fazla bu kadar istek: kalabalık sunucuda TAB açılınca yüzlerce istek birden gidip oyunu takmasın. */
    private static final int MAX_PARALLEL = 4;
    private static final java.util.concurrent.ConcurrentLinkedQueue<String> QUEUE = new java.util.concurrent.ConcurrentLinkedQueue<>();
    private static final java.util.concurrent.atomic.AtomicInteger RUNNING = new java.util.concurrent.atomic.AtomicInteger();
    /** Son yanıtın özeti: değişmediyse skin/pelerin dokusu yeniden çözülüp yüklenmez (5 dakikada bir takılma olmasın). */
    private static final Map<String, Integer> SRC = new ConcurrentHashMap<>();
    private static final Set<String> KNOWN_CAPES = Set.of("cubixora", "galaksi", "lav", "gunbatimi", "buz", "zumrut");
    private static final Set<String> KNOWN_WINGS = Set.of("ejderha", "melek", "gece");

    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    @Nullable private static String projectId, apiKey, fsBase;
    @Nullable private static String selfName;

    private CosmeticsManager() {}

    /** Eski Gson sürümlerinde (1.17) JsonParser.parseString yok; bu yöntem her sürümde çalışır. */
    @SuppressWarnings("deprecation")
    private static com.google.gson.JsonElement json(String s) { return new JsonParser().parse(s); }

    private static Path dir() { return FabricLoader.getInstance().getConfigDir().resolve("cubixora"); }

    public static void init() {
        try {
            Path cloud = dir().resolve("cloud.json");
            if (Files.exists(cloud)) {
                JsonObject o = json(Files.readString(cloud)).getAsJsonObject();
                if (o.has("projectId") && o.has("apiKey")) {
                    projectId = o.get("projectId").getAsString();
                    apiKey = o.get("apiKey").getAsString();
                }
                // Supabase sürümü: bulut okumaları launcher üzerinden (yerel köprü) yapılır
                fsBase = o.has("fsBase") ? o.get("fsBase").getAsString() : null;
            }
        } catch (Exception e) {
            Cubixora.LOG.warn("cloud.json okunamadı", e);
        }
        loadSelf();
    }

    private static void loadSelf() {
        try {
            Path file = dir().resolve("self.json");
            if (!Files.exists(file)) return;
            JsonObject o = json(Files.readString(file)).getAsJsonObject();
            selfName = o.get("name").getAsString();
            String key = selfName.toLowerCase(Locale.ROOT);
            String skin = o.has("skin") && !o.get("skin").isJsonNull() ? o.get("skin").getAsString() : null;
            PlayerCosmetics c = parse(key, o, skin, ostr(o, "capeTex"), ostr(o, "wingsTex"));
            c.local = true;
            CACHE.put(key, c);
        } catch (Exception e) {
            Cubixora.LOG.warn("self.json okunamadı", e);
        }
    }

    @Nullable public static String selfName() { return selfName; }
    @Nullable public static String projectId() { return projectId; }
    @Nullable public static String apiKey() { return apiKey; }
    @Nullable public static String fsBase() { return fsBase; }

    /** Oyun içi gardroptan anında değişiklik: kendi kaydımızı günceller (bulut kaydını launcher yapar). */
    public static void setSelf(@Nullable String cape, @Nullable String wings, @Nullable Boolean pet) {
        if (selfName == null) return;
        String key = selfName.toLowerCase(Locale.ROOT);
        PlayerCosmetics c = CACHE.get(key);
        if (c == null) { c = new PlayerCosmetics(); c.local = true; c.loadedAt = System.currentTimeMillis(); CACHE.put(key, c); }
        if (cape != null) c.capeTexture = KNOWN_CAPES.contains(cape) ? Compat.id("cubixora", "textures/cape/" + cape + ".png") : null;
        if (wings != null) c.wingsTexture = KNOWN_WINGS.contains(wings) ? Compat.id("cubixora", "textures/wings/" + wings + ".png") : null;
        if (pet != null) c.pet = pet;
    }
    /** Oyun içi gardroptan efekt değişimi: hemen görünür (boş = çıkar). */
    public static void setSelfEffect(@Nullable String effect) {
        if (selfName == null || effect == null) return;
        String key = selfName.toLowerCase(Locale.ROOT);
        PlayerCosmetics c = CACHE.get(key);
        if (c == null) { c = new PlayerCosmetics(); c.local = true; c.loadedAt = System.currentTimeMillis(); CACHE.put(key, c); }
        c.effect = effect;
    }
    public static void setSelfProps(@Nullable String hat, @Nullable String fly) {
        if (selfName == null) return;
        String key = selfName.toLowerCase(Locale.ROOT);
        PlayerCosmetics c = CACHE.get(key);
        if (c == null) { c = new PlayerCosmetics(); c.local = true; c.loadedAt = System.currentTimeMillis(); CACHE.put(key, c); }
        if (hat != null) c.hat = hat;
        if (fly != null) c.fly = fly;
    }
    /** Oyun içi skin stüdyosundan: kendi skinimizi anında değiştirir (dataUrl null ise launcher'ın verdiği skine döner). */
    public static void setSelfSkin(@Nullable String dataUrl, boolean slim) {
        if (selfName == null) return;
        String key = selfName.toLowerCase(Locale.ROOT);
        PlayerCosmetics c = CACHE.get(key);
        if (c == null) { c = new PlayerCosmetics(); c.local = true; c.loadedAt = System.currentTimeMillis(); CACHE.put(key, c); }
        c.slim = slim;
        if (dataUrl != null && dataUrl.startsWith(PNG)) registerSkin(key, c, dataUrl.substring(PNG.length()));
        else loadSelf();
    }
    /** Oyun içi gardrop: mağazaya admin'in yüklediği pelerin dokusu varsa hazır (uygulama içi) dokunun yerine geçer. */
    public static void setSelfCapeTex(@Nullable String dataUrl) {
        if (selfName == null || dataUrl == null || !dataUrl.startsWith(PNG)) return;
        String key = selfName.toLowerCase(Locale.ROOT);
        PlayerCosmetics c = CACHE.get(key);
        if (c == null) return;
        registerDynamic(key, "cape", dataUrl, c, false);
    }
    public static boolean knownCape(String id) { return KNOWN_CAPES.contains(id); }
    public static boolean knownWings(String id) { return KNOWN_WINGS.contains(id); }

    /** Oyun her karede çağırır; bu yüzden sadece önbelleğe bakar, gerekirse arka planda sorgu başlatır. */
    @Nullable
    public static PlayerCosmetics get(@Nullable String name) {
        if (name == null || name.isEmpty()) return null;
        String key = name.toLowerCase(Locale.ROOT);
        PlayerCosmetics c = CACHE.get(key);
        long now = System.currentTimeMillis();
        if (c != null) {
            if (!c.local && now - c.loadedAt > REFRESH_MS) fetch(key);
            return c;
        }
        Long miss = MISSES.get(key);
        if (miss == null || now - miss > MISS_RETRY_MS) fetch(key);
        return null;
    }

    public static void reloadAll() {
        MISSES.clear();
        SRC.clear();
        for (Map.Entry<String, PlayerCosmetics> e : CACHE.entrySet()) {
            if (!e.getValue().local) fetch(e.getKey());
        }
        loadSelf();
    }

    private static void fetch(String key) {
        if (projectId == null || apiKey == null || !key.matches("[a-z0-9_]{3,16}")) {
            MISSES.put(key, System.currentTimeMillis());
            return;
        }
        if (!PENDING.add(key)) return;
        QUEUE.add(key);
        pump();
    }

    private static void pump() {
        String k;
        while (RUNNING.get() < MAX_PARALLEL && (k = QUEUE.poll()) != null) {
            RUNNING.incrementAndGet();
            try { start(k); } catch (Throwable t) { PENDING.remove(k); RUNNING.decrementAndGet(); }
        }
    }

    private static void start(String key) {
        String url = fsBase != null ? fsBase + "/documents/cosmetics/" + URLEncoder.encode(key, StandardCharsets.UTF_8)
                : "https://firestore.googleapis.com/v1/projects/" + projectId
                + "/databases/(default)/documents/cosmetics/" + URLEncoder.encode(key, StandardCharsets.UTF_8)
                + "?key=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(10)).GET().build();
        HTTP.sendAsync(req, HttpResponse.BodyHandlers.ofString()).whenComplete((res, err) -> {
            try {
                if (err != null || res.statusCode() != 200) {
                    MISSES.put(key, System.currentTimeMillis());
                    PlayerCosmetics old = CACHE.get(key);
                    if (res != null && res.statusCode() == 404 && old != null && !old.local) { CACHE.remove(key); SRC.remove(key); }
                    return;
                }
                int sig = res.body().hashCode();
                PlayerCosmetics same = CACHE.get(key);
                if (same != null && !same.local && Integer.valueOf(sig).equals(SRC.get(key))) {   // değişmemiş: sadece süreyi yenile
                    same.loadedAt = System.currentTimeMillis();
                    MISSES.remove(key);
                    return;
                }
                JsonObject fields = json(res.body()).getAsJsonObject().getAsJsonObject("fields");
                String data = str(fields, "data");
                String skin = str(fields, "skin");
                String capeTex = str(fields, "capeTex");
                String wingsTex = str(fields, "wingsTex");
                JsonObject o = data == null || data.isEmpty() ? new JsonObject() : json(data).getAsJsonObject();
                PlayerCosmetics old = CACHE.get(key);
                if (old != null && old.local) return; // kendi kaydımız öncelikli
                CACHE.put(key, parse(key, o, skin, capeTex, wingsTex));
                SRC.put(key, sig);
                MISSES.remove(key);
            } catch (Exception e) {
                Cubixora.LOG.debug("Kozmetik okunamadı: {}", key, e);
                MISSES.put(key, System.currentTimeMillis());
            } finally {
                PENDING.remove(key);
                RUNNING.decrementAndGet();
                pump();
            }
        });
    }

    @Nullable
    private static String str(@Nullable JsonObject fields, String name) {
        if (fields == null || !fields.has(name)) return null;
        JsonObject v = fields.getAsJsonObject(name);
        return v.has("stringValue") ? v.get("stringValue").getAsString() : null;
    }

    @Nullable
    private static String ostr(JsonObject o, String name) {
        return o.has(name) && o.get(name).isJsonPrimitive() ? o.get(name).getAsString() : null;
    }

    private static PlayerCosmetics parse(String key, JsonObject o, @Nullable String skinDataUrl,
                                         @Nullable String capeTex, @Nullable String wingsTex) {
        PlayerCosmetics c = new PlayerCosmetics();
        c.loadedAt = System.currentTimeMillis();
        c.slim = o.has("slim") && o.get("slim").getAsBoolean();
        String cape = o.has("cape") ? o.get("cape").getAsString() : "";
        String wings = o.has("wings") ? o.get("wings").getAsString() : "";
        if (KNOWN_CAPES.contains(cape)) c.capeTexture = Compat.id("cubixora", "textures/cape/" + cape + ".png");
        if (KNOWN_WINGS.contains(wings)) c.wingsTexture = Compat.id("cubixora", "textures/wings/" + wings + ".png");
        c.pet = o.has("pet") && o.get("pet").getAsBoolean();
        c.hat = id(o, "hat"); c.fly = id(o, "fly"); c.effect = id(o, "effect");
        c.petRight = o.has("petSide") && "right".equals(o.get("petSide").getAsString());
        c.wingsOpenDefault = !o.has("wingsOpen") || o.get("wingsOpen").getAsBoolean();
        if (o.has("wingSpeed")) c.wingSpeed = clamp(o.get("wingSpeed").getAsFloat(), 0.2f, 2.5f);
        if (o.has("capeWave")) c.capeWave = clamp(o.get("capeWave").getAsFloat(), 0f, 2f);
        // mağazaya sonradan eklenen (mod içinde olmayan) pelerin/kanat: dokusu belgeden gelir
        if ((c.capeTexture == null || capeTex != null) && cape.matches("[a-z0-9_]{1,32}")) registerDynamic(key, "cape", capeTex, c, false);
        if ((c.wingsTexture == null || wingsTex != null) && wings.matches("[a-z0-9_]{1,32}")) registerDynamic(key, "wings", wingsTex, c, true);
        if (skinDataUrl != null && skinDataUrl.startsWith("data:image/png;base64,")) {
            registerSkin(key, c, skinDataUrl.substring("data:image/png;base64,".length()));
        }
        return c;
    }

    private static String id(JsonObject o, String k) {
        String v = ostr(o, k);
        return v != null && v.matches("[a-z0-9_]{1,24}") ? v : "";
    }

    private static float clamp(float v, float lo, float hi) { return Math.max(lo, Math.min(hi, v)); }

    private static final String PNG = "data:image/png;base64,";
    /** Yüksek çözünürlüklü (HD) dinamik pelerin dokularının katsayısı (64x32'nin kaç katı). */
    public static final java.util.Map<Identifier, Integer> SCALE = new java.util.concurrent.ConcurrentHashMap<>();

    /** Mağaza dokusunu (data URL) çözüp kaydeder; hazır olunca pelerin/kanat alanına yazar. */
    private static void registerDynamic(String key, String kind, @Nullable String dataUrl, PlayerCosmetics c, boolean wings) {
        if (dataUrl == null || !dataUrl.startsWith(PNG)) return;
        try {
            String b64 = dataUrl.substring(PNG.length());
            byte[] bytes = Base64.getDecoder().decode(b64);
            if (bytes.length > 200 * 1024) return;
            NativeImage img = NativeImage.read(new ByteArrayInputStream(bytes));
            if (img.getWidth() > 1024 || img.getHeight() > 1024 || img.getWidth() < 16) { img.close(); return; }
            Identifier id = Compat.id("cubixora", "dyn/" + kind + "_" + Integer.toHexString(b64.hashCode() & 0xfffffff));
            if (!wings) SCALE.put(id, Math.max(1, Math.min(16, img.getWidth() / 64)));
            Minecraft.getInstance().execute(() -> {
                Compat.registerTexture(id, img);
                if (wings) c.wingsTexture = id; else c.capeTexture = id;
            });
        } catch (Exception e) {
            Cubixora.LOG.debug("{} dokusu çözülemedi: {}", kind, key, e);
        }
    }

    /** PNG'yi çözer ve dokuyu ana (render) iş parçacığında kaydeder. */
    private static void registerSkin(String key, PlayerCosmetics c, String base64) {
        try {
            byte[] bytes = Base64.getDecoder().decode(base64);
            if (bytes.length > 64 * 1024) return;
            NativeImage img = NativeImage.read(new ByteArrayInputStream(bytes));
            if (img.getWidth() != 64 || img.getHeight() != 64) { img.close(); return; }
            Identifier id = Compat.id("cubixora", "skin/" + key + "_" + Integer.toHexString(base64.hashCode() & 0xffffff));
            Minecraft.getInstance().execute(() -> {
                Compat.registerTexture(id, img);
                c.skinTexture = id;
            });
        } catch (Exception e) {
            Cubixora.LOG.debug("Skin çözülemedi: {}", key, e);
        }
    }
}
