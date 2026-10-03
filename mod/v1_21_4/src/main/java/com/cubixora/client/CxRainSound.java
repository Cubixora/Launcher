package com.cubixora.client;

import net.minecraft.client.sound.MovingSoundInstance;
import net.minecraft.client.sound.SoundInstance;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvent;
import net.minecraft.util.Identifier;

/** Menülerde çalan, kesintisiz dönen yağmur sesi. Hedef ses seviyesine yumuşakça yaklaşır, 0'a inince durur. */
final class CxRainSound extends MovingSoundInstance {
    float target = 0.5f;

    CxRainSound() {
        super(SoundEvent.of(Identifier.of("cubixora", "rain")), SoundCategory.MASTER, SoundInstance.createRandom());
        this.repeat = true;
        this.repeatDelay = 0;
        this.relative = true;
        this.attenuationType = SoundInstance.AttenuationType.NONE;
        this.volume = 0.01f;
    }

    boolean finished() { return isDone(); }

    @Override
    public void tick() {
        volume += (target - volume) * 0.06f;
        if (target <= 0.001f && volume < 0.01f) setDone();
    }

    @Override public boolean shouldAlwaysPlay() { return true; }
}
