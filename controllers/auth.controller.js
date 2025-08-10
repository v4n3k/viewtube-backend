import bcrypt from 'bcrypt';
import { config as dotenvConfig } from 'dotenv-esm';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { env, validateAuthToken } from '../utils/utils.js';

dotenvConfig();

const JWT_SECRET = env('JWT_SECRET');
const IS_DEV = env('NODE_ENV') === 'dev';

class AuthController {
	async signUp(req, res) {

		const { login, password, passwordConfirmation } = req.body;

		if (!login || !password || !passwordConfirmation) {
			return res
				.status(400)
				.json({ error: 'Missing required fields' });
		}

		if (password !== passwordConfirmation) {
			return res.status(400).json({ error: 'Passwords do not match' });
		}

		const existingUser = await db.query(
			'SELECT * FROM users WHERE login = $1',
			[login]
		);
		if (existingUser.rows.length > 0) {
			return res.status(409).json({ error: 'login already exists' });
		}

		const hashedPassword = await bcrypt.hash(password, 8);

		const newUserResult = await db.query(
			'INSERT INTO users (login, password) VALUES ($1, $2) RETURNING id, login',
			[login, hashedPassword]
		);

		res.json({ message: 'User created successfully' });

	}

	async signIn(req, res) {
		const { login, password } = req.body;

		const userDoesNotExistError = {
			error: `User with login ${login} does not exist`,
		};
		const wrongPasswordError = {
			error: 'Wrong password',
		};

		if (!login || !password) {
			return res
				.status(400)
				.json({ error: 'Login and password are required' });
		}

		const userResult = await db.query(
			'SELECT * FROM users WHERE login = $1',
			[login]
		);
		const user = userResult.rows[0];

		if (!user) {
			return res.status(401).json(userDoesNotExistError);
		}

		const passwordMatch = await bcrypt.compare(password, user.password);

		if (!passwordMatch) {
			return res.status(401).json(wrongPasswordError);
		}

		const token = jwt.sign({ id: user.id, login: user.login }, JWT_SECRET, {
			expiresIn: '7d',
		});

		res.cookie('authToken', token, {
			httpOnly: true,
			secure: IS_DEV ? true : false,
			sameSite: IS_DEV ? 'None' : 'Lax',
			maxAge: 60 * 60 * 1000 * 24 * 7, // 7 days
		});

		res.json({ message: 'Sign in successful', userId: user.id, login });
	}

	async signOut(req, res) {
		validateAuthToken(req);

		res.cookie('authToken', '', {
			httpOnly: true,
			secure: IS_DEV ? true : false,
			sameSite: IS_DEV ? 'None' : 'Lax',
			expires: new Date(0),
		});

		res.json({ message: 'Sign out successful' });
	}

	checkIsAuth(req, res) {
		try {
			const authHeader = req.headers.cookie;

			if (!authHeader) {
				return res
					.status(401)
					.json({ isAuth: false, error: 'Unauthorized: No cookie header' });
			}

			const tokenMatch = authHeader.match(/authToken=([^;]+)/);

			if (!tokenMatch) {
				return res
					.status(401)
					.json({
						isAuth: false,
						error: 'Unauthorized: authToken not found in cookie',
					});
			}

			const token = tokenMatch[1];

			if (!token) {
				return res
					.status(401)
					.json({ isAuth: false, error: 'Unauthorized: No token in cookie' });
			}

			try {
				jwt.verify(token, process.env.JWT_SECRET, err => {
					if (err) {
						return res
							.status(401)
							.json({
								isAuth: false,
								error: 'Invalid or expired token',
								message: err.message,
							});
					} else {
						return res.json({ isAuth: true });
					}
				});
			} catch (err) {
				return res
					.status(500)
					.json({
						isAuth: false,
						error: 'Internal server error during verification',
						message: err.message,
					});
			}
		} catch (err) {
			res
				.status(500)
				.json({
					isAuth: false,
					error: 'Internal Server Error',
					message: err.message,
				});
		}
	}
}

export default new AuthController();
