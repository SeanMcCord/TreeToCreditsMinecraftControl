import {rrtStar, rrtStarExtend, goalReached, cloneGraph, deserializeGraph, serializeGraph, linksBackToRootNode} from './rrt_star.js';
import {createWorldCollides, createWorldPathCollides} from './world_obstacle_check.js';
import {Physics, PlayerState} from 'prismarine-physics';
import minecraftData from 'minecraft-data';
import {CompositeControl, ControlState, randomValidCompositeControl} from './sample_control.js';
import control, {clearedState, cloneState, stateDiff, executeState, CompositeKeyStateMap} from './gui_interactions/gui_direct_control.js';
import {transformYawToMouseSpace, transformPitchToMouseSpace, mouseMoveWithinNoActionRegion} from './gui_interactions/gui_mouse_transforms.js';
import {respawn} from './gui_interactions/gui_respawn.js';
import {performance} from 'perf_hooks';
import {testPath} from './trailblazer/high_level_planner.js';
import {mineflayer as mineflayerViewer} from 'prismarine-viewer';
import {pathViewer, posViewer} from './trailblazer/path_viewer.js';
import pathfinderLib from 'mineflayer-pathfinder';
const {goals, pathfinder, Movements} = pathfinderLib;
import {TreeNode} from './trailblazer/monte_carlo_tree_search.js';
import {MoveExecutor} from './trail_follower/move_executor.js';
import {VelocityEstimator} from './velocity_estimator.js';
import {PacketToGUI} from './gui_interactions/packet_to_gui.js';
import vec3 from 'vec3';
import {HighLevelControl} from './gui_interactions/high_level_control.js';

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
  // TODO: remove directlySetYaw
  private directlySetYaw = 0;
  private moveExecutor;
  private velocityEstimator;
  private globalControlState: CompositeKeyStateMap;
  private highLevelControl;
  constructor(mineflayerBot, highLevelControl: HighLevelControl, config: AgentConfig) {
    this.mineflayerBot = mineflayerBot;
    this.mineflayerBot.loadPlugin(pathfinder);
    // Only use the data we get from the proxy to move the bot
    this.mineflayerBot.physicsEnabled = false;
    this.globalControlState = clearedState();
    this.velocityEstimator = new VelocityEstimator();
    // TODO: handle yaw updates from the control system and the proxy.
    this.highLevelControl = highLevelControl;
    this.mineflayerBot.once('spawn', async () => {
      this.directlySetYaw = this.mineflayerBot.entity.yaw;
      this.moveExecutor = new MoveExecutor(this.mineflayerBot, this.velocityEstimator, highLevelControl);
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
    this.mineflayerBot.on('move', (position) => {
      this.velocityEstimator.addPosition(position)
    });
  }

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
    movement.liquidCost = 2;
    movement.allowParkour = false;

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

  async encloseSelf() {
    const center = this.mineflayerBot.entity.position.clone().floored();
    const fillPositions = [
      center.offset(1, 0, 0),
      center.offset(0, 0, 1),
      center.offset(-1, 0, 0),
      center.offset(0, 0, -1),
      center.offset(1, 1, 0),
      center.offset(0, 1, 1),
      center.offset(-1, 1, 0),
      center.offset(0, 1, -1),
    ];
    for (const pos of fillPositions) {
      console.log(pos);
      await this.moveExecutor.placeBlock(pos.x, pos.y, pos.z);
    }
  }

  async makeAndPlaceCraftingTable() {
    const startTime = performance.now();
    const oakPlankRecipes = this.mineflayerBot.recipesFor(this.mcData.itemsByName.oak_planks.id)
    await this.mineflayerBot.craft(oakPlankRecipes[0]);
    const craftingTableRecipes = this.mineflayerBot.recipesFor(this.mcData.itemsByName.crafting_table.id)
    await this.mineflayerBot.craft(craftingTableRecipes[0]);
    console.log({deltaT: performance.now() - startTime});
  }
}

export default Agent;
