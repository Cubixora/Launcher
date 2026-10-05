package com.cubixora.cosmetics;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.model.geom.builders.CubeDeformation;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.PartDefinition;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.resources.Identifier;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Şapkalar ve uçan petler: model JSON'dan (assets/cubixora/props/ID.json) kurulur, doku textures/prop/ID.png.
 * Aynı JSON launcher önizlemesinde de kullanılır. Yalnız ModelPart döndürme ve çeviri/ölçek kullanır
 * (sürümler arası API farkı yok).
 */
public final class CxProps {
    private CxProps() {}

    public static final class Model {
        public final ModelPart root;
        public final Identifier tex;
        final Map<String, ModelPart> parts = new HashMap<>();
        final Map<String, float[]> base = new HashMap<>();
        Model(ModelPart root, Identifier tex) { this.root = root; this.tex = tex; }
        public ModelPart part(String n) { return parts.get(n); }
        /** Başlangıç duruşuna döner (animasyon üstüne yazar). */
        void reset() {
            for (Map.Entry<String, ModelPart> e : parts.entrySet()) {
                float[] b = base.get(e.getKey());
                e.getValue().xRot = b[0]; e.getValue().yRot = b[1]; e.getValue().zRot = b[2];
            }
        }
    }

    private static final Map<String, Model> CACHE = new ConcurrentHashMap<>();
    private static final Model MISSING = new Model(null, null);
    private static final java.util.regex.Pattern ID_OK = java.util.regex.Pattern.compile("[a-z0-9_]{1,24}");

    /** Model hazırsa döner; dosya yoksa/bozuksa null (bir daha denenmez). */
    public static Model get(String id) {
        if (id == null || id.isEmpty()) return null;
        Model m = CACHE.get(id);   // her karede çağrılır: önce önbellek (kalıp kontrolü yalnız ilk seferde)
        if (m == null) {
            if (!ID_OK.matcher(id).matches()) return null;
            try { m = load(id); } catch (Throwable t) { Cubixora.LOG.warn("Model yüklenemedi: " + id, t); m = MISSING; }
            CACHE.put(id, m);
        }
        return m == MISSING ? null : m;
    }

    private static Model load(String id) throws Exception {
        try (InputStream in = CxProps.class.getResourceAsStream("/assets/cubixora/props/" + id + ".json")) {
            if (in == null) return MISSING;
            JsonObject o = new JsonParser().parse(new InputStreamReader(in, StandardCharsets.UTF_8)).getAsJsonObject();
            JsonArray tw = o.getAsJsonArray("tex");
            MeshDefinition data = new MeshDefinition();
            Map<String, PartDefinition> pd = new HashMap<>();
            pd.put("root", data.getRoot());
            JsonArray parts = o.getAsJsonArray("parts");
            for (JsonElement pe : parts) {
                JsonObject p = pe.getAsJsonObject();
                CubeListBuilder b = CubeListBuilder.create();
                for (JsonElement be : p.getAsJsonArray("b")) {
                    JsonArray a = be.getAsJsonArray();
                    b.texOffs(a.get(7).getAsInt(), a.get(8).getAsInt())
                     .addBox(a.get(0).getAsFloat(), a.get(1).getAsFloat(), a.get(2).getAsFloat(), a.get(3).getAsFloat(), a.get(4).getAsFloat(), a.get(5).getAsFloat(), new CubeDeformation(a.get(6).getAsFloat()));
                }
                JsonArray pv = p.getAsJsonArray("pv");
                PartDefinition parent = pd.get(p.get("p").getAsString());
                pd.put(p.get("n").getAsString(), parent.addOrReplaceChild(p.get("n").getAsString(), b,
                        PartPose.offset(pv.get(0).getAsFloat(), pv.get(1).getAsFloat(), pv.get(2).getAsFloat())));
            }
            ModelPart root = LayerDefinition.create(data, tw.get(0).getAsInt(), tw.get(1).getAsInt()).bakeRoot();
            Model m = new Model(root, Compat.id("cubixora", "textures/prop/" + id + ".png"));
            Map<String, ModelPart> byName = new HashMap<>();
            byName.put("root", root);
            for (JsonElement pe : parts) {
                JsonObject p = pe.getAsJsonObject();
                String n = p.get("n").getAsString();
                ModelPart mp = byName.get(p.get("p").getAsString()).getChild(n);
                byName.put(n, mp);
                m.parts.put(n, mp);
                JsonArray r = p.getAsJsonArray("rot");
                float[] bs = { r.get(0).getAsFloat(), r.get(1).getAsFloat(), r.get(2).getAsFloat() };
                m.base.put(n, bs);
                mp.xRot = bs[0]; mp.yRot = bs[1]; mp.zRot = bs[2];
            }
            return m;
        }
    }

