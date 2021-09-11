import mc from 'minecraft-protocol';
import mineflayer from 'mineflayer';
import {HighLevelControl} from './gui_interactions/high_level_control.js';
import {PacketToGUI} from './gui_interactions/packet_to_gui.js';

// Based off https://github.com/DecentralisedTech/mineflayer-reflection-proxy

// Overview
// This is a transparent proxy that allows a vanilla minecraft client to connect to a vanilla minecraft server with
// the intent of capturing the world state. The goal is to use mineflayer as a model of the world. This proxy aims 
// to make no mutations to the data sent between the minecraft client and server.
//
// Setup Process
// A virtual server is created for the minecraft client to connect to called playerServer. When the minecraft client 
// connects to the playerServer a second virtual server is created for the bot called botServer. A mineflayer bot is
// then created connected to the botServer. Once the bot connects to the botServer then a virtual minecraft client 
//
// Data Flow Diagram
//
// Vanilla Minecraft Client <-> playerClient <-> serverClient <-> Minecraft Server
//                      bot <-> botClient     <--/

// Limitations
// Inventory clicks from the bot are not sent to the player. This does not seem possible with vanilla clients.
// May be able to make up for this with set_slot calls.
// Vehicles do not currently update the bots position
// Window interactions are very fickle. No dragging items. No clicking outside the window to close it. No double click.

// TODO: ensure the held item is updated.
// TODO: handle reconnection.

// Modifications to mineflayer
// inventory
//  bot.resetWindowsActionNumber = () => {
//    nextActionNumber = 0;
//  }

export const startProxy = (): Promise<[any, HighLevelControl]> => {
  const proxyServerPort = 25564;
  const botServerPort = 25566;
  const states = mc.states;
  const host = process.env.HOST;
  const port = parseInt(process.env.PORT || '25565');
  const version = process.env.VERSION;
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;

  const playerServer = mc.createServer({
    'online-mode': false,
    port: proxyServerPort,
    version: version,
    maxPlayers: 1
  });
  console.log(`Proxy running at 127.0.0.1:${proxyServerPort}`);

  return new Promise<any>((resolve, reject) => {
    playerServer.on('login', (playerClient) => {
      console.log(`${playerClient.username} connected to the proxy`)
      const botServer = mc.createServer({
        'online-mode': false,
        port: botServerPort,
        version: version,
        maxPlayers: 1
      });
      console.log(`Started Mineflayer server at 127.0.0.1:${botServerPort}`);

      let bot;
      const highLevelControl = new HighLevelControl();

      botServer.on('login', (botClient) => {
        console.log('Mineflayer connected to proxy')
        const serverClient = mc.createClient({
          host,
          port,
          username,
          password,
          keepAlive: true,
          version: version
        })
        console.log(`Proxy fully connected ${host}:${port}`)

        // TODO: find a better home for this logic.
        new PacketToGUI(botClient, bot, highLevelControl);

        const playerClientPacketHandler = createPlayerClientPacketHandler(serverClient, botClient, bot);
        playerClient.on('packet', playerClientPacketHandler);

        const serverClientPacketHandler = createServerClientPacketHandler(states, playerClient, botClient);
        serverClient.on('packet', serverClientPacketHandler);
      })

      bot = mineflayer.createBot({
        host: 'localhost',
        username,
        port: botServerPort,
        version
      })
      bot.on('error', (e) => {
        console.log({bot: e});
        reject(e);
      });
      resolve([bot, highLevelControl]);
    })
  });
}

