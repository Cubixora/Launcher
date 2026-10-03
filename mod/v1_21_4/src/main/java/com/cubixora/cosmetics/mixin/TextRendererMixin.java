package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxFont;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Cubixora profilinde varsayılan yazı tipi yerine Cubixora yazı tipi kullanılır. */
@Mixin(TextRenderer.class)
public abstract class TextRendererMixin {
    @ModifyVariable(method = "getFontStorage", at = @At("HEAD"), argsOnly = true, require = 0)
    private Identifier cubixora$font(Identifier id) { return CxFont.map(id); }
}
