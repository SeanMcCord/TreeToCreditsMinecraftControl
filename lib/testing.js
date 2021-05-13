import {tossEyeOfEnder, getHeadingFromEyeOfEnder, StrongholdGoal, StrongholdSensor} from './stronghold_search.js'

export default async (bot, mcData) => {
  await tossEyeOfEnder(bot, mcData);
  const {heading, tossOrigin} = await getHeadingFromEyeOfEnder(bot, 5000);
  console.log({heading, tossOrigin});
  const sensor = new StrongholdSensor(bot, mcData);
  // TODO: pick up the eye of ender
  bot.pathfinder.setGoal(new StrongholdGoal(heading, tossOrigin, sensor), true);
}
