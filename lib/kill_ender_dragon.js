import {performance} from 'perf_hooks';
import Vec3 from 'vec3';
// Gets the position of the bedrock at the top of the portal
// null if not found
// NOTE: This should be a 0, 0 I think
export const getPortalLocation = (bot, mcData) => {
  const bedRockPositions = bot.findBlocks({
    matching: mcData.blocksByName.bedrock.id,
    maxDistance: 256,
    count: 100
  });
  if (bedRockPositions.length === 0) return
  return bedRockPositions.filter((position) => {
    // Only consider positions with bedrock below them.
    return bedRockPositions.some((pos) => pos.equals(position.plus(new Vec3(0, -1, 0)))) &&
      bedRockPositions.some((pos) => pos.equals(position.plus(new Vec3(0, -2, 0))));
  }).reduce((maxPos, position) => {
    // Get the highest position
    return (maxPos == null || position.y > maxPos.y) ? position : maxPos;
  });
}

export const prepairPortalForBed = (bot, mcData) => {
}

export const placeBed = async (bot, mcData, position) => {
  // TODO: handle all bed types
  const bedId = mcData.itemsByName.white_bed.id;
  const bed = bot.inventory.slots.find((item) => item != null && item.type === bedId);
  if (bed == null) {
    throw new Error('No bed in inventory');
  }
  if (bot.blockAt(position).name === 'white_bed') {
    console.log('bed placed already');
    return;
  }
  await bot.equip(bed, 'hand');
  await bot.placeBlock(bot.blockAt(position.offset(0, -1, 0)), new Vec3(0, 1, 0));
  console.log('bed placed');
}

// NOTE: I wonder if a three bed is possible if the head is at the right angle
export const activateBedWithReplacement = async (bot, mcData, bedBlock) => {
  const position = bedBlock.position.clone();
  await bot.activateBlock(bedBlock);
  console.log('bed activated');
  await new Promise((r => setTimeout(r, 50)));
  await placeBed(bot, mcData, position);
}

export const headsDown = (bot) => {
  bot.lookAt(bot.entity.position.clone().add(new Vec3(0, -1, 0)));
}

