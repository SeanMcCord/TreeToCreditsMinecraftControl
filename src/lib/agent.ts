import {rrtStar, rrtStarExtend, goalReached, cloneGraph, deserializeGraph, serializeGraph, linksBackToRootNode} from './rrt_star.js';
import {createWorldCollides, createWorldPathCollides} from './world_obstacle_check.js';
import {Physics, PlayerState} from 'prismarine-physics';
import minecraftData from 'minecraft-data';
import vec3 from 'vec3';
import {CompositeControl, ControlState, randomValidCompositeControl} from './sample_control.js';
import control, {clearedState, cloneState, stateDiff, executeState, CompositeKeyStateMap} from './gui_direct_control.js';
import {transformYawToMouseSpace, transformPitchToMouseSpace, mouseMoveWithinNoActionRegion} from './gui_mouse_transforms.js';
import {performance} from 'perf_hooks';
import {testPath} from './trailblazer/high_level_planner.js';

// TODO: ensure only inventory operations do not occur while moving via key commands

// TODO: figure out type of position
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61f2fbe571f0968b8efbb36317e83d746b6d8b0b/types/three/src/math/Vector3.d.ts
const configurationToThreeVector = (config) => {
  return [config[0], config[1], config[2]];
}

class Agent {
  private mineflayerBot;
  private mcData;
  private directlySetYaw = 0;
  private globalControlState: CompositeKeyStateMap;
  constructor(mineflayerBot) {
    this.mineflayerBot = mineflayerBot;
    // Only use the data we get from the proxy to move the bot
    this.mineflayerBot.physicsEnabled = false;
    this.globalControlState = clearedState();
    // TODO: handle yaw updates from the control system and the proxy.
    this.mineflayerBot.on('spawn', () => {
      this.directlySetYaw = this.mineflayerBot.entity.yaw;
      // TODO: find out why we need to move a small ammount first.
      control.moveMouse(10, 0);
    });
    this.mcData = minecraftData(mineflayerBot.version);
    // Use the moves to set the velocity
    this.mineflayerBot.on('move', (data) => {
      // console.log({data});
    });
  }

  async lookInDirection(targetYaw, targetPitch) {
    const deltaYaw = transformYawToMouseSpace(this.directlySetYaw, targetYaw)
    const deltaPitch = transformPitchToMouseSpace(this.mineflayerBot.entity.pitch, targetPitch);
    if (mouseMoveWithinNoActionRegion(deltaYaw, deltaPitch)) {
      return;
    }
    console.log({deltaYaw, deltaPitch});
    await control.moveMouse(deltaYaw, deltaPitch);
    this.directlySetYaw = targetYaw;
  }

  async lookAtPosition(targetX, targetY, targetZ) {
    let targetPitch = this.mineflayerBot.entity.pitch;
    const deltaX = targetX - this.mineflayerBot.entity.position.x;
    const deltaY = targetY == null ? 0 : targetY - this.mineflayerBot.entity.position.y;
    const deltaZ = targetZ - this.mineflayerBot.entity.position.z;
    console.log({deltaX, deltaY, deltaZ});
    let targetYaw = Math.atan(deltaX / deltaZ);
    // TODO: handle pitch calculation.
    if (deltaZ > 0) {
      targetYaw -= Math.PI;
    }
    await this.lookInDirection(targetYaw, targetPitch);
  }

  async executeControl(controlState: CompositeControl, durationMillisecond: number) {
    let start = performance.now();
    await this.lookInDirection(controlState.yaw, this.mineflayerBot.entity.pitch);
    console.log({time: performance.now() - start, event: 'look'});

    // TODO: come up with a way to merge the key commands.
    const toExecute: Array<Function> = [];
    toExecute.push(controlState.state.forward ? control.moveForwardStart : control.moveForwardStop);
    toExecute.push(controlState.state.back ? control.moveBackStart : control.moveBackStop);
    toExecute.push(controlState.state.left ? control.moveLeftStart : control.moveLeftStop);
    toExecute.push(controlState.state.right ? control.moveRightStart : control.moveRightStop);
    toExecute.push(controlState.state.jump ? control.jumpStart : control.jumpStop);
    toExecute.push(controlState.state.sprint ? control.sprintStart : control.sprintStop);
    toExecute.push(controlState.state.sneak ? control.sneakStart : control.sneakStop);

    start = performance.now();
    let stateTarget = clearedState();
    for (const command of toExecute) {
      stateTarget = command(stateTarget);
    }
    console.log({stateTarget});
    const diff = stateDiff(this.globalControlState, stateTarget);
    console.log({diff});
    await executeState(diff);
    this.globalControlState = stateTarget;
    console.log({time: performance.now() - start, event: 'execute commands'});
  }

