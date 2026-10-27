# Stelle browser character sprite standard (v1)

The game uses three **local** PNG sheets:

- `browser/assets/lyuna.png`
- `browser/assets/hero-boy.png`
- `browser/assets/hero-girl.png`

Each sheet is **384 × 384 px** with 4 rows × 4 columns of **96 × 96 px** frames.

| Row | Facing |
| --- | --- |
| 0 | down / front |
| 1 | left |
| 2 | right |
| 3 | up / back |

Columns are frames 0–3. The standardized images place the character centered around **x = 48** and the feet around **y = 90** within each cell. Character content is at most **83 px high** and **86 px wide**. All characters use the same draw dimensions and anchor; do not compensate by adding per-character scale sliders.

The user's original reference portrait is **not** part of the project. Only approved derivative sprites should be placed here.

## Installing the normalized artwork

Unzip the provided `stelle_normalized_assets.zip` **at the Stelle repository root**. It contains `browser/assets/{lyuna,hero-boy,hero-girl}.png` plus `sprite_spec.json`. The ZIP assets replace existing PNG sheets, but do not overwrite the SVG fallback sheets.

From PowerShell, once the ZIP is in the project root:

```powershell
Expand-Archive -LiteralPath .\stelle_normalized_assets.zip -DestinationPath . -Force
py browser/server.py --binary cerune --port 8765
```

For released builds, add the approved normalized PNG assets to the repository; a browser without these PNGs will fall back to legacy SVGs. 
