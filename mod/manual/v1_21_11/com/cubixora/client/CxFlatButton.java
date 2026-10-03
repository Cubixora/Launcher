package com.cubixora.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.narration.NarrationMessageBuilder;
import net.minecraft.client.gui.widget.ClickableWidget;
import net.minecraft.text.Text;
import net.minecraft.util.Util;

/** Cubixora arayüz düğmesi (ESC menüsü satırı, Hata Bildir vb.): CxStyle renkleri, üzerine gelince aydınlanır. */
public final class CxFlatButton extends ClickableWidget {
    private final Runnable run;
    private float hover;
    private long last = Util.getMeasuringTimeMs();
    public boolean accent;
    /** Gizlenmiş vanilla düğmenin kopyası: konum, yazı ve etkinlik durumu ondan alınır. */
    public ClickableWidget mirror;
    /** ESC menüsü: sonradan başka modların eklediği düğmeleri (Mod Menu) temizlemek için ekran. */
    public Screen owner;
    public java.util.function.Supplier<String> dynamic;
    public java.util.function.BooleanSupplier accentWhen;

    public CxFlatButton(int x, int y, int w, int h, String label, Runnable run) {
        super(x, y, w, h, Text.literal(label));
        this.run = run;
    }

    @Override
    protected void renderWidget(DrawContext c, int mouseX, int mouseY, float delta) {
        long now = Util.getMeasuringTimeMs();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        if (owner != null) CxPause.sweep(owner);
        if (mirror != null) { setX(mirror.getX()); setY(mirror.getY()); active = mirror.active; setMessage(mirror.getMessage()); }
        if (dynamic != null) setMessage(Text.literal(dynamic.get()));
        if (accentWhen != null) accent = accentWhen.getAsBoolean();
        hover = CxUi.approach(hover, isHovered() ? 1 : 0, 18, dt);
        var tr = MinecraftClient.getInstance().textRenderer;
        int x = getX(), y = getY(), w = getWidth(), h = getHeight();
        int r = Math.min(7, h / 2 - 1);
        CxUi.round(c, x, y, w, h, r, CxUi.mix(accent ? CxStyle.accent(0.22f) : CxStyle.button(), accent ? CxStyle.accent(0.42f) : CxStyle.buttonHover(), hover));
        c.fillGradient(x + 2, y + 1, x + w - 2, y + h / 2, CxUi.alpha(0xFFFFFFFF, 0.06f + hover * 0.05f), 0);   // üstten ince ışık
        CxUi.outline(c, x, y, w, h, r, CxUi.alpha(accent ? CxStyle.accent() : CxStyle.panelBorder(), 0.55f + hover * 0.45f));
        CxUi.capsBox(c, tr, getMessage().getString(), x, y, w, h, accent ? CxUi.mix(CxStyle.buttonText(), CxStyle.accent(), 0.6f) : active ? CxStyle.buttonText() : CxUi.alpha(CxStyle.buttonText(), 0.4f));
    }

    @Override public void onClick(net.minecraft.client.gui.Click click, boolean doubled) { CxUi.click(); run.run(); }
    @Override protected void appendClickableNarrations(NarrationMessageBuilder builder) { appendDefaultNarrations(builder); }
}
