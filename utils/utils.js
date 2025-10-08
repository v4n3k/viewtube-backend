import jwt from 'jsonwebtoken';
import { db } from '../db.js';

export const env = varName => {
	const varValue = process.env[varName];

	if (!varValue) {
		throw new Error(`Environment variable ${varName} is not set`);
	}

	return varValue;
};

export const validateAuthToken = req => {
	try {
		const token = req.cookies.authToken;

		if (!token) {
			throw new Error('Authentication required');
		}

		jwt.verify(token, env('JWT_SECRET'), err => {
			if (err) {
				throw new Error('Invalid token');
			}
		});

		return true;
	} catch (err) {
		throw err;
	}
};

export const validateChannelId = async (req, channelId) => {
	try {
		if (!channelId) {
			throw new Error('Channel ID is required');
		}

		const token = req.cookies.authToken;

		if (!token) {
			throw new Error('Authentication required');
		}

		jwt.verify(token, env('JWT_SECRET'), err => {
			if (err) {
				throw new Error('Invalid token');
			}
		});

		const decodedToken = jwt.decode(token);

		const userId = decodedToken.userId;

		const result = await db.query(
			'SELECT id FROM channels WHERE id = $1 AND "userId" = $2',
			[channelId, userId]
		);

		if (result.rows.length === 0) {
			throw new Error('Unauthorized');
		}

		return true;
	} catch (err) {
		throw err;
	}
};

export const handleError = fn => async (req, res, next) => {
	try {
		await fn(req, res, next);
	} catch (err) {
		console.error('Error in async controller:', err);

		res.status(500).json({
			error: err,
			message: err.message || 'Internal Server Error',
		});
	}
};
