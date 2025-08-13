import { db } from '../db.js';

class ChannelController {
	async getChannelById(req, res) {
		const { channelId } = req.params;

		if (!channelId) {
			return res.status(400).json({ error: 'Channel ID is required' });
		}

		const channelResult = await db.query(
			`SELECT
      	c.*,
      	(SELECT COUNT(*) FROM subscriptions WHERE "subscribedToChannelId" = c.id) AS "subscribersCount",
      	(SELECT COUNT(*) FROM videos WHERE "channelId" = c.id) AS "videosCount"
    	FROM
      	channels c
    	WHERE
      	c.id = $1
  	`,
			[channelId]
		);

		const channel = channelResult.rows[0];

		res.json(channel);
	}
}

export default new ChannelController();
