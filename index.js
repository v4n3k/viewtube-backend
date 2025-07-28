process.on('uncaughtException', (err) => {
	console.error('UNCAUGHT EXCEPTION: Server is shutting down...', err);
	process.exit(1);
});

process.on('unhandledRejection', (reason) => {
	console.error('UNHANDLED REJECTION: Server is shutting down...', reason);
	process.exit(1);
});

import pkg from 'cookie-parser';
import cors from 'cors';
import { config as dotenvConfig } from 'dotenv-esm';
import express from 'express';
import fs from 'fs/promises';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './db.js';
import { router as commentRouter } from './routes/comment.routes.js';
import { router as subscriptionRouter } from './routes/subscription.routes.js';
import { router as videoRouter } from './routes/video.routes.js';
import { env } from './utils/utils.js';

dotenvConfig();
const cookieParse = pkg;

const PORT = env("BACKEND_PORT");
const FRONTEND_URL = env("FRONTEND_URL");
const LOCAL_FRONTEND_URL = env("LOCAL_FRONTEND_URL");
const IS_DEV = env('NODE_ENV') === 'dev';

const app = express();

const startServer = async () => {
	try {
		console.log('Starting server initialization...');


		console.log('Initializing database...');
		await initializeDatabase();
		console.log('Database initialized successfully.');

		const __filename = fileURLToPath(import.meta.url);
		const __dirname = path.dirname(__filename);
		const imageStorageDirectory = path.join(__dirname, 'uploads');

		console.log('Ensuring uploads directory exists...');
		await fs.mkdir(imageStorageDirectory, { recursive: true });
		console.log('Uploads directory ready.');

		app.set('trust proxy', true);

		app.use(helmet());
		app.use(express.json());
		app.use(cookieParse());
		app.use(cors({
			origin: IS_DEV ? LOCAL_FRONTEND_URL : FRONTEND_URL,
			methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE'],
			allowedHeaders: [
				'Content-Type',
				'Authorization',
				'Accept',
				'Origin',
				'X-Requested-With'
			],
			credentials: true,
			preflightContinue: false,
			optionsSuccessStatus: 204
		}));

		app.use('/api', videoRouter);
		app.use('/api', commentRouter);
		app.use('/api', subscriptionRouter);

		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT} in ${env('NODE_ENV')} mode`);
		});

	} catch (error) {
		console.error('FATAL ERROR: Server failed to start:', error);
		process.exit(1);
	}
};

startServer();