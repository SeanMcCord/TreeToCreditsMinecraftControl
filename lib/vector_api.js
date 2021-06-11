import express from 'express';
import cors from 'cors';
import {graphqlHTTP} from 'express-graphql';
import {buildSchema} from 'graphql';
import {performance} from 'perf_hooks';


export class EntityWatcher {
  constructor(bot) {
    this._bot = bot;
    this._entityListenerMap = new Map();
    this._entityStateMap = new Map();
    // TODO: this is gross. do this better
    this._app = this._startServer();
  }

  watchEntity(entityUuid) {
    if (this._entityListenerMap.has(entityUuid)) return;
    const entityMovedHandler = (entity) => {
      if (entity.uuid !== entityUuid) return;
      // TODO: This line makes this only work with ender dragons. Remove it to allow anything to be used.
      if (entity.metadata[15] !== 3) return;
      const velocity = {
        time: performance.now(),
        velocityComponents: entity.velocity.toArray(),
        yaw: entity.yaw,
        pitch: entity.pitch,
        headYaw: entity.headYaw,
        headPitch: entity.headPitch,
        positionComponents: entity.position.toArray()
      };
      if (this._entityStateMap.has(entityUuid)) {
        const previousStates = this._entityStateMap.get(entityUuid);
        const previousState = previousStates[previousStates.length - 1];
        const deltaT = velocity.time - previousState.time;
        velocity.computedVelocityComponents = [
          (velocity.positionComponents[0] - previousState.positionComponents[0]) / (deltaT / 50),
          (velocity.positionComponents[1] - previousState.positionComponents[1]) / (deltaT / 50),
          (velocity.positionComponents[2] - previousState.positionComponents[2]) / (deltaT / 50)
        ];
      }
      // console.log({entityUuid, velocity});
      if (!this._entityStateMap.has(entityUuid)) {
        this._entityStateMap.set(entityUuid, []);
      }
      this._entityStateMap.get(entityUuid).push(velocity);
    }
    this._bot.on('entityMoved', entityMovedHandler);
    this._entityListenerMap.set(entityUuid, {event: 'entityMoved', handler: entityMovedHandler});
  }

  terminate() {
    this._app.close();
    this._entityListenerMap.forEach((_, listener) => this._bot.removeListener(listener.event, listener.handler));
  }

  _startServer() {
    const schema = buildSchema(`
      type EntityState {
        time: Float
        velocityComponents: [Float]
        yaw: Float
        pitch: Float
        headYaw: Float
        headPitch: Float
        positionComponents: [Float]
        computedVelocityComponents: [Float]
      }

      type Query {
        getAllEntityUuids: [String]
        getStatesForEntity(entityUuid: String!): [EntityState]
      }
    `);

    const root = {
      getAllEntityUuids: () => {
        let uuids = []
        for (const key of this._entityListenerMap.keys()) {
          uuids.push(key);
        }
        return uuids;
      },
      getStatesForEntity: ({entityUuid}) => {
        // TODO: return an error if there is no entityUuid
        if (!this._entityStateMap.has(entityUuid)) {
          return [];
        }
        return this._entityStateMap.get(entityUuid);
      }
    };

    const app = express();
    app.use(cors())
    app.use('/graphql', graphqlHTTP({
      schema: schema,
      rootValue: root,
      graphiql: true,
    }));
    app.listen(4000);
    console.log('Running a GraphQL API server at http://localhost:4000/graphql');

    return app;
  }
}
