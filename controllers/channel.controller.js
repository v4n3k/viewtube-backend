import { v4 as uuidv4 } from 'uuid';
import { s3 } from '../config/s3.js';
import { db } from '../db.js';
import { env, validateAuthToken, validateChannelId } from '../utils/utils.js';

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

	async getChannelsByUserId(req, res) {
		const { userId } = req.params;

		if (!userId || isNaN(userId)) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		const channelsResult = await db.query(
			`SELECT
				c.*,
				(SELECT COUNT(*) FROM subscriptions WHERE "subscribedToChannelId" = c.id) AS "subscribersCount",
				(SELECT COUNT(*) FROM videos WHERE "channelId" = c.id) AS "videosCount"
			FROM
				channels c
			WHERE
				c."userId" = $1
			ORDER BY
				c."createdAt" DESC`,
			[userId]
		);

		const channels = channelsResult.rows;

		res.json(channels);
	}

	async createChannel(req, res) {
		const { userId, name, description } = req.body;
		const avatarFile = req.files?.avatarFile?.[0];
		const bannerFile = req.files?.bannerFile?.[0];

		if (!userId || !name || !description || !avatarFile || !bannerFile) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		const avatarKey = `avatars/${userId}/${uuidv4()}-${avatarFile.originalname}`;
		const bannerKey = `banners/${userId}/${uuidv4()}-${bannerFile.originalname}`;

		const avatarUploadParams = {
			Bucket: env('S3_BUCKET_NAME'),
			Key: avatarKey,
			Body: avatarFile.buffer,
			ContentType: avatarFile.mimetype
		};
		const bannerUploadParams = {
			Bucket: env('S3_BUCKET_NAME'),
			Key: bannerKey,
			Body: bannerFile.buffer,
			ContentType: bannerFile.mimetype
		};

		const [avatarUploadResult, bannerUploadResult] = await Promise.all([
			s3.upload(avatarUploadParams).promise(),
			s3.upload(bannerUploadParams).promise()
		]);

		const avatarUrl = avatarUploadResult.Location;
		const bannerUrl = bannerUploadResult.Location;

		const channelResult = await db.query(
			`INSERT INTO channels 
				("userId", name, description, "avatarUrl", "bannerUrl") 
				VALUES ($1, $2, $3, $4, $5) 
			RETURNING *`,
			[userId, name, description, avatarUrl, bannerUrl]
		);

		const newChannel = channelResult.rows[0];

		res.status(201).json(newChannel);
	}

	async deleteChannel(req, res) {
		const { channelId } = req.params;

		if (!channelId || isNaN(channelId)) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		validateAuthToken(req);
		await validateChannelId(req, channelId);

		const channelResult = await db.query(
			`DELETE FROM channels WHERE id = $1 RETURNING *`,
			[channelId]
		);

		const deletedChannel = channelResult.rows[0];

		res.json(deletedChannel);
	}
}

export default new ChannelController();
