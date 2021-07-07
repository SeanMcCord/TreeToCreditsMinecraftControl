import Vec3 from 'vec3';
import {logger} from './logger.js';
import trailblazer from './trailblazer/index.js';

export default async (bot, mcData) => {
  await trailblazer(bot);
  logger.info('test');
}
