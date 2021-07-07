import util from 'util';
import {exec} from 'child_process';
const execP = util.promisify(exec);

// function clearedState() {
//   return new Map([
//     ['w', 'keyup'],
//     ['a', 'keyup'],
//     ['s', 'keyup'],
//     ['d', 'keyup'],
//     ['e', 'keyup'],
//     ['q', 'keyup'],
//     ['ctrl', 'keyup'],
//     ['shift', 'keyup'],
//     ['space', 'keyup'],
//     ['Escape', 'keyup'],
//     ['1', 'keyup'],
//     ['2', 'keyup'],
//     ['3', 'keyup'],
//     ['4', 'keyup'],
//     ['5', 'keyup'],
//     ['6', 'keyup'],
//     ['7', 'keyup'],
//     ['8', 'keyup'],
//     ['9', 'keyup'],
//     ['0', 'keyup'],
//   ]);
// }
// 
// function applyState(state) {
// }

function generateCommand(text) {
  return async function () {
    console.log(text);
    try {
      const {stdout, stderr} = await execP(`DISPLAY=:0 xdotool ${text}`);
      if (stdout.length !== 0 || stderr.length !== 0) {
        console.log('stdout:', stdout);
        console.log('stderr:', stderr);
      }
    } catch (err) {
      console.error(err);
    };
  }
};

async function moveMouse(x, y) {
  try {
    // -- allows for negative numbers
    console.log({moveMouse: {x, y}});
    const {stdout, stderr} = await execP(`DISPLAY=:0 xdotool mousemove_relative -- ${x} ${y}`);
    if (stdout.length !== 0 || stderr.length !== 0) {
      console.log('stdout:', stdout);
      console.log('stderr:', stderr);
    }
  } catch (err) {
    console.error(err);
  };
};

const openInventory = generateCommand('key e');
const closeInventory = generateCommand('key Escape');
const turnLeft = generateCommand('mousemove_relative 100 0');
const goForward = generateCommand('keydown ctrl w');
const stop = generateCommand('keyup ctrl w');
const moveLeft = generateCommand('keydown a');
const stopMoveLeft = generateCommand('keyup a');
const moveRight = generateCommand('keydown d');
const stopMoveRight = generateCommand('keyup d');
const jump = generateCommand('key space');
const crouchStart = generateCommand('keydown shift');
const crouchStop = generateCommand('keyup shift');

async function wait(ms) {
  await new Promise(r => setTimeout(r, ms));
}

export default {
  openInventory,
  closeInventory,
  turnLeft,
  goForward,
  stop,
  moveLeft,
  stopMoveLeft,
  moveRight,
  stopMoveRight,
  jump,
  crouchStop,
  crouchStart,
  moveMouse,
  wait
};

// const go = async () => {
//   goForward()
//   await wait(1000);
//   moveLeft();
//   await wait(2000);
//   stop()
//   stopMoveLeft();
//   moveRight();
//   await wait(500);
//   goForward()
//   await wait(2000);
//   moveLeft();
//   await wait(4000);
//   stopMoveLeft();
//   stopMoveRight();
//   stop()
// }
// go();
