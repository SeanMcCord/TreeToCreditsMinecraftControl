import {transformYawToMouseSpace, transformPitchToMouseSpace, mouseMoveWithinNoActionRegion} from '../gui_interactions/gui_mouse_transforms.js';
import control, {clearedState, cloneState, stateDiff, executeState, CompositeKeyStateMap, queryMousePosition} from '../gui_interactions/gui_direct_control.js';
import {getFacingToBlock, getFacingToNeighborBlock} from '../facing.js';
import {performance} from 'perf_hooks';
import vec3 from 'vec3';
import {HighLevelControl} from '../gui_interactions/high_level_control.js';
import {VelocityEstimator} from '../velocity_estimator.js';

// TODO: there should be a way to update the directly set values when mineflayer updates.
// TODO: handle respawn. set values are not correct

export class MoveExecutor {
  private mineflayerBot;
  private velocityEstimator: VelocityEstimator;
  private highLevelControl: HighLevelControl;
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
  async shortMoveXZ(x: number, z: number, jumpUp = false, allowableOffet = 0.2, maxVelocity = 0.3, timeout = 500) {
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
      await this.lookAtPosition(x, undefined, z, this.mineflayerBot.entity.height);
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

  async lookInDirection(targetYaw: number, targetPitch: number) {
    const deltaYaw = transformYawToMouseSpace(this.directlySetYaw, targetYaw)
    const deltaPitch = transformPitchToMouseSpace(this.directlySetPitch, targetPitch);
    if (mouseMoveWithinNoActionRegion(deltaYaw, deltaPitch)) {
      return;
    }
    console.log({deltaYaw, deltaPitch});
    console.log(await queryMousePosition());
    await control.moveMouseRelative(deltaYaw, deltaPitch);
    console.log(await queryMousePosition());
    this.directlySetYaw = targetYaw;
    this.directlySetPitch = targetPitch;
  }

  // target values may be floats
  async lookAtPosition(targetX: number, targetY: number, targetZ: number, height: number) {
    const deltaX = targetX - this.mineflayerBot.entity.position.x;
    const deltaY = targetY == null ? 0 : targetY - (this.mineflayerBot.entity.position.y + height);
    const deltaZ = targetZ - this.mineflayerBot.entity.position.z;
    console.log({action: 'look_at_pos', deltaX, deltaY, deltaZ});
    let targetYaw = Math.atan(deltaX / deltaZ);
    // Don't change the yaw if both are 0
    if (isNaN(targetYaw)) {
      targetYaw = this.directlySetYaw;
    }

    let distance = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaZ, 2));
    let targetPitch = Math.atan(deltaY / distance);
    if (deltaZ >= 0) {
      targetYaw -= Math.PI;
    }
    await this.lookInDirection(targetYaw, targetPitch);
  }

  async lookAtBlockSurface(targetX: number, targetY: number, targetZ: number): Promise<boolean> {
    const block = this.mineflayerBot.blockAt(vec3([targetX, targetY, targetZ]), false);
    const positions = getFacingToBlock(this.mineflayerBot, block);
    const pos = positions.sort((a, b) => a.distance - b.distance)?.[0]?.targetPos;
    // TODO: inform caller that block was not reachable
    if (pos == null) return false;
    // TODO: handle sneak
    await this.lookAtPosition(pos.x, pos.y, pos.z, this.mineflayerBot.entity.height);
    return true;
  }

  // Looks at block and breaks it if visible from current position.
  // target values must be integers
  async breakBlock(targetX: number, targetY: number, targetZ: number) {
    const block = this.mineflayerBot.blockAt(vec3([targetX, targetY, targetZ]), false);
    const positions = getFacingToBlock(this.mineflayerBot, block);
    const pos = positions.sort((a, b) => a.distance - b.distance)?.[0]?.targetPos;
    // TODO: inform caller that block was not reachable
    if (pos == null) return;
    await this.lookAtPosition(pos.x, pos.y, pos.z, this.mineflayerBot.entity.height);
    const state = control.leftClickDown(clearedState());
    await executeState(state);

    await control.wait(this.mineflayerBot.digTime(block));
    // TODO: handle failure modes.
    // TODO: handle block updates
    await executeState(clearedState());
  }

  // Looks at block neighbor and places it if face is visible from current position.
  // target values must be integers
  async placeBlock(targetX: number, targetY: number, targetZ: number): Promise<boolean> {
    const targetBlock = this.mineflayerBot.blockAt(vec3([targetX, targetY, targetZ]), false);
    const sneak = true;
    // TODO: extract out the height constants. In game we drop by 3/8 of a block when sneaking. This was done by testing in game.
    const height = sneak ? this.mineflayerBot.entity.height - (3 / 8) : this.mineflayerBot.entity.height;
    const facings = getFacingToNeighborBlock(this.mineflayerBot.world, this.mineflayerBot.entity.position, height, targetBlock);
    console.log({facings});
    const closestFacing = facings.sort((a, b) => a.distance - b.distance)?.[0];
    if (closestFacing == null) return false;
    console.log({closestFacing});

    const closestBlock = closestFacing.block;
    const facingVector = targetBlock.position.clone().minus(closestBlock.position);
    console.log({targetPosition: targetBlock.position, facingVector});
    await this.highLevelControl.exlusiveGUI(new Set(['movement']), async (currentScope, currentState, executeGlobalState) => {
      const sneakState = control.sneakStart(clearedState());
      await executeGlobalState(sneakState);

      await this.lookAtPosition(closestFacing.targetPos.x, closestFacing.targetPos.y, closestFacing.targetPos.z, height);

      // TODO: handle neightbor blocks with right click actions. i.e. chests, furnaces
      // HACK: Just assume all blocks require sneak because there isn't data on interactable blocks in mcdata
      // console.log('sneak start');
    });
    // TODO: This is dangerous to execute becuase we release the lock on the GUI to allow the placeBlock
    // command to aquire the lock via the block_place packet in gui_interactions/packet_to_gui
    // The risk is that between the above lock release and the placeBlock call bellow another interaction changes
    // the world state. Swapping to reenterent locks may be a solution to this.
    // ################################
    await this.mineflayerBot.placeBlock(closestBlock, facingVector);
    // ################################

    // Ensure our sneak is cleared.
    await this.highLevelControl.exlusiveGUI(new Set(['movement']), async (currentScope, currentState, executeGlobalState) => {
      await executeGlobalState(clearedState());
    });
    console.log('block placed');
    return true;
  }
}
