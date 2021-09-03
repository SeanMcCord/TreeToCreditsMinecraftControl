// This magic value came from the number of mouse units to move on my computer.
// TODO: allow this value to be set by other means.
const MOUSE = 1200 / Math.PI;
// This is an arbitrary small number to prevent sending moves when the difference is small.
const MIN_MOUSE_MOVE = 2;

export const transformYawToMouseSpace = (currentYaw: number, targetYaw: number): number => {
  const deltaYawInt = (targetYaw - currentYaw) % (2 * Math.PI);
  // Invert the yaw direction as it is backward between the mineflayer yaw and the mouse.
  const deltaYaw = Math.round(-1 * deltaYawInt * MOUSE);
  return deltaYaw;
}

export const transformPitchToMouseSpace = (currentPitch: number, targetPitch: number): number => {
  return Math.round(-1 * (targetPitch - currentPitch) * MOUSE);
}

export const mouseMoveWithinNoActionRegion = (deltaYaw: number, deltaPitch: number): boolean => {
  return (Math.abs(deltaYaw) < MIN_MOUSE_MOVE || Math.abs(deltaYaw) > (2 * Math.PI * MOUSE) - MIN_MOUSE_MOVE) &&
    Math.abs(deltaPitch) < MIN_MOUSE_MOVE;
}
