import vec3 from 'vec3';

export const getPositionsWithinEntityBoundingBox = (entity): Array<any> => {
  const halfWidth = entity.width / 2;
  const low = entity.position.clone().offset(-1 * halfWidth, 0, -1 * halfWidth);
  const high = entity.position.clone().offset(halfWidth, entity.height, halfWidth);
  return getPositionsWithinAxisAlignedBoundingBox(low, high);
}

export const getPositionsWithinAxisAlignedBoundingBox = (low, high): Array<any> => {
  const xMin = Math.floor(low.x);
  const yMin = Math.floor(low.y);
  const zMin = Math.floor(low.z);
  const xMax = Math.floor(high.x);
  const yMax = Math.floor(high.y);
  const zMax = Math.floor(high.z);
  const positions = [];
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      for (let z = zMin; z <= zMax; z++) {
        positions.push(vec3([x, y, z]));
      }
    }
  }
  return positions;
}
