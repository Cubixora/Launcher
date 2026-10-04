package com.cubixora.client;

import net.minecraft.client.MinecraftClient;
import org.lwjgl.glfw.GLFW;
import org.lwjgl.glfw.GLFWImage;
import org.lwjgl.stb.STBImage;
import org.lwjgl.system.MemoryStack;
import org.lwjgl.system.MemoryUtil;

import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.IntBuffer;

/**
 * Cubixora imleçleri: menülerde fare imlecini seçilen tasarımla değiştirir.
 * Launcher ile iki yönlü eşitlenir: launcher'da seçilen burada, burada seçilen launcher'da uygulanır.
 * İmleç bir kez oluşturulur (GPU/bellek maliyeti yok); her karede sadece tutamaç yeniden atanır, o da yalnız bir menü açıkken.
 */
public final class CxCursor {
    private CxCursor() {}

    public static final String[] IDS = { "", "altin", "neon", "buz", "lav", "zumrut", "gokkusagi", "galaksi", "cubixora", "klasik", "gece", "pati", "kalp", "kedi", "yildiz", "kilic", "hayalet", "cilek" };
    public static final String[] NAMES = { "Varsayılan", "Altın Ok", "Neon Mor", "Buz Mavisi", "Lav", "Zümrüt", "Gökkuşağı", "Galaksi", "Cubixora", "Retro Beyaz", "Gece Siyahı", "Pembe Pati", "Kalpli", "Kedi Rozetli", "Yıldız Değneği", "Piksel Kılıç", "Sevimli Hayalet", "Çilek" };
    private static final int[] HX = { 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 1, 1, 1 }, HY = { 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 1, 1, 1 };

    private static String want = null, applied = null, lastLauncher = null;
    private static long handle = 0;

    private static int index(String id) { for (int i = 0; i < IDS.length; i++) if (IDS[i].equals(id)) return i; return 0; }
    private static String clean(String id) { return id == null ? "" : IDS[index(id)]; }
    public static String current() { if (want == null) want = clean(CxClient.settings.cursor); return want; }
    public static String name() { return NAMES[index(current())]; }

    /** Oyun içinden seçildi: kaydet ve launcher'a bildir. */
    public static void choose(String id) {
        id = clean(id);
        if (id.equals(current())) return;
        want = id; CxClient.settings.cursor = id; CxClient.save();
        if (CxBridge.available()) CxBridge.raw("/cursor", "{\"id\":\"" + id + "\"}", null);
    }
    /** Ayar ekranındaki düğme: sıradaki imleç (canlı önizleme: imleç hemen değişir). */
    public static void next() { choose(IDS[(index(current()) + 1) % IDS.length]); }

    /** Launcher yanıtından: launcher'daki seçim değiştiyse uygula (eski yanıtlar yerel seçimi geri almaz). */
    public static void fromLauncher(String id) {
        if (id == null || id.equals(lastLauncher)) return;
        lastLauncher = id;
        id = clean(id);
        if (id.equals(current())) return;
        want = id; CxClient.settings.cursor = id; CxClient.save();
    }

    /** Launcher'daki seçimi sorar (2 sn'de bir, tek küçük yerel istek). */
    public static void poll() {
        if (!CxBridge.available()) return;
        CxBridge.raw("/cursor", "{}", o -> { if (o != null && o.has("cur")) fromLauncher(o.get("cur").getAsString()); });
    }

    /** Her karede (ana iş parçacığı). */
    public static void frame() {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc == null || mc.getWindow() == null) return;
        long win = mc.getWindow().getHandle();
        String w = current();
        if (!w.equals(applied)) {
            long old = handle;
            handle = w.isEmpty() ? 0 : create(w, win);
            applied = w;
            GLFW.glfwSetCursor(win, handle);
            if (old != 0) GLFW.glfwDestroyCursor(old);
        }
        // Minecraft 1.21.9+ menülerde imleci kendi değiştirir (el, yazı imleci); seçili imleç menü açıkken korunur
        if (handle != 0 && mc.currentScreen != null) GLFW.glfwSetCursor(win, handle);
    }

    private static long create(String id, long win) {
        float scale = 1f;
        try { float[] sx = new float[1], sy = new float[1]; GLFW.glfwGetWindowContentScale(win, sx, sy); scale = sx[0]; } catch (Throwable ignored) {}
        boolean big = scale >= 1.5f;
        String path = "/assets/cubixora/textures/cursor/" + id + (big ? "@2x" : "") + ".png";
        ByteBuffer file = null, pix = null;
        try (InputStream in = CxCursor.class.getResourceAsStream(path); MemoryStack st = MemoryStack.stackPush()) {
            if (in == null) return 0;
            byte[] b = in.readAllBytes();
            file = MemoryUtil.memAlloc(b.length); file.put(b).flip();
            IntBuffer w = st.mallocInt(1), h = st.mallocInt(1), c = st.mallocInt(1);
            pix = STBImage.stbi_load_from_memory(file, w, h, c, 4);
            if (pix == null) return 0;
            GLFWImage img = GLFWImage.malloc(st);
            img.set(w.get(0), h.get(0), pix);
            int i = index(id), k = big ? 2 : 1;
            return GLFW.glfwCreateCursor(img, HX[i] * k, HY[i] * k);
        } catch (Throwable t) {
            com.cubixora.cosmetics.Cubixora.LOG.debug("imleç", t);
            return 0;
        } finally {
            if (pix != null) STBImage.stbi_image_free(pix);
            if (file != null) MemoryUtil.memFree(file);
        }
    }
}
