package com.cubixora.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.entity.Entity;
import net.minecraft.entity.decoration.ItemFrameEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.util.Identifier;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;
import net.minecraft.world.World;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Cubixora spreyi: baktığın bloğun yüzüne logo basar (10 sn kalır, 10 sn'de bir kullanılır).
 * Görsel, yalnızca bu istemcide var olan görünmez bir eşya çerçevesidir; sunucuya hiçbir şey gitmez.
 * Diğer Cubixora oyuncuları spreyi bulut kaydından alıp kendi dünyalarında aynı yere çizer.
 */
public final class CxSpray {
    private CxSpray() {}

    public static final long LIFE_MS = 10_000, COOLDOWN_MS = 10_000;
    private static long lastUse;
    private static int nextId = -1_900_000;

    private static final class Live { final ItemFrameEntity e; final long expire; final World world; Live(ItemFrameEntity e, long expire, World world) { this.e = e; this.expire = expire; this.world = world; } }
    private static final Map<String, Live> LIVE = new HashMap<>();

    /** Dokunulamayan, çarpışmayan sprey çerçevesi: fare ışını ve bloklar içinden geçer. */
    private static final class Frame extends ItemFrameEntity {
        Frame(World w, BlockPos p, Direction d) { super(w, p, d); }
        @Override public boolean canHit() { return false; }
        @Override public boolean isAttackable() { return false; }
    }

    /** Çarktan sprey seçildiğinde. */
    public static void use(MinecraftClient mc) {
        long now = System.currentTimeMillis();
        if (mc.player == null || mc.world == null) return;
        if (now - lastUse < COOLDOWN_MS) { CxEmote.msg(mc, "§7Sprey hazır olmasına §f" + ((COOLDOWN_MS - (now - lastUse) + 999) / 1000) + " sn §7var"); return; }
        HitResult h = mc.player.raycast(6.0, 1.0f, false);
        if (h == null || h.getType() != HitResult.Type.BLOCK) { CxEmote.msg(mc, "§7Sprey için bir bloğa bak"); return; }
        BlockHitResult b = (BlockHitResult) h;
        Direction side = b.getSide();
        BlockPos at = b.getBlockPos().offset(side);
        int rot = (side == Direction.UP || side == Direction.DOWN) ? (Math.round((mc.player.getYaw() + 180f) / 45f) & 7) : 0;
        lastUse = now;
        String me = mc.player.getName().getString();
        spawn(me, at.getX(), at.getY(), at.getZ(), side.getId(), rot, LIFE_MS);
        CxBridge.raw("/spray", "{\"x\":" + at.getX() + ",\"y\":" + at.getY() + ",\"z\":" + at.getZ() + ",\"d\":" + side.getId() + ",\"r\":" + rot + "}", null);
        CxEmote.msg(mc, "§7Sprey basıldı");
    }

    /** Bir oyuncunun spreyini (kendi ya da başkasının) bu dünyaya koyar; eskisi varsa değiştirir. */
    public static void spawn(String owner, int x, int y, int z, int dir, int rot, long remainingMs) {
        MinecraftClient mc = MinecraftClient.getInstance();
        World w = mc.world;
        if (w == null || remainingMs <= 0 || dir < 0 || dir > 5) return;
        remove(owner);
        try {
            Frame f = new Frame(w, new BlockPos(x, y, z), Direction.byId(dir));
            ItemStack st = new ItemStack(Items.PAPER);
            st.set(DataComponentTypes.ITEM_MODEL, Identifier.of("cubixora", "spray_logo"));
            f.setHeldItemStack(st, false);
            f.setRotation(rot & 7);
            f.setInvisible(true);
            f.setInvulnerable(true);
            f.setId(nextId--);
            if (nextId < -2_000_000) nextId = -1_900_000;
            mc.world.addEntity(f);
            LIVE.put(owner.toLowerCase(Locale.ROOT), new Live(f, System.currentTimeMillis() + remainingMs, w));
        } catch (Throwable t) { com.cubixora.cosmetics.Cubixora.LOG.debug("sprey", t); }
    }

    public static void remove(String owner) {
        Live l = LIVE.remove(owner.toLowerCase(Locale.ROOT));
        if (l != null) kill(l);
    }

    private static void kill(Live l) {
        try { MinecraftClient mc = MinecraftClient.getInstance(); if (mc.world == l.world) mc.world.removeEntity(l.e.getId(), Entity.RemovalReason.DISCARDED); } catch (Throwable ignored) {}
    }

    /** Her istemci tikinde: süresi dolanları kaldırır, dünya değişince hepsini bırakır. */
    public static void tick(MinecraftClient mc) {
        if (LIVE.isEmpty()) return;
        long now = System.currentTimeMillis();
        List<String> gone = new ArrayList<>();
        for (Map.Entry<String, Live> en : LIVE.entrySet()) if (mc.world != en.getValue().world || now >= en.getValue().expire) gone.add(en.getKey());
        for (String k : gone) { Live l = LIVE.remove(k); if (l != null) kill(l); }
    }
}
