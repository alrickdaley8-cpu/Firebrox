package net.firebrox.greenlantern.client;

import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.firebrox.greenlantern.item.PowerRingItem;
import net.firebrox.greenlantern.power.RingConstruct;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.item.ItemStack;
import net.minecraft.text.Text;

/**
 * Draws a small willpower gauge + selected-construct label in the bottom-left
 * of the screen whenever the player holds a charged (or chargeable) Power Ring.
 */
public class RingHudOverlay implements HudRenderCallback {

    private static final int BAR_WIDTH = 80;
    private static final int BAR_HEIGHT = 6;

    @Override
    public void onHudRender(DrawContext context, float tickDelta) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.options.hudHidden) {
            return;
        }

        ItemStack ring = findRing();
        if (ring == null) {
            return;
        }

        int energy = PowerRingItem.getEnergy(ring);
        RingConstruct construct = PowerRingItem.getConstruct(ring);

        int screenH = client.getWindow().getScaledHeight();
        int x = 8;
        int y = screenH - 32;

        // Background bar.
        context.fill(x - 1, y - 1, x + BAR_WIDTH + 1, y + BAR_HEIGHT + 1, 0xAA000000);
        context.fill(x, y, x + BAR_WIDTH, y + BAR_HEIGHT, 0xFF203020);

        // Fill proportion.
        int filled = Math.round(BAR_WIDTH * (energy / (float) PowerRingItem.MAX_ENERGY));
        int color = energy > 0 ? 0xFF21DD3B : 0xFF553333;
        context.fill(x, y, x + filled, y + BAR_HEIGHT, color);

        // Labels.
        Text label = Text.translatable("construct.greenlantern." + construct.name().toLowerCase());
        context.drawTextWithShadow(client.textRenderer,
                Text.translatable("hud.greenlantern.willpower", energy, PowerRingItem.MAX_ENERGY),
                x, y - 20, 0xFF7CFF8A);
        context.drawTextWithShadow(client.textRenderer, label, x, y - 10, 0xFF9FE9FF);
    }

    private static ItemStack findRing() {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null) {
            return null;
        }
        ItemStack main = client.player.getMainHandStack();
        if (main.getItem() instanceof PowerRingItem) {
            return main;
        }
        ItemStack off = client.player.getOffHandStack();
        if (off.getItem() instanceof PowerRingItem) {
            return off;
        }
        return null;
    }
}
