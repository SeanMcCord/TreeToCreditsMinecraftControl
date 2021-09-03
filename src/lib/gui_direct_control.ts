import util from 'util';
import {exec} from 'child_process';
const execP = util.promisify(exec);

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


const transformStateIntoArguements = (state: CompositeKeyStateMap): string => {
  const commandSegments: Array<string> = [];
  for (const [key, targetKeyState] of state.keyboard.entries()) {
    commandSegments.push(`${targetKeyState} --delay 0 ${key}`);
  }
  for (const [key, targetKeyState] of state.mouse.entries()) {
    commandSegments.push(`${targetKeyState} ${key}`);
  }
  return commandSegments.join(" ");
}

export const executeState = async (state: CompositeKeyStateMap) => {
  const arguements = transformStateIntoArguements(state);
  console.log({arguements});
  if (arguements.length === 0) {
    return;
  }
  try {
    const {stdout, stderr} = await execP(`DISPLAY=:0 xdotool ${arguements}`);
    if (stdout.length !== 0 || stderr.length !== 0) {
      console.log('stdout:', stdout);
      console.log('stderr:', stderr);
    }
  } catch (err) {
    console.error(err);
  };
}

const generateCommand = (text: string) => {
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

const moveMouseRelative = async (x: number, y: number) => {
  try {
    // -- allows for negative numbers
    console.log({moveMouseRelative: {x, y}});
    const {stdout, stderr} = await execP(`DISPLAY=:0 xdotool mousemove_relative -- ${x} ${y}`);
    if (stdout.length !== 0 || stderr.length !== 0) {
      console.log('stdout:', stdout);
      console.log('stderr:', stderr);
    }
  } catch (err) {
    console.error(err);
  };
};

const moveMouse = async (x: number, y: number) => {
  try {
    // -- allows for negative numbers
    console.log({moveMouse: {x, y}});
    const {stdout, stderr} = await execP(`DISPLAY=:0 xdotool mousemove -- ${x} ${y}`);
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

const moveForwardStart = generateKeyboardCommand('w', 'keydown');
const moveForwardStop = generateKeyboardCommand('w', 'keyup');
const moveBackStart = generateKeyboardCommand('s', 'keydown');
const moveBackStop = generateKeyboardCommand('s', 'keyup');
const moveLeftStart = generateKeyboardCommand('a', 'keydown');
const moveLeftStop = generateKeyboardCommand('a', 'keyup');
const moveRightStart = generateKeyboardCommand('d', 'keydown');
const moveRightStop = generateKeyboardCommand('d', 'keyup');

const jumpStart = generateKeyboardCommand('space', 'keydown');
const jumpStop = generateKeyboardCommand('space', 'keyup');
const sprintStart = generateKeyboardCommand('ctrl', 'keydown');
const sprintStop = generateKeyboardCommand('ctrl', 'keyup');
const sneakStart = generateKeyboardCommand('shift', 'keydown');
const sneakStop = generateKeyboardCommand('shift', 'keyup');

const leftClickDown = generateMouseCommand('1', 'mousedown');
const leftClickUp = generateMouseCommand('1', 'mouseup');

const wait = async (ms: number) => {
  await new Promise(r => setTimeout(r, ms));
}

export default {
  openInventory,
  closeInventory,
  moveForwardStart,
  moveForwardStop,
  moveBackStart,
  moveBackStop,
  moveLeftStart,
  moveLeftStop,
  moveRightStart,
  moveRightStop,
  jumpStart,
  jumpStop,
  sprintStart,
  sprintStop,
  sneakStart,
  sneakStop,
  moveMouse,
  moveMouseRelative,
  wait,
  leftClickDown,
  leftClickUp,
};
