package net.firebrox.greenlantern.network;

import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.firebrox.greenlantern.GreenLantern;
import net.firebrox.greenlantern.item.PowerRingItem;
import net.firebrox.greenlantern.power.RingConstruct;
import net.firebrox.greenlantern.power.RingPowerHandler;
import net.minecraft.item.ItemStack;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

/**
 * Client -> server messages for the Green Lantern ring.
 * <ul>
 *     <li>{@link #ACTIVATE_CONSTRUCT} — fire / apply the selected construct.</li>
 *     <li>{@link #CYCLE_CONSTRUCT} — switch to the next (or previous) construct.</li>
 * </ul>
 */
public final class ModNetworking {
    private ModNetworking() {}

    public static final Identifier ACTIVATE_CONSTRUCT = GreenLantern.id("activate_construct");
    public static final Identifier CYCLE_CONSTRUCT = GreenLantern.id("cycle_construct");

    public static void registerServerReceivers() {
        ServerPlayNetworking.registerGlobalReceiver(ACTIVATE_CONSTRUCT,
                (server, player, handler, buf, responseSender) ->
                        server.execute(() -> RingPowerHandler.activate(player)));

        ServerPlayNetworking.registerGlobalReceiver(CYCLE_CONSTRUCT,
                (server, player, handler, buf, responseSender) -> {
                    boolean forward = buf.readBoolean();
                    server.execute(() -> {
                        ItemStack ring = RingPowerHandler.findRing(player);
                        if (ring == null) {
                            return;
                        }
                        RingConstruct current = PowerRingItem.getConstruct(ring);
                        RingConstruct next = forward ? current.next() : current.previous();
                        PowerRingItem.setConstruct(ring, next);
                        player.sendMessage(Text.translatable("message.greenlantern.construct_selected",
                                Text.translatable("construct.greenlantern." + next.name().toLowerCase())), true);
                    });
                });

        GreenLantern.LOGGER.info("[Green Lantern] Server network receivers registered.");
    }
}
