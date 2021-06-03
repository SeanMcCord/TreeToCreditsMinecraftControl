import Vec3 from 'vec3';
import pathfinder from 'mineflayer-pathfinder';
const {Movements, goals} = pathfinder;

// From https://stackoverflow.com/questions/31128855/comparing-ecma6-sets-for-equality
// Man I hate javascript
function eqSet(as, bs) {
  if (as.size !== bs.size) return false;
  for (let a of as) if (!bs.has(a)) return false;
  return true;
}

// TODO: make the names consistent for Blocks, Vec3, and position objects
export class FireBallSensor {
  constructor(bot, mcData) {
    this._bot = bot;
    // TODO: remove this if we can just use the keys of the dangerBlocks
    this._dangerBlocks = new Map();
    this._stateId = 0;
    const newEntityHooks = [];

    // TODO: confirm if the yaw and pitch get the right path. Swap over to the entitySpawn if it can
    const getDangerousBlocks = (position, direction) => {
      // const yaw = entity.yaw;
      // const pitch = entity.pitch;
      // const csPitch = Math.cos(pitch);
      // const snPitch = Math.sin(pitch);
      // const csYaw = Math.cos(yaw);
      // const snYaw = Math.sin(yaw);
      // const direction = new Vec3(-snYaw * csPitch, snPitch, -csYaw * csPitch);
      const dangerBlocks = new Set();
      const airId = mcData.blocksByName.air.id;
      bot.world.raycast(position, direction.normalize(), 128, (block) => {
        if (block.type === airId) {
          dangerBlocks.add(JSON.stringify(block.position));
          dangerBlocks.add(JSON.stringify(block.position.offset(0, 1, 0)));
          dangerBlocks.add(JSON.stringify(block.position.offset(0, -1, 0)));
          dangerBlocks.add(JSON.stringify(block.position.offset(1, 0, 0)));
          dangerBlocks.add(JSON.stringify(block.position.offset(-1, 0, 0)));
          dangerBlocks.add(JSON.stringify(block.position.offset(0, 0, 1)));
          dangerBlocks.add(JSON.stringify(block.position.offset(0, 0, -1)));
          return false;
        }
        return true;
      });
      return dangerBlocks;
    };
    this._addFireBall = (entity) => {
      if (entity.type !== 'object' || entity.objectType !== 'Small Fireball') return;
      // console.log({addFireBall: entity.uuid});
      // Fire ball moved will be sent very shortly. This doesn't need to invalidate the path
      // this._stateId += 1;
    };
    this._fireBallMoved = (entity) => {
      if (entity.type !== 'object' || entity.objectType !== 'Small Fireball') return;
      const dangerBlocks = getDangerousBlocks(entity.position, entity.velocity);
      // console.log({fireBallMoved: entity.uuid});
      this._dangerBlocks.set(entity.uuid, dangerBlocks);
      this._stateId += 1;
    };
    this._removeFireBall = (entity) => {
      if (entity.type !== 'object' || entity.objectType !== 'Small Fireball') return;
      // console.log({fireBallGone: entity.uuid});
      this._dangerBlocks.delete(entity.uuid);
      this._stateId += 1;
    };
    newEntityHooks.push(this._addFireBall);
    bot.on('entitySpawn', this._addFireBall);
    bot.on('entityMoved', this._fireBallMoved);
    bot.on('entityGone', this._removeFireBall);
    // ####################
    // BLAZE
    const getDangerousBlazeBlocks = (entity) => {
      const yaw = entity.headYaw || 0;
      const pitch = entity.headPitch || 0;
      const csPitch = Math.cos(pitch);
      const snPitch = Math.sin(pitch);
      const csYaw = Math.cos(yaw);
      const snYaw = Math.sin(yaw);
      const direction = new Vec3(-snYaw * csPitch, snPitch, -csYaw * csPitch);
      let dangerBlocks = new Set();
      if (entity.metadata[15] === 1) {
        // console.log({onFire: entity.uuid});
        dangerBlocks = getDangerousBlocks(entity.position.offset(0, 1.6, 0), direction);
      }
      // line of sight when on fire
      // hitbox
      dangerBlocks.add(JSON.stringify(entity.position.floored()));
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(0, 1, 0)));
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(0, 2, 0)));
      // +x
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(1, 0, 0)));
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(1, 1, 0)));
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(1, 2, 0)));
      // -x
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(-1, 0, 0)));
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(-1, 1, 0)));
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(-1, 2, 0)));
      // +z
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(0, 0, 1)));
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(0, 1, 1)));
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(0, 2, 1)));
      // -z
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(0, 0, -1)));
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(0, 1, -1)));
      dangerBlocks.add(JSON.stringify(entity.position.floored().offset(0, 2, -1)));
      return dangerBlocks;
    };
    this._addBlaze = (entity) => {
      if (entity.type !== 'mob' || entity.objectType !== 'Blaze') return;
      // console.log({addBlaze: entity.uuid});
      const dangerBlocks = getDangerousBlazeBlocks(entity);
      this._dangerBlocks.set(entity.uuid, dangerBlocks);
      this._stateId += 1;
    };
    this._blazeMoved = (entity) => {
      if (entity.type !== 'mob' || entity.objectType !== 'Blaze') return;
      // console.log({blazeMoved: entity.uuid});
      const dangerBlocks = getDangerousBlazeBlocks(entity);
      this._dangerBlocks.set(entity.uuid, dangerBlocks);
      this._stateId += 1;
    };
    this._blazeUpdated = (entity) => {
      if (entity.type !== 'mob' || entity.objectType !== 'Blaze') return;
      // console.log({blazeUpdated: entity.uuid});
      const dangerBlocks = getDangerousBlazeBlocks(entity);
      this._dangerBlocks.set(entity.uuid, dangerBlocks);
      this._stateId += 1;
    };
    this._removeBlaze = (entity) => {
      if (entity.type !== 'mob' || entity.objectType !== 'Blaze') return;
      // console.log({fireBallGone: entity.uuid});
      this._dangerBlocks.delete(entity.uuid);
      this._stateId += 1;
    };
    newEntityHooks.push(this._addBlaze);
    bot.on('entitySpawn', this._addBlaze);
    bot.on('entityMoved', this._blazeMoved);
    bot.on('entityUpdate', this._blazeUpdated);
    bot.on('entityGone', this._removeBlaze);
    // #########
    // Ender Dragon
    // #########
    // Ender fire ball
    // #########
    // Endermen
    // TODO: standing in a two high area is safe from these guys. Find a way to get the bot to know that

    // Ensure existing mobs are listed in the danger set
    for (const entity_ref of Object.entries(bot.entities)) {
      const entity = entity_ref[1];
      newEntityHooks.forEach((hook) => hook.call(this, entity));
    }
  }

  inDanger(pos) {
    const blockA = JSON.stringify(pos);
    for (const blocks of this._dangerBlocks.values()) {
      if (blocks.has(blockA)) {
        return true;
      }
    }
    return false;
  }

  dangerLevel(pos) {
    let dangerLevel = 0;
    const blockA = JSON.stringify(pos);
    for (const blocks of this._dangerBlocks.values()) {
      if (blocks.has(blockA)) {
        dangerLevel += 1;
      }
    }
    return dangerLevel;
  }

  getStateId() {
    return this._stateId;
  }

  // Map of fire ball uuids to JSON.stringifyied Vec3 locations
  getDangerBlocksByFireBall() {
    return this._dangerBlocks;
  }

  // Set of JSON.stringifyied Vec3 locations
  getDangerBlocks() {
    const dangerBlockSet = new Set();
    for (const blocks of this._dangerBlocks.values()) {
      for (const block of blocks) {
        dangerBlockSet.add(block);
      }
    }
    return dangerBlockSet;
  }

  terminate() {
    this._bot.removeListener('entitySpawn', this._addFireBall);
    this._bot.removeListener('entityMoved', this._fireBallMoved);
    this._bot.removeListener('entityGone', this._removeFireBall);
    this._bot.removeListener('entitySpawn', this._addBlaze);
    this._bot.removeListener('entityMoved', this._blazeMoved);
    this._bot.removeListener('entityUpdate', this._blazeUpdated);
    this._bot.removeListener('entityGone', this._removeBlaze);
  }
}

export class NeoGoal extends goals.Goal {
  constructor(fireBallSensor, goal) {
    super();
    this._fireBallSensor = fireBallSensor;
    this._goal = goal;
    this._tempGoal;
    this._sensorStateId = this._fireBallSensor.getStateId();
    this._changed = true;
    this._changeTimer = () => this._changed = true;
    setInterval(this._changeTimer, 1500);
  }

  terminate() {
    clearInterval(this._changeTimer);
  }

  heuristic(node) {
    // TODO: include the cost of going into danger
    if (this._tempGoal != null) {
      return this._tempGoal.heuristic(node);
    }
    return this._goal.heuristic(node);
  }

  isEnd(node) {
    if (this._tempGoal != null) {
      return this._tempGoal.isEnd(node);
    }
    return this._goal.isEnd(node);
  }

  hasChanged() {
    if (this._changed) {
      this._changed = false;
      return true;
    }
    // if (this._sensorStateId !== this._fireBallSensor.getStateId()) {
    //   this._sensorStateId = this._fireBallSensor.getStateId();
    //   return true;
    // }
    return false;
  }
}
