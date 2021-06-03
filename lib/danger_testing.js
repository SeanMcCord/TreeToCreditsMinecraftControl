import pathfinder from 'mineflayer-pathfinder';
const {Movements, goals} = pathfinder;
import {avoidBlaze, FireFighter} from './blaze_spawner.js';
import {collectNearestItemDrop} from './high_level_operations.js';
import Vec3 from 'vec3';
import {NeoGoal, FireBallSensor} from './neo_goal.js';

// Build entire closter.
// TODO: build it faster by using environment
const buildCloster = async (bot, mcData) => {
  // find place to put one down.
  const blockedPositions = new Set();
  for (const entity_ref of Object.entries(bot.entities)) {
    const entity = entity_ref[1];
    if (entity.type === 'mob') {
      const position = entity.position.floored();
      blockedPositions.add(position);
      blockedPositions.add(position.offset(0, 1, 0));
      blockedPositions.add(position.offset(1, 0, 0));
      blockedPositions.add(position.offset(-1, 0, 0));
      blockedPositions.add(position.offset(0, 0, 1));
      blockedPositions.add(position.offset(0, 0, -1));
      blockedPositions.add(position.offset(1, 1, 0));
      blockedPositions.add(position.offset(-1, 1, 0));
      blockedPositions.add(position.offset(0, 1, 1));
      blockedPositions.add(position.offset(0, 1, -1));
    }
  }
  const airId = mcData.blocksByName.air.id;
  const candidateLocations = bot.findBlocks({matching: airId, maxDistance: 64, count: 10000})
    .filter((pos) => bot.blockAt(pos.offset(0, -1, 0)).boundingBox === 'block' && bot.blockAt(pos.offset(0, 1, 0)).type === airId)
    .filter((pos) => !blockedPositions.has(pos))
    .filter((pos) => {
      // Simple check if bot can build walls there or if part is already there.
      return (bot.blockAt(pos.offset(1, 0, 0)).boundingBox === 'block' || bot.blockAt(pos.offset(1, -1, 0)).boundingBox === 'block') &&
        (bot.blockAt(pos.offset(-1, 0, 0)).boundingBox === 'block' || bot.blockAt(pos.offset(-11, -1, 0)).boundingBox === 'block') &&
        (bot.blockAt(pos.offset(0, 0, 1)).boundingBox === 'block' || bot.blockAt(pos.offset(0, -1, 1)).boundingBox === 'block') &&
        (bot.blockAt(pos.offset(0, 0, -1)).boundingBox === 'block' || bot.blockAt(pos.offset(0, -1, -1)).boundingBox === 'block')
    })

  const candidateGoals = candidateLocations.map((pos) => new goals.GoalBlock(pos.x, pos.y, pos.z));
  await bot.pathfinder.goto(new goals.GoalCompositeAny(candidateGoals));
  const directionToCenter = bot.entity.position.floored().offset(0.5, 2, 0.5);
  // await bot.lookAt(directionToCenter, true);
  // await bot.setControlState('forward', true);
  // // TODO: handle moving different amounts
  // await new Promise((r => setTimeout(r, 50)));
  // await bot.setControlState('forward', false);
  // center bot in block
  const position = bot.entity.position.floored();
  console.log({closter: position, exactPosition: bot.entity.position, directionToCenter});
  console.log('time to build!!!!!!!!!');
  // TODO make this use more than just dirt
  const buildingMaterial = bot.inventory.slots.find((itemInSlot) => itemInSlot != null && itemInSlot.name === 'dirt');
  if (buildingMaterial == null) {
    console.log('no building material to make closter :(');
    // TODO: handle there not being materials to use
  }
  await bot.equip(buildingMaterial, 'hand');
  // TODO: maybe build this in a way to escape danger fastest. Ex block fire from blazes
  const buildWall = async (x, z) => {
    const blockA = bot.blockAt(position.offset(x, -1, z));
    let blockB = bot.blockAt(position.offset(x, 0, z));
    const blockC = bot.blockAt(position.offset(x, 1, z));
    await bot.lookAt(bot.entity.position.floored().offset(0.5, 2, 0.5), true);
    await bot.setControlState('forward', true);
    // TODO: handle moving different amounts
    await new Promise((r => setTimeout(r, 50)));
    await bot.setControlState('forward', false);
    if (blockB.boundingBox !== 'block') {
      await bot.placeBlock(blockA, new Vec3(0, 1, 0));
    }
    if (blockC.boundingBox !== 'block') {
      blockB = bot.blockAt(blockB.position);
      await bot.placeBlock(blockB, new Vec3(0, 1, 0));
    }
  }
  //build wall 1
  await buildWall(1, 0);
  //build wall 2
  await buildWall(-1, 0);
  //build wall 3
  await buildWall(0, 1);
  //build wall 4
  await buildWall(0, -1);
  //build roof
  let blockA = bot.blockAt(position.offset(0, 1, -1));
  let blockB = bot.blockAt(position.offset(0, 2, -1));
  const blockC = bot.blockAt(position.offset(0, 3, 0));
  if (blockC.boundingBox !== 'block') {
    if (blockB.boundingBox !== 'block') {
      await bot.placeBlock(blockA, new Vec3(0, 1, 0));
      blockB = bot.blockAt(blockB.position);
    }
    await bot.placeBlock(blockB, new Vec3(0, 0, 1));
  }

}

