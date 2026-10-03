package com.cubixora.client;

import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.Clip;
import javax.sound.sampled.FloatControl;
import javax.sound.sampled.LineEvent;
import java.io.BufferedInputStream;
import java.io.InputStream;

/**
 * Açılış sesi. Minecraft'ın ses sistemi kaynaklar yüklenmeden çalışmadığı için Java'nın kendi ses altyapısıyla çalınır.
 * Ses cihazını açmak ve dosyayı çözmek ağırdır (yüzlerce ms); bu iş oyun başlarken arka planda yapılır ({@link #prepare}),
 * açılış animasyonunun ilk karesinde yalnızca hazır klip başlatılır. Böylece animasyon sırasında takılma olmaz.
 */
public final class CxBootSound {
    private static volatile Clip ready;
    private static volatile boolean preparing, played, done;
    private CxBootSound() {}

    /** Klibi arka planda hazırlar (birden çok kez çağrılabilir). */
    public static synchronized void prepare() {
        if (preparing || played) return;
        preparing = true;
        Thread th = new Thread(() -> {
            try (InputStream in = CxBootSound.class.getResourceAsStream("/assets/cubixora/boot/intro.wav")) {
                if (in == null) return;
                AudioInputStream ais = AudioSystem.getAudioInputStream(new BufferedInputStream(in));
                Clip clip = AudioSystem.getClip();
                clip.open(ais);
                clip.addLineListener(e -> { if (e.getType() == LineEvent.Type.STOP) clip.close(); });
                ready = clip;
            } catch (Throwable ignored) {
            } finally { done = true; }
        }, "Cubixora-BootSound");
        th.setDaemon(true);
        th.setPriority(Thread.MIN_PRIORITY);
        th.start();
    }

    public static void play(float volume) {
        if (played) return;
        played = true;
        prepare();
        Thread th = new Thread(() -> {
            try {
                // hazır olana kadar bekle (en fazla ~3 sn); ana (çizim) iş parçacığını hiç bekletmez
                for (int i = 0; i < 150 && !done; i++) Thread.sleep(20);
                Clip clip = ready;
                if (clip == null) return;
                try {
                    FloatControl g = (FloatControl) clip.getControl(FloatControl.Type.MASTER_GAIN);
                    g.setValue(Math.max(g.getMinimum(), (float) (20 * Math.log10(Math.max(0.0001, volume)))));
                } catch (Exception ignored) {}
                clip.start();
            } catch (Throwable ignored) {
            }
        }, "Cubixora-BootSound-Play");
        th.setDaemon(true);
        th.start();
    }
}