export class DragonHeadFollower {
  constructor(bot, mcData) {
    this._bot = bot;
    this._headPos;
    this._previousPhase;
    this._perchDetect = (entity) => {
      if (entity.type !== 'mob' || entity.name !== 'ender_dragon') return
      if (this._previousPhase == null) {
        this._previousPhase = entity.metadata[15];
      } else if (this._previousPhase === entity.metadata[15]) {
        return;
      }
      this._previousPhase = entity.metadata[15];
      if (entity.metadata[15] === 2) {
        console.log('###############################');
        console.log('stage 2');
        console.log('###############################');
        return;
      }
      if (entity.metadata[15] === 3) {
        console.log('###############################');
        console.log('stage 3');
        console.log('###############################');
        return;
      }
      console.log({dragonPhase: entity.metadata[15]});
    }
    this._replaceBrokenBeds = true;
    this._interactingWithBed = false;
    this._oldBedFootLocation;
    this._headMoved = async (entity) => {
      // const startTime = performance.now();
      if (entity.type !== 'mob' || entity.name !== 'ender_dragon') return
      const getViewVector = (pitch, yaw) => {
        const csPitch = Math.cos(pitch)
        const snPitch = Math.sin(pitch)
        const csYaw = Math.cos(yaw)
        const snYaw = Math.sin(yaw)
        return new Vec3(-snYaw * csPitch, snPitch, -csYaw * csPitch)
      }
      const headingVector = getViewVector(entity.pitch, entity.yaw);
      this._headPos = entity.position.clone().add(headingVector.scaled(-6.5)).offset(0, 0.5, 0);
      //console.log({countEntityMoved: bot.listenerCount('entityMoved'), countEntityUpdate: bot.listenerCount('entityUpdate')});
      // TODO: remove this log
      const bedPositions = bot.findBlocks({matching: mcData.blocksByName.white_bed.id, maxDistance: 200, count: 2});
      const bedBlocks = bedPositions.map((pos) => bot.blockAt(pos))
      const headOfBedBlock = bedBlocks.find((block) => block.getProperties().part === 'head');
      const footOfBedBlock = bedBlocks.find((block) => block.getProperties().part === 'foot');
      if (headOfBedBlock == null || footOfBedBlock == null) {
        if (this._replaceBrokenBeds && this._oldBedFootLocation != null) {
          try {
            if (this._interactingWithBed) {
              return;
            }
            this._interactingWithBed = true;
            console.log('bed is missing :(');
            await placeBed(bot, mcData, this._oldBedFootLocation);
            this._interactingWithBed = false;
          } catch (err) {
            this._interactingWithBed = false;
            throw err
          }
        }
        // console.log({time: performance.now() - startTime});
        return
      }
      if (this._oldBedFootLocation == null) {
        this._oldBedFootLocation = footOfBedBlock.position;
      }
      const offsetPosition = headOfBedBlock.position.clone().offset(0.5, 1.5, 0.5);
      const dx = this._headPos.x - offsetPosition.x;
      const dy = this._headPos.y - offsetPosition.y;
      const dz = this._headPos.z - offsetPosition.z;
      const dxz = Math.sqrt(Math.pow(dx, 2) + Math.pow(dz, 2));
      // console.log({dy, dxz});
      if (dy < 0.5) {
        console.log({headAtHalfBlock: this._headPos});
      }
      if (this._interactingWithBed) {
        // console.log({time: performance.now() - startTime});
        return;
      }
      if (dy >= 0 && dy < 1 && dxz < 1) {
        console.log({dy, dxz});
        console.log('activate bed 55ish');
        try {
          if (this._interactingWithBed) {
            return;
          }
          this._interactingWithBed = true;
          await activateBedWithReplacement(bot, mcData, footOfBedBlock);
          this._interactingWithBed = false;
        } catch (err) {
          this._interactingWithBed = false;
          throw err
        }
        // console.log({time: performance.now() - startTime});
        return;
      }
      if (dy >= 0 && dy < 0.5 && dxz < 1.6) {
        console.log({dy, dxz});
        console.log('activate bed 54ish');
        try {
          if (this._interactingWithBed) {
            return;
          }
          this._interactingWithBed = true;
          await activateBedWithReplacement(bot, mcData, footOfBedBlock);
          this._interactingWithBed = false;
        } catch (err) {
          this._interactingWithBed = false;
          throw err
        }
        // console.log({time: performance.now() - startTime});
        return;
      }
      if (dy >= 0 && dy < 2 && dxz < 1.6) {
        console.log({dy, dxz});
        console.log('activate bed 51ish');
        try {
          if (this._interactingWithBed) {
            return;
          }
          this._interactingWithBed = true;
          await activateBedWithReplacement(bot, mcData, footOfBedBlock);
          this._interactingWithBed = false;
        } catch (err) {
          this._interactingWithBed = false;
          throw err
        }
        // console.log({time: performance.now() - startTime});
        return;
      }
      if (dy >= 0 && dy < 1.5 && dxz < 2) {
        console.log({dy, dxz});
        console.log('activate bed 51ish');
        try {
          if (this._interactingWithBed) {
            return;
          }
          this._interactingWithBed = true;
          await activateBedWithReplacement(bot, mcData, footOfBedBlock);
          this._interactingWithBed = false;
        } catch (err) {
          this._interactingWithBed = false;
          throw err
        }
        // console.log({time: performance.now() - startTime});
        return;
      }
      if (dy >= 0 && dy < 0.86 && dxz < 8) {
        console.log({dy, dxz});
        console.log('activate bed take the L');
        try {
          if (this._interactingWithBed) {
            return;
          }
          this._interactingWithBed = true;
          await activateBedWithReplacement(bot, mcData, footOfBedBlock);
          this._interactingWithBed = false;
        } catch (err) {
          this._interactingWithBed = false;
          throw err
        }
        // console.log({time: performance.now() - startTime});
        return;
      }
      if (dy >= 0 && dy < 0.47 && dxz < 15) {
        console.log({dy, dxz});
        console.log('activate bed last resort');
        try {
          if (this._interactingWithBed) {
            return;
          }
          this._interactingWithBed = true;
          await activateBedWithReplacement(bot, mcData, footOfBedBlock);
          this._interactingWithBed = false;
        } catch (err) {
          this._interactingWithBed = false;
          throw err
        }
        // console.log({time: performance.now() - startTime});
        return;
      }
      // console.log({time: performance.now() - startTime});
      return;
    }
    bot.on('entityUpdate', this._perchDetect);
    bot.on('entityMoved', this._headMoved);

    // Ensure existing mobs are found
    for (const entity_ref of Object.entries(bot.entities)) {
      const entity = entity_ref[1];
      this._perchDetect(entity);
      this._headMoved(entity);
    }
  }

  getPosition() {
    return this._headPos;
  }

  terminate() {
    this._bot.removeListener('entityUpdate', this._perchDetect);
    this._bot.removeListener('entityMoved', this._headMoved);
  }
}
