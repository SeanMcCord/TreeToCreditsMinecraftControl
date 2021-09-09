import {transformYawToMouseSpace, transformPitchToMouseSpace, mouseMoveWithinNoActionRegion} from '../gui_interactions/gui_mouse_transforms.js';
import control, {clearedState, cloneState, stateDiff, executeState, CompositeKeyStateMap} from '../gui_interactions/gui_direct_control.js';
import {getFacingToBlock, getFacingToNeighborBlock} from '../facing.js';
import {performance} from 'perf_hooks';
import vec3 from 'vec3';
import {HighLevelControl} from '../gui_interactions/high_level_control.js';

// TODO: there should be a way to update the directly set values when mineflayer updates.
// TODO: handle respawn. set values are not correct

export class MoveExecutor {
  private mineflayerBot;
  private velocityEstimator;
  private highLevelControl;
  private directlySetYaw = 0
  private directlySetPitch = 0;
  constructor(bot, velocityEstimator, highLevelControl: HighLevelControl) {
    this.mineflayerBot = bot;
    this.velocityEstimator = velocityEstimator;
    this.highLevelControl = highLevelControl;
    this.directlySetYaw = bot.entity.yaw;
    this.directlySetPitch = bot.entity.pitch;
  }

  // TODO: handle parkour. Right now gaps are not handled well.
  // Moves the bot small distances.
  // TODO: the majority of the work.
  // allowableOffet: distance in XZ plane needed before stopping. Must be positive
  // timeout: number of milliseconds to attempt movement before stopping. Throws Error
  async shortMoveXZ(x, z, jumpUp = false, allowableOffet = 0.2, maxVelocity = 0.3, timeout = 500) {
    const distance = () => Math.sqrt(Math.pow(this.mineflayerBot.entity.position.x - x, 2) + Math.pow(this.mineflayerBot.entity.position.z - z, 2));
    const startTime = performance.now();
    for (; ;) {
      if (performance.now() - startTime > timeout) {
        await executeState(clearedState());
        throw new Error('centerXZ took too long');
      }
      const currentDistance = distance();
      const velocity = this.velocityEstimator.getVelocity();
      const currentVelocity = Math.sqrt(Math.pow(velocity.z, 2) + Math.pow(velocity.x, 2));
      console.log({currentVelocity, currentDistance});
      if (currentDistance <= allowableOffet && currentVelocity <= maxVelocity) {
        await executeState(clearedState());
        return;
      }
      await this.lookAtPosition(x, undefined, z);
      let state = control.moveForwardStart(clearedState());
      if (jumpUp && currentDistance > 0.4) {
        state = control.jumpStart(state);
      } else if (currentDistance < 0.4) {
        // TODO: this will alow prevent us from dropping down a block. This may cause issues at the cost of better positioning.
        state = control.sneakStart(state);
      }
      await executeState(state);
      await control.wait(50);
    }
  }

  async lookInDirection(targetYaw, targetPitch) {
    const deltaYaw = transformYawToMouseSpace(this.directlySetYaw, targetYaw)
    const deltaPitch = transformPitchToMouseSpace(this.directlySetPitch, targetPitch);
    if (mouseMoveWithinNoActionRegion(deltaYaw, deltaPitch)) {
      return;
    }
    // console.log({deltaYaw, deltaPitch});
    await control.moveMouseRelative(deltaYaw, deltaPitch);
    this.directlySetYaw = targetYaw;
    this.directlySetPitch = targetPitch;
  }

  // target values may be floats
  async lookAtPosition(targetX, targetY, targetZ) {
    const deltaX = targetX - this.mineflayerBot.entity.position.x;
    // TODO: How should this handle the height of the bot? How about when swimming or in a boat?
    const height = this.mineflayerBot.entity.height;
    const deltaY = targetY == null ? 0 : targetY - (this.mineflayerBot.entity.position.y + height);
    const deltaZ = targetZ - this.mineflayerBot.entity.position.z;
    console.log({action: 'look_at_pos', deltaX, deltaY, deltaZ});
    let targetYaw = Math.atan(deltaX / deltaZ);

    let distance = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaZ, 2));
    let targetPitch = Math.atan(deltaY / distance);
    if (deltaZ >= 0) {
      targetYaw -= Math.PI;
    }
    await this.lookInDirection(targetYaw, targetPitch);
  }

  // Looks at block and breaks it if visible from current position.
  // target values must be integers
  async breakBlock(targetX, targetY, targetZ) {
    const block = this.mineflayerBot.blockAt(vec3(targetX, targetY, targetZ), false);
    const positions = getFacingToBlock(this.mineflayerBot, block);
    const pos = positions.sort((a, b) => a.distance - b.distance)?.[0]?.targetPos;
    // TODO: inform caller that block was not reachable
    if (pos == null) return;
    await this.lookAtPosition(pos.x, pos.y, pos.z);
    const state = control.leftClickDown(clearedState());
    await executeState(state);

    await control.wait(this.mineflayerBot.digTime(block));
    // TODO: handle failure modes.
    // TODO: handle block updates
    await executeState(clearedState());
  }

  // Looks at block neighbor and places it if face is visible from current position.
  // target values must be integers
  async placeBlock(targetX, targetY, targetZ) {
    const block = this.mineflayerBot.blockAt(vec3(targetX, targetY, targetZ), false);
    const positions = getFacingToNeighborBlock(this.mineflayerBot, block);
    const pos = positions.sort((a, b) => a.distance - b.distance)?.[0]?.targetPos;
    // TODO: inform caller that block was not reachable
    if (pos == null) return;
    console.dir(positions, {depth: null});
    await this.lookAtPosition(pos.x, pos.y, pos.z);
    // TODO: handle neightbor blocks with right click actions. i.e. chests, furnaces
    const state = control.rightClickDown(clearedState());
    await executeState(state);

    // TODO: handle failure modes.
    // TODO: handle block updates
    await executeState(clearedState());
  }
}
