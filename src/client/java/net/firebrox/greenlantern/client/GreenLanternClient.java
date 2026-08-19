package net.firebrox.greenlantern.client;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.fabric.api.networking.v1.PacketByteBufs;
import net.firebrox.greenlantern.network.ModNetworking;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.network.PacketByteBuf;
import org.lwjgl.glfw.GLFW;

public class GreenLanternClient implements ClientModInitializer {

    private static KeyBinding activateKey;
    private static KeyBinding cycleNextKey;
    private static KeyBinding cyclePrevKey;

    @Override
    public void onInitializeClient() {
        activateKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.greenlantern.activate",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_R,
                "category.greenlantern"));

        cycleNextKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.greenlantern.cycle_next",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_V,
                "category.greenlantern"));

        cyclePrevKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.greenlantern.cycle_prev",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_C,
                "category.greenlantern"));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (client.player == null) {
                return;
            }
            while (activateKey.wasPressed()) {
                PacketByteBuf buf = PacketByteBufs.create();
                ClientPlayNetworking.send(ModNetworking.ACTIVATE_CONSTRUCT, buf);
            }
            while (cycleNextKey.wasPressed()) {
                sendCycle(true);
            }
            while (cyclePrevKey.wasPressed()) {
                sendCycle(false);
            }
        });

        HudRenderCallback.EVENT.register(new RingHudOverlay());
    }

    private static void sendCycle(boolean forward) {
        PacketByteBuf buf = PacketByteBufs.create();
        buf.writeBoolean(forward);
        ClientPlayNetworking.send(ModNetworking.CYCLE_CONSTRUCT, buf);
    }
}
