import Vec3 from 'vec3';
import pathfinder from 'mineflayer-pathfinder';
const {Movements, goals} = pathfinder
import {performance} from 'perf_hooks';

export const tossEyeOfEnder = async (bot, mcData) => {
  // ensure we have an eye of ender to use
  let item;
  const eyeOfEnder = mcData.itemsByName.ender_eye;
  item = bot.inventory.items().filter(item => item.type === eyeOfEnder.id)[0];
  if (!item) {
    console.log({itemNotFoundInInventory: eyeOfEnder});
    throw new Error(`Item ${eyeOfEnder} not in inventory`);
  }

  // activate the item
  await bot.equip(item, 'hand');
  // not 100% sure this wait is needed to ensure the item is in the hand
  await bot.waitForTicks(4);
  console.log('activate eye of ender');
  bot.activateItem();
  // not sure if we need to wait on this
  bot.deactivateItem();
}

// returns a vector of magnitude 1 in the direction of the stronghold and the initial location of the toss
// { heading: vec3, tossOrigin: vec3 }
export const getHeadingFromEyeOfEnder = async (bot, timeout) => {
  const eyeOfEnderLocations = []
  return new Promise((resolve, reject) => {
    let errorTimmer;
    if (timeout != null) {
      errorTimmer = setTimeout(() => {
        reject(new Error(`Eye of ender did not disapear in timeout ${timeout}`));
        removeEventListeners();
      }, timeout);
    }
    const eyeOfEnderMoved = (entity) => {
      if (entity.name != 'eye_of_ender') return;
      // TODO: The eye of ender spends some time at the end point of its movement. The direction could be calculated before it falls.
      // console.log({eyeOfEnderPos: entity.position});
      eyeOfEnderLocations.push(entity.position.clone());
    }
    const eyeOfEnderGone = (entity) => {
      if (entity.name != 'eye_of_ender') return;
      console.log('eye of ender gone');
      removeEventListeners();
    }
    const removeEventListeners = () => {
      if (errorTimmer != null) clearTimeout(errorTimmer);
      bot.removeListener('entityMoved', eyeOfEnderMoved);
      bot.removeListener('entityGone', eyeOfEnderGone);
      resolve(constructHeadingVectorFromPath(eyeOfEnderLocations));
    }
    bot.on('entityMoved', eyeOfEnderMoved);
    bot.on('entityGone', eyeOfEnderGone);
  });
}

const constructHeadingVectorFromPath = (path) => {
  // TODO: see if a more advanced version can be built from the entity data.
  // Only take the x and z components to construct the heading.
  const startingPosition = path[0];
  const endingPosition = path[path.length - 1];
  const heading = new Vec3(endingPosition.x - startingPosition.x, 0, endingPosition.z - startingPosition.z).unit();
  return {heading, tossOrigin: startingPosition};
}

const estimateMaxStrongholdLocationFromHeading = (heading, tossOrigin) => {
  // ## Assume 
  // tossOrigin is within first ring of strongholds.
  // TODO: consider adding support for other stronghold rings and minecraft editions
  // https://minecraft.fandom.com/wiki/Stronghold#Java_Edition
  // ## Given
  // tossOrigin vector t represents the offset from the world origin to the eye of ender toss.
  // heading unit vector h represents the direction from the tossOrigin that the stronghold is in.
  // scalar d represents the max distance from the origin to the end of the first stronghold ring.
  // ## Then
  // The stronghold position must lie on the vector defined by t + sh where s represents the scale factor for unit vector h.
  // The scale factor can be calculated by solving for s in ||t + sh|| = d
  //
  // There may be a better way to do this with linear algebra, but I did it the 'easy' way.
  // https://www.wolframalpha.com/input/?i=%28t_1+%2B+s+*+h_1%29%5E2+%2B+%28t_2+%2B+s+*+h_2%29%5E2+%3D+d%5E2+solve+for+s
  // s = (sqrt(h_1^2 (d^2 - t_2^2) + h_2^2 (d^2 - t_1^2) + 2 h_2 h_1 t_1 t_2) - h_1 t_1 - h_2 t_2)/(h_1^2 + h_2^2) and h_1^2 + h_2^2!=0
  const d = 2816;
  const h1 = heading.x;
  const h2 = heading.z;
  const t1 = tossOrigin.x;
  const t2 = tossOrigin.z;
  const scaleFactor = (Math.sqrt(Math.pow(h1, 2) * (Math.pow(d, 2) - Math.pow(t2, 2)) + Math.pow(h2, 2) * (Math.pow(d, 2) - Math.pow(t1, 2)) + 2 * h2 * h1 * t1 * t2) - h1 * t1 - h2 * t2) / (Math.pow(h1, 2) + Math.pow(h2, 2));
  const estimatedMaxLocation = tossOrigin.plus(heading.scaled(scaleFactor));
  return estimatedMaxLocation
}

