import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV ||= 'development';
process.env.PORT ||= '5000';
process.env.CLIENT_ORIGIN ||= 'http://localhost:5173,http://127.0.0.1:5173';
process.env.JWT_SECRET ||= 'dev-secret-change-me';

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri('secret-calculator-chat');

console.log(`Embedded MongoDB started at ${process.env.MONGODB_URI}`);
await import('./index.js');

const shutdown = async () => {
  await mongod.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