export default async (bot, mcData) => {
  const fireBallSensor = new FireBallSensor(bot, mcData);
  const moves = new Movements(bot, mcData);
  moves.occupyCost = (positions) => {
    if (positions == null || positions.length === 0) {
      return 0;
    }
    const cost = positions.reduce((cost, pos) => {
      const dangerLevel = fireBallSensor.dangerLevel(pos);
      return cost = cost + dangerLevel * 4;
    }, 0);
    return cost;
  }
  moves.blocksToAvoid.add(mcData.blocksByName.fire.id);
  bot.pathfinder.setMovements(moves);

  while (true) {
    const goalA = new NeoGoal(fireBallSensor, new goals.GoalBlock(-95, 68, 482));
    bot.pathfinder.setGoal(goalA, true);
    await new Promise((r => setTimeout(r, 10000)));
    const goalB = new NeoGoal(fireBallSensor, new goals.GoalBlock(-105, 72, 539));
    bot.pathfinder.setGoal(goalB, true);
    await new Promise((r => setTimeout(r, 10000)));
    const goalC = new NeoGoal(fireBallSensor, new goals.GoalBlock(-154, 71, 476));
    bot.pathfinder.setGoal(goalC, true);
    await new Promise((r => setTimeout(r, 10000)));
  }
  fireBallSensor.terminate();
}

const otherTest = async (bot, mcData) => {
  const firefighter = new FireFighter(bot, mcData, null, null, 20);
  const moves = new Movements(bot, mcData);
  moves.blocksToAvoid.add(mcData.blocksByName.fire.id);
  bot.pathfinder.setMovements(moves);
  bot.pvp.movements = moves;
  // TODO: find out why this doesn't work
  // bot.collectblock.movements = moves;

  const getBlazesNearby = (range) => {
    const nearbyBlazes = []
    for (const entity_ref of Object.entries(bot.entities)) {
      const entity = entity_ref[1];
      if (entity.type === 'mob' && entity.mobType === 'Blaze') {
        if (bot.entity.position.distanceTo(entity.position) <= range) {
          nearbyBlazes.push(entity);
        }
      }
    }
    return nearbyBlazes;
  };
  const getClosestBlazeForMelee = () => {
    // Filter out blazes to high above the ground
    const nearbyGroundedBlazes = getBlazesNearby(30).filter((blaze) => {
      const blocks = []
      blocks.push(bot.blockAt(blaze.position));
      blocks.push(bot.blockAt(blaze.position.offset(0, -1, 0)));
      blocks.push(bot.blockAt(blaze.position.offset(0, -2, 0)));
      blocks.push(bot.blockAt(blaze.position.offset(0, -3, 0)));
      blocks.push(bot.blockAt(blaze.position.offset(0, -4, 0)));
      blocks.push(bot.blockAt(blaze.position.offset(0, -5, 0)));
      return !blocks.every((block) => block.type === mcData.blocksByName.air.id);
    });
    return nearbyGroundedBlazes.sort((blazeA, blazeB) => {
      const distanceA = bot.entity.position.distanceTo(blazeA.position);
      const distanceB = bot.entity.position.distanceTo(blazeB.position);
      return distanceA - distanceB;
    })[0];
  };
  let closter = false;
  const attackClosestBlaze = async () => {
    if (closter) return;
    const blaze = getClosestBlazeForMelee(30);
    if (blaze == null) {
      if (bot.pvp.target != null) {
        bot.pvp.stop();
      }
      if (closter) return;
      try {
        // TODO: remove this error driven flow
        await collectNearestItemDrop(bot, mcData.itemsByName.blaze_rod.id);
      } catch (error) {
        await firefighter.extinguishNearestFire();
      }
      // Nothing to kill, time to pickup rods and put out fires.
      // TODO: Handle the case where a new blaze spawn. That is more important
      return;
    }
    if (closter) return;
    const distance = bot.entity.position.distanceTo(blaze.position);
    if (bot.pvp.target !== blaze) {
      console.log({distanceToCloserBlaze: distance});
      if (closter) return;
      bot.pvp.attack(blaze);
      console.log('not waiting on kill');
    }
  };
  setInterval(attackClosestBlaze, 1000);
  const closterDetect = () => {
    if (bot.health < 6 && closter == false) {
      closter = true;
      clearInterval(attackClosestBlaze);
      bot.pvp.stop();
      bot.pathfinder.setGoal(null);
      buildCloster(bot, mcData);
      console.log('time to closter!!!!!!!!!');
    } else if (bot.health === 20 && bot.food === 20 && closter == true) {
      closter == false;
      console.log('closter over');
      setInterval(attackClosestBlaze, 1000);
    }
  };
  bot.on('health', closterDetect);

  //while (blazes.length > 0 || !firefighter.isJobHereDone()) {
  //  if (blazes.length > 0) {
  //    const entity = blazes.pop();
  //    await bot.pvp.attack(entity);
  //  } else {
  //    await firefighter.extinguishNearestFire();
  //  }
  //}
  //firefighter.terminate();
}
