import { db } from '../db.js';

class VideoController {
	async getRecommendedVideos(req, res) {
		const { page, limit } = req.query;

		const parsedPage = parseInt(page, 10);
		const parsedLimit = parseInt(limit, 10);

		if (isNaN(parsedPage) || isNaN(parsedLimit) || parsedPage <= 0 || parsedLimit <= 0) {
			console.log('invalid req query');

			return res.status(400).json({ error: 'Page and limit must be positive numbers' });
		}

		const offset = (parsedPage - 1) * parsedLimit;

		const countResult = await db.query(
			`SELECT COUNT(*) FROM videos WHERE visibility = 'public'`
		);
		const totalItems = parseInt(countResult.rows[0].count, 10);

		const totalPages = Math.ceil(totalItems / parsedLimit);

		if (parsedPage > totalPages) {
			return res.json({
				recommendedVideos: [],
				currentPage: totalPages,
				totalPages: totalPages,
				totalItems: totalItems,
			});
		}

		const recommendedVideosResult = await db.query(
			`SELECT
          v.*,
          c.id AS "channelId",
          c.name AS "channelName",
          c."avatarUrl" AS "channelAvatar"
       FROM
          videos v
       JOIN
          channels c ON v."channelId" = c.id
       WHERE
          v.visibility = 'public'
       LIMIT $1 OFFSET $2`,
			[parsedLimit, offset]
		);
		const recommendedVideos = recommendedVideosResult.rows;

		res.json({
			recommendedVideos,
			currentPage: parsedPage,
			totalPages,
			totalItems,
		});
	}

	async getVideoById(req, res) {
		const { id } = req.params;

		if (!id) {
			return res.status(400).json({ error: 'Video ID is required' });
		}

		const videoResult = await db.query(
			'SELECT * FROM videos WHERE id = $1',
			[id]
		);
		const video = videoResult.rows[0];

		res.json(video);
	}

	async getVideosByChannelId(req, res) {
		const { channelId } = req.params;

		if (!channelId) {
			return res.status(400).json({ error: 'Channel ID is required' });
		}

		const videosResult = await db.query(
			'SELECT * FROM videos WHERE "channelId" = $1',
			[channelId]
		);
		const videos = videosResult.rows;

		res.json(videos);
	}

	async getWatchLaterVideosByChannelId(req, res) {
		const { channelId } = req.params;

		if (!channelId) {
			return res.status(400).json({ error: 'Channel ID is required' });
		}

		const watchLaterVideosResult = await db.query(
			'SELECT * FROM "watchLater" WHERE "channelId" = $1',
			[channelId]
		);
		const watchLaterVideos = watchLaterVideosResult.rows;

		res.json(watchLaterVideos);
	}

	async getHistoryVideosByChannelId(req, res) {
		const { channelId } = req.params;

		if (!channelId) {
			return res.status(400).json({ error: 'Channel ID is required' });
		}

		const historyVideosResult = await db.query(
			'SELECT * FROM "watchHistory." WHERE "channelId" = $1',
			[channelId]
		);
		const historyVideos = historyVideosResult.rows;

		res.json(historyVideos);
	}

	async getLikedVideosByChannelId(req, res) {
		const { channelId } = req.params;

		if (!channelId) {
			return res.status(400).json({ error: 'Channel ID is required' });
		}

		const likedVideosResult = await db.query(
			`SELECT *FROM "videoReactions"
			 	WHERE "channelId" = $1 AND "reactionType" = \'like\'`,
			[channelId]
		);
		const likedVideos = likedVideosResult.rows;

		res.json(likedVideos);
	}

	async getSubscribedVideosByChannelIds(req, res) {
		const { channelIds } = req.params;

		if (!channelIds.length) {
			return res.status(400).json({ error: 'Channel IDs are required' });
		}

		const subscribedVideosResult = await db.query(
			`SELECT * FROM "subscriptions"
			 	WHERE "channelId" = ANY($1)`,
			[channelIds]
		);
		const subscribedVideos = subscribedVideosResult.rows;

		res.json(subscribedVideos);
	}
}

export default new VideoController();
