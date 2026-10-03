package com.cubixora.client;

import net.minecraft.client.Minecraft;
import net.minecraft.core.component.DataComponents;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.decoration.ItemFrame;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.resources.Identifier;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.level.Level;

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

    private static final class Live { final ItemFrame e; final long expire; final Level world; Live(ItemFrame e, long expire, Level world) { this.e = e; this.expire = expire; this.world = world; } }
    private static final Map<String, Live> LIVE = new HashMap<>();

    /** Dokunulamayan, çarpışmayan sprey çerçevesi: fare ışını ve bloklar içinden geçer. */
    private static final class Frame extends ItemFrame {
        Frame(Level w, BlockPos p, Direction d) { super(w, p, d); }
        @Override public boolean isPickable() { return false; }
        @Override public boolean isAttackable() { return false; }
    }

    /** Çarktan sprey seçildiğinde. */
    public static void use(Minecraft mc) {
        long now = System.currentTimeMillis();
        if (mc.player == null || mc.level == null) return;
        if (now - lastUse < COOLDOWN_MS) { CxEmote.msg(mc, "§7Sprey hazır olmasına §f" + ((COOLDOWN_MS - (now - lastUse) + 999) / 1000) + " sn §7var"); return; }
        HitResult h = mc.player.pick(6.0, 1.0f, false);
        if (h == null || h.getType() != HitResult.Type.BLOCK) { CxEmote.msg(mc, "§7Sprey için bir bloğa bak"); return; }
        BlockHitResult b = (BlockHitResult) h;
        Direction side = b.getDirection();
        BlockPos at = b.getBlockPos().relative(side);
        int rot = (side == Direction.UP || side == Direction.DOWN) ? (Math.round((mc.player.getYRot() + 180f) / 45f) & 7) : 0;
        lastUse = now;
        String me = mc.player.getName().getString();
        spawn(me, at.getX(), at.getY(), at.getZ(), side.get3DDataValue(), rot, LIFE_MS);
        CxBridge.raw("/spray", "{\"x\":" + at.getX() + ",\"y\":" + at.getY() + ",\"z\":" + at.getZ() + ",\"d\":" + side.get3DDataValue() + ",\"r\":" + rot + "}", null);
        CxEmote.msg(mc, "§7Sprey basıldı");
    }

    /** Bir oyuncunun spreyini (kendi ya da başkasının) bu dünyaya koyar; eskisi varsa değiştirir. */
    public static void spawn(String owner, int x, int y, int z, int dir, int rot, long remainingMs) {
        Minecraft mc = Minecraft.getInstance();
        Level w = mc.level;
        if (w == null || remainingMs <= 0 || dir < 0 || dir > 5) return;
        remove(owner);
        try {
            Frame f = new Frame(w, new BlockPos(x, y, z), Direction.from3DDataValue(dir));
            ItemStack st = new ItemStack(Items.PAPER);
            st.set(DataComponents.ITEM_MODEL, Identifier.fromNamespaceAndPath("cubixora", "spray_logo"));
            f.setItem(st, false);
            f.setRotation(rot & 7);
            f.setInvisible(true);
            f.setInvulnerable(true);
            f.setId(nextId--);
            if (nextId < -2_000_000) nextId = -1_900_000;
            mc.level.addEntity(f);
            LIVE.put(owner.toLowerCase(Locale.ROOT), new Live(f, System.currentTimeMillis() + remainingMs, w));
        } catch (Throwable t) { com.cubixora.cosmetics.Cubixora.LOG.debug("sprey", t); }
    }

    public static void remove(String owner) {
        Live l = LIVE.remove(owner.toLowerCase(Locale.ROOT));
        if (l != null) kill(l);
    }

    private static void kill(Live l) {
        try { Minecraft mc = Minecraft.getInstance(); if (mc.level == l.world) mc.level.removeEntity(l.e.getId(), Entity.RemovalReason.DISCARDED); } catch (Throwable ignored) {}
    }

    /** Her istemci tikinde: süresi dolanları kaldırır, dünya değişince hepsini bırakır. */
    public static void tick(Minecraft mc) {
        if (LIVE.isEmpty()) return;
        long now = System.currentTimeMillis();
        List<String> gone = new ArrayList<>();
        for (Map.Entry<String, Live> en : LIVE.entrySet()) if (mc.level != en.getValue().world || now >= en.getValue().expire) gone.add(en.getKey());
        for (String k : gone) { Live l = LIVE.remove(k); if (l != null) kill(l); }
    }
}
