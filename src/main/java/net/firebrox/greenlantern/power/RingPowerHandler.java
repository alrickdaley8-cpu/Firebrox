package net.firebrox.greenlantern.power;

import net.firebrox.greenlantern.item.PowerRingItem;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.RaycastContext;

/**
 * Server-side application of ring constructs. Called from the network receiver
 * when the client activates a construct, and from the flight tick loop.
 */
public final class RingPowerHandler {
    private RingPowerHandler() {}

    /** Locate a Power Ring in either hand. Returns null if the player holds none. */
    public static ItemStack findRing(PlayerEntity player) {
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

    /**
     * Activate the currently-selected construct on the ring the player is holding.
     */
    public static void activate(ServerPlayerEntity player) {
        ItemStack ring = findRing(player);
        if (ring == null) {
            return;
        }
        ServerWorld world = (ServerWorld) player.getWorld();
        RingConstruct construct = PowerRingItem.getConstruct(ring);

        switch (construct) {
            case BEAM -> fireBeam(player, world, ring);
            case FLIGHT -> toggleFlight(player, ring);
            case SHIELD -> raiseShield(player, world, ring);
            case PLATFORM -> castPlatform(player, world, ring);
        }
    }

    // ------------------------------------------------------------------
    // BEAM
    // ------------------------------------------------------------------

    private static void fireBeam(ServerPlayerEntity player, ServerWorld world, ItemStack ring) {
        RingConstruct c = RingConstruct.BEAM;
        if (!PowerRingItem.consumeEnergy(ring, c.cost())) {
            notifyEmpty(player);
            return;
        }

        Vec3d start = player.getCameraPosVec(1.0F);
        Vec3d dir = player.getRotationVec(1.0F);
        double range = 24.0;
        Vec3d end = start.add(dir.multiply(range));

        // Block raycast to stop the beam at terrain.
        HitResult blockHit = world.raycast(new RaycastContext(start, end,
                RaycastContext.ShapeType.COLLIDER, RaycastContext.FluidHandling.NONE, player));
        Vec3d reach = blockHit.getType() == HitResult.Type.MISS ? end : blockHit.getPos();

        // Entity raycast within the segment.
        Box box = player.getBoundingBox().stretch(dir.multiply(range)).expand(1.0);
        double closest = start.squaredDistanceTo(reach);
        Entity target = null;
        for (Entity e : world.getOtherEntities(player, box, ent -> ent instanceof LivingEntity && ent.isAlive())) {
            Box eb = e.getBoundingBox().expand(0.3);
            var opt = eb.raycast(start, reach);
            if (opt.isPresent()) {
                double d = start.squaredDistanceTo(opt.get());
                if (d < closest) {
                    closest = d;
                    target = e;
                }
            }
        }

        Vec3d impact = target != null ? target.getPos().add(0, target.getHeight() * 0.5, 0) : reach;
        drawBeamParticles(world, start, impact);
        world.playSound(null, player.getX(), player.getY(), player.getZ(),
                SoundEvents.ENTITY_ENDER_DRAGON_SHOOT, SoundCategory.PLAYERS, 0.6F, 1.6F);

        if (target instanceof LivingEntity living) {
            DamageSource src = world.getDamageSources().indirectMagic(player, player);
            living.damage(src, 7.0F);
            living.takeKnockback(0.6, -dir.x, -dir.z);
            world.spawnParticles(ParticleTypes.CRIT, impact.x, impact.y, impact.z, 12,
                    0.2, 0.2, 0.2, 0.1);
        }
    }

    private static void drawBeamParticles(ServerWorld world, Vec3d start, Vec3d end) {
        Vec3d delta = end.subtract(start);
        double length = delta.length();
        Vec3d step = delta.normalize().multiply(0.4);
        Vec3d p = start;
        int steps = (int) (length / 0.4);
        for (int i = 0; i < steps; i++) {
            world.spawnParticles(ParticleTypes.HAPPY_VILLAGER, p.x, p.y, p.z, 1, 0, 0, 0, 0);
            world.spawnParticles(ParticleTypes.END_ROD, p.x, p.y, p.z, 1, 0.01, 0.01, 0.01, 0);
            p = p.add(step);
        }
    }

    // ------------------------------------------------------------------
    // FLIGHT (toggle) — sustained draw handled in FlightManager
    // ------------------------------------------------------------------

    private static void toggleFlight(ServerPlayerEntity player, ItemStack ring) {
        boolean nowFlying = FlightManager.toggle(player);
        if (nowFlying) {
            if (PowerRingItem.getEnergy(ring) <= 0) {
                FlightManager.stop(player);
                notifyEmpty(player);
                return;
            }
            player.getAbilities().allowFlying = true;
            player.getAbilities().flying = true;
            player.sendAbilitiesUpdate();
            player.sendMessage(net.minecraft.text.Text.translatable(
                    "message.greenlantern.flight_on"), true);
            player.getWorld().playSound(null, player.getX(), player.getY(), player.getZ(),
                    SoundEvents.ITEM_ELYTRA_FLYING, SoundCategory.PLAYERS, 0.5F, 1.4F);
        } else {
            FlightManager.applyGroundAbilities(player);
            player.sendMessage(net.minecraft.text.Text.translatable(
                    "message.greenlantern.flight_off"), true);
        }
    }

    // ------------------------------------------------------------------
    // SHIELD
    // ------------------------------------------------------------------

    private static void raiseShield(ServerPlayerEntity player, ServerWorld world, ItemStack ring) {
        RingConstruct c = RingConstruct.SHIELD;
        if (!PowerRingItem.consumeEnergy(ring, c.cost())) {
            notifyEmpty(player);
            return;
        }
        int duration = 20 * 12; // 12 seconds
        player.addStatusEffect(new StatusEffectInstance(StatusEffects.RESISTANCE, duration, 3, false, true, true));
        player.addStatusEffect(new StatusEffectInstance(StatusEffects.ABSORPTION, duration, 2, false, true, true));
        player.addStatusEffect(new StatusEffectInstance(StatusEffects.FIRE_RESISTANCE, duration, 0, false, true, true));

        world.playSound(null, player.getX(), player.getY(), player.getZ(),
                SoundEvents.BLOCK_BEACON_POWER_SELECT, SoundCategory.PLAYERS, 0.7F, 1.2F);
        spawnShieldParticles(world, player);
        player.sendMessage(net.minecraft.text.Text.translatable(
                "message.greenlantern.shield_on"), true);
    }

    private static void spawnShieldParticles(ServerWorld world, PlayerEntity player) {
        double cx = player.getX();
        double cy = player.getBodyY(0.5);
        double cz = player.getZ();
        double radius = 1.6;
        for (int i = 0; i < 60; i++) {
            double theta = world.random.nextDouble() * Math.PI * 2;
            double phi = Math.acos(2 * world.random.nextDouble() - 1);
            double x = cx + radius * Math.sin(phi) * Math.cos(theta);
            double y = cy + radius * Math.cos(phi);
            double z = cz + radius * Math.sin(phi) * Math.sin(theta);
            world.spawnParticles(ParticleTypes.HAPPY_VILLAGER, x, y, z, 1, 0, 0, 0, 0);
        }
    }

    // ------------------------------------------------------------------
    // PLATFORM — hard-light floor of glass panes below the player's feet
    // ------------------------------------------------------------------

    private static void castPlatform(ServerPlayerEntity player, ServerWorld world, ItemStack ring) {
        RingConstruct c = RingConstruct.PLATFORM;
        if (!PowerRingItem.consumeEnergy(ring, c.cost())) {
            notifyEmpty(player);
            return;
        }

        net.minecraft.util.math.BlockPos center = player.getBlockPos().down();
        int placed = 0;
        for (int dx = -1; dx <= 1; dx++) {
            for (int dz = -1; dz <= 1; dz++) {
                net.minecraft.util.math.BlockPos pos = center.add(dx, 0, dz);
                if (world.getBlockState(pos).getMaterial().isReplaceable()) {
                    world.setBlockState(pos, net.minecraft.block.Blocks.GREEN_STAINED_GLASS.getDefaultState());
                    placed++;
                }
            }
        }
        world.playSound(null, player.getX(), player.getY(), player.getZ(),
                SoundEvents.BLOCK_GLASS_PLACE, SoundCategory.PLAYERS, 0.7F, 1.5F);
        world.spawnParticles(ParticleTypes.HAPPY_VILLAGER,
                player.getX(), player.getY(), player.getZ(), 20, 1.0, 0.1, 1.0, 0.0);

        if (placed == 0) {
            // Refund if nothing could be placed.
            PowerRingItem.addEnergy(ring, c.cost());
        }
    }

    // ------------------------------------------------------------------

    private static void notifyEmpty(ServerPlayerEntity player) {
        player.sendMessage(net.minecraft.text.Text.translatable(
                "message.greenlantern.ring_empty"), true);
        player.getWorld().playSound(null, player.getX(), player.getY(), player.getZ(),
                SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(), SoundCategory.PLAYERS, 0.6F, 0.8F);
    }
}
