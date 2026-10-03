package com.cubixora.cosmetics.mixin;

import com.cubixora.client.CxClient;
import com.cubixora.client.CxFont;
import com.cubixora.client.CxPlayersScreen;
import net.minecraft.client.gui.hud.PlayerListHud;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** TAB listesinde Cubixora Client kullanan oyuncuların adının başına CX logosu koyar. */
@Mixin(PlayerListHud.class)
public abstract class PlayerListHudMixin {
    @Inject(method = "getPlayerName", at = @At("RETURN"), cancellable = true, require = 0)
    private void cubixora$logo(PlayerListEntry entry, CallbackInfoReturnable<Text> cir) {
        if (CxClient.enabled && CxPlayersScreen.isCxUser(CxPlayersScreen.nameOf(entry))) cir.setReturnValue(CxFont.logoName(cir.getReturnValue()));
    }
}