  async executeStop() {
    const stopInPlace = {
      state: {
        forward: false,
        back: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        sneak: false,
      },
      yaw: this.directlySetYaw,
    }
    await this.executeControl(stopInPlace, 0)
  }

  async executeControlSequence(controlStates: Array<CompositeControl>, durationMillisecond: number) {
    for (const controlState of controlStates) {
      const start = performance.now();
      await this.executeControl(controlState, durationMillisecond);

      const waitStart = performance.now();
      await control.wait(durationMillisecond);
      console.log({time: performance.now() - waitStart, durationMillisecond, event: 'wait'});

      console.log({
        time: performance.now() - start,
        durationMillisecond,
        controlState,
        position: this.mineflayerBot.entity.position,
      });
    }
  }

  // // TODO: add timeout
  // // TODO: detect if the agent is stuck or significanlty off track.
  // // simple move on flat ground
  // async moveToPosition(targetX, targetZ, radius, autoStop = true) {
  //   let forwardPressed = false;
  //   for (; ;) {
  //     const deltaX = targetX - this.mineflayerBot.entity.position.x;
  //     const deltaZ = targetZ - this.mineflayerBot.entity.position.z;
  //     const distanceSquared = Math.pow(deltaX, 2) + Math.pow(deltaZ, 2)
  //     const goalRadiusSquared = Math.pow(radius, 2);
  //     console.log({distanceSquared, goalRadiusSquared, velocity: this.mineflayerBot.entity.velocity});
  //     if (distanceSquared < goalRadiusSquared) {
  //       if (autoStop) {
  //         console.log('stop');
  //         await control.moveForwardStop();
  //       }
  //       return true;
  //     }
  //     await this.lookAtPosition(targetX, undefined, targetZ);
  //     if (!forwardPressed) {
  //       await control.moveForwardStart();
  //       forwardPressed = true;
  //     }
  //     await control.wait(100);
  //   }
  // }

  async findPathToPosition(targetX, targetZ, radius, vertexCount) {
    const initialConfig = [this.mineflayerBot.entity.position.x, 0, this.mineflayerBot.entity.position.z];
    const goalConfig = [targetX, 0, targetZ];
    const worldCollides = createWorldCollides(this.mineflayerBot.world);
    const worldPathCollides = createWorldPathCollides(this.mineflayerBot.world, worldCollides);
    const incDistance = 0.25;
    const graph = rrtStar(initialConfig, goalConfig, worldCollides, worldPathCollides, vertexCount, incDistance);


    let minCostPath = 100000;
    let minCostPathLinks = new Set();
    graph.forEachNode((node) => {
      const config = configurationToThreeVector(node.data.config);
      if (goalReached(config, goalConfig, radius) && node.data.cost < minCostPath) {
        minCostPath = node.data.cost;
        minCostPathLinks = linksBackToRootNode(graph, String(node.id));
      };
    });
    console.log({minCostPath, minCostPathLinks});
    return [graph, minCostPathLinks];
  }

  // // TODO: would be nice if there was a robust way to encapsulate the idea of chaining a set of moves.
  // // Right now it ends up stopping when each goal is reached. This slows down the bot.
  // async traversePath(graph, pathLinks) {
  //   let currentNode = graph.getNode('initial_config');
  //   while (pathLinks.size > 0) {
  //     graph.forEachLinkedNode(
  //       currentNode.id,
  //       (node, link) => {
  //         if (!pathLinks.has(link.id)) {
  //           return;
  //         } else {
  //           pathLinks.delete(link.id);
  //         }
  //         currentNode = node;
  //         console.log({node, config: node.data.config});
  //       },
  //       true // enumerate only outbound links
  //     );
  //     const vector = configurationToThreeVector(currentNode.data.config);
  //     await this.moveToPosition(vector[0], vector[2], 1, false);
  //   };
  //   await control.moveForwardStop();
  // }