// 
export class StrongholdSensor {
  constructor(bot, mcData) {
    this._bot = bot;
    this._mcData = mcData;
    this._location = {found: false};
    this._chunkMap = new Map();
    this._findStrongholdBlocksInLoadedChunks();
    // console.log({map: this._chunkMap});
    this._chunkLoadEventHandler = this._startChunkChecker();
  }

  terminate() {
    if (this._chunkLoadEventHandler == null) {
      return;
    }
    this._bot.removeListener('chunkColumnLoad', this._chunkLoadEventHandler);
  }

  structureLocation() {
    return this._location;
  }

  _findStrongholdBlocksInLoadedChunks() {
    const chunks = this._bot.world.getColumns();
    for (const {chunkX, chunkZ} of chunks) {
      this._findStrongholdBlocksInChunk(chunkX * 16, chunkZ * 16)
    }
  }

  _startChunkChecker() {
    console.log('start chunk checker');
    const chunkLoadEventHandler = async (chunkLoadPosition) => {
      // TODO: look into why this is getting called twice per chunk
      // console.log({chunkLoadPosition});

      // TEST make sure the chunk is actually loaded.
      // TODO: find a better way to ensure the chunk data is loaded
      await new Promise(r => setTimeout(r, 500));
      // const chunkData = this._bot.world.getColumn(Math.floor(chunkLoadPosition.x / 16), Math.floor(chunkLoadPosition.z / 16));
      // console.log({chunkLoadPosition});
      // console.log({chunkData});
      this._findStrongholdBlocksInChunk(chunkLoadPosition.x, chunkLoadPosition.z);
    }
    this._bot.on('chunkColumnLoad', chunkLoadEventHandler);
    return chunkLoadEventHandler;
  }


  async _findStrongholdBlocksInChunk(chunkX, chunkZ) {
    const chunkStartTime = performance.now();
    const blockIds = this._strongholdBlockSet(this._mcData);
    const chunkPosition = JSON.stringify({x: chunkX, z: chunkZ});
    if (this._chunkMap.has(chunkPosition)) {
      // No need to to process the chunk again
      return;
    } else {
      this._chunkMap.set(chunkPosition, new Map());
    }
    const cursor = new Vec3(0, 0, 0)
    for (cursor.x = chunkX; cursor.x < chunkX + 16; cursor.x++) {
      for (cursor.y = 0; cursor.y < 80; cursor.y++) {
        for (cursor.z = chunkZ; cursor.z < chunkZ + 16; cursor.z++) {
          const blockType = this._bot.world.getBlockType(cursor);
          if (!blockIds.has(blockType)) {
            continue;
          }
          // console.log({cursor, blockType});
          if (this._chunkMap.get(chunkPosition).has(blockType)) {
            const blockCount = this._chunkMap.get(chunkPosition).get(blockType);
            this._chunkMap.get(chunkPosition).set(blockType, blockCount + 1);
          } else {
            this._chunkMap.get(chunkPosition).set(blockType, 1);
          }
        }
      }
    }
    const values = this._chunkMap.get(chunkPosition).values();
    let blockCount = 0;
    for (const count of values) {
      blockCount += count;
    }
    const blockCountThreshold = 100;
    if (blockCount > blockCountThreshold) {
      if (this._location.target == null || (!this._location.finalTarget)) {
        // default to the chunk location
        let ignoreY = true;
        let finalTarget = false;
        let target = new Vec3(chunkX, 0, chunkZ);
        // Check if the portal room was in the chunk.
        const portalRoomBlocks = this._strongholdPortalRoomSet(this._mcData);
        const keys = this._chunkMap.get(chunkPosition).keys();
        for (const key of keys) {
          if (portalRoomBlocks.has(key)) {
            const closestPortalRoomBlock = this._bot.findBlock({matching: [...portalRoomBlocks], maxDistance: 256});
            console.log({closestPortalRoomBlock});
            if (closestPortalRoomBlock != null) {
              console.log({foundFinalTarget: closestPortalRoomBlock});
              ignoreY = false;
              finalTarget = true;
              target = closestPortalRoomBlock.position.clone();
              // No need to continue searching
              this.terminate();
              break;
            }
          }
        }
        if (this._location.target == null || (!this._location.finalTarget && this._location.blockCount < blockCount) || finalTarget) {
          this._location = {
            found: true,
            target,
            ignoreY,
            // TODO: keep these following data internal.
            blockCount,
            finalTarget
          }
          console.log({locationUpdate: this._location});
        }
      }
      // console.log({chunkX, chunkZ, blockCount, time: performance.now() - chunkStartTime, map: this._chunkMap.get(chunkPosition)});
    }
  }