    // ------------------------------------------------------------------ uçan pet: kendi fiziğiyle oyuncunun etrafında dolaşır
    private static final class Follow {
        float x, y, z, vx, vy, vz;       // oyuncu çerçevesinde konum / hız (blok)
        float heading, bank, lastDh;     // bakış yönü (radyan), yatış
        float phase;                     // kanat fazı
        float lastBy; boolean init;
        long at;
        float speed;                     // yumuşatılmış oyuncu hızı 0..1
    }
    private static final Map<String, Follow> FOLLOW = new ConcurrentHashMap<>();

    private static float lerp(float a, float b, float t) { return a + (b - a) * t; }
    private static float clamp(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }
    private static float wrap(float a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

    /** Çizim anındaki duruş bilgisi (ertelenmiş çizimde modele sonradan uygulanır). */
    public static final class Pose { float t, phase, burst, speed, bank, dir, vy; }

    /** Kısa süreli hızlı kanat çırpma (arada bir). t'nin saf fonksiyonu: Java ve launcher önizlemesi aynı. */
    public static float burstAt(float t) {
        float u = (float) (Math.sin(t * 0.72) + Math.sin(t * 0.31 + 1.0));
        return clamp((u - 1.5f) * 3f, 0f, 1f);
    }

    /**
     * Matris oyuncunun GÖVDE ÇERÇEVESİNDE (eğilme/duruştan etkilenmeyen) ayarlıyken çağrılır.
     * Pet kendi konumuna sahiptir: yay ile hedefe doğru süzülür, oyuncu dönünce/yürüyünce geride kalır,
     * oyuncunun arkasında ve çevresinde dolaşır, hareket yönüne bakar ve dönüşlerde yatar.
     * bodyYawDeg: oyuncunun gövde yönü (derece) - çerçeve dönüşünü telafi etmek için.
     */
    public static Pose placeFly(PoseStack m, String owner, float t, float limb, boolean sneaking, float bodyYawDeg) {
        Follow f = FOLLOW.computeIfAbsent(owner.toLowerCase(Locale.ROOT), k -> new Follow());
        long now = System.nanoTime();
        float dt = f.at == 0 ? 0.016f : clamp((now - f.at) / 1e9f, 0.001f, 0.08f);
        if (now == f.at) dt = 0f;
        f.at = now;
        float by = (float) Math.toRadians(bodyYawDeg);
        float speedT = clamp(limb, 0f, 1f);
        f.speed = lerp(f.speed, speedT, 1f - (float) Math.exp(-dt * 3f));
        float v = f.speed * 5.6f;                                   // oyuncunun ileri hızı (blok/sn) ~ yürüyüş/koşu

        // hedef: arkada, yukarıda, yavaşça yan yana salınan bir yörünge
        float ang = (float) (Math.sin(t * 0.29) * 1.75 + Math.sin(t * 0.71 + 1.0) * 0.45);
        float rad = 1.35f + 0.28f * (float) Math.sin(t * 0.47 + 2.0) + f.speed * 0.5f;
        float tx = (float) Math.sin(ang) * rad;
        float tz = (float) Math.cos(ang) * rad;
        float ty = -1.15f + 0.14f * (float) Math.sin(t * 1.9) + 0.2f * (float) Math.sin(t * 0.63) - f.speed * 0.08f;

        if (!f.init) { f.x = tx; f.y = ty; f.z = tz; f.heading = 0f; f.lastBy = by; f.init = true; }
        if (dt > 0f) {
            // oyuncu dönünce pet dünyada sabit kalır: çerçeveyi ters döndür
            float dy = wrap(by - f.lastBy);
            f.lastBy = by;
            float c = (float) Math.cos(dy), s = (float) Math.sin(dy);
            float nx = c * f.x - s * f.z, nz = s * f.x + c * f.z;
            f.x = nx; f.z = nz;
            float nvx = c * f.vx - s * f.vz, nvz = s * f.vx + c * f.vz;
            f.vx = nvx; f.vz = nvz;
            f.heading = wrap(f.heading - dy);
            // oyuncu ileri gidince pet geride kalır
            f.z += v * dt;
            // hafif sönümlü yay (organik, hafif taşma)
            float w = 3.3f, z2 = 0.8f;
            f.vx += ((tx - f.x) * w * w - 2f * z2 * w * f.vx) * dt;
            f.vy += ((ty - f.y) * w * w * 1.3f - 2f * 0.9f * w * f.vy) * dt;
            f.vz += ((tz - f.z) * w * w - 2f * z2 * w * f.vz) * dt;
            f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
            f.z = Math.min(f.z, 3.2f);
            // yön: dünyadaki hareket yönüne (oyuncu ileri = -z); duruyorsa oyuncuya/etrafa bak
            float wx = f.vx, wz = f.vz - v;
            float sp = (float) Math.sqrt(wx * wx + wz * wz);
            float lookX = -f.x, lookZ = -f.z;
            float la = (float) Math.atan2(-lookX, -lookZ) + (float) Math.sin(t * 0.9) * 0.6f;
            float desired = la;
            if (sp > 0.05f) {
                float ma = (float) Math.atan2(-wx, -wz);
                float wgt = clamp((sp - 0.4f) / 1.2f, 0f, 1f);
                desired = la + wrap(ma - la) * wgt;
            }
            float old = f.heading;
            f.heading = wrap(f.heading + wrap(desired - f.heading) * (1f - (float) Math.exp(-dt * 3.5f)));
            float dh = wrap(f.heading - old) / dt;
            f.lastDh = lerp(f.lastDh, dh, 1f - (float) Math.exp(-dt * 6f));
            f.bank = clamp(-f.lastDh * 0.28f, -0.5f, 0.5f);
            float burst = burstAt(t);
            f.phase += dt * (4.2f + f.speed * 1.6f + burst * 13f);
        }
        m.translate(f.x, f.y, f.z);
        float k = 0.8f;
        m.scale(k, k, k);
        Pose p = new Pose();
        p.t = t; p.phase = f.phase; p.burst = burstAt(t); p.speed = f.speed; p.bank = f.bank; p.dir = f.heading; p.vy = clamp(-f.vy, -1.5f, 1.5f);
        return p;
    }

    private static void rot(Model mdl, String n, float pitch, float yaw, float roll) {
        ModelPart p = mdl.part(n);
        if (p == null) return;
        float[] b = mdl.base.get(n);
        p.xRot = b[0] + pitch; p.yRot = b[1] + yaw; p.zRot = b[2] + roll;
    }

    /** Modeli duruşa sokar (çizmeden hemen önce çağır). Launcher önizlemesindeki flyPose ile aynı hareket. */
    public static void pose(Model mdl, Pose p) {
        mdl.reset();
        float t = p.t, ph = p.phase, sp = p.speed, br = p.burst;
        float s = (float) Math.sin(ph), c = (float) Math.cos(ph);
        mdl.root.yRot = p.dir;
        float amp = 0.62f + br * 0.22f;
        // gövde: kanat vuruşunda hafif zıplar, hıza göre öne eğilir, dönüşte yatar
        rot(mdl, "body", 0.1f + sp * 0.22f + p.vy * 0.12f - s * 0.04f, (float) Math.sin(t * 0.8 + 1.2) * 0.06f, p.bank);
        rot(mdl, "neck1", (float) Math.sin(t * 1.3) * 0.05f, (float) Math.sin(t * 1.1) * 0.12f, 0);
        rot(mdl, "neck2", (float) Math.sin(t * 1.3 + 0.7) * 0.06f - sp * 0.15f, (float) Math.sin(t * 1.1 + 0.9) * 0.16f, 0);
        rot(mdl, "head", (float) Math.sin(t * 1.9) * 0.06f + sp * 0.1f, (float) Math.sin(t * 0.7) * 0.3f, (float) Math.sin(t * 0.9) * 0.05f);
        float jaw = (float) Math.pow(Math.max(0, Math.sin(t * 0.5 + 2.0)), 8) * 0.3f + br * 0.12f;
        rot(mdl, "jaw", jaw, 0, 0);
        float fl = (float) Math.sin(t * 5.0) * 0.1f;
        rot(mdl, "finL", 0, 0, fl); rot(mdl, "finR", 0, 0, -fl);
        for (int i = 1; i <= 5; i++) {
            rot(mdl, "tail" + i, (float) Math.sin(t * 1.9 - i * 0.5) * 0.05f + sp * 0.04f,
                (float) Math.sin(t * 2.6 - i * 0.7) * (0.18f + 0.06f * i) + p.bank * -0.3f * i * 0.3f, 0);
        }
        // kanatlar: omuz vuruşu + dirsek katlanması + parmak kemiklerinin geriden gelmesi
        float sh = -0.12f + s * amp, el = -0.2f - c * 0.38f * (0.7f + br * 0.4f), sweep = s * 0.1f;
        rot(mdl, "wingL", 0, -0.22f - sweep, sh);   rot(mdl, "wingR", 0, 0.22f + sweep, -sh);
        rot(mdl, "wingAL", 0, 0, el);               rot(mdl, "wingAR", 0, 0, -el);
        for (int i = 1; i <= 3; i++) {
            float cur = -c * 0.16f * i;
            rot(mdl, "f" + i + "L", 0, 0, cur); rot(mdl, "f" + i + "R", 0, 0, -cur);
        }
        float tuck = sp * 0.3f;
        rot(mdl, "thighL", tuck + (float) Math.sin(t * 1.5) * 0.06f, 0, 0); rot(mdl, "thighR", tuck + (float) Math.sin(t * 1.5 + 0.5) * 0.06f, 0, 0);
    }
}
