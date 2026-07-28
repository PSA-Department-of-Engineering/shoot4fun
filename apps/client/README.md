# client

A Three.js 3D app scaffolded per the team playbook's `REF-ThreeJS.md`; read that
REF before extending the scene. The 3D core is the framework-agnostic `SceneApp`
module in `src/scene/`; the demo content inside it is placeholder.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run e2e` | Build, then run the headless WebGL smoke e2e against `vite preview` |

First machine only: `npx playwright install chromium` before `npm run e2e`.

## Conventions baked in

- `renderer.setAnimationLoop` drives the frame loop (XR-compatible); all motion
  is delta-time scaled.
- The camera rides the `camera-rig` group; locomotion moves the rig.
- Units are meters, Y up.
- `#app` gets `data-scene-ready="true"` after the first rendered frame; loading
  UI and the smoke e2e key off it.
- `dispose()` frees every GPU resource; call it whenever the app unmounts.

## Going immersive later
The scaffold is already WebXR-shaped (`setAnimationLoop`, meters, camera rig).
To enable VR, flip `renderer.xr.enabled = true` and mount `VRButton` in
`SceneApp.mount()`; see `REF-ThreeJS.md` section 9.
