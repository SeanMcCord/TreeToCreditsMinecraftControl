const getConfig = () => {
  if (process.env.SPEEDRUN_ID == null) {
    throw new Error("Environmental variable SPEEDRUN_ID must be supplied");
  }
  let config = {
    vectorAPIPort: 4000,
    speedrunId: process.env.SPEEDRUN_ID,
  };
  if (process.env.NODE_ENV === 'production') {
    config = Object.assign(
      {},
      config,
      {
        metricsPort: 8080,
        viewerPort: 3001,
        mcServerPort: 25565,
        mcServerHost: '192.168.1.163',
      }
    );
  } else {
    config = Object.assign(
      {},
      config,
      {
        metricsPort: 8081,
        viewerPort: 3004,
        mcServerPort: 3022,
        mcServerHost: 'localhost',
      }
    );
  }
  return config;
}

export default getConfig;
