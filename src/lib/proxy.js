import mc from 'minecraft-protocol';
import mineflayer from 'mineflayer';
// import {mineflayer as mineflayerViewer} from 'prismarine-viewer';
import controls from './gui_direct_control.js';
import repl from 'repl';
import Agent from './agent.js';

// TODO: ensure the held item is updated.

// Limitations
// Inventory clicks from the bot are not sent to the player. This does not seem possible with vanilla clients. May be able to make up for this with set_slot calls.
// Vehicles do not currently update the bots position
// Window interactions are very fickle. No dragging items. No clicking outside the window to close it. No double click.

// Modifications to mineflayer
// inventory
//  bot.resetWindowsActionNumber = () => {
//    nextActionNumber = 0;
//  }

const proxyServerPort = 25564;
const botServerPort = 25566;
const states = mc.states
let host = process.env.HOST
let port = process.env.PORT | 25565
let version = process.env.VERSION
let username = process.env.USERNAME
let password = process.env.PASSWORD

// Server player connects to
const playerServer = mc.createServer({
  'online-mode': false,
  port: proxyServerPort,
  version: version,
  maxPlayers: 1
})

console.log(`Proxy running at 127.0.0.1:${proxyServerPort}`)

playerServer.on('login', (playerClient) => {
  console.log(`${playerClient.username} connected to the proxy`)

  // Server mineflayer connects to
  const botServer = mc.createServer({
    'online-mode': false,
    port: botServerPort,
    version: version,
    maxPlayers: 1
  })
  console.log(`Started Mineflayer server at 127.0.0.1:${botServerPort}`)

  let bot

  botServer.on('login', (botClient) => {
    console.log('Mineflayer connected to proxy')
    // Target Server
    const server = mc.createClient({
      host,
      port,
      username,
      password,
      keepAlive: true,
      version: version
    })
    console.log(`Proxy connected ${host}:${port}`)

    const lastLook = {pitch: 0, yaw: 0}
    const lastWindow = {windowId: 0, actionId: 0}

    playerClient.on('packet', (data, meta) => {
      if (meta.name !== 'keep_alive') {
        // console.log('P_CLIENT => SERVER:', meta.name)
        server.write(meta.name, data)
        if ('position' === meta.name) {
          data = {x: data.x, y: data.y, z: data.z, yaw: lastLook.yaw, pitch: lastLook.pitch}
        }
        if ('position_look' === meta.name) {
          meta.name = 'position'
          lastLook.pitch = data.pitch
          lastLook.yaw = data.yaw
        }
        if ('look' === meta.name) {
          meta.name = 'position'
          data = {...data, ...bot.entity.position}
          lastLook.pitch = data.pitch
          lastLook.yaw = data.yaw
        }
        if ('window_click' === meta.name) {
          // console.log({
          //   event: 'proxy_window_click',
          //   lastWindow,
          //   ...data
          // });
          if (lastWindow.actionId > data.action) {
            // NOTE: I'm not sure why the action number is not being reset right now.
            bot.resetWindowsActionNumber();
          }
          bot.clickWindow(data.slot, data.mouseButton, data.mode);
          lastWindow.windowId = data.windowId;
          lastWindow.actionId = data.action;
        }

        // TODO: determine if this is needed at all. Some test show it might not be.
        // if ('transaction' === meta.name) {
        //   console.log({
        //     event: 'transaction',
        //     ...data
        //   });
        // }
        botClient.write(meta.name, data)
      }
    })

    server.on('packet', (data, meta) => {
      // console.log('SERVER => CLIENT:', meta.name)
      if (meta.state === states.PLAY) {
        // TODO: try this and see if it is more effecient
        // server.writeToClients([playerClient, botClient], meta.name, data);
        // console.log('SERVER => P_CLIENT:', meta.name)
        playerClient.write(meta.name, data)
        // console.log('SERVER => B_CLIENT:', meta.name)
        botClient.write(meta.name, data)
        if (meta.name === 'set_compression') {
          botClient.compressionThreshold = data.threshold
          playerClient.compressionThreshold = data.threshold
        }
      }
    })

  })

  bot = mineflayer.createBot({
    host: 'localhost',
    username,
    port: botServerPort,
    version
  })
  console.log('Created Mineflayer instance')
  const context = repl.start('> ').context;
  context.bot = bot;
  context.controls = controls;
  context.agent = new Agent(bot);
  // bot.once('spawn', () => {
  //   mineflayerViewer(bot, {port: 3011});
  // });
})