  getFakePlayer() {
    // TODO: handle slots
    return {
      version: this.mineflayerBot.version,
      inventory: {
        slots: [],
      },
      entity: {
        effects: {},
        position: this.mineflayerBot.entity.position.clone(),
        velocity: this.mineflayerBot.entity.velocity.clone(),
        onGround: this.mineflayerBot.entity.onGround,
        isInWater: this.mineflayerBot.entity.isInWater,
        isInLava: this.mineflayerBot.entity.isInLava,
        isInWeb: this.mineflayerBot.entity.isInWeb,
        isCollidedHorizontally: this.mineflayerBot.entity.isCollidedHorizontally,
        isCollidedVertically: this.mineflayerBot.entity.isCollidedVertically,
        yaw: this.mineflayerBot.entity.yaw
      },
      jumpTicks: 0,
      jumpQueued: false
    };
  }

  clonePlayer(player) {
    // TODO: handle slots
    return {
      version: player.version,
      inventory: {
        slots: [],
      },
      entity: {
        effects: {},
        position: player.entity.position.clone(),
        velocity: player.entity.velocity.clone(),
        onGround: player.entity.onGround,
        isInWater: player.entity.isInWater,
        isInLava: player.entity.isInLava,
        isInWeb: player.entity.isInWeb,
        isCollidedHorizontally: player.entity.isCollidedHorizontally,
        isCollidedVertically: player.entity.isCollidedVertically,
        yaw: player.entity.yaw
      },
      jumpTicks: player.jumpTicks,
      jumpQueued: player.jumpQueued,
    };
  }

  getFakeWorld() {
    return this.mineflayerBot.world;
  }

  getRandomControl(): CompositeControl {
    const bias = {
      forward: 0.5,
      back: 0.0,
      left: 0.0,
      right: 0.0,
      jump: 0.2,
      sprint: 0.3,
      sneak: 0.0,
    };
    return randomValidCompositeControl(bias);
  }

  simulateInput(controlState: ControlState, ticks: number = 5, inputPlayer, world) {
    const physics = Physics(this.mcData, world);
    let player;
    if (inputPlayer == null) {
      player = this.getFakePlayer();
    } else {
      player = this.clonePlayer(inputPlayer);
    }
    if (world == null) {
      world = this.getFakeWorld();
    }
    const playerState = new PlayerState(player, controlState);

    for (let i = 0; i < ticks; i++) {
      physics.simulatePlayer(playerState, world);
      console.log({i, playerState});
    }
    playerState.apply(player);

    return player;
  }

  simulateRandomWalk(steps: number, ticksPerStep: number = 5) {
    const path: Array<CompositeControl> = [];
    const playerPostSimulation = [];
    let player = this.getFakePlayer();
    let world = this.getFakeWorld();
    for (let i = 0; i < steps; i++) {
      const compositeControl = this.getRandomControl();
      path.push(compositeControl);
      player.entity.yaw = compositeControl.yaw;
      player = this.simulateInput(compositeControl.state, ticksPerStep, player, world);
      playerPostSimulation.push(this.clonePlayer(player));
    }

    return {path, playerPostSimulation};
  }

  async testWalk(steps: number = 10, ticksPerStep: number = 5) {
    const result = this.simulateRandomWalk(steps, ticksPerStep);
    console.log({result, pos: result.playerPostSimulation[0].entity.position});
    console.log({finalPos: result.playerPostSimulation[result.playerPostSimulation.length - 1].entity.position});
    console.log({playerPostSimulation: {...result.playerPostSimulation}});
    await this.executeControlSequence(result.path, 50 * ticksPerStep);
    console.log({
      postExecutionEntity: {
        position: this.mineflayerBot.entity.position,
        velocity: this.mineflayerBot.entity.velocity,
        botYaw: this.mineflayerBot.entity.yaw,
        directYaw: this.directlySetYaw,
      }
    });
    await this.executeStop();
  }

  testPath(timeBudgetMilis: number = 200, explorationFactor: number = 1 / Math.sqrt(2), itterations: number = 20) {
    testPath(this.mineflayerBot, this.mcData, timeBudgetMilis, explorationFactor, itterations);
  }
}

export default Agent;
