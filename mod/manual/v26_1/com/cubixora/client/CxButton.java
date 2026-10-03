package com.cubixora.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.narration.NarrationElementOutput;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Util;

import java.util.function.Consumer;

/**
 * Cubixora menü düğmesi: koyu zemin; üzerine gelince altın alt çizgi ortadan açılır, yazı altına döner.
 * Açılışta sırayla hızlıca aşağıdan süzülerek gelir.
 */
public final class CxButton extends AbstractWidget {
    private final Consumer<CxButton> onPress;
    private float hover;
    private long last = Util.getMillis();
    long opened = Util.getMillis();
    float appearDelay;
    boolean pill;

    public CxButton(int x, int y, int w, int h, Component label, Consumer<CxButton> onPress) {
        super(x, y, w, h, label);
        this.onPress = onPress;
    }

    @Override
    protected void extractWidgetRenderState(GuiGraphicsExtractor c, int mouseX, int mouseY, float delta) {
        long now = Util.getMillis();
        float dt = Math.min(0.1f, (now - last) / 1000f); last = now;
        hover = CxUi.approach(hover, isHovered() && active ? 1 : 0, 20, dt);
        float ap = CxUi.easeOut(((now - opened) / 1000f - appearDelay) / 0.22f);
        if (ap <= 0) return;
        int x = getX(), y = getY() + Math.round((1 - ap) * 5), w = getWidth(), h = getHeight();
        var tr = Minecraft.getInstance().font;
        String label = getMessage().getString();
        if (pill) {
            CxUi.round(c, x, y, w, h, 5, CxUi.alpha(CxUi.mix(0xCC15161B, 0xEE1E1F26, hover), ap));
            CxUi.round(c, x, y + h - 1, w, 1, 0, CxUi.alpha(CxUi.mix(0x33FFFFFF, CxUi.ACCENT, hover), ap));
            int tw = tr.width(label);
            c.text(tr, label, x + (w - tw) / 2, y + (h - 8) / 2, CxUi.alpha(CxUi.ACCENT, ap), false);
            return;
        }
        // menü düğmesi: koyu yarı saydam zemin, üzerine gelince altın çizgi ortadan açılır, yazı altına döner
        float hv = CxUi.easeOut(hover);
        CxUi.round(c, x, y, w, h, 4, CxUi.alpha(CxUi.mix(0x9E101116, 0xE01C1D26, hv), ap));
        c.fill(x + 4, y, x + w - 4, y + 1, CxUi.alpha(0x14FFFFFF, ap));
        if (hv > 0.01f) {
            int half = Math.round((w / 2f - 4) * hv), cx = x + w / 2;
            c.fill(cx - half, y + h - 1, cx + half, y + h, CxUi.alpha(CxUi.ACCENT, hv * ap));
            c.fill(x, y + 4, x + 2, y + h - 4, CxUi.alpha(CxUi.ACCENT, hv * ap));
        }
        int tw = tr.width(label);
        c.text(tr, label, x + (w - tw) / 2, y + (h - 8) / 2, CxUi.alpha(CxUi.mix(0xFFE9E9EE, CxUi.ACCENT, hv), ap), false);
    }

    @Override
    public void onClick(net.minecraft.client.input.MouseButtonEvent click, boolean doubled) {
        onPress.accept(this);
    }

    @Override
    protected void updateWidgetNarration(NarrationElementOutput builder) { defaultButtonNarrationText(builder); }
}
