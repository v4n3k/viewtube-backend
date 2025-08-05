import { db } from '../db.js';

class SubscriptionController {
	async createSubscription(req, res) {
		const { subscriberChannelId, subscribeToChannelId } = req.body;

		if (!subscriberChannelId || !subscribeToChannelId) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		if (parseInt(subscriberChannelId) === parseInt(subscribeToChannelId)) {
			return res.status(400).json({ error: 'You cannot subscribe to yourself' });
		}

		const subscriptionResult = await db.query(
			`INSERT INTO subscriptions 
				("subscriberChannelId", "subscribedToChannelId") 
				VALUES ($1, $2)
			RETURNING *`,
			[subscriberChannelId, subscribeToChannelId]
		);
		const subscription = subscriptionResult.rows[0];

		res.status(201).json(subscription);
	}

	async deleteSubscription(req, res) {
		const { subscriberChannelId, unsubscribeFromChannelId } = req.body;

		if (!subscriberChannelId || !unsubscribeFromChannelId) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		if (parseInt(subscriberChannelId) === parseInt(unsubscribeFromChannelId)) {
			return res.status(400).json({ error: 'You cannot unsubscribe from yourself' });
		}

		const subscriptionResult = await db.query(
			`DELETE FROM subscriptions 
				WHERE "subscriberChannelId" = $1 AND "subscribedToChannelId" = $2
			RETURNING *`,
			[subscriberChannelId, unsubscribeFromChannelId]
		);
		const subscription = subscriptionResult.rows[0];

		res.json(subscription);
	};
}

export default new SubscriptionController();