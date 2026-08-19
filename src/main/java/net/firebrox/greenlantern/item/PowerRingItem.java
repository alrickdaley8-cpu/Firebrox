package net.firebrox.greenlantern.item;

import net.firebrox.greenlantern.power.RingConstruct;
import net.minecraft.client.item.TooltipContext;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.world.World;

import java.util.List;

/**
 * The Power Ring. It stores "willpower" (energy) and a currently-selected
 * {@link RingConstruct}. Energy is refilled at a Power Battery block and spent
 * when the player activates constructs (handled server-side via networking and
 * {@link net.firebrox.greenlantern.power.RingPowerHandler}).
 */
public class PowerRingItem extends Item {
    public static final int MAX_ENERGY = 200;

    private static final String NBT_ENERGY = "Willpower";
    private static final String NBT_CONSTRUCT = "Construct";

    public PowerRingItem(Settings settings) {
        super(settings);
    }

    // ------------------------------------------------------------------
    // NBT helpers
    // ------------------------------------------------------------------

    public static int getEnergy(ItemStack stack) {
        NbtCompound nbt = stack.getNbt();
        if (nbt == null || !nbt.contains(NBT_ENERGY)) {
            return 0;
        }
        return Math.max(0, Math.min(MAX_ENERGY, nbt.getInt(NBT_ENERGY)));
    }

    public static void setEnergy(ItemStack stack, int energy) {
        int clamped = Math.max(0, Math.min(MAX_ENERGY, energy));
        stack.getOrCreateNbt().putInt(NBT_ENERGY, clamped);
    }

    /** @return true if there was enough energy and it was consumed. */
    public static boolean consumeEnergy(ItemStack stack, int amount) {
        int energy = getEnergy(stack);
        if (energy < amount) {
            return false;
        }
        setEnergy(stack, energy - amount);
        return true;
    }

    public static void addEnergy(ItemStack stack, int amount) {
        setEnergy(stack, getEnergy(stack) + amount);
    }

    public static RingConstruct getConstruct(ItemStack stack) {
        NbtCompound nbt = stack.getNbt();
        if (nbt == null || !nbt.contains(NBT_CONSTRUCT)) {
            return RingConstruct.BEAM;
        }
        return RingConstruct.byId(nbt.getInt(NBT_CONSTRUCT));
    }

    public static void setConstruct(ItemStack stack, RingConstruct construct) {
        stack.getOrCreateNbt().putInt(NBT_CONSTRUCT, construct.ordinal());
    }

    // ------------------------------------------------------------------
    // Item behaviour
    // ------------------------------------------------------------------

    @Override
    public boolean hasGlint(ItemStack stack) {
        // Glows brighter once it holds some charge.
        return getEnergy(stack) > 0;
    }

    @Override
    public boolean isItemBarVisible(ItemStack stack) {
        return true;
    }

    @Override
    public int getItemBarStep(ItemStack stack) {
        return Math.round(getEnergy(stack) * 13.0F / MAX_ENERGY);
    }

    @Override
    public int getItemBarColor(ItemStack stack) {
        // Green willpower bar.
        return 0x21DD3B;
    }

    @Override
    public void appendTooltip(ItemStack stack, World world, List<Text> tooltip, TooltipContext context) {
        RingConstruct construct = getConstruct(stack);
        tooltip.add(Text.translatable("item.greenlantern.power_ring.energy",
                        getEnergy(stack), MAX_ENERGY)
                .formatted(Formatting.GREEN));
        tooltip.add(Text.translatable("item.greenlantern.power_ring.construct",
                        Text.translatable("construct.greenlantern." + construct.name().toLowerCase()))
                .formatted(Formatting.AQUA));
        tooltip.add(Text.translatable("item.greenlantern.power_ring.hint")
                .formatted(Formatting.DARK_GRAY, Formatting.ITALIC));
    }

    // Give a stable model / no durability behaviour.
    @Override
    public boolean isEnchantable(ItemStack stack) {
        return false;
    }
}
