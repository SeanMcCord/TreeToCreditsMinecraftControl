export type CompositeControl = {
  state: ControlState;
  yaw: number;
}

export type ControlState = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  sneak: boolean;
}

// number in range from 0 to 1. 1 being 100%
export type ControlStateBias = {
  forward: number;
  back: number;
  left: number;
  right: number;
  jump: number;
  sprint: number;
  sneak: number;
}

export const randomValidCompositeControl = (bias: ControlStateBias): CompositeControl => {
  return {
    state: randomValidControl(bias),
    yaw: Math.random() * 2 * Math.PI
  }
}

const randomValidControl = (bias: ControlStateBias): ControlState => {
  for (; ;) {
    const controls = generateRandomControl(bias);
    if (controlsValid(controls)) {
      return controls;
    }
  }
}

const generateRandomControl = (bias: ControlStateBias): ControlState => {
  return {
    forward: Math.random() < bias.forward,
    back: Math.random() < bias.back,
    left: Math.random() < bias.left,
    right: Math.random() < bias.right,
    jump: Math.random() < bias.jump,
    sprint: Math.random() < bias.sprint,
    sneak: Math.random() < bias.sneak
  };
}

const controlsValid = (controls: ControlState): boolean => {
  if (controls.forward && controls.back) {
    return false;
  }
  if (controls.left && controls.right) {
    return false;
  }
  return true;
}
