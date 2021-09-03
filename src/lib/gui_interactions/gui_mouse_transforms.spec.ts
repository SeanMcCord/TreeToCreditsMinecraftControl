import {expect} from 'chai';
import {transformYawToMouseSpace, mouseMoveWithinNoActionRegion} from './gui_mouse_transforms.js';

describe('transformYawToMouseSpace', () => {
  describe('maps currentYaw 0', () => {
    it('targetYaw 0 to 0', () => {
      expect(transformYawToMouseSpace(0, 0)).to.equal(0);
    });
    it('targetYaw π/2 to -600', () => {
      expect(transformYawToMouseSpace(0, Math.PI / 2)).to.equal(-600);
    });
    it('targetYaw π to -1200', () => {
      expect(transformYawToMouseSpace(0, Math.PI)).to.equal(-1200);
    });
    it('targetYaw 3π/2 to -1800', () => {
      expect(transformYawToMouseSpace(0, 3 * Math.PI / 2)).to.equal(-1800);
    });
    it('targetYaw 2π to 0', () => {
      expect(transformYawToMouseSpace(0, 2 * Math.PI)).to.equal(0);
    });
  });
  describe('maps currentYaw π/2', () => {
    it('targetYaw 0 to 600', () => {
      expect(transformYawToMouseSpace(Math.PI / 2, 0)).to.equal(600);
    });
    it('targetYaw π/2 to 0', () => {
      expect(transformYawToMouseSpace(Math.PI / 2, Math.PI / 2)).to.equal(0);
    });
    it('targetYaw π to -600', () => {
      expect(transformYawToMouseSpace(Math.PI / 2, Math.PI)).to.equal(-600);
    });
  });
  describe('maps currentYaw π', () => {
    it('targetYaw 0 to 1200', () => {
      expect(transformYawToMouseSpace(Math.PI, 0)).to.equal(1200);
    });
  });
  describe('maps currentYaw 3π/2', () => {
    it('targetYaw 0 to 1800', () => {
      expect(transformYawToMouseSpace(3 * Math.PI / 2, 0)).to.equal(1800);
    });
  });
  describe('maps currentYaw 2π', () => {
    it('targetYaw 0 to 0', () => {
      expect(transformYawToMouseSpace(2 * Math.PI, 0)).to.equal(0);
    });
  });
});

describe('mouseMoveWithinNoActionRegion', () => {
  describe('pitch 0', () => {
    it('yaw 0 results in false', () => {
      expect(mouseMoveWithinNoActionRegion(0, 0)).to.be.true;
    });
    it('yaw 600 results in false', () => {
      expect(mouseMoveWithinNoActionRegion(600, 0)).to.be.false;
    });
    it('yaw -600 results in false', () => {
      expect(mouseMoveWithinNoActionRegion(-600, 0)).to.be.false;
    });
    it('yaw 1200 results in false', () => {
      expect(mouseMoveWithinNoActionRegion(1200, 0)).to.be.false;
    });
    it('yaw -1200 results in false', () => {
      expect(mouseMoveWithinNoActionRegion(-1200, 0)).to.be.false;
    });
    it('yaw 1800 results in false', () => {
      expect(mouseMoveWithinNoActionRegion(1800, 0)).to.be.false;
    });
    it('yaw -1800 results in false', () => {
      expect(mouseMoveWithinNoActionRegion(-1800, 0)).to.be.false;
    });
  });
});
