import {Vec3} from 'vec3';

// From https://github.com/PrismarineJS/mineflayer/blob/5050b8e67c1421da0540ff9a919b4f08688c966a/lib/plugins/digging.js#L41
// The complexity of getting the bot to look at a block is quite high.

// The raycast of prismarine-world steps one block length. This value is five because four would
// exclude valid blocks.
// TODO: Check how this differs between single player and multiplayer.
const MAX_POTENTIAL_REACH_DISTANCE = 5;
// This value came from testing on a multiplayer server by looking at blocks and trying to break them.
// Anything beyond 4.5 blocks away was not breakable. version: 1.16.4
const MAX_REACH_DISTANCE = 4.5;

export const getFacingToBlock = (bot, block): Array<any> => {
  // Check faces that could be seen from the current position. If the delta is smaller then 0.5 that means the
  // bot cam most likely not see the face as the block is 1 block thick
  // this could be false for blocks that have a smaller bounding box then 1x1x1
  const dx = bot.entity.position.x - block.position.x + 0.5
  const dy = bot.entity.position.y - block.position.y - 0.5 + bot.entity.height // -0.5 because the bot position
  // is calculated from the block position that is inside its feet so 0.5 - 1 = -0.5
  const dz = bot.entity.position.z - block.position.z + 0.5
  // Check y first then x and z
  const visibleFaces = {
    y: Math.sign(Math.abs(dy) > 0.5 ? dy : 0),
    x: Math.sign(Math.abs(dx) > 0.5 ? dx : 0),
    z: Math.sign(Math.abs(dz) > 0.5 ? dz : 0)
  }

  const validFaces = []
  const startPos = bot.entity.position.offset(0, bot.entity.height, 0)
  for (const i in visibleFaces) {
    if (!visibleFaces[i]) continue // skip as this face is not visible
    // target position on the target block face. -> 0.5 + (current face) * 0.5
    const targetPos = block.position.offset(0.5 + (i === 'x' ? visibleFaces[i] * 0.5 : 0), 0.5 + (i === 'y' ? visibleFaces[i] * 0.5 : 0), 0.5 + (i === 'z' ? visibleFaces[i] * 0.5 : 0))
    const rayBlock = bot.world.raycast(startPos, targetPos.clone().subtract(startPos).normalize(), MAX_POTENTIAL_REACH_DISTANCE)
    if (rayBlock) {
      const rayPos = rayBlock.position
      if (rayPos.x === block.position.x && rayPos.y === block.position.y && rayPos.z === block.position.z) {
        // console.info(rayBlock)
        const distance = rayBlock.intersect.distanceTo(startPos);
        if (distance <= MAX_REACH_DISTANCE) {
          validFaces.push({
            face: rayBlock.face,
            targetPos: rayBlock.intersect,
            distance,
          })
        }
      }
    }
  }
  return validFaces;
}

export const getFacingToNeighborBlock = (bot, block): Array<any> => {
  // Check faces that could be seen from the current position. If the delta is smaller then 0.5 that means the
  // bot cam most likely not see the face as the block is 1 block thick
  // this could be false for blocks that have a smaller bounding box then 1x1x1
  const dx = bot.entity.position.x - (block.position.x + 0.5)
  const dy = bot.entity.position.y - block.position.y - 0.5 + bot.entity.height // -0.5 because the bot position
  // is calculated from the block position that is inside its feet so 0.5 - 1 = -0.5
  const dz = bot.entity.position.z - (block.position.z + 0.5)
  // Example: block is x: 1, y: 10, z: 1, bot head is at x: 1.5, y: 10.6, z: 1.5
  // dx: 0, dy: 0.1, dz: 0

  // Check y first then x and z
  const visibleFaces = [
    {name: 'yPositive', x: 0, y: dy < 0.5 ? 0.5 : 0, z: 0},
    {name: 'yNegative', x: 0, y: dy > -0.5 ? -0.5 : 0, z: 0},
    {name: 'xPositive', x: dx < 0.5 ? 0.5 : 0, y: 0, z: 0},
    {name: 'xNegative', x: dx > -0.5 ? -0.5 : 0, y: 0, z: 0},
    {name: 'zPositive', x: 0, y: 0, z: dz < 0.5 ? 0.5 : 0},
    {name: 'zNegative', x: 0, y: 0, z: dz > -0.5 ? -0.5 : 0},
  ]

  console.log({dx, dy, dz});
  console.dir(visibleFaces, {depth: null});
  const validFaces = []
  const startPos = bot.entity.position.offset(0, bot.entity.height, 0)
  for (const faceDirection of visibleFaces) {
    if (faceDirection.x === 0 && faceDirection.y === 0 && faceDirection.z === 0) continue // skip as this face is not visible
    // target position on the target block face. -> 0.5 + (current face) * 0.5
    const targetPos = block.position.offset(0.5 + faceDirection.x, 0.5 + faceDirection.y, 0.5 + faceDirection.z)
    const rayBlock = bot.world.raycast(startPos, targetPos.clone().subtract(startPos).normalize(), MAX_POTENTIAL_REACH_DISTANCE)
    if (rayBlock) {
      const rayPos = rayBlock.position
      const expectedNeighborPos = block.position.clone().offset(Math.sign(faceDirection.x), Math.sign(faceDirection.y), Math.sign(faceDirection.z));
      if (rayPos.x === expectedNeighborPos.x && rayPos.y === expectedNeighborPos.y && rayPos.z === expectedNeighborPos.z) {
        const distance = rayBlock.intersect.distanceTo(startPos);
        if (distance <= MAX_REACH_DISTANCE) {
          validFaces.push({
            face: rayBlock.face,
            targetPos: rayBlock.intersect,
            distance,
          })
        }
      }
    }
  }
  return validFaces;
}
