package com.cubixora.cosmetics;

import net.minecraft.client.model.Dilation;
import net.minecraft.client.model.ModelData;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.model.ModelPartBuilder;
import net.minecraft.client.model.ModelPartData;
import net.minecraft.client.model.TexturedModelData;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.util.math.MatrixStack;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Eklemli, kalınlığı olan kanat modeli (launcher önizlemesiyle aynı geometri ve doku).
 * Her kanat 3 bölüm: omuz → ön kol → uç. Her bölümde kemik (ön kenar), zar/tüy paneli,
 * melek kanatlarında örtü tüyü katmanı, ejderha kanatlarında eklem pençesi var.
 * Çırpma kuş gibi aşağı-yukarıdır ve uç bölümler geriden gelir (dalga etkisi).
 * Kök, sırtın 3.5 piksel arkasında olduğu ve bütün açılar geriye doğru olduğu için
 * kanat hiçbir durumda oyuncunun içine girmez.
 */
public final class WingModel {
    private static final float PX = 1f / 16f;
    private static final Map<String, Float> OPEN = new ConcurrentHashMap<>();

    private final ModelPart right, left;
    private final ModelPart[] rightSegs, leftSegs;

    public WingModel() {
        this.right = build(false);
        this.left = build(true);
        this.rightSegs = segs(right);
        this.leftSegs = segs(left);
    }

    private static ModelPart[] segs(ModelPart root) {
        ModelPart s1 = root.getChild("s1");
        ModelPart s2 = s1.getChild("s2");
        return new ModelPart[]{s1, s2, s2.getChild("s3")};
    }

    /** x başlangıcı: sağ kanat −x yönüne, sol kanat +x yönüne uzanır. */
    private static float x0(boolean left, float w) { return left ? 0f : -w; }

    private static ModelPart build(boolean left) {
        Dilation thin = new Dilation(0f, 0f, -0.35f); // zar kalınlığı 0.3 piksel
        float dir = left ? 1f : -1f;
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();
        ModelPartData s1 = root.addChild("s1", ModelPartBuilder.create().mirrored(left)
                .uv(20, 0).cuboid(x0(left, 7), -0.5f, -0.5f, 7, 1, 1)
                .uv(0, 0).cuboid(x0(left, 8), 0.5f, -0.5f, 8, 12, 1, thin)
                .uv(20, 10).cuboid(x0(left, 7), 0.5f, -0.05f, 7, 6, 1, thin),
                Compat.pivot(0f, 0f, 0f));
        ModelPartData s2 = s1.addChild("s2", ModelPartBuilder.create().mirrored(left)
                .uv(20, 3).cuboid(x0(left, 6), -0.5f, -0.5f, 6, 1, 1)
                .uv(0, 14).cuboid(x0(left, 7), 0.5f, -0.5f, 7, 12, 1, thin)
                .uv(20, 18).cuboid(x0(left, 6), 0.5f, -0.05f, 6, 7, 1, thin)
                .uv(40, 0).cuboid(-0.5f, -2.5f, -0.5f, 1, 2, 1),
                Compat.pivot(dir * 7f, 0f, 0f));
        s2.addChild("s3", ModelPartBuilder.create().mirrored(left)
                .uv(20, 6).cuboid(x0(left, 6), -0.5f, -0.5f, 6, 1, 1)
                .uv(0, 28).cuboid(x0(left, 6), 0.5f, -0.5f, 6, 11, 1, thin),
                Compat.pivot(dir * 6f, 0f, 0f));
        return TexturedModelData.of(data, 64, 64).createModel();
    }

    /** Açık/kapalı arası yumuşak geçiş (oyuncu başına). */
    public static float openAmount(String name, boolean wantOpen) {
        String key = name.toLowerCase(Locale.ROOT);
        float open = OPEN.getOrDefault(key, wantOpen ? 1f : 0f);
        open += ((wantOpen ? 1f : 0f) - open) * 0.08f;
        OPEN.put(key, open);
        return open;
    }

    private static float lerp(float a, float b, float t) { return a + (b - a) * t; }
    private static float wave(float x) { return (float) Math.sin(x + 0.4 * Math.sin(x)); } // hızlı aşağı vuruş

    /**
     * Kanatları çizer. Çağırmadan önce matris oyuncunun gövdesine göre ayarlanmış olmalı
     * (body.rotate). t: saniye, speed: launcher'daki hız, extra: uçarken ek hız.
     */
    public void render(MatrixStack matrices, VertexConsumer vc, int light, float open, float t, float speed, float extra) {
        pose(open, t, speed, extra);
        for (int side = -1; side <= 1; side += 2) {
            matrices.push();
            place(matrices, side);
            part(side > 0).render(matrices, vc, light, OverlayTexture.DEFAULT_UV);
            matrices.pop();
        }
    }

    /** Sol (side=1) ya da sağ (side=-1) kanadın kökünü sırtın arkasına taşır. push/pop çağıran tarafta. */
    public static void place(MatrixStack matrices, int side) {
        matrices.translate(side * 1.5f * PX, 1.5f * PX, 5.5f * PX); // sırtın arkası
        matrices.scale(0.9f, 0.9f, 0.9f);
    }

    public ModelPart part(boolean isLeft) { return isLeft ? left : right; }

    /** Açıları ayarlar (çizmeden). */
    public void pose(float open, float t, float speed, float extra) {
        float p = t * 3.0f * speed * (1f + extra);
        float[][] pose = {
                {lerp(-15f, 8f + 30f * wave(p), open), lerp(75f, 26f, open)},
                {lerp(-6f, 22f * wave(p - 0.55f), open), lerp(14f, 4f, open)},
                {lerp(-4f, 16f * wave(p - 1.1f), open), lerp(10f, 2f, open)}
        };
        for (int side = -1; side <= 1; side += 2) {
            boolean isLeft = side > 0;
            ModelPart[] segs = isLeft ? leftSegs : rightSegs;
            float sgn = isLeft ? -1f : 1f; // sol kanat aynalı döner
            for (int i = 0; i < 3; i++) {
                segs[i].roll = (float) Math.toRadians(sgn * pose[i][0]);
                segs[i].yaw = (float) Math.toRadians(sgn * pose[i][1]);
                segs[i].pitch = 0f;
            }
        }
    }
}
