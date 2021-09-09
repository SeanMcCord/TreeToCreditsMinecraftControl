import {queryMousePosition} from './gui_direct_control.js';
import readline from 'readline';
import util from 'util';

// Quick and dirty way to get mouse positions for inventory menus.
// Pros: Quick, Easy to debug
// Cons: not GUI scale invariant
// Ranges for windows can be found here https://wiki.vg/Inventory#Windows
// Inventory names here https://github.com/PrismarineJS/prismarine-windows/blob/master/index.js
// This only handles 1.16 and newer. Older versions are out of scope.

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = util.promisify(rl.question).bind(rl);

const slotsByWindowType = new Map<string, Array<number>>([
  // ['minecraft:inventory', [...Array(46).keys(), -999]],
  ['minecraft:crafting', [...Array(46).keys(), -999]],
  ['minecraft:furnace', [...Array(39).keys(), -999]],
  ['minecraft:generic_9x3', [...Array(63).keys(), -999]],
]);

const getPositionOfSlot = async (rl, slot: number): Promise<{x: number, y: number}> => {
  await question(`Where is slot ${slot}?`);
  const position = await queryMousePosition();
  console.log(position);
  return position;
}

const calibrate = async () => {
  const positionMap = {};
  for (const [windowType, slotIds] of slotsByWindowType.entries()) {
    positionMap[windowType] = {};
    console.log(windowType);
    for (const slotId of slotIds) {
      const position = await getPositionOfSlot(rl, slotId);
      positionMap[windowType][slotId] = position;
    }
  }
  console.log(JSON.stringify(positionMap));
}

calibrate();
