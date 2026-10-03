package com.cubixora.cosmetics;

import net.minecraft.resources.Identifier;
import org.jetbrains.annotations.Nullable;

/** Bir oyuncunun Cubixora kozmetikleri (launcher'da seçilenler). */
public final class PlayerCosmetics {
    /** Özel skin dokusu; yoksa oyuncunun normal skini kullanılır. */
    @Nullable public volatile Identifier skinTexture;
    public volatile boolean slim;
    @Nullable public volatile Identifier capeTexture;
    @Nullable public volatile Identifier wingsTexture;
    public volatile boolean pet;
    public volatile boolean petRight;
    public volatile boolean wingsOpenDefault = true;
    public volatile float wingSpeed = 1f;
    public volatile float capeWave = 1f;
    /** Bu kayıt ne zaman alındı (yeniden sorgulama için). */
    public volatile long loadedAt;
    /** Oyuncunun kendi kaydı (bilgisayardaki self.json) buluttan gelenle ezilmez. */
    public volatile boolean local;
}
