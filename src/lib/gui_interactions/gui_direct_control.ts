import util from 'util';
import {execFile} from 'child_process';
const execFileP = util.promisify(execFile);

// TODO: consider where they control mapping should be stored.
// Should this expose the keys or the commands that map to keys?
// i.e. e vs openInventory

// TODO: look more into useing libxdo directly rather than xdotool via child processes.

const keyboardKeys = ['w', 'a', 's', 'd', 'e', 'q', 'ctrl', 'shift', 'space', 'Escape',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;
type KeyboardKeys = typeof keyboardKeys[number];
type KeyboardKeyStates = 'keyup' | 'keydown';

const mouseKeys = ['1', '3'] as const;
type MouseKeys = typeof mouseKeys[number];
type MouseKeyStates = 'mouseup' | 'mousedown';

type KeyboardKeyStateMap = Map<KeyboardKeys, KeyboardKeyStates>;
type MouseKeyStateMap = Map<MouseKeys, MouseKeyStates>;
export type CompositeKeyStateMap = {
  keyboard: KeyboardKeyStateMap;
  mouse: MouseKeyStateMap;
}

type KeyboardCommand = {
  key: KeyboardKeys;
  targetKeyState: KeyboardKeyStates;
  targetDevice: 'KEYBOARD';
}
type MouseCommand = {
  key: MouseKeys;
  targetKeyState: MouseKeyStates;
  targetDevice: 'MOUSE';
}

type Command = KeyboardCommand | MouseCommand;



export const clearedState = (): CompositeKeyStateMap => {
  return {
    keyboard: new Map([
      ['w', 'keyup'],
      ['a', 'keyup'],
      ['s', 'keyup'],
      ['d', 'keyup'],
      ['e', 'keyup'],
      ['q', 'keyup'],
      ['ctrl', 'keyup'],
      ['shift', 'keyup'],
      ['space', 'keyup'],
      ['Escape', 'keyup'],
      ['1', 'keyup'],
      ['2', 'keyup'],
      ['3', 'keyup'],
      ['4', 'keyup'],
      ['5', 'keyup'],
      ['6', 'keyup'],
      ['7', 'keyup'],
      ['8', 'keyup'],
      ['9', 'keyup'],
      ['0', 'keyup'],
    ]),
    mouse: new Map([
      ['1', 'mouseup'],
      ['3', 'mouseup']
    ])
  };
}

export const cloneState = (state: CompositeKeyStateMap): CompositeKeyStateMap => {
  return {
    keyboard: new Map(state.keyboard),
    mouse: new Map(state.mouse)
  };
};

export const stateDiff = (stateA: CompositeKeyStateMap, stateB: CompositeKeyStateMap): CompositeKeyStateMap => {
  const diff = {keyboard: new Map(), mouse: new Map()};
  for (const keyboardKey of keyboardKeys) {
    const valueA = stateA.keyboard.get(keyboardKey);
    const valueB = stateB.keyboard.get(keyboardKey);
    if (valueB == null) {
      continue;
    } else if (valueA == null) {
      diff.keyboard.set(keyboardKey, valueB);
    } else if (valueA !== valueB) {
      diff.keyboard.set(keyboardKey, valueB);
    }
  }
  for (const mouseKey of mouseKeys) {
    const valueA = stateA.mouse.get(mouseKey);
    const valueB = stateB.mouse.get(mouseKey);
    if (valueB == null) {
      continue;
    } else if (valueA == null) {
      diff.mouse.set(mouseKey, valueB);
    } else if (valueA !== valueB) {
      diff.mouse.set(mouseKey, valueB);
    }
  }

  return diff;
}

const coalesceCommand = (state: CompositeKeyStateMap, command: Command): CompositeKeyStateMap => {
  const stateClone = cloneState(state);
  if (command.targetDevice === 'MOUSE') {
    stateClone.mouse.set(command.key, command.targetKeyState);
  } else if (command.targetDevice === 'KEYBOARD') {
    stateClone.keyboard.set(command.key, command.targetKeyState);
  }
  return stateClone;
};

const generateKeyboardCommand = (key: KeyboardKeys, targetKeyState: KeyboardKeyStates) => {
  const command: Command = {key, targetKeyState, targetDevice: 'KEYBOARD'};
  return (state: CompositeKeyStateMap): CompositeKeyStateMap => {
    return coalesceCommand(state, command);
  };
}

const generateMouseCommand = (key: MouseKeys, targetKeyState: MouseKeyStates) => {
  const command: Command = {key, targetKeyState, targetDevice: 'MOUSE'};
  return (state: CompositeKeyStateMap): CompositeKeyStateMap => {
    return coalesceCommand(state, command);
  };
}


const transformStateIntoArguements = (state: CompositeKeyStateMap): Array<string> => {
  const commandSegments: Array<string> = [];
  for (const [key, targetKeyState] of state.keyboard.entries()) {
    commandSegments.push(targetKeyState, '--delay', '0', key);
  }
  for (const [key, targetKeyState] of state.mouse.entries()) {
    commandSegments.push(targetKeyState, key);
  }
  return commandSegments;
}

export const executeState = async (state: CompositeKeyStateMap) => {
  console.trace();
  const args = transformStateIntoArguements(state);
  console.log({args});
  if (args.length === 0) {
    return;
  }
  try {
    const {stdout, stderr} = await execFileP('xdotool', args, {env: {'DISPLAY': ':0'}});
    if (stdout.length !== 0 || stderr.length !== 0) {
      console.log('stdout:', stdout);
      console.log('stderr:', stderr);
    }
  } catch (err) {
    console.error(err);
  };
}

const generateCommand = (args: Array<string>) => {
  return async function () {
    console.log(args);
    try {
      const {stdout, stderr} = await execFileP('xdotool', args, {env: {'DISPLAY': ':0'}});
      if (stdout.length !== 0 || stderr.length !== 0) {
        console.log('stdout:', stdout);
        console.log('stderr:', stderr);
      }
    } catch (err) {
      console.error(err);
    };
  }
};

const moveMouseRelative = async (x: number, y: number) => {
  try {
    // -- allows for negative numbers
    console.log({moveMouseRelative: {x, y}});
    const {stdout, stderr} = await execFileP('xdotool', ['mousemove_relative', '--', x.toString(), y.toString()], {env: {'DISPLAY': ':0'}});
    console.log('mousemove_relative done');
    if (stdout.length !== 0 || stderr.length !== 0) {
      console.log('stdout:', stdout);
      console.log('stderr:', stderr);
    }
  } catch (err) {
    console.error(err);
  };
};
// TODO: find out why we need to move a small ammount first.
const jiggleMouseHackPleaseFix = async () => {
  await moveMouseRelative(10, 0);
}

const moveMouse = async (x: number, y: number) => {
  try {
    // -- allows for negative numbers
    console.log({moveMouse: {x, y}});
    const {stdout, stderr} = await execFileP('xdotool', ['mousemove', '--', x.toString(), y.toString()], {env: {'DISPLAY': ':0'}});
    if (stdout.length !== 0 || stderr.length !== 0) {
      console.log('stdout:', stdout);
      console.log('stderr:', stderr);
    }
  } catch (err) {
    console.error(err);
  };
};

export const queryMousePosition = async (): Promise<{x: number, y: number}> => {
  try {
    const {stdout, stderr} = await execFileP('xdotool', ['getmouselocation'], {env: {'DISPLAY': ':0'}});
    if (stderr.length !== 0) {
      console.log('stderr:', stderr);
    }
    // Example response 'x:1105 y:442 screen:0 window:67108871'
    const [x, y] = stdout.split(' ', 2).map(s => parseInt(s.slice(2)));
    return {x, y};
  } catch (err) {
    console.error(err);
  };
};

// const openInventory = generateCommand(['key', 'e']);
// const closeInventory = generateCommand(['key', 'Escape']);

const moveForwardStart = generateKeyboardCommand('w', 'keydown');
const moveForwardStop = generateKeyboardCommand('w', 'keyup');
const moveBackStart = generateKeyboardCommand('s', 'keydown');
const moveBackStop = generateKeyboardCommand('s', 'keyup');
const moveLeftStart = generateKeyboardCommand('a', 'keydown');
const moveLeftStop = generateKeyboardCommand('a', 'keyup');
const moveRightStart = generateKeyboardCommand('d', 'keydown');
const moveRightStop = generateKeyboardCommand('d', 'keyup');

const openInventoryDown = generateKeyboardCommand('e', 'keydown');
const openInventoryUp = generateKeyboardCommand('e', 'keyup');
const closeWindowDown = generateKeyboardCommand('e', 'keydown');
const closeWindowUp = generateKeyboardCommand('e', 'keyup');

const jumpStart = generateKeyboardCommand('space', 'keydown');
const jumpStop = generateKeyboardCommand('space', 'keyup');
const sprintStart = generateKeyboardCommand('ctrl', 'keydown');
const sprintStop = generateKeyboardCommand('ctrl', 'keyup');
const sneakStart = generateKeyboardCommand('shift', 'keydown');
const sneakStop = generateKeyboardCommand('shift', 'keyup');

// TODO: consider adding 'key' as a state.
// These keys really only need a single press. 
const oneDown = generateKeyboardCommand('1', 'keydown');
const oneUp = generateKeyboardCommand('1', 'keyup');
const twoDown = generateKeyboardCommand('2', 'keydown');
const twoUp = generateKeyboardCommand('2', 'keyup');
const threeDown = generateKeyboardCommand('3', 'keydown');
const threeUp = generateKeyboardCommand('3', 'keyup');
const fourDown = generateKeyboardCommand('4', 'keydown');
const fourUp = generateKeyboardCommand('4', 'keyup');
const fiveDown = generateKeyboardCommand('5', 'keydown');
const fiveUp = generateKeyboardCommand('5', 'keyup');
const sixDown = generateKeyboardCommand('6', 'keydown');
const sixUp = generateKeyboardCommand('6', 'keyup');
const sevenDown = generateKeyboardCommand('7', 'keydown');
const sevenUp = generateKeyboardCommand('7', 'keyup');
const eightDown = generateKeyboardCommand('8', 'keydown');
const eightUp = generateKeyboardCommand('8', 'keyup');
const nineDown = generateKeyboardCommand('9', 'keydown');
const nineUp = generateKeyboardCommand('9', 'keyup');
const zeroDown = generateKeyboardCommand('0', 'keydown');
const zeroUp = generateKeyboardCommand('0', 'keyup');

const leftClickDown = generateMouseCommand('1', 'mousedown');
const leftClickUp = generateMouseCommand('1', 'mouseup');
const rightClickDown = generateMouseCommand('3', 'mousedown');
const rightClickUp = generateMouseCommand('3', 'mouseup');

const wait = async (ms: number) => {
  await new Promise(r => setTimeout(r, ms));
}

export default {
  // openInventory,
  // closeInventory,
  moveForwardStart,
  moveForwardStop,
  moveBackStart,
  moveBackStop,
  moveLeftStart,
  moveLeftStop,
  moveRightStart,
  moveRightStop,
  openInventoryDown,
  openInventoryUp,
  closeWindowDown,
  closeWindowUp,
  jumpStart,
  jumpStop,
  sprintStart,
  sprintStop,
  sneakStart,
  sneakStop,
  moveMouse,
  moveMouseRelative,
  jiggleMouseHackPleaseFix,
  wait,
  oneDown,
  oneUp,
  twoDown,
  twoUp,
  threeDown,
  threeUp,
  fourDown,
  fourUp,
  fiveDown,
  fiveUp,
  sixDown,
  sixUp,
  sevenDown,
  sevenUp,
  eightDown,
  eightUp,
  nineDown,
  nineUp,
  zeroDown,
  zeroUp,
  leftClickDown,
  leftClickUp,
  rightClickDown,
  rightClickUp,
};
