import {getLowestCostPosition} from './high_level_operations.js';
import pathfinder from 'mineflayer-pathfinder';
import Vec3 from 'vec3';
const {Movements, goals} = pathfinder;

export const avoidBlaze = (bot, mcData) => {
  // don't collide with any blaze
  // bot.on('entitySpawn', (entity) => {
  //   console.log({entity});
  // });
  // Fireball spawn
  // bot.on('entitySpawn', (entity) => {
  //   if (entity.type !== 'object' || entity.objectType !== 'Small Fireball') return;
  //   // name small_fireball
  //   // console.log({entity});
  // });
  // bot.on('entityMoved', (entity) => {
  //   if (entity.type !== 'object' || entity.objectType !== 'Small Fireball') return;
  //   // name small_fireball
  //   // console.log({entity});
  // });
  const avoidBlazesGoal = new goals.GoalCompositeAll();
  const addBlazeToAvoidGoal = (blaze) => {
    console.log({addingMob: blaze})
    avoidBlazesGoal.push(new goals.GoalInvert(new goals.GoalFollow(blaze, 6)));
  };
  for (const entity_ref of Object.entries(bot.entities)) {
    const entity = entity_ref[1];
    // console.log({entity});
    if (entity.type === 'mob' && entity.kind === 'Hostile mob' && entity.mobType === 'Zombie') {
      addBlazeToAvoidGoal(entity);
    }
  }
  // Blaze spawn
  bot.on('entitySpawn', (entity) => {
    if (entity.type === 'mob' && entity.mobType === 'Zombie') {
      addBlazeToAvoidGoal(entity);
    }
    // name blaze
    // console.log({entity});
  });

  console.log({avoidBlazesGoal});
  bot.pathfinder.setGoal(avoidBlazesGoal, true);
}

export class FireFighter {
  constructor(bot, mcData, lowPosition, highPosition, range) {
    this._bot = bot;
    this._fireId = mcData.blocksByName.fire.id;
    // Find all the fire in the given cubeoid
    const fireBlockPositions = this._bot.findBlocks({matching: this._fireId, count: 10000, maxDistance: range});
    const isBlocksInCubiod = (blockPosition) => {
      // TODO: remove this and remove maxDistance to enforce cubeoid
      return true;
      return (blockPosition.x >= lowPosition.x && blockPosition.x <= highPosition.x) &&
        (blockPosition.y >= lowPosition.y && blockPosition.y <= highPosition.y) &&
        (blockPosition.z >= lowPosition.z && blockPosition.z <= highPosition.z);
    };
    this._fireBlocksInCubiod = fireBlockPositions.filter(isBlocksInCubiod);
    this._newFireFinder = (_, newBlock) => {
      if (newBlock.type !== this._fireId) return;
      if (!isBlocksInCubiod(newBlock.position)) return;
      this._fireBlocksInCubiod.push(newBlock.position);
    }
    bot.world.on('blockUpdate', this._newFireFinder);
  }

  async extinguishNearestFire() {
    if (this._fireBlocksInCubiod.length === 0) {
      return;
    }
    const firePosition = await getLowestCostPosition(this._bot, this._fireBlocksInCubiod);
    this._fireBlocksInCubiod = this._fireBlocksInCubiod.filter((block) => !(block.x === firePosition.x && block.y === firePosition.y && block.z === firePosition.z));
    await this._collectFire(firePosition);
  }

  isJobHereDone() {
    return this._fireBlocksInCubiod.length === 0;
  }

  terminate() {
    this._bot.world.removeListener('blockUpdate', this._newFireFinder);
  }

  async _collectFire(position) {
    await new Promise((resolve, reject) => {
      try {
        const block = this._bot.blockAt(position);
        if (block == null || block.type !== this._fireId) {
          // just don't bother if the block is null or not fire.
          resolve();
          return;
        }
        this._bot.collectBlock.collect(block, async (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}
