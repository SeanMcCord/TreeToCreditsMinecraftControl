import Vec3 from 'vec3';
import pathfinder from 'mineflayer-pathfinder';
const {Movements, goals} = pathfinder;
import {getPortalLocation, DragonHeadFollower} from './kill_ender_dragon.js';
import {EntityWatcher} from './vector_api.js';
import {nextDisplacement, nextVelocity} from './dragon_movement.js';
import {performance} from 'perf_hooks';
import {logger} from './logger.js';

export default async (bot, mcData, vectorAPIPort) => {
  const entityWatcher = new EntityWatcher(bot, vectorAPIPort);
  const portalLocation = getPortalLocation(bot, mcData);
  logger.info({portalLocation});

  const explodedPositionCount = new Map();
  const explosionHandler = (packet) => {
    const p = new Vec3(packet.x, packet.y, packet.z)
    packet.affectedBlockOffsets.forEach((offset) => {
      const pt = p.offset(offset.x, offset.y, offset.z)
      let count = 1;
      if (explodedPositionCount.has(JSON.stringify(pt.toArray()))) {
        count += explodedPositionCount.get(JSON.stringify(pt.toArray()));
      }
      explodedPositionCount.set(JSON.stringify(pt.toArray()), count);
    })
    logger.info({explodedPositionCount});
  }
  // bot._client.on('explosion', explosionHandler);
  let dragonEntity;
  let previousDragonYaw = Math.PI;
  let previousDragonPitch = 0;
  let previousDragonHeadYaw = Math.PI;
  let previousDragonHeadPitch = 0;
  let previousDragonHealth;
  const dragonMovedHandler = (entity) => {
    if (entity.type !== 'mob' || entity.name !== 'ender_dragon') return;
    dragonEntity = entity;
    if (previousDragonPitch == null || entity.pitch != null && previousDragonPitch !== entity.pitch) {
      previousDragonPitch = entity.pitch;
      logger.info({dragonPitch: entity.pitch});
    }
    if (previousDragonYaw == null || entity.yaw != null && previousDragonYaw !== entity.yaw) {
      previousDragonYaw = entity.yaw;
      logger.info({dragonYaw: entity.yaw});
    }
    if (previousDragonHeadPitch == null || entity.headPitch != null && previousDragonHeadPitch !== entity.headPitch) {
      previousDragonHeadPitch = entity.headPitch;
      logger.info({dragonHeadPitch: entity.headPitch});
    }
    if (previousDragonHeadYaw == null || entity.headYaw != null && previousDragonHeadYaw !== entity.headYaw) {
      previousDragonHeadYaw = entity.headYaw;
      logger.info({dragonHeadYaw: entity.headYaw});
    }
  }
  const dragonHealthHandler = (entity) => {
    if (entity.type !== 'mob' || entity.name !== 'ender_dragon') return;
    dragonEntity = entity;
    if (previousDragonHealth == null || previousDragonHealth !== entity.metadata[8]) {
      previousDragonHealth = entity.metadata[8];
      logger.info({dragonHealth: entity.metadata[8]});
    }
  }
  bot.on('entitySpawn', (entity) => {
    if (entity.type !== 'mob' || entity.name !== 'ender_dragon') return;
    entityWatcher.watchEntity(entity.uuid);
  });
  let ticksSinceEstimate = 0;
  bot.on('physicsTick', () => ticksSinceEstimate++);
  // Assumes there is only one dragon
  let posDisplacementEstimate;
  let posEstimateDatum;
  let previousVelocity;
  let velocityEstimate;
  let previousStartTime = performance.now();
  bot.on('entityMoved', (entity) => {
    if (entity.type !== 'mob' || entity.name !== 'ender_dragon') return;
    if (ticksSinceEstimate === 0) {
      logger.info('not enough ticks')
      return;
    }
    const entityVelocity = entity.velocity.clone();
    const entityPosition = entity.position.clone();
    if (posDisplacementEstimate != null) {
      const actualDisplacement = entityPosition.minus(posEstimateDatum);
      const deltaT = performance.now() - previousStartTime;
      logger.info({
        ticksSinceEstimate,
        actualDisplacement,
        previousVelocity: previousVelocity.scaled(ticksSinceEstimate),
        entityVelocity: entityVelocity.scaled(ticksSinceEstimate),
        deltaT
      });
      // NOTE: scaling this is too simple. It contiunes to move through the phase space during periods we don't get packets
      const posEstimate = posEstimateDatum.plus(posDisplacementEstimate.scaled(ticksSinceEstimate));
      const diff = posEstimate.minus(entityPosition);
      const pErr = (actual, expected) => Math.abs((actual - expected) / expected) * 100;
      // const expectedVector = posDisplacementEstimate.scaled(ticksSinceEstimate);
      // const actualVector = entityPosition.minus(posEstimateDatum);
      // logger.info({
      //   ticksSinceEstimate,
      //   posEstimate,
      //   entityPosition,
      //   diff,
      //   percentError: {
      //     x: pErr(actualVector.x, expectedVector.x),
      //     y: pErr(actualVector.y, expectedVector.y),
      //     z: pErr(actualVector.z, expectedVector.z)
      //   }
      // });
    }
    previousStartTime = performance.now();
    velocityEstimate = nextVelocity(entityVelocity);
    posDisplacementEstimate = nextDisplacement(velocityEstimate);
    posEstimateDatum = entityPosition;
    previousVelocity = entityVelocity;
    ticksSinceEstimate = 0;
  });
  // bot.on('entityMoved', dragonMovedHandler);
  bot.on('entityUpdate', dragonHealthHandler);
  // bot.on('entitySpawn', dragonHealthHandler);
  // bot.on('entityUpdate', dragonHealthHandler);
  const headFollower = new DragonHeadFollower(bot, mcData);
  const logDragonHead = () => {
    if (headFollower.getPosition() == null) {
      logger.info('head not found');
      return;
    }
    const distance = portalLocation.offset(0, 1, 0).distanceTo(headFollower.getPosition())
    bot.lookAt(headFollower.getPosition(), true);
    const position = headFollower.getPosition();
    bot.chat(`/teleport TheMetaLink ${position.x} ${position.y - 1.6} ${position.z}`)
    //logger.info({distance, head: headFollower.getPosition()})
  }
  // setInterval(logDragonHead, 50);

  bot.getDragonHeadPos = () => headFollower.getPosition();
  bot.getDragon = () => dragonEntity;

  // TODO: will the portal always be within render distance on load?
  // TODO: make sure the checks we check are in the correct dimension
  const moves = new Movements(bot, mcData);
  bot.pathfinder.setMovements(moves);
  const standingPosition = portalLocation.offset(2, -3, 0)
  // bot.pathfinder.setGoal(new goals.GoalBlock(...standingPosition.toArray()), false);
  await new Promise((r => {
    setTimeout(() => {
      clearInterval(logDragonHead);
      bot._client.removeListener('explosion', explosionHandler);
      bot.removeListener('entityUpdate', dragonHealthHandler);
      bot.removeListener('entityMoved', dragonMovedHandler);
      r();
    }, 30000000)
  }));
}
