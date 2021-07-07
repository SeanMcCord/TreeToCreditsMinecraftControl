import {rrtStar, rrtStarExtend, goalReached, cloneGraph, deserializeGraph, serializeGraph, linksBackToRootNode} from './rrt_star.js';
import {createWorldCollides, createWorldPathCollides} from './world_obstacle_check.js';
import control from './gui_direct_control.js';
// TODO: extract control details out of this.
const MOUSE = 1200 / Math.PI;
const MIN_MOUSE_MOVE = 2;

// TODO: ensure only inventory operations do not occur while moving via key commands

// TODO: figure out type of position
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61f2fbe571f0968b8efbb36317e83d746b6d8b0b/types/three/src/math/Vector3.d.ts
const configurationToThreeVector = (config) => {
  return [config[0], config[1], config[2]];
}

class Agent {
  private mineflayerBot;
  constructor(mineflayerBot) {
    this.mineflayerBot = mineflayerBot;
    // Only use the data we get from the proxy to move the bot
    this.mineflayerBot.physicsEnabled = false;
    // Use the moves to set the velocity
    this.mineflayerBot.on('move', (data) => {
      // console.log({data});
    });
  }

  async lookInDirection(targetYaw, targetPitch) {
    const deltaYawInt = (targetYaw - this.mineflayerBot.entity.yaw) % (2 * Math.PI);
    // Invert the yaw direction as it is backward between the mineflayer yaw and the mouse.
    const deltaYaw = Math.round(-1 * deltaYawInt * MOUSE);
    const deltaPitch = Math.round(-1 * (targetPitch - this.mineflayerBot.entity.pitch) * MOUSE);
    if ((Math.abs(deltaYaw) < MIN_MOUSE_MOVE || Math.abs(deltaYaw) > (2 * Math.PI * MOUSE) - MIN_MOUSE_MOVE) && Math.abs(deltaPitch) < MIN_MOUSE_MOVE) {
      return;
    }
    console.log({deltaYawInt, deltaYaw});
    await control.moveMouse(deltaYaw, deltaPitch);
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

  // TODO: add timeout
  // TODO: detect if the agent is stuck or significanlty off track.
  // simple move on flat ground
  async moveToPosition(targetX, targetZ, radius, autoStop = true) {
    let forwardPressed = false;
    for (; ;) {
      const deltaX = targetX - this.mineflayerBot.entity.position.x;
      const deltaZ = targetZ - this.mineflayerBot.entity.position.z;
      const distanceSquared = Math.pow(deltaX, 2) + Math.pow(deltaZ, 2)
      const goalRadiusSquared = Math.pow(radius, 2);
      console.log({distanceSquared, goalRadiusSquared, velocity: this.mineflayerBot.entity.velocity});
      if (distanceSquared < goalRadiusSquared) {
        if (autoStop) {
          console.log('stop');
          await control.stop();
        }
        return true;
      }
      await this.lookAtPosition(targetX, undefined, targetZ);
      if (!forwardPressed) {
        await control.goForward();
        forwardPressed = true;
      }
      await control.wait(100);
    }
  }

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

  // TODO: would be nice if there was a robust way to encapsulate the idea of chaining a set of moves.
  // Right now it ends up stopping when each goal is reached. This slows down the bot.
  async traversePath(graph, pathLinks) {
    let currentNode = graph.getNode('initial_config');
    while (pathLinks.size > 0) {
      graph.forEachLinkedNode(
        currentNode.id,
        (node, link) => {
          if (!pathLinks.has(link.id)) {
            return;
          } else {
            pathLinks.delete(link.id);
          }
          currentNode = node;
          console.log({node, config: node.data.config});
        },
        true // enumerate only outbound links
      );
      const vector = configurationToThreeVector(currentNode.data.config);
      await this.moveToPosition(vector[0], vector[2], 1, false);
    };
    await control.stop();
  }
}

export default Agent;
