package net.firebrox.greenlantern.block;

import net.minecraft.block.AbstractBlock;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.sound.BlockSoundGroup;
import net.firebrox.greenlantern.GreenLantern;
import net.minecraft.util.Identifier;

public class ModBlocks {
    public static final Block POWER_BATTERY = new PowerBatteryBlock(
            AbstractBlock.Settings.copy(Blocks.LANTERN)
                    .strength(3.5F)
                    .luminance(state -> 12)
                    .requiresTool()
                    .sounds(BlockSoundGroup.METAL)
                    .nonOpaque());

    public static void register() {
        register("power_battery", POWER_BATTERY);
        GreenLantern.LOGGER.info("[Green Lantern] Blocks registered.");
    }

    private static Block register(String path, Block block) {
        Identifier id = GreenLantern.id(path);
        return Registry.register(Registries.BLOCK, id, block);
    }
}
