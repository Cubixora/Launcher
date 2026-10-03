package com.cubixora.cosmetics;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Oyun içi otomatik giriş. Launcher, oyunu açarken config/cubixora/autologin.json yazar
 * (sunucu, oyuncu adı, şifre) ve 2 dakika sonra siler; mod dosyayı açılışta belleğe alır.
 * Sunucuya girildiğinde sunucunun yazdığı mesaja bakılır: "/login", "/l", "/giris" veya
 * "/register" hangisini istiyorsa o komut hemen gönderilir. Mesaj gelmezse kısa süre sonra
 * "/login" denenir. Minecraft sınıflarına bağlı değildir; komut gönderme işini sürüme özel
 * Compat sınıfı yapar (sender).
 */
public final class AutoLogin {
    private static final class Entry { String server; String pass; }

    private static final List<Entry> ENTRIES = new ArrayList<>();
    private static final Pattern REGISTER = Pattern.compile("/(register|reg|kayit|kayıt)\\b");
    private static final Pattern LOGIN = Pattern.compile("/(login|log|l|giris|giriş)\\b");

    /** Sürüme özel komut gönderici (başında "/" olmadan). */
    public static volatile Consumer<String> sender;
    /** Bu sürümde sunucu mesajlarını dinleyebiliyor muyuz (1.19+). Dinleyemiyorsak daha erken denenir. */
    public static volatile boolean messagesSupported = true;

    private static Entry active;
    private static long joinAt;
    private static boolean done;

    private AutoLogin() {}

    @SuppressWarnings("deprecation")
    public static void init() {
        try {
            Path f = FabricLoader.getInstance().getConfigDir().resolve("cubixora").resolve("autologin.json");
            if (!Files.exists(f)) return;
            JsonElement root = new JsonParser().parse(Files.readString(f));
            try { Files.deleteIfExists(f); } catch (Exception ignored) {}
            JsonArray arr = root.getAsJsonObject().getAsJsonArray("entries");
            if (arr == null) return;
            for (JsonElement el : arr) {
                JsonObject o = el.getAsJsonObject();
                Entry e = new Entry();
                e.server = host(o.has("server") ? o.get("server").getAsString() : "");
                e.pass = o.has("pass") ? o.get("pass").getAsString() : "";
                if (!e.server.isEmpty() && !e.pass.isEmpty() && !e.pass.contains(" ")) ENTRIES.add(e);
            }
            Cubixora.LOG.info("Oto-giriş: {} sunucu kaydı yüklendi", ENTRIES.size());
        } catch (Exception e) {
            Cubixora.LOG.warn("autologin.json okunamadı", e);
        }
    }

    /** "Play.Sunucu.com:25565" -> "play.sunucu.com" */
    private static String host(String s) {
        String h = s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
        if (h.startsWith("[")) { int i = h.indexOf(']'); return i > 0 ? h.substring(1, i) : h; }
        int c = h.lastIndexOf(':');
        if (c > 0 && h.indexOf(':') == c) h = h.substring(0, c);
        if (h.endsWith(".")) h = h.substring(0, h.length() - 1);
        return h;
    }

    private static boolean matches(String saved, String joined) {
        if (saved.equals(joined)) return true;
        // "sunucu.com" kaydı "play.sunucu.com" ile, "play.sunucu.com" kaydı "sunucu.com" ile de eşleşsin
        if (saved.matches("[0-9.]+") || joined.matches("[0-9.]+") || saved.contains(":") || joined.contains(":")) return false; // IP adresleri tam eşleşmeli
        return joined.endsWith("." + saved) || saved.endsWith("." + joined)
                || base(saved).equals(base(joined));
    }

    private static String base(String h) {
        String[] p = h.split("\\.");
        if (p.length < 2) return h;
        String last2 = p[p.length - 2] + "." + p[p.length - 1];
        // "com.tr", "net.tr" gibi iki parçalı uzantılar
        if (p.length >= 3 && p[p.length - 2].length() <= 3 && p[p.length - 1].length() == 2) return p[p.length - 3] + "." + last2;
        return last2;
    }

    /** Sunucuya bağlanınca çağrılır (tek oyunculu dünyada address null). */
    public static void onJoin(String address) {
        active = null; done = false;
        if (address == null || ENTRIES.isEmpty()) return;
        String h = host(address);
        for (Entry e : ENTRIES) {
            if (matches(e.server, h)) { active = e; joinAt = System.currentTimeMillis(); break; }
        }
        if (active != null) Cubixora.LOG.info("Oto-giriş bu sunucu için hazır: {}", h);
    }

    public static void onDisconnect() { active = null; done = false; }

    /** Sunucudan gelen her sistem/sohbet mesajı (düz metin). */
    public static void onMessage(String text) {
        if (active == null || done || text == null) return;
        if (System.currentTimeMillis() - joinAt > 90_000) { active = null; return; }
        String t = text.toLowerCase(Locale.ROOT);
        Matcher log = LOGIN.matcher(t);
        if (log.find()) { send(log.group(1) + " " + active.pass); return; } // ikisi birden yazıyorsa giriş öncelikli
        if (REGISTER.matcher(t).find()) send("register " + active.pass + " " + active.pass);
    }

    /** Her oyun tikinde: sunucu bir şey yazmadıysa kısa süre sonra /login denenir. */
    public static void tick() {
        if (active == null || done) return;
        long waited = System.currentTimeMillis() - joinAt;
        if (waited > (messagesSupported ? 5000 : 1800)) send("login " + active.pass);
    }

    private static void send(String cmd) {
        Consumer<String> s = sender;
        if (s == null) return;
        done = true;
        try {
            s.accept(cmd);
            Cubixora.LOG.info("Oto-giriş komutu gönderildi (/{} ****)", cmd.substring(0, cmd.indexOf(' ')));
        } catch (Exception e) {
            Cubixora.LOG.warn("Oto-giriş komutu gönderilemedi", e);
        }
    }
}
