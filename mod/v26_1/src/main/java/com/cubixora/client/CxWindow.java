package com.cubixora.client;

import net.minecraft.client.Minecraft;
import org.lwjgl.BufferUtils;
import org.lwjgl.glfw.GLFW;
import org.lwjgl.glfw.GLFWImage;

import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.nio.ByteBuffer;

/** Oyun penceresinin simgesini (başlık çubuğu / görev çubuğu) Cubixora simgesiyle değiştirir. */
public final class CxWindow {
    private CxWindow() {}
    private static boolean done;

    public static void tick(Minecraft mc) {
        if (done || !CxClient.enabled || mc.getWindow() == null) return;
        done = true;
        try (InputStream in = CxWindow.class.getResourceAsStream("/assets/cubixora/textures/gui/icon.png")) {
            if (in == null) return;
            BufferedImage src = javax.imageio.ImageIO.read(in);
            int[] sizes = { 16, 32, 48, 128 };
            GLFWImage.Buffer imgs = GLFWImage.malloc(sizes.length);
            ByteBuffer[] keep = new ByteBuffer[sizes.length];
            for (int i = 0; i < sizes.length; i++) {
                int n = sizes[i];
                BufferedImage b = new BufferedImage(n, n, BufferedImage.TYPE_INT_ARGB);
                var g = b.createGraphics();
                g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                g.drawImage(src, 0, 0, n, n, null); g.dispose();
                ByteBuffer px = BufferUtils.createByteBuffer(n * n * 4);
                for (int y = 0; y < n; y++) for (int x = 0; x < n; x++) {
                    int p = b.getRGB(x, y);
                    px.put((byte) (p >> 16)).put((byte) (p >> 8)).put((byte) p).put((byte) (p >>> 24));
                }
                px.flip(); keep[i] = px;
                imgs.position(i).width(n).height(n).pixels(px);
            }
            imgs.position(0);
            GLFW.glfwSetWindowIcon(mc.getWindow().handle(), imgs);
            imgs.free();
        } catch (Throwable ignored) {}
    }
}