const createPlayerClientPacketHandler = (serverClient, botClient, bot) => {
  const lastLook = {pitch: 0, yaw: 0}
  const lastWindow = {windowId: 0, actionId: 0}
  // Clones data sent from the playerClient to the botClient
  const playerClientPacketHandler = (data, meta) => {
    // console.log('P_CLIENT => SERVER_CLIENT:', meta.name)
    if (meta.name !== 'keep_alive') {
      // console.log('P_CLIENT => SERVER_CLIENT:', meta.name)
      serverClient.write(meta.name, data);

      // console.log('P_CLIENT => B_CLIENT:', meta.name)
      let dataClone = data;
      let metaNameClone = meta.name;
      if ('position' === meta.name) {
        dataClone = {x: data.x, y: data.y, z: data.z, yaw: lastLook.yaw, pitch: lastLook.pitch};
      }
      if ('position_look' === meta.name) {
        metaNameClone = 'position';
        lastLook.pitch = data.pitch;
        lastLook.yaw = data.yaw;
      }
      if ('look' === meta.name) {
        metaNameClone = 'position';
        dataClone = {...data, ...bot.entity.position};
        lastLook.pitch = data.pitch;
        lastLook.yaw = data.yaw;
      }
      if ('held_item_slot' === meta.name) {
        // console.log({
        //   event: 'proxy_held_item_slot',
        //   slotId: data.slotId,
        // });
        // TODO: Find out why this value is named 'slot' in the clientbound packet but 'slotId' in the serverbound packet.
        // This is the behavior of the vanilla client.
        // https://wiki.vg/Protocol#Held_Item_Change_.28clientbound.29
        dataClone = {slot: data.slotId};
      }
      if ('set_slot' === meta.name) {
        // console.log({
        //   event: 'set_slot',
        //   ...data
        // });
      }
      if ('open_window' === meta.name) {
        console.log({
          event: 'open_window',
          ...data
        });
      }
      if ('close_window' === meta.name) {
        // console.log({
        //   event: 'close_window',
        //   ...data
        // });
      }
      if ('window_click' === meta.name) {
        console.log({
          event: 'proxy_window_click',
          lastWindow,
          ...data
        });
        if (lastWindow.windowId !== data.windowId) {
          // NOTE: I'm not sure why the action number is not being reset right now.
          // bot.resetWindowsActionNumber();
          // console.log('windowActionIdReset');
        }
        // if (lastWindow.actionId > data.action) {
        //   // NOTE: I'm not sure why the action number is not being reset right now.
        //   // This seems to be what the vanilla client does. Mineflayer does not reset this value until it
        //   // hits 32767.
        //   // https://github.com/PrismarineJS/mineflayer/blob/a0befeb042fe3851ac35887da116c2910f505791/lib/plugins/inventory.js#L311
        //   bot.resetWindowsActionNumber();
        // }
        // For clicks orignating from the vanilla client.
        // bot.clickWindow(data.slot, data.mouseButton, data.mode);
        lastWindow.windowId = data.windowId;
        lastWindow.actionId = data.action;
      }

      // TODO: determine if this is needed at all.Some test show it might not be.
      if ('transaction' === meta.name) {
        console.log({
          event: 'transaction',
          ...data
        });
      }
      botClient.write(metaNameClone, dataClone);
    }
  }
  return playerClientPacketHandler;
}

const createServerClientPacketHandler = (states, playerClient, botClient) => {
  const serverClientPacketHandler = (data, meta) => {
    // console.log('SERVER_CLIENT => CLIENT:', meta.name)
    if (meta.state === states.PLAY) {
      // TODO: try this and see if it is more effecient
      // serverClient.writeToClients([playerClient, botClient], meta.name, data);
      if ('transaction' === meta.name) {
        console.log({
          event: 'transaction',
          ...data
        });
      }
      // console.log('SERVER_CLIENT => P_CLIENT:', meta.name)
      playerClient.write(meta.name, data);
      // console.log('SERVER_CLIENT => B_CLIENT:', meta.name)
      botClient.write(meta.name, data);
      if (meta.name === 'set_compression') {
        // TODO: remove thise ignores
        // @ts-ignore
        botClient.compressionThreshold = data.threshold;
        // @ts-ignore
        playerClient.compressionThreshold = data.threshold;
      }
    }
  }
  return serverClientPacketHandler;
}

