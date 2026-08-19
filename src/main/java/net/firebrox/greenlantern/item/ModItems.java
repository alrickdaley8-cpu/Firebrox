package net.firebrox.greenlantern.item;

import net.fabricmc.fabric.api.itemgroup.v1.FabricItemGroup;
import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;
import net.firebrox.greenlantern.GreenLantern;
import net.firebrox.greenlantern.block.ModBlocks;
import net.minecraft.item.BlockItem;
import net.minecraft.item.Item;
import net.minecraft.item.ItemGroup;
import net.minecraft.item.ItemGroups;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

public class ModItems {
    public static final PowerRingItem POWER_RING = new PowerRingItem(
            new Item.Settings().maxCount(1).fireproof());

    public static final Item POWER_BATTERY_ITEM = new BlockItem(
            ModBlocks.POWER_BATTERY, new Item.Settings());

    public static final Item WILLPOWER_CRYSTAL = new Item(
            new Item.Settings());

    // Our own creative-tab item group.
    public static final RegistryKey<ItemGroup> GREEN_LANTERN_GROUP_KEY =
            RegistryKey.of(RegistryKeys.ITEM_GROUP, GreenLantern.id("green_lantern"));

    public static final ItemGroup GREEN_LANTERN_GROUP = FabricItemGroup.builder()
            .icon(() -> {
                ItemStack stack = new ItemStack(POWER_RING);
                PowerRingItem.setEnergy(stack, PowerRingItem.MAX_ENERGY);
                return stack;
            })
            .displayName(Text.translatable("itemGroup.greenlantern.green_lantern"))
            .build();

    public static void register() {
        register("power_ring", POWER_RING);
        register("power_battery", POWER_BATTERY_ITEM);
        register("willpower_crystal", WILLPOWER_CRYSTAL);

        Registry.register(Registries.ITEM_GROUP, GREEN_LANTERN_GROUP_KEY, GREEN_LANTERN_GROUP);

        // Populate our own tab.
        ItemGroupEvents.modifyEntriesEvent(GREEN_LANTERN_GROUP_KEY).register(entries -> {
            ItemStack chargedRing = new ItemStack(POWER_RING);
            PowerRingItem.setEnergy(chargedRing, PowerRingItem.MAX_ENERGY);
            entries.add(chargedRing);
            entries.add(POWER_BATTERY_ITEM);
            entries.add(WILLPOWER_CRYSTAL);
        });

        // Also drop a convenience copy into the vanilla Tools/Combat tabs.
        ItemGroupEvents.modifyEntriesEvent(ItemGroups.TOOLS).register(entries ->
                entries.add(POWER_RING));
        ItemGroupEvents.modifyEntriesEvent(ItemGroups.INGREDIENTS).register(entries ->
                entries.add(WILLPOWER_CRYSTAL));

        GreenLantern.LOGGER.info("[Green Lantern] Items registered.");
    }

    private static Item register(String path, Item item) {
        Identifier id = GreenLantern.id(path);
        return Registry.register(Registries.ITEM, id, item);
    }
}
