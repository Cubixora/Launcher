package com.cubixora.cosmetics;

import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeDeformation;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.builders.PartDefinition;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Eklemli kanat modeli (26.x, Mojang isimleri). Geometri diğer sürümlerle birebir aynı. */
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

    private static float x0(boolean left, float w) { return left ? 0f : -w; }

    private static ModelPart build(boolean left) {
        CubeDeformation thin = new CubeDeformation(0f, 0f, -0.35f);
        CubeDeformation none = new CubeDeformation(0f);
        float dir = left ? 1f : -1f;
        MeshDefinition mesh = new MeshDefinition();
        PartDefinition root = mesh.getRoot();
        PartDefinition s1 = root.addOrReplaceChild("s1", CubeListBuilder.create().mirror(left)
                .texOffs(20, 0).addBox(x0(left, 7), -0.5f, -0.5f, 7, 1, 1, none)
                .texOffs(0, 0).addBox(x0(left, 8), 0.5f, -0.5f, 8, 12, 1, thin)
                .texOffs(20, 10).addBox(x0(left, 7), 0.5f, -0.05f, 7, 6, 1, thin),
                PartPose.offset(0f, 0f, 0f));
        PartDefinition s2 = s1.addOrReplaceChild("s2", CubeListBuilder.create().mirror(left)
                .texOffs(20, 3).addBox(x0(left, 6), -0.5f, -0.5f, 6, 1, 1, none)
                .texOffs(0, 14).addBox(x0(left, 7), 0.5f, -0.5f, 7, 12, 1, thin)
                .texOffs(20, 18).addBox(x0(left, 6), 0.5f, -0.05f, 6, 7, 1, thin)
                .texOffs(40, 0).addBox(-0.5f, -2.5f, -0.5f, 1, 2, 1, none),
                PartPose.offset(dir * 7f, 0f, 0f));
        s2.addOrReplaceChild("s3", CubeListBuilder.create().mirror(left)
                .texOffs(20, 6).addBox(x0(left, 6), -0.5f, -0.5f, 6, 1, 1, none)
                .texOffs(0, 28).addBox(x0(left, 6), 0.5f, -0.5f, 6, 11, 1, thin),
                PartPose.offset(dir * 6f, 0f, 0f));
        return LayerDefinition.create(mesh, 64, 64).bakeRoot();
    }

    public static float openAmount(String name, boolean wantOpen) {
        String key = name.toLowerCase(Locale.ROOT);
        float open = OPEN.getOrDefault(key, wantOpen ? 1f : 0f);
        open += ((wantOpen ? 1f : 0f) - open) * 0.08f;
        OPEN.put(key, open);
        return open;
    }

    private static float lerp(float a, float b, float t) { return a + (b - a) * t; }
    private static float wave(float x) { return (float) Math.sin(x + 0.4 * Math.sin(x)); }

    public static void place(PoseStack ps, int side) {
        ps.translate(side * 1.5f * PX, 1.5f * PX, 5.5f * PX);
        ps.scale(0.9f, 0.9f, 0.9f);
    }

    public ModelPart part(boolean isLeft) { return isLeft ? left : right; }

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
            float sgn = isLeft ? -1f : 1f;
            for (int i = 0; i < 3; i++) {
                segs[i].zRot = (float) Math.toRadians(sgn * pose[i][0]);
                segs[i].yRot = (float) Math.toRadians(sgn * pose[i][1]);
                segs[i].xRot = 0f;
            }
        }
    }
}
