package com.cubixora.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.function.Consumer;

/** Skin stüdyosu yardımcıları: kayıtlı skin klasörü, PNG doğrulama/dönüştürme, oyuncu adıyla Mojang skini bulma. */
public final class CxSkins {
    public static final class Skin { public byte[] png; public boolean slim; public String error; }
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).followRedirects(HttpClient.Redirect.NORMAL).build();
    private CxSkins() {}

    public static File dir() {
        File d = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir().resolve("cubixora").resolve("skins").toFile();
        d.mkdirs();
        return d;
    }

    public static List<File> list() {
        File[] fs = dir().listFiles((d, n) -> n.toLowerCase().endsWith(".png"));
        if (fs == null) return new ArrayList<>();
        Arrays.sort(fs, (a, b) -> a.getName().compareToIgnoreCase(b.getName()));
        return new ArrayList<>(Arrays.asList(fs));
    }

    public static String safeName(String n) {
        String s = n == null ? "" : n.trim().replaceAll("[^A-Za-z0-9 _\\-çğıöşüÇĞİÖŞÜ]", "").trim();
        return s.length() > 32 ? s.substring(0, 32) : s;
    }

    /** PNG'yi doğrular; 64x32 (eski) skinleri 64x64'e çevirir. Hata varsa null döner. */
    public static byte[] normalize(byte[] png) {
        try {
            BufferedImage in = ImageIO.read(new ByteArrayInputStream(png));
            if (in == null || in.getWidth() != 64 || (in.getHeight() != 64 && in.getHeight() != 32)) return null;
            BufferedImage out = in;
            if (in.getHeight() == 32) {
                out = new BufferedImage(64, 64, BufferedImage.TYPE_INT_ARGB);
                Graphics2D g = out.createGraphics();
                g.drawImage(in, 0, 0, null);
                // sağ bacak/kol -> sol bacak/kol (yatay aynalı)
                int[][] r = { { 4, 16, 4, 4, 20, 48 }, { 8, 16, 4, 4, 24, 48 }, { 0, 20, 4, 12, 24, 52 }, { 4, 20, 4, 12, 20, 52 }, { 8, 20, 4, 12, 16, 52 }, { 12, 20, 4, 12, 28, 52 },
                        { 44, 16, 4, 4, 36, 48 }, { 48, 16, 4, 4, 40, 48 }, { 40, 20, 4, 12, 40, 52 }, { 44, 20, 4, 12, 36, 52 }, { 48, 20, 4, 12, 32, 52 }, { 52, 20, 4, 12, 44, 52 } };
                for (int[] q : r) g.drawImage(in, q[4] + q[2], q[5], q[4], q[5] + q[3], q[0], q[1], q[0] + q[2], q[1] + q[3], null);
                g.dispose();
            }
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            ImageIO.write(out, "png", bo);
            return bo.toByteArray();
        } catch (Exception e) { return null; }
    }

    public static Skin load(File f) {
        Skin s = new Skin();
        try {
            byte[] b = Files.readAllBytes(f.toPath());
            s.png = normalize(b);
            if (s.png == null) s.error = "Skin 64x64 (ya da 64x32) PNG olmalı.";
            else s.slim = guessSlim(s.png);
        } catch (Exception e) { s.error = "Dosya okunamadı."; }
        return s;
    }

    /** Kol modeli tahmini: ince kolun son sütunu şeffaftır. */
    public static boolean guessSlim(byte[] png) {
        try {
            BufferedImage im = ImageIO.read(new ByteArrayInputStream(png));
            return ((im.getRGB(54, 20) >>> 24) & 0xFF) == 0 && ((im.getRGB(55, 25) >>> 24) & 0xFF) == 0;
        } catch (Exception e) { return false; }
    }

    public static String dataUrl(byte[] png) { return "data:image/png;base64," + Base64.getEncoder().encodeToString(png); }

    /** Oyuncu adıyla Mojang skinini arka planda bulur; sonuç ana iş parçacığında verilir. */
    @SuppressWarnings("deprecation")
    public static void lookup(String name, Consumer<Skin> cb) {
        net.minecraft.client.Minecraft mc = net.minecraft.client.Minecraft.getInstance();
        Thread t = new Thread(() -> {
            Skin s = new Skin();
            try {
                if (!name.matches("[A-Za-z0-9_]{3,16}")) throw new IllegalStateException("Geçerli bir oyuncu adı yaz.");
                String r1 = get("https://api.mojang.com/users/profiles/minecraft/" + name);
                if (r1 == null) throw new IllegalStateException("Oyuncu bulunamadı.");
                String id = new JsonParser().parse(r1).getAsJsonObject().get("id").getAsString();
                String r2 = get("https://sessionserver.mojang.com/session/minecraft/profile/" + id);
                if (r2 == null) throw new IllegalStateException("Skin bilgisi alınamadı (biraz sonra tekrar dene).");
                String val = new JsonParser().parse(r2).getAsJsonObject().getAsJsonArray("properties").get(0).getAsJsonObject().get("value").getAsString();
                JsonObject sk = new JsonParser().parse(new String(Base64.getDecoder().decode(val))).getAsJsonObject().getAsJsonObject("textures").getAsJsonObject("SKIN");
                String url = sk.get("url").getAsString();
                if (!url.startsWith("https://textures.minecraft.net/")) throw new IllegalStateException("Beklenmeyen skin adresi.");
                s.slim = sk.has("metadata") && sk.getAsJsonObject("metadata").has("model") && "slim".equals(sk.getAsJsonObject("metadata").get("model").getAsString());
                HttpResponse<byte[]> r = HTTP.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(10)).GET().build(), HttpResponse.BodyHandlers.ofByteArray());
                if (r.statusCode() != 200) throw new IllegalStateException("Skin indirilemedi.");
                s.png = normalize(r.body());
                if (s.png == null) throw new IllegalStateException("Bu skin biçimi desteklenmiyor.");
            } catch (IllegalStateException e) { s.error = e.getMessage(); }
            catch (Exception e) { s.error = "Bağlantı hatası."; }
            mc.execute(() -> cb.accept(s));
        }, "cx-skin-lookup");
        t.setDaemon(true);
        t.start();
    }

    private static String get(String url) throws Exception {
        HttpResponse<String> r = HTTP.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(10)).GET().build(), HttpResponse.BodyHandlers.ofString());
        return r.statusCode() == 200 ? r.body() : null;
    }
}
