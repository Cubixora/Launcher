package com.cubixora.client;

import net.minecraft.client.resources.sounds.AbstractTickableSoundInstance;
import net.minecraft.client.resources.sounds.SoundInstance;
import net.minecraft.sounds.SoundSource;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.resources.Identifier;

/** Menülerde çalan, kesintisiz dönen yağmur sesi. Hedef ses seviyesine yumuşakça yaklaşır, 0'a inince durur. */
final class CxRainSound extends AbstractTickableSoundInstance {
    float target = 0.5f;

    CxRainSound() {
        super(SoundEvent.createVariableRangeEvent(Identifier.fromNamespaceAndPath("cubixora", "rain")), SoundSource.MASTER, SoundInstance.createUnseededRandom());
        this.looping = true;
        this.delay = 0;
        this.relative = true;
        this.attenuation = SoundInstance.Attenuation.NONE;
        this.volume = 0.01f;
    }

    boolean finished() { return isStopped(); }

    @Override
    public void tick() {
        volume += (target - volume) * 0.06f;
        if (target <= 0.001f && volume < 0.01f) stop();
    }

    @Override public boolean canStartSilent() { return true; }
}
