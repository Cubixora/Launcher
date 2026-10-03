package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxFontFilter;
import net.minecraft.resources.FileToIdConverter;
import net.minecraft.resources.Identifier;
import net.minecraft.server.packs.resources.Resource;
import net.minecraft.server.packs.resources.ResourceManager;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Açılışta seçili olmayan yazı stillerinin büyük harf / başlık boyları yüklenmez (bkz. CxFontFilter). */
@Mixin(FileToIdConverter.class)
public abstract class FontFinderMixin {
    @Shadow @Final private String prefix;

    @Inject(method = "listMatchingResourceStacks", at = @At("RETURN"), cancellable = true, require = 0)
    private void cubixora$fonts(ResourceManager rm, CallbackInfoReturnable<Map<Identifier, List<Resource>>> cir) {
        if (!"font".equals(prefix)) return;
        Map<Identifier, List<Resource>> in = cir.getReturnValue(), out = new LinkedHashMap<>();
        CxFontFilter.begin();
        for (Map.Entry<Identifier, List<Resource>> e : in.entrySet()) {
            Identifier id = e.getKey();
            if (CxFontFilter.keep(id.getNamespace(), id.getPath())) { out.put(id, e.getValue()); CxFontFilter.kept(id.getNamespace(), id.getPath()); }
        }
        CxFontFilter.end();
        cir.setReturnValue(out);
    }
}
