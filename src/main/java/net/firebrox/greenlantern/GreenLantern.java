package net.firebrox.greenlantern;

import net.fabricmc.api.ModInitializer;
import net.firebrox.greenlantern.block.ModBlocks;
import net.firebrox.greenlantern.item.ModItems;
import net.firebrox.greenlantern.network.ModNetworking;
import net.firebrox.greenlantern.power.FlightManager;
import net.minecraft.util.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Green Lantern - a willpower / power-ring mod for Fabric.
 *
 * <p>Charge a {@code Power Ring} at a {@code Power Battery} and spend that
 * energy on ring "constructs": an energy beam, sustained flight, a protective
 * shield, and hard-light platforms.</p>
 */
public class GreenLantern implements ModInitializer {
    public static final String MOD_ID = "greenlantern";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    public static Identifier id(String path) {
        return new Identifier(MOD_ID, path);
    }

    @Override
    public void onInitialize() {
        LOGGER.info("[Green Lantern] In brightest day, in blackest night... initializing.");
        ModBlocks.register();
        ModItems.register();
        ModNetworking.registerServerReceivers();
        FlightManager.registerServerTick();
        LOGGER.info("[Green Lantern] Ready. No evil shall escape my sight.");
    }
}
