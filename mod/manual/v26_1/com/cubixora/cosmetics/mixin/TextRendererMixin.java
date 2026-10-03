package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxFont;
import net.minecraft.client.gui.Font;
import net.minecraft.network.chat.FontDescription;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Cubixora profilinde varsayılan yazı tipi yerine Cubixora yazı tipi kullanılır. */
@Mixin(Font.class)
public abstract class TextRendererMixin {
    @ModifyVariable(method = "getGlyphSource", at = @At("HEAD"), argsOnly = true, require = 0)
    private FontDescription cubixora$font(FontDescription src) { return CxFont.map(src); }
}
