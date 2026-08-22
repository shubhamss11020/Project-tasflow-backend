import { app } from './app';
import { config } from './config';

const server = app.listen(config.port, () => {
  console.log(`TaskFlow API Server running on port ${config.port} (${config.nodeEnv})`);
  console.log(`Swagger UI Documentation available at: http://localhost:${config.port}/api-docs`);
});

const gracefulShutdown = () => {
  console.log('Shutting down server gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
