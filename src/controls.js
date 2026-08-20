// Single source of truth for every control in the game.
// The title screen, the pause menu and the F1 overlay all render from this list,
// and the test suite asserts that each binding actually does something.

export const CONTROL_GROUPS = [
  {
    title: 'Starship flight (space)',
    mode: 'space',
    items: [
      { keys: ['W', 'S'], label: 'Throttle up / down' },
      { keys: ['Mouse'], label: 'Steer (pitch & yaw)' },
      { keys: ['A', 'D'], label: 'Roll' },
      { keys: ['Shift'], label: 'Boost' },
      { keys: ['Space'], label: 'Pulse drive (clear of planets & hostiles)' },
      { keys: ['LMB'], label: 'Photon cannons' },
      { keys: ['F'], label: 'Scan the planet you are aimed at' },
      { keys: ['E'], label: 'Hold to dock with a station or the Anomaly' },
      { keys: ['T'], label: 'Toggle first-person cockpit' },
      { keys: ['M'], label: 'Galaxy map' },
    ],
  },
  {
    title: 'Atmospheric flight',
    mode: 'flight',
    items: [
      { keys: ['—'], label: 'Fly at a planet to enter its atmosphere — no keypress' },
      { keys: ['W', 'S'], label: 'Throttle / brake' },
      { keys: ['Mouse'], label: 'Steer' },
      { keys: ['A', 'D'], label: 'Roll' },
      { keys: ['Space'], label: 'Climb (past 1400 m you return to space)' },
      { keys: ['Ctrl'], label: 'Descend' },
      { keys: ['Shift'], label: 'Boost' },
      { keys: ['F'], label: 'Disembark once you have set down' },
      { keys: ['T'], label: 'Toggle cockpit view' },
    ],
  },
  {
    title: 'On foot',
    mode: 'surface',
    items: [
      { keys: ['W', 'A', 'S', 'D'], label: 'Move' },
      { keys: ['Mouse'], label: 'Look' },
      { keys: ['Space'], label: 'Jump, hold for jetpack' },
      { keys: ['Shift'], label: 'Sprint' },
      { keys: ['LMB'], label: 'Mining beam' },
      { keys: ['RMB'], label: 'Boltcaster' },
      { keys: ['F'], label: 'Hold to scan creatures, ruins and portals' },
      { keys: ['E'], label: 'Board ship · use terminals, farms, teleporters, portals' },
      { keys: ['Q'], label: 'Instant launch to orbit (at your ship)' },
      { keys: ['G'], label: 'Refuel thrusters at the ship · feed a creature' },
      { keys: ['R'], label: 'Recharge hazard protection with sodium' },
      { keys: ['V'], label: 'Summon the Exocraft' },
      { keys: ['F'], label: 'Board / leave the Exocraft' },
    ],
  },
  {
    title: 'Building & terrain',
    mode: 'surface',
    items: [
      { keys: ['B'], label: 'Toggle build mode' },
      { keys: ['[', ']'], label: 'Cycle base part' },
      { keys: ['LMB'], label: 'Place the selected part' },
      { keys: ['X'], label: 'Demolish nearby part (in build mode)' },
      { keys: ['Z'], label: 'Dig terrain' },
      { keys: ['X'], label: 'Raise terrain' },
      { keys: ['N'], label: 'Report on the base built here' },
    ],
  },
  {
    title: 'Galaxy map',
    mode: 'map',
    items: [
      { keys: ['M'], label: 'Open / close the map' },
      { keys: ['Click'], label: 'Select a star' },
      { keys: ['Enter'], label: 'Warp, or take the next hop of the plotted route' },
      { keys: ['Q', 'E'], label: 'Rotate the galaxy' },
      { keys: ['Wheel'], label: 'Zoom' },
      { keys: ['G'], label: 'Intergalactic view' },
      { keys: ['Esc'], label: 'Close' },
    ],
  },
  {
    title: 'Menus & system',
    mode: 'any',
    items: [
      { keys: ['C'], label: 'Refiner & nutrient processor' },
      { keys: ['Tab'], label: 'Journey log (discoveries, milestones, Atlas Path, language)' },
      { keys: ['F1'], label: 'This control list' },
      { keys: ['H'], label: 'Photo mode (hide the HUD)' },
      { keys: ['P'], label: 'Toggle exposure' },
      { keys: ['Ctrl+S'], label: 'Save' },
      { keys: ['Esc'], label: 'Close a menu / release the mouse' },
      { keys: ['Click'], label: 'Recapture the mouse' },
    ],
  },
];

// Flat list of the key codes the game listens for, used by the audit test.
export const BOUND_CODES = [
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyQ', 'KeyR', 'KeyT',
  'KeyV', 'KeyB', 'KeyC', 'KeyH', 'KeyM', 'KeyP', 'KeyX', 'KeyZ',
  'Space', 'ShiftLeft', 'ControlLeft', 'Tab', 'Enter', 'Escape',
  'BracketLeft', 'BracketRight', 'F1',
];

export function renderControlsHTML() {
  return CONTROL_GROUPS.map((g) => `
    <div class="ctrl-group">
      <div class="ctrl-title">${g.title}</div>
      ${g.items.map((i) => `
        <div class="ctrl-row">
          <span class="ctrl-keys">${i.keys.map((k) => `<kbd>${k}</kbd>`).join('')}</span>
          <span class="ctrl-label">${i.label}</span>
        </div>`).join('')}
    </div>`).join('');
}
