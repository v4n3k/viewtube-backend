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
		const { videoId, channelId } = req.params;

		if (!videoId || !channelId) {
			return res.status(400).json({ error: 'Video ID and Channel ID are required' });
		}

		try {
			const videoResult = await db.query(
				`
      SELECT
        v.*,
        c.id AS "channelId",
        c.name AS "channelName",
        c."avatarUrl" AS "channelAvatarUrl",
        (SELECT COUNT(*) FROM subscriptions WHERE "subscribedToChannelId" = c.id) AS "subscriptionsCount"
      FROM videos v
      JOIN channels c ON v."channelId" = c.id
      WHERE v.id = $1
      `,
				[videoId]
			);

			const video = videoResult.rows[0];

			if (!video) {
				return res.status(404).json({ error: 'Video not found' });
			}

			let isLiked = false;
			let isDisliked = false;
			let isSaved = false;

			const reactionsResult = await db.query(
				`
      SELECT "reactionType" FROM "videoReactions"
      WHERE "channelId" = $1 AND "videoId" = $2
      `,
				[channelId, videoId]
			);

			const reactions = reactionsResult.rows;

			if (reactions.length > 0) {
				isLiked = reactions.some(r => r.reactionType === 'like');
				isDisliked = reactions.some(r => r.reactionType === 'dislike');
			}

			const savedResult = await db.query(
				`
      SELECT 1 FROM "watchLater"
      WHERE "channelId" = $1 AND "videoId" = $2
      `,
				[channelId, videoId]
			);
			isSaved = savedResult.rows.length > 0;

			const response = {
				...video,
				channel: {
					id: video.channelId,
					name: video.channelName,
					avatarUrl: video.channelAvatarUrl,
					subscriptionsCount: parseInt(video.subscriptionsCount, 10),
				},
				isLiked,
				isDisliked,
				isSaved,
			};

			res.json(response);
		} catch (error) {
			console.error('Error fetching video:', error);
			res.status(500).json({ error: 'Internal Server Error' });
		}
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

	async likeVideo(req, res) {
		const { channelId, videoId } = req.params;

		if (!channelId || !videoId) {
			return res.status(400).json({ error: 'Channel ID and video ID are required' });
		}

		const reactionResult = await db.query(
			`INSERT INTO "videoReactions" ("channelId", "videoId", "reactionType")
				VALUES ($1, $2, 'like')
				ON CONFLICT ("channelId", "videoId") DO UPDATE SET "reactionType" = 'like'
			RETURNING *`,
			[channelId, videoId]
		);
		const reaction = reactionResult.rows[0];

		res.json(reaction);
	}

	async unlikeVideo(req, res) {
		const { channelId, videoId } = req.params;

		if (!channelId || !videoId) {
			return res.status(400).json({ error: 'Channel ID and video ID are required' });
		}

		const reactionResult = await db.query(
			`DELETE FROM "videoReactions" 
				WHERE "channelId" = $1 AND "videoId" = $2
			RETURNING *`,
			[channelId, videoId]
		);

		res.json({ message: 'Video unliked successfully' });
	}

	async dislikeVideo(req, res) {
		const { channelId, videoId } = req.params;

		if (!channelId || !videoId) {
			return res.status(400).json({ error: 'Channel ID and video ID are required' });
		}

		const reactionResult = await db.query(
			`INSERT INTO "videoReactions" ("channelId", "videoId", "reactionType")
				VALUES ($1, $2, 'dislike')
				ON CONFLICT ("channelId", "videoId") DO UPDATE SET "reactionType" = 'dislike'
			RETURNING *`,
			[channelId, videoId]
		);
		const reaction = reactionResult.rows[0];

		res.json(reaction);
	}

	async undislikeVideo(req, res) {
		const { channelId, videoId } = req.params;

		if (!channelId || !videoId) {
			return res.status(400).json({ error: 'Channel ID and video ID are required' });
		}

		const reactionResult = await db.query(
			`DELETE FROM "videoReactions" 
				WHERE "channelId" = $1 AND "videoId" = $2
			RETURNING *`,
			[channelId, videoId]
		);

		res.json({ message: 'Video undisliked successfully' });
	}

	async addToWatchLater(req, res) {
		const { channelId, videoId } = req.params;

		if (!channelId || !videoId) {
			return res.status(400).json({ error: 'Channel ID and video ID are required' });
		}

		const watchLaterVideoResult = await db.query(
			`INSERT INTO "watchLater" ("channelId", "videoId")
				VALUES ($1, $2)
				ON CONFLICT ("channelId", "videoId") DO NOTHING
			RETURNING *`,
			[channelId, videoId]
		);
		const watchLaterVideo = watchLaterVideoResult.rows[0];

		res.json(watchLaterVideo);
	}

	async deleteFromWatchLater(req, res) {
		const { channelId, videoId } = req.params;

		if (!channelId || !videoId) {
			return res.status(400).json({ error: 'Channel ID and video ID are required' });
		}

		const watchLaterVideoResult = await db.query(
			`DELETE FROM "watchLater" 
				WHERE "channelId" = $1 AND "videoId" = $2
			RETURNING *`,
			[channelId, videoId]
		);

		res.json({ message: 'Video removed from watch later successfully' });
	}
}

export default new VideoController();