  _strongholdBlockSet(mcData) {
    const strongholdBlocks = new Set();
    strongholdBlocks.add(mcData.blocksByName.stone_bricks.id);
    strongholdBlocks.add(mcData.blocksByName.cracked_stone_bricks.id);
    strongholdBlocks.add(mcData.blocksByName.mossy_stone_bricks.id);
    strongholdBlocks.add(mcData.blocksByName.infested_stone_bricks.id);
    strongholdBlocks.add(mcData.blocksByName.infested_mossy_stone_bricks.id);
    strongholdBlocks.add(mcData.blocksByName.infested_cracked_stone_bricks.id);
    strongholdBlocks.add(mcData.blocksByName.infested_stone.id);
    strongholdBlocks.add(mcData.blocksByName.infested_cobblestone.id);
    strongholdBlocks.add(mcData.blocksByName.end_portal.id);
    strongholdBlocks.add(mcData.blocksByName.end_portal_frame.id);
    return strongholdBlocks;
  }

  _strongholdPortalRoomSet(mcData) {
    const strongholdBlocks = new Set();
    strongholdBlocks.add(mcData.blocksByName.end_portal.id);
    strongholdBlocks.add(mcData.blocksByName.end_portal_frame.id);
    return strongholdBlocks;
  }
}

// Goal that updates the target with more accurate stronghold location
// TODO: handle chunk updates to update target location
export class StrongholdGoal extends goals.Goal {
  constructor(heading, tossOrigin, sensor) {
    super();
    this._sensor = sensor;
    this._maxDistanceLocation = estimateMaxStrongholdLocationFromHeading(heading, tossOrigin);
    this._setTarget(this._maxDistanceLocation, true);
  }

  _setTarget(target, ignoreY) {
    this._target = new Vec3(Math.floor(target.x), Math.floor(target.y), Math.floor(target.z));
    this._ignoreY = ignoreY;
  }

  heuristic(node) {
    const dx = this._target.x - node.x;
    const dz = this._target.z - node.z;
    let cost = this._distanceXZ(dx, dz);
    if (!this._ignoreY) {
      const dy = this._target.y - node.y;
      cost += Math.abs(dy);
    }
    return cost;
  }

  isEnd(node) {
    let atEnd;
    atEnd = node.x === this._target.x && node.z === this._target.z;
    if (!this._ignoreY) {
      const atY = node.y === this._target.y;
      atEnd = atEnd && atY;
    }
    return atEnd;
  }

  hasChanged() {
    const sensorLocation = this._sensor.structureLocation();
    if (sensorLocation.found) {
      const target = sensorLocation.target.clone();
      const ignoreY = sensorLocation.ignoreY;
      if (target.x !== this._target.x || target.y !== this._target.y || target.z !== this._target.z) {
        this._setTarget(target, ignoreY);
        console.log({goalUpdate: target});
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  _distanceXZ(dx, dz) {
    dx = Math.abs(dx)
    dz = Math.abs(dz)
    return Math.abs(dx - dz) + Math.min(dx, dz) * Math.SQRT2
  }
}
