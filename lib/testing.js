import {placeEyesOfEnder, tossEyeOfEnder, getHeadingFromEyeOfEnderToss, StrongholdGoal, StrongholdSensor, enterEndPortal} from './stronghold_search.js';
import {collectNearestItemDrop, ItemNotFoundError} from './high_level_operations.js';

export default async (bot, mcData) => {
  // TODO: make sure we don't toss it in an area that might endanger the eye of ender.
  // i.e. near lava or underground where the item may be item elevated if it breaks in the wall.
  const headingPromise = getHeadingFromEyeOfEnderToss(bot, 10000);
  await tossEyeOfEnder(bot, mcData);
  // Free to move or do whatever after toss until heading resolves

  const {heading, tossOrigin} = await headingPromise;
  try {
    await collectNearestItemDrop(bot, mcData.itemsByName.ender_eye.id)
  } catch (error) {
    if (!(error instanceof ItemNotFoundError)) {
      throw error;
    }
  }

  const sensor = new StrongholdSensor(bot, mcData);
  // Bot is really dumb when it comes to water right now.
  bot.pathfinder.setGoal(new StrongholdGoal(heading, tossOrigin, sensor));
  await new Promise((resolve, _) => {
    // TODO: handle the case that we didn't make it to our goal.
    bot.once('goal_reached', () => {
      resolve();
    });
  });

  // TODO: ensure the space above the end portal is clear
  // TODO: ensure nothing hits us while we place eyes
  await placeEyesOfEnder(bot, mcData);

  await enterEndPortal(bot, mcData);
}
