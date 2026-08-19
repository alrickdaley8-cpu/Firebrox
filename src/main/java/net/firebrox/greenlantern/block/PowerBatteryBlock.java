package net.firebrox.greenlantern.block;

import net.firebrox.greenlantern.item.ModItems;
import net.firebrox.greenlantern.item.PowerRingItem;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.ShapeContext;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.shape.VoxelShape;
import net.minecraft.util.shape.VoxelShapes;
import net.minecraft.world.BlockView;
import net.minecraft.world.World;

/**
 * The Power Battery ("the lantern"). Right-click it while holding a Power Ring
 * to recharge the ring's willpower to full, accompanied by a burst of green
 * particles and a beacon-like hum.
 */
public class PowerBatteryBlock extends Block {
    private static final VoxelShape SHAPE = VoxelShapes.union(
            Block.createCuboidShape(3, 0, 3, 13, 2, 13),   // base
            Block.createCuboidShape(4, 2, 4, 12, 12, 12),  // body
            Block.createCuboidShape(3, 12, 3, 13, 16, 13)  // top lantern
    );

    public PowerBatteryBlock(Settings settings) {
        super(settings);
    }

    @Override
    public VoxelShape getOutlineShape(BlockState state, BlockView world, BlockPos pos, ShapeContext context) {
        return SHAPE;
    }

    @Override
    public ActionResult onUse(BlockState state, World world, BlockPos pos, PlayerEntity player,
                              Hand hand, BlockHitResult hit) {
        ItemStack held = player.getStackInHand(hand);

        // Only respond to a ring in either hand.
        ItemStack ring = held.getItem() instanceof PowerRingItem
                ? held
                : findRing(player);

        if (ring == null || !(ring.getItem() instanceof PowerRingItem)) {
            return ActionResult.PASS;
        }

        int before = PowerRingItem.getEnergy(ring);
        if (before >= PowerRingItem.MAX_ENERGY) {
            if (world.isClient) {
                player.sendMessage(net.minecraft.text.Text.translatable(
                        "message.greenlantern.ring_full"), true);
            }
            return ActionResult.SUCCESS;
        }

        if (!world.isClient) {
            PowerRingItem.setEnergy(ring, PowerRingItem.MAX_ENERGY);
            world.playSound(null, pos, SoundEvents.BLOCK_BEACON_ACTIVATE, SoundCategory.BLOCKS,
                    0.7F, 1.4F);
            player.sendMessage(net.minecraft.text.Text.translatable(
                    "message.greenlantern.ring_charged"), true);
        } else {
            spawnChargeParticles(world, pos);
        }

        return ActionResult.success(world.isClient);
    }

    private static ItemStack findRing(PlayerEntity player) {
        ItemStack main = player.getMainHandStack();
        if (main.getItem() instanceof PowerRingItem) {
            return main;
        }
        ItemStack off = player.getOffHandStack();
        if (off.getItem() instanceof PowerRingItem) {
            return off;
        }
        return null;
    }

    private static void spawnChargeParticles(World world, BlockPos pos) {
        double cx = pos.getX() + 0.5;
        double cy = pos.getY() + 1.0;
        double cz = pos.getZ() + 0.5;
        for (int i = 0; i < 20; i++) {
            double ox = (world.random.nextDouble() - 0.5) * 0.8;
            double oz = (world.random.nextDouble() - 0.5) * 0.8;
            world.addParticle(ParticleTypes.HAPPY_VILLAGER,
                    cx + ox, cy + world.random.nextDouble() * 0.6, cz + oz,
                    0.0, 0.05, 0.0);
        }
    }
}
