import {ConfigurationCollides, ConfigurationPathCollides, Configuration} from './rrt_star.js';
import vec3 from 'vec3';

const DEFAULT_AGENT_BOUNDING_BOX_RADIUS = 0.2;

export const createWorldCollides = (world): ConfigurationCollides => {
  // TODO: use a better cache.
  const blockedCache = new Map<string, boolean>();
  return (configuration: Configuration): boolean => {
    const positions = new Map<string, Array<number>>();
    const fixedY = 56;
    const centerPoint = [Math.floor(configuration[0]), fixedY, Math.floor(configuration[2])];
    positions.set(centerPoint.toString(), centerPoint);

    const minusZ = [Math.floor(configuration[0]), fixedY, Math.floor(configuration[2] - DEFAULT_AGENT_BOUNDING_BOX_RADIUS)];
    positions.set(minusZ.toString(), minusZ);
    const plusZ = [Math.floor(configuration[0]), fixedY, Math.floor(configuration[2] + DEFAULT_AGENT_BOUNDING_BOX_RADIUS)];
    positions.set(plusZ.toString(), plusZ);
    const minusX = [Math.floor(configuration[0] - DEFAULT_AGENT_BOUNDING_BOX_RADIUS), fixedY, Math.floor(configuration[2])];
    positions.set(minusX.toString(), minusX);
    const plusX = [Math.floor(configuration[0] + DEFAULT_AGENT_BOUNDING_BOX_RADIUS), fixedY, Math.floor(configuration[2])];
    positions.set(plusX.toString(), plusX);

    // TODO: add diagonals

    for (const [key, position] of positions) {
      let block;
      // TODO: use the correct y height when movement can handle verticality
      if (blockedCache.has(key)) {
        block = blockedCache.get(key);
      } else {
        block = world.getBlock(vec3(position));
        if (block != null) {
          blockedCache.set(key, block);
        }
      }
      if (block == null) {
        // console.log({configuration, block});
        return true;
      }
      if (block.boundingBox !== 'empty') {
        // console.log({configuration, block, result});
        return true;
      }
    }
    return false;
  };
};

export const createWorldPathCollides = (world, configCollides: ConfigurationCollides): ConfigurationPathCollides => {
  return (configurations: Array<Configuration>): boolean => {
    for (const config of configurations) {
      if (configCollides(config)) {
        return true;
      }
    }
    return false;
  };
};
