# Models

Third-party assets served from this directory, with their provenance.
Anything added here needs a licence that permits redistribution inside
this repository and inside a built image, and it needs a source URL that
someone else can check.

## `robot.glb`

- **Licence:** CC0 1.0 Universal (public domain dedication)
- **Author:** Tomás Laulhé (<https://www.patreon.com/quaternius>)
- **Modifications:** Don McCurdy (<https://donmccurdy.com/>): three facial
  expression morph targets, converted with FBX2GLTF, duplicate materials
  removed and material metalness reduced
- **Source:** <https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb>
- **Licence statement:** <https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/RobotExpressive/README.md>

A rigged character with the animation clips the game drives it by:
`Idle`, `Walking`, `Running`, `Death` and `Punch`. The mapping from
those clip names to the roles the game asks for lives in
`src/scene/CharacterLibrary.ts`, which is the only place the asset's own
vocabulary is spoken.

CC0 waives the attribution requirement. The credit above is recorded
because knowing where a binary in a repository came from is worth more
than the licence obliges.
