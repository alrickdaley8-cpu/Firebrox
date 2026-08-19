package net.firebrox.greenlantern.power;

/**
 * The set of "constructs" a Power Ring can manifest. Each has a willpower
 * (energy) cost and a short lore-friendly description. The order here defines
 * the cycle order when the player scrolls constructs with the ring keybind.
 */
public enum RingConstruct {
    BEAM("Energy Beam", 6, "Fires a bolt of hard-light willpower."),
    FLIGHT("Flight", 2, "Lifts the wielder into sustained flight."),
    SHIELD("Shield", 20, "Surrounds the wielder in a protective sphere."),
    PLATFORM("Platform", 8, "Manifests a solid hard-light platform underfoot.");

    private final String displayName;
    private final int cost;
    private final String description;

    RingConstruct(String displayName, int cost, String description) {
        this.displayName = displayName;
        this.cost = cost;
        this.description = description;
    }

    public String displayName() {
        return displayName;
    }

    /** Willpower units consumed when this construct is activated (or per second, for flight). */
    public int cost() {
        return cost;
    }

    public String description() {
        return description;
    }

    public RingConstruct next() {
        RingConstruct[] values = values();
        return values[(this.ordinal() + 1) % values.length];
    }

    public RingConstruct previous() {
        RingConstruct[] values = values();
        return values[(this.ordinal() - 1 + values.length) % values.length];
    }

    public static RingConstruct byId(int id) {
        RingConstruct[] values = values();
        if (id < 0 || id >= values.length) {
            return BEAM;
        }
        return values[id];
    }
}
