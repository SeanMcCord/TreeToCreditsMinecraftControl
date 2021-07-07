import Vec3 from 'vec3';
import {logger} from '../logger.js';

export default async (bot) => {
  logger.info('trail');
  const startPos = bot.entity.position.clone();
  await new Promise(r => setTimeout(r, 10000));
  bot.clearControlStates();
  const endPos = bot.entity.position.clone();
  await new Promise(r => setTimeout(r, 1000));
  const finalPos = bot.entity.position.clone();
  const startToEnd = endPos.minus(startPos);
  const endToFinal = finalPos.minus(endPos);
  logger.info({startToEnd, endToFinal});
}
