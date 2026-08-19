package net.firebrox.greenlantern.power;

import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.firebrox.greenlantern.item.PowerRingItem;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Tracks which players are actively flying on ring-power and drains willpower
 * once per second. When the ring runs dry (or the ring leaves their hands), the
 * player's creative-flight ability is revoked and they fall.
 */
public final class FlightManager {
    private FlightManager() {}

    private static final Set<UUID> FLYING = new HashSet<>();
    private static int tickCounter = 0;

    /** @return true if the player is now flying, false if flight was toggled off. */
    public static boolean toggle(ServerPlayerEntity player) {
        UUID id = player.getUuid();
        if (FLYING.contains(id)) {
            FLYING.remove(id);
            return false;
        }
        FLYING.add(id);
        return true;
    }

    public static boolean isFlying(ServerPlayerEntity player) {
        return FLYING.contains(player.getUuid());
    }

    public static void stop(ServerPlayerEntity player) {
        FLYING.remove(player.getUuid());
        applyGroundAbilities(player);
    }

    /** Revoke flight abilities unless the player is in creative/spectator. */
    public static void applyGroundAbilities(ServerPlayerEntity player) {
        if (player.isCreative() || player.isSpectator()) {
            return;
        }
        player.getAbilities().allowFlying = false;
        player.getAbilities().flying = false;
        player.sendAbilitiesUpdate();
    }

    public static void registerServerTick() {
        ServerTickEvents.END_SERVER_TICK.register(server -> {
            tickCounter++;
            boolean drainTick = tickCounter % 20 == 0; // once a second
            if (FLYING.isEmpty()) {
                return;
            }

            // Snapshot to avoid concurrent modification.
            for (UUID id : new HashSet<>(FLYING)) {
                ServerPlayerEntity player = server.getPlayerManager().getPlayer(id);
                if (player == null) {
                    FLYING.remove(id);
                    continue;
                }

                ItemStack ring = RingPowerHandler.findRing(player);
                if (ring == null) {
                    // Ring removed — cancel flight.
                    stop(player);
                    player.sendMessage(net.minecraft.text.Text.translatable(
                            "message.greenlantern.flight_off"), true);
                    continue;
                }

                // Keep ability enabled for non-creative players.
                if (!player.isCreative() && !player.isSpectator()) {
                    player.getAbilities().allowFlying = true;
                    if (!player.getAbilities().flying) {
                        // Player landed / stopped; keep tracking but don't drain while grounded.
                    }
                }

                if (drainTick && player.getAbilities().flying) {
                    if (!PowerRingItem.consumeEnergy(ring, RingConstruct.FLIGHT.cost())) {
                        stop(player);
                        player.sendMessage(net.minecraft.text.Text.translatable(
                                "message.greenlantern.ring_empty"), true);
                        player.getWorld().playSound(null, player.getX(), player.getY(), player.getZ(),
                                SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(), SoundCategory.PLAYERS,
                                0.6F, 0.8F);
                    }
                }
            }
        });
    }
}
