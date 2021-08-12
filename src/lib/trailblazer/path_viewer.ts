import {TreeNode} from './monte_carlo_tree_search';
import vec3 from 'vec3';

const pathViewer = (viewer, rootNode: TreeNode) => {
  const tempColorMap = new Map<number, any>([
    [0, 0x003f5c],
    [1, 0x58508d],
    [2, 0xbc5090],
    [3, 0xff6361],
    [4, 0xffa600],
  ]);
  // const positions = uniquePositions(rootNode);
  // viewer.drawPoints('startPoint', positions, 0xff9aff, 16);
  const groupCount = 5;
  // const uniqueResult = uniquePositionFrequency(rootNode);
  // const uniqueResult = uniquePositionMinCost(rootNode);
  const uniqueResult = uniquePositionMaxScore(rootNode);
  const valueGroups = singleLinearValueGroup(uniqueResult, groupCount);
  valueGroups.forEach((group) => {
    const color = tempColorMap.get(group.group);
    const positions = group.members.map((posHash) => uniqueResult.positions.get(posHash));
    viewer.drawPoints(`group-${group.group}`, positions, color, 16);

  });
}

const uniquePositions = (rootNode: TreeNode): Array<any> => {
  const seenPos = new Set<string>();
  const positions = [];
  const bfs = bfsGenerator(rootNode);
  for (const node of bfs) {
    const pos = node.data.state.data;
    if (seenPos.has(pos.posHash)) {
      continue;
    }
    seenPos.add(pos.posHash);
    positions.push(vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5));
  }
  return positions;
}

type UniqueResults<Type> = {
  positions: Map<string, Type>;
  value: Map<string, number>;
}

const uniquePositionFrequency = (rootNode: TreeNode): UniqueResults<any> => {
  const positionMap = new Map<string, any>();
  const positionFrequency = new Map<string, number>();
  const bfs = bfsGenerator(rootNode);
  for (const node of bfs) {
    const pos = node.data.state.data;
    if (!positionFrequency.has(pos.posHash)) {
      positionFrequency.set(pos.posHash, 0);
      positionMap.set(pos.posHash, vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5));
    }
    positionFrequency.set(pos.posHash, positionFrequency.get(pos.posHash) + 1);
  }
  return {
    positions: positionMap,
    value: positionFrequency,
  };
}

const uniquePositionMinCost = (rootNode: TreeNode): UniqueResults<any> => {
  const positionMap = new Map<string, any>();
  const positionMinCost = new Map<string, number>();
  const bfs = bfsGenerator(rootNode);
  for (const node of bfs) {
    const pos = node.data.state.data;
    if (!positionMinCost.has(pos.posHash)) {
      positionMinCost.set(pos.posHash, pos.costToCome);
      positionMap.set(pos.posHash, vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5));
    } else {
      const priorMinCost = positionMinCost.get(pos.posHash);
      if (priorMinCost > pos.costToCome) {
        positionMinCost.set(pos.posHash, pos.costToCome);
      }
    }
  }
  return {
    positions: positionMap,
    value: positionMinCost,
  };
}

const uniquePositionMaxScore = (rootNode: TreeNode): UniqueResults<any> => {
  const positionMap = new Map<string, any>();
  const positionMaxScore = new Map<string, number>();
  const bfs = bfsGenerator(rootNode);
  for (const node of bfs) {
    const pos = node.data.state.data;
    if (!positionMaxScore.has(pos.posHash)) {
      positionMaxScore.set(pos.posHash, node.data.scoreMax);
      positionMap.set(pos.posHash, vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5));
    } else {
      const priorMaxScore = positionMaxScore.get(pos.posHash);
      if (priorMaxScore < node.data.scoreMax) {
        positionMaxScore.set(pos.posHash, node.data.scoreMax);
      }
    }
  }
  return {
    positions: positionMap,
    value: positionMaxScore,
  };
}

type Group<Type> = {
  group: number;
  members: Array<Type>;
}

const singleLinearValueGroup = (uniqueResult: UniqueResults<any>, groups: number): Array<Group<any>> => {
  let maxValue = Number.MIN_SAFE_INTEGER;
  let minValue = Number.MAX_SAFE_INTEGER;
  for (const value of uniqueResult.value.values()) {
    if (value > maxValue) maxValue = value;
    if (value < minValue) minValue = value;
  }
  const partitionLength = (maxValue - minValue) / groups;
  console.log({minValue, maxValue, partitionLength});

  const partitions = [];
  for (let i = 0; i < groups; i++) {
    partitions.push({
      group: i,
      members: [],
    });
  }

  uniqueResult.value.forEach((value, pos) => {
    const groupIndex = value === maxValue ? groups - 1 : Math.floor((value - minValue) / partitionLength);
    try {
      partitions[groupIndex].members.push(pos);
    } catch (e) {
      console.log({value, pos, groups, groupIndex, partitionLength, minValue, maxValue});
      throw e;
    }
  });

  return partitions;
}



function* bfsGenerator(rootNode: TreeNode) {
  const open = [rootNode];
  while (open.length > 0) {
    const node = open.pop();
    open.push(...node.outEdges.map((e) => e.target));
    yield node;
  }
}

export default pathViewer
