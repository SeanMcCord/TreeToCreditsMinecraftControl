import {rrtStar, rrtStarExtend, goalReached, cloneGraph, deserializeGraph, serializeGraph, linksBackToRootNode} from './rrt_star.js';
import {createWorldCollides, createWorldPathCollides} from './world_obstacle_check.js';
import {Physics, PlayerState} from 'prismarine-physics';
import minecraftData from 'minecraft-data';
import vec3 from 'vec3';
import {CompositeControl, ControlState, randomValidCompositeControl} from './sample_control.js';
import control, {clearedState, cloneState, stateDiff, executeState, CompositeKeyStateMap} from './gui_direct_control.js';
import {transformYawToMouseSpace, transformPitchToMouseSpace, mouseMoveWithinNoActionRegion} from './gui_mouse_transforms.js';
import {respawn} from './gui_respawn.js';
import {performance} from 'perf_hooks';
import {testPath} from './trailblazer/high_level_planner.js';
import {mineflayer as mineflayerViewer} from 'prismarine-viewer';
import {pathViewer, posViewer} from './trailblazer/path_viewer.js';
import pathfinderLib from 'mineflayer-pathfinder';
const {goals, pathfinder, Movements} = pathfinderLib;
import {TreeNode} from './trailblazer/monte_carlo_tree_search.js';

// TODO: ensure only inventory operations do not occur while moving via key commands

// TODO: figure out type of position
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61f2fbe571f0968b8efbb36317e83d746b6d8b0b/types/three/src/math/Vector3.d.ts
const configurationToThreeVector = (config) => {
  return [config[0], config[1], config[2]];
}

export type AgentConfig = {
  mineflayerViewerPort: number;
}

class Agent {
  private mineflayerBot;
  private mcData;
  private directlySetYaw = 0;
  private globalControlState: CompositeKeyStateMap;
  constructor(mineflayerBot, config: AgentConfig) {
    this.mineflayerBot = mineflayerBot;
    this.mineflayerBot.loadPlugin(pathfinder);
    // Only use the data we get from the proxy to move the bot
    this.mineflayerBot.physicsEnabled = false;
    this.globalControlState = clearedState();
    // TODO: handle yaw updates from the control system and the proxy.
    this.mineflayerBot.once('spawn', async () => {
      this.directlySetYaw = this.mineflayerBot.entity.yaw;
      // TODO: find out why we need to move a small ammount first.
      control.moveMouseRelative(10, 0);
      mineflayerViewer(this.mineflayerBot, {port: config.mineflayerViewerPort});
      // await this.mineflayerBot.waitForChunksToLoad();
      // await new Promise(resolve => setTimeout(resolve, 2000));
      // this.testPath(40, 0.0, 0.0000000000000000000001, 0.0, 400, 0.0, 0.0, 0.0, 0.8, {x: 100, y: 10, z: 40}).then((r) => {
      // this.getPath({x: 100, y: 10, z: -40}, 10000).then((r) => {
      //   mineflayerBot.quit();
      //   process.exit();
      // });
    });
    this.mineflayerBot.on('death', respawn);
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
    await control.moveMouseRelative(deltaYaw, deltaPitch);
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

  goodValueTestPath() {
    // TODO: wrap up these config values to make this more clear.
    this.testPath(40, 1.0, 0.00000000001, 0.0, 200, 0.0, 0.0, 0.0, 0.3, {x: 100, y: 10, z: 40});
  }

  testPath(timeBudgetMilis: number = 200, mixmaxFactor: number = 0.125, explorationFactor: number = 1 / Math.sqrt(2), percentBetterNode: number = 0.20, iterations: number = 20, efficiencyWeight: number = 0.3, distanceWeight: number = 1.0, biasWeight: number = 0.3, goalBias: number = 0.2, goalPos = {x: 20, y: 64, z: 20}): Promise<any> {
    const renderRootNode = (node: TreeNode) => {
      pathViewer(this.mineflayerBot.viewer, node);
    }
    const renderPosArray = (positions: Array<any>, label: string, color: any) => {
      posViewer(this.mineflayerBot.viewer, positions, label, color);
    }
    // const renderRootNode = null;
    const result = testPath(this.mineflayerBot, this.mcData, timeBudgetMilis, mixmaxFactor, explorationFactor, percentBetterNode, iterations, efficiencyWeight, distanceWeight, biasWeight, goalBias, goalPos, renderRootNode, renderPosArray);
    // result.then((r) => {
    //   for (const pathSegment of r.bestPath) {
    //     console.dir(pathSegment, {depth: null})
    //   }
    // });
    return result;
  }

  getPath(goalPos = {x: 20, y: 64, z: 20}, timeout: number = 200): Promise<any> {
    const goal = new goals.GoalBlock(goalPos.x, goalPos.y, goalPos.z);
    const movement = new Movements(this.mineflayerBot, this.mcData);

    const result = this.mineflayerBot.pathfinder.getPathTo(movement, goal, timeout);

    const renderPosArray = (positions: Array<any>, label: string, color: any) => {
      posViewer(this.mineflayerBot.viewer, positions, label, color);
    }
    const finalResult = new Promise<any>((resolve, reject) => {
      const getNext = (depth: number, result) => {
        if (depth % 20 == 0) {
          console.log({depth, result});
          console.log({blockCount: movement.testBlockCount, uniquePositions: movement.testBlockMap.size, cacheSize: movement.testBlockCache.size, hits: movement.testCacheHits});
          renderPosArray(result.path, 'moves', 0xff0aff);
          const openSetPositions = [];
          for (const pos of result.context.openNodeMap.values()) {
            openSetPositions.push(pos.data);
          }
          renderPosArray(openSetPositions, 'openSet', 0xff0a00);
        }
        if (result.status === 'timeout' || result.status === 'success') {
          resolve(result);
          return;
        }
        const nextResult = result.context.compute();
        setImmediate(() => getNext(depth + 1, nextResult));
      }
      getNext(0, result);
    });
    return finalResult;
  }
}

export default Agent;
