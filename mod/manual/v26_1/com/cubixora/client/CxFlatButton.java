package com.cubixora.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.narration.NarrationElementOutput;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Util;

/** Cubixora arayüz düğmesi (ESC menüsü satırı, Hata Bildir vb.): CxStyle renkleri, üzerine gelince aydınlanır. */
public final class CxFlatButton extends AbstractWidget {
    private final Runnable run;
    private float hover;
    private long last = Util.getMillis();
    public boolean accent;
    /** Gizlenmiş vanilla düğmenin kopyası: konum, yazı ve etkinlik durumu ondan alınır. */
    public AbstractWidget mirror;
    /** ESC menüsü: sonradan başka modların eklediği düğmeleri (Mod Menu) temizlemek için ekran. */
    public Screen owner;
    public java.util.function.Supplier<String> dynamic;
    public java.util.function.BooleanSupplier accentWhen;

    public CxFlatButton(int x, int y, int w, int h, String label, Runnable run) {
        super(x, y, w, h, Component.literal(label));
        this.run = run;
    }

    @Override
    protected void extractWidgetRenderState(GuiGraphicsExtractor c, int mouseX, int mouseY, float delta) {
        long now = Util.getMillis();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        if (owner != null) CxPause.sweep(owner);
        if (mirror != null) { setX(mirror.getX()); setY(mirror.getY()); active = mirror.active; setMessage(mirror.getMessage()); }
        if (dynamic != null) setMessage(Component.literal(dynamic.get()));
        if (accentWhen != null) accent = accentWhen.getAsBoolean();
        hover = CxUi.approach(hover, isHovered() ? 1 : 0, 18, dt);
        var tr = Minecraft.getInstance().font;
        int x = getX(), y = getY(), w = getWidth(), h = getHeight();
        int r = Math.min(7, h / 2 - 1);
        CxUi.round(c, x, y, w, h, r, CxUi.mix(accent ? CxStyle.accent(0.22f) : CxStyle.button(), accent ? CxStyle.accent(0.42f) : CxStyle.buttonHover(), hover));
        c.fillGradient(x + 2, y + 1, x + w - 2, y + h / 2, CxUi.alpha(0xFFFFFFFF, 0.06f + hover * 0.05f), 0);   // üstten ince ışık
        CxUi.outline(c, x, y, w, h, r, CxUi.alpha(accent ? CxStyle.accent() : CxStyle.panelBorder(), 0.55f + hover * 0.45f));
        CxUi.capsBox(c, tr, getMessage().getString(), x, y, w, h, accent ? CxUi.mix(CxStyle.buttonText(), CxStyle.accent(), 0.6f) : active ? CxStyle.buttonText() : CxUi.alpha(CxStyle.buttonText(), 0.4f));
    }

    @Override public void onClick(net.minecraft.client.input.MouseButtonEvent click, boolean doubled) { CxUi.click(); run.run(); }
    @Override protected void updateWidgetNarration(NarrationElementOutput builder) { defaultButtonNarrationText(builder); }
}
