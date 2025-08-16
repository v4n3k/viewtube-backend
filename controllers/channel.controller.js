import { db } from '../db.js';

class ChannelController {
	async getChannelById(req, res) {
		const { requesterChannelId, requestedChannelId } = req.params;

		if (!requestedChannelId || !requesterChannelId || isNaN(requesterChannelId)) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		const channelResult = await db.query(
			`SELECT
        c.*,
        (SELECT COUNT(*) FROM subscriptions WHERE "subscribedToChannelId" = c.id) AS "subscribersCount",
        (SELECT COUNT(*) FROM videos WHERE "channelId" = c.id) AS "videosCount",
        (SELECT EXISTS (
        SELECT 1 FROM subscriptions
          WHERE "subscriberChannelId" = $2
            AND "subscribedToChannelId" = c.id
            )) AS "isSubscribed"
          FROM
            channels c
        WHERE
        	c.id = $1
      `,
			[requestedChannelId, requesterChannelId]
		);

		const channel = channelResult.rows[0];

		if (!channel) {
			return res.status(404).json({ error: 'Channel not found' });
		}

		res.json(channel);
	}
}

export default new ChannelController();
