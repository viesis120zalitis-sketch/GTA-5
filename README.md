# GTA 5 Inspired (Three.js, mobile landscape)

Open-world game using a cleaned San Andreas map and your own GLB models.

## Folder layout
```
index.html        game page
css/style.css     touch controls + HUD
js/config.js      ALL settings (map scale, spawn, which car/character, speeds)
js/main.js        game code
assets/maps/      map_clean.glb  (add this file here)
assets/vehicles/  (move car .glb files here later)
assets/characters/ (move character .glb files here later)
```
Right now the car and character load from the repo root (`police_car.glb`, `michael.glb`).
If you move them into `assets/...`, update the paths in `js/config.js`.

## Controls
- Left joystick (or WASD): move / drive. Drag on the screen to turn the camera.
- ENTER/EXIT (or F): get in / out of the car. BRAKE (Space). RUN (Shift).

## Run
Turn on GitHub Pages (Settings > Pages > main branch, root), then open the page URL on your iPhone.

## Credits
Map: "Map_gta 5" by viktor_lol_14 (https://sketchfab.com/viktor_lol_14),
CC-BY-4.0, source: https://sketchfab.com/3d-models/map-gta-5-85988bbf297749e0a3b87adf0076b9df
Cleaned (stray offshore pieces removed, texture resized) for this project.
