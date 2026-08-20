# FIREBROX

A particle life laboratory. Species of glowing motes attract and repel according to a force matrix. Nothing is choreographed — cells, serpents, lattices, and galaxies appear from the laws you write.

## Run it

Serve the folder (ES modules need a local server):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## How it works

Each particle has a color (a species). The interaction matrix says how strongly species **i** is pulled toward species **j**. Close range is always repulsive so matter cannot collapse to a point. Mid-range follows Tom Mohr’s particle-life force curve. The world can wrap like a torus.

## Controls

| Key | Action |
| --- | --- |
| Space | Pause |
| R | Randomize laws |
| G | Respawn |
| M | Mutate the matrix |
| H | Toggle the laws panel |
| S | Snapshot PNG |
| F | Fullscreen |
| 1–9 | Load a preset |
| ? | Manual |

Click-drag on the canvas to attract, repel, or spawn, depending on the mouse mode. Drag a matrix cell vertically to rewrite a single law.

## Presets

Genesis, Serpents, Cells, Nebula, Koi, Crystal, Predators, Atoms, Foam, Mosaic, Mitosis, Broth.
