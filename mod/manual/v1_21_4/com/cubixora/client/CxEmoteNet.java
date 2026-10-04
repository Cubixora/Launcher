package com.cubixora.client;

import com.cubixora.cosmetics.CosmeticsManager;
import com.cubixora.cosmetics.Cubixora;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.particle.ParticleTypes;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Emote ağ katmanı: kendi emotemizi launcher köprüsüyle buluta yazar; yakındaki Cubixora oyuncularının
 * emotelerini bulutta yoklar (saniyede ~1 kez, tek istek) ve oynatır. Ayrıca kalp efektini üretir.
 */
public final class CxEmoteNet {
    private CxEmoteNet() {}

    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(6)).build();
    private static final Map<String, Long> LAST = new ConcurrentHashMap<>();
    private static volatile boolean inFlight;
    private static long nextPoll;
    private static int tickN;

    public static void send(String id) {
        if (!CxBridge.available()) return;
        CxBridge.raw("/emote", "{\"id\":\"" + (id == null ? "" : id.replace("\"", "")) + "\"}", null);
    }

    public static void tick(MinecraftClient mc) {
        if (mc.world == null || mc.player == null) return;
        long now = System.currentTimeMillis();
        if (now >= nextPoll && !inFlight) { nextPoll = now + 1100; poll(mc, now); }
        if (CxEmoteAnim.any() && (++tickN & 1) == 0) hearts(mc);
        // ateş efekti oyuncu katmanında çiziliyor (CxFlames); burada tik başına iş yok
    }

    /** Ses ağı için: oyuncu listesindeki herkes + yüklü olanların uzaklığı (blok); yüklü değilse -1. */
    public static String voicePeersJson() {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player == null || mc.world == null) return "[]";
        java.util.HashMap<String, Double> dist = new java.util.HashMap<>();
        for (AbstractClientPlayerEntity p : mc.world.getPlayers()) dist.put(p.getName().getString().toLowerCase(Locale.ROOT), Math.sqrt(mc.player.squaredDistanceTo(p)));
        StringBuilder b = new StringBuilder("[");
        int k = 0;
        for (String n : CxPlayersScreen.tabNames()) {
            if (!n.matches("[A-Za-z0-9_]{3,16}")) continue;
            Double d = dist.get(n.toLowerCase(Locale.ROOT));
            if (k++ > 0) b.append(',');
            b.append("{\"n\":\"").append(n).append("\",\"d\":").append(d == null ? -1 : Math.round(d * 10) / 10.0).append('}');
            if (k >= 60) break;
        }
        return b.append(']').toString();
    }

    private static void poll(MinecraftClient mc, long now) {
        String pid = CosmeticsManager.projectId(), key = CosmeticsManager.apiKey();
        if (pid == null || key == null) return;
        String me = mc.player.getName().getString().toLowerCase(Locale.ROOT);
        List<String> names = new ArrayList<>();
        for (AbstractClientPlayerEntity p : mc.world.getPlayers()) {
            String n = p.getName().getString().toLowerCase(Locale.ROOT);
            if (n.equals(me) || !n.matches("[a-z0-9_]{3,16}") || mc.player.squaredDistanceTo(p) > 4096) continue;
            if (CosmeticsManager.get(n) == null) continue;   // Cubixora kullanmayanları sorgulama
            names.add(n);
            if (names.size() >= 30) break;
        }
        if (names.isEmpty()) return;
        String base = "projects/" + pid + "/databases/(default)/documents/";
        StringBuilder b = new StringBuilder("{\"documents\":[");
        for (int i = 0; i < names.size(); i++) b.append(i > 0 ? "," : "").append('"').append(base).append("emotes/").append(names.get(i)).append("\",\"").append(base).append("sprays/").append(names.get(i)).append('"');
        b.append("]}");
        String url = "https://firestore.googleapis.com/v1/projects/" + pid + "/databases/(default)/documents:batchGet?key=" + URLEncoder.encode(key, StandardCharsets.UTF_8);
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(b.toString())).build();
        inFlight = true;
        HTTP.sendAsync(req, HttpResponse.BodyHandlers.ofString()).whenComplete((res, err) -> {
            try {
                if (err != null || res.statusCode() != 200) return;
                @SuppressWarnings("deprecation") JsonElement root = new JsonParser().parse(res.body());
                for (JsonElement e : root.getAsJsonArray()) {
                    JsonObject o = e.getAsJsonObject();
                    if (!o.has("found")) continue;
                    JsonObject d = o.getAsJsonObject("found");
                    String full = d.get("name").getAsString();
                    String n = full.substring(full.lastIndexOf('/') + 1);
                    boolean spray = full.contains("/sprays/");
                    JsonObject f = d.getAsJsonObject("fields");
                    if (f == null || !f.has("t")) continue;
                    long t = Long.parseLong(f.getAsJsonObject("t").get("integerValue").getAsString());
                    // yaş sunucu saatiyle ölçülür: iki bilgisayarın saati farklıysa sprey/emote hiç görünmüyordu
                    long age = serverAge(o, d, t);
                    if (spray) {
                        Long sp = LAST.put("s:" + n, t);
                        if ((sp == null || sp != t) && age < CxSpray.LIFE_MS - 300 && age > -3000) {
                            final int x = num(f, "x"), y = num(f, "y"), z = num(f, "z"), dd = num(f, "d"), rr = num(f, "r");
                            final long left = CxSpray.LIFE_MS - Math.max(0, age);
                            MinecraftClient.getInstance().execute(() -> CxSpray.spawn(n, x, y, z, dd, rr, left));
                        }
                        continue;
                    }
                    String id = f.has("id") ? f.getAsJsonObject("id").get("stringValue").getAsString() : "";
                    Long prev = LAST.put(n, t);
                    boolean fresh = prev == null ? age < 4000 : prev != t;   // ilk görüşte sadece taze emote
                    if (!fresh) continue;
                    if (id.isEmpty()) CxEmoteAnim.stop(n); else CxEmoteAnim.start(n, id);
                }
            } catch (Throwable ex) { Cubixora.LOG.debug("emote yoklama", ex); }
            finally { inFlight = false; }
        });
    }

    /** Belgenin yaşı Firestore sunucu saatine göre (updateTime -> readTime). Bilgisayar saatleri farklı olsa da doğru çalışır. */
    private static long serverAge(JsonObject o, JsonObject d, long t) {
        try {
            if (o.has("readTime") && d.has("updateTime"))
                return java.time.Duration.between(java.time.Instant.parse(d.get("updateTime").getAsString()), java.time.Instant.parse(o.get("readTime").getAsString())).toMillis();
        } catch (Throwable ignored) {}
        return System.currentTimeMillis() - t;
    }

    private static int num(JsonObject f, String k) { return f.has(k) ? Integer.parseInt(f.getAsJsonObject(k).get("integerValue").getAsString()) : 0; }

    /** Elden savrulan kalpler (parçacık dokusu emoji kalple değiştirilmiştir). */
    private static void hearts(MinecraftClient mc) {
        for (Map.Entry<String, CxEmoteAnim.Active> en : CxEmoteAnim.all().entrySet()) {
            float u = CxEmoteAnim.time(en.getKey());
            if (u < 1.55f || u > 3.1f) continue;
            for (AbstractClientPlayerEntity p : mc.world.getPlayers()) {
                if (!p.getName().getString().equalsIgnoreCase(en.getKey())) continue;
                double yaw = Math.toRadians(p.getYaw());
                double fx = -Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
                java.util.Random r = new java.util.Random();
                double y = p.getY() + (p.isSneaking() ? 1.3 : 1.55);
                double x = p.getX() + fx * 0.5 - rx * 0.2, z = p.getZ() + fz * 0.5 - rz * 0.2;
                double spread = (r.nextDouble() - 0.5) * 0.12;
                mc.world.addImportantParticle(ParticleTypes.HEART, x, y, z, fx * 0.06 + rx * spread, 0.04 + r.nextDouble() * 0.04, fz * 0.06 + rz * spread);
            }
        }
    }
}
