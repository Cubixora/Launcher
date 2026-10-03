package com.cubixora.client;

import com.cubixora.cosmetics.Cubixora;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.Minecraft;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Oyun ↔ launcher köprüsü. Launcher açıkken 127.0.0.1 üzerinde küçük bir sunucu çalışır;
 * gardrop ve mağaza işlemleri (kuşan, satın al) oraya gider, launcher buluta kaydeder.
 */
public final class CxBridge {
    public static final class Item { public String id = "", name = "", type = "", ref = "", rarity = "yaygin"; public int price; public boolean owned, free; public long until; public String icon = "", tex = ""; }
    public static final class State {
        public long coins; public String cape = "", wings = "", hat = "", fly = "", effect = ""; public boolean pet;
        public final List<Item> items = new ArrayList<>();
        public boolean ok; public String error = "";
    }

    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    public static volatile State last = new State();

    private CxBridge() {}

    public static boolean available() { return CxClient.bridgePort > 0 && !CxClient.bridgeToken.isEmpty(); }

    public static void state(Consumer<State> cb) { call("/state", "{}", cb); }
    public static void equip(String json, Consumer<State> cb) { call("/equip", json, cb); }
    public static void buy(String id, Consumer<State> cb) { call("/buy", "{\"id\":\"" + id.replace("\"", "") + "\"}", cb); }

    @SuppressWarnings("deprecation")
    private static void call(String path, String body, Consumer<State> cb) {
        if (!available()) { State s = new State(); s.error = "Launcher bağlantısı yok. Oyunu Cubixora Launcher'dan aç."; deliver(cb, s); return; }
        HttpRequest req = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + CxClient.bridgePort + path))
                .timeout(Duration.ofSeconds(15)).header("x-cubixora", CxClient.bridgeToken).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build();
        HTTP.sendAsync(req, HttpResponse.BodyHandlers.ofString()).whenComplete((res, err) -> {
            State s = new State();
            try {
                if (err != null) { s.error = "Launcher'a ulaşılamadı. Launcher açık olmalı."; }
                else {
                    JsonObject o = new JsonParser().parse(res.body()).getAsJsonObject();
                    if (res.statusCode() != 200) s.error = o.has("error") ? o.get("error").getAsString() : "Hata " + res.statusCode();
                    else {
                        s.ok = true;
                        s.coins = o.has("coins") ? o.get("coins").getAsLong() : 0;
                        JsonObject eq = o.getAsJsonObject("equipped");
                        if (eq != null) { s.cape = eq.get("cape").getAsString(); s.wings = eq.get("wings").getAsString(); s.pet = eq.get("pet").getAsBoolean(); s.hat = eq.has("hat") ? eq.get("hat").getAsString() : ""; s.fly = eq.has("fly") ? eq.get("fly").getAsString() : ""; s.effect = eq.has("effect") ? eq.get("effect").getAsString() : ""; }
                        if (o.has("items")) for (JsonElement e : o.getAsJsonArray("items")) {
                            JsonObject x = e.getAsJsonObject(); Item it = new Item();
                            it.id = x.get("id").getAsString(); it.name = x.get("name").getAsString(); it.type = x.get("type").getAsString();
                            it.ref = x.has("ref") ? x.get("ref").getAsString() : ""; it.rarity = x.has("rarity") ? x.get("rarity").getAsString() : "yaygin";
                            it.price = x.has("price") ? x.get("price").getAsInt() : 0; it.owned = x.get("owned").getAsBoolean(); it.free = x.has("free") && x.get("free").getAsBoolean(); it.until = x.has("until") ? x.get("until").getAsLong() : 0; it.icon = x.has("icon") && !x.get("icon").isJsonNull() ? x.get("icon").getAsString() : ""; it.tex = x.has("tex") && !x.get("tex").isJsonNull() ? x.get("tex").getAsString() : "";
                            s.items.add(it);
                        }
                        last = s;
                        CxClient.coins = s.coins;
                    }
                }
            } catch (Exception e) { s.error = "Yanıt okunamadı."; Cubixora.LOG.debug("köprü", e); }
            deliver(cb, s);
        });
    }

    /** Genel istek: yanıt JSON'u (hata ise null) ana iş parçacığında verilir. */
    @SuppressWarnings("deprecation")
    public static void raw(String path, String body, Consumer<JsonObject> cb) {
        if (!available()) { if (cb != null) Minecraft.getInstance().execute(() -> cb.accept(null)); return; }
        HttpRequest req = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + CxClient.bridgePort + path))
                .timeout(Duration.ofSeconds(15)).header("x-cubixora", CxClient.bridgeToken).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body == null ? "{}" : body)).build();
        HTTP.sendAsync(req, HttpResponse.BodyHandlers.ofString()).whenComplete((res, err) -> {
            JsonObject o = null;
            try { if (err == null && res.statusCode() == 200) o = new JsonParser().parse(res.body()).getAsJsonObject(); } catch (Exception ignored) {}
            JsonObject fo = o;
            if (cb != null) Minecraft.getInstance().execute(() -> cb.accept(fo));
        });
    }

    private static void deliver(Consumer<State> cb, State s) { Minecraft.getInstance().execute(() -> cb.accept(s)); }

    /** Süreli eşyanın kalan süresi: "6g 23:14:05" ya da "23:14:05"; süre dolduysa "Süresi doldu". */
    public static String timeLeft(long until) {
        long ms = until - System.currentTimeMillis();
        if (ms <= 0) return "Süresi doldu";
        long s = ms / 1000, d = s / 86400, h = (s % 86400) / 3600, m = (s % 3600) / 60, x = s % 60;
        String t = String.format("%02d:%02d:%02d", h, m, x);
        return d > 0 ? d + "g " + t : t;
    }

    public static int rarityColor(String r) {
        switch (r == null ? "" : r) {
            case "nadir": return 0xFF5AA9FF;
            case "destansi": return 0xFFB27BFF;
            case "efsanevi": return 0xFFFFB13B;
            case "ozel": return 0xFFFF5AB8;
            default: return 0xFF8B8B95;
        }
    }
    public static String rarityName(String r) {
        switch (r == null ? "" : r) {
            case "nadir": return "NADİR";
            case "destansi": return "DESTANSI";
            case "efsanevi": return "EFSANEVİ";
            case "ozel": return "ÖZEL";
            default: return "YAYGIN";
        }
    }
}
