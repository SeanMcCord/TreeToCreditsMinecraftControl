import pino from 'pino';

// Create a logging instance
// export const logger = pino({
//   level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
// });
export const logger = {
  info: (...args) => {console.log(...args)}
};
