import { db } from '../db';

class SubscriptionController {
	async getSubscriptionsByUserId(req, res) {
		const { userId } = req.params;

		if (!userId) {
			res.status(400).json({ error: 'Missing required user id' });
		}

		const subscriptionsResult = await db.query(
			`SELECT * FROM subscriptions
				WHERE "userId" = $1`,
			[userId]
		);
		const subscriptions = subscriptionsResult.rows;

		res.json(subscriptions);
	}

	async createSubscription(req, res) {
		const { userId, channelId } = req.body;

		if (!userId || !channelId) {
			res.status(400).json({ error: 'Missing required fields' });
		}

		const subscription = await db.query(
			`INSERT INTO subscriptions 
				("userId", "channelId") 
				VALUES ($1, $2)
			RETURNING *`,
			[userId, channelId]
		);

		res.status(201).json(subscription);
	}
}

export default new SubscriptionController();