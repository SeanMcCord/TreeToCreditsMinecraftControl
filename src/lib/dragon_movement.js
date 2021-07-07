import Vec3 from 'vec3';
import {logger} from './logger.js';

export const nextPos = (dragonEntity) => {
  const tps = 20.0;
  const displacement = dragonEntity.velocity.clone().scaled(20 / tps);
  logger.info({displacement, velocity: dragonEntity.velocity});
  return dragonEntity.position.clone().plus(displacement);
}

export const nextDisplacement = (dragonVelocity) => {
  const actualTPS = 20.0;
  const typicalTPS = 20.0;
  return dragonVelocity.clone().scaled(actualTPS / typicalTPS);
}

export const nextVelocity = (dragonVelocity) => {
  return dragonVelocity;
}
