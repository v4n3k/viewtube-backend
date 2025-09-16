import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { s3 } from '../config/s3.js';
import { db } from '../db.js';
import { env } from '../utils/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getVideoDuration(filePath) {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(filePath, (err, metadata) => {
			if (err) return reject(err);

			const duration = metadata.format.duration;
			resolve(Math.floor(duration));
		});
	});
}

class VideoController {
	async getRecommendedVideos(req, res) {
		const { page, limit } = req.query;

		const parsedPage = parseInt(page, 10);
		const parsedLimit = parseInt(limit, 10);

		if (isNaN(parsedPage) || isNaN(parsedLimit) || parsedPage <= 0 || parsedLimit <= 0) {
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

		const videoResult = await db.query(
			`
      SELECT
        v.*,
        c.id AS "channelId",
        c.name AS "channelName",
        c."avatarUrl" AS "channelAvatarUrl",
        (SELECT COUNT(*) FROM subscriptions WHERE "subscribedToChannelId" = c.id) AS "subscribersCount"
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
		let isSubscribed = false;

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

		const subscriptionsResult = await db.query(
			`
			SELECT 1 FROM "subscriptions"
			WHERE "subscriberChannelId" = $1 AND "subscribedToChannelId" = $2
			`,
			[channelId, video.channelId]
		);
		isSubscribed = subscriptionsResult.rows.length > 0;

		const response = {
			...video,
			channel: {
				id: video.channelId,
				name: video.channelName,
				avatarUrl: video.channelAvatarUrl,
				subscribersCount: parseInt(video.subscribersCount, 10),
				isSubscribed,
			},
			isLiked,
			isDisliked,
			isSaved,
		};

		res.json(response);
	}


	async getVideosByChannelId(req, res) {
		const { channelId } = req.params;
		const { page, limit } = req.query;

		const parsedPage = parseInt(page, 10);
		const parsedLimit = parseInt(limit, 10);

		if (isNaN(parsedPage) || isNaN(parsedLimit) || parsedPage <= 0 || parsedLimit <= 0) {
			return res.status(400).json({ error: 'Page and limit must be positive numbers' });
		}

		if (!channelId) {
			return res.status(400).json({ error: 'Channel ID is required' });
		}

		const offset = (parsedPage - 1) * parsedLimit;

		const countResult = await db.query(
			'SELECT COUNT(*) FROM videos WHERE "channelId" = $1',
			[channelId]
		);

		const totalItems = parseInt(countResult.rows[0].count, 10);
		const totalPages = Math.ceil(totalItems / parsedLimit);

		if (totalItems === 0 || (parsedPage > totalPages && totalPages > 0)) {
			return res.json({
				videos: [],
				currentPage: totalItems === 0 ? 1 : totalPages,
				totalPages: totalItems === 0 ? 0 : totalPages,
				totalItems: totalItems,
			});
		}

		const channelVideosResult = await db.query(
			`SELECT
        v.id,
        v.title,
        v.description,
        v."previewUrl",
        v.duration,
        v.views,
        v.visibility,
        v."createdAt",
        c.id AS "channelId",
        c.name AS "channelName",
        c."avatarUrl" AS "channelAvatar"
    	FROM
        videos v
      JOIN
        channels c ON v."channelId" = c.id
      WHERE
        v."channelId" = $1
      ORDER BY
        v."createdAt" DESC 
      LIMIT $2 OFFSET $3`,
			[channelId, parsedLimit, offset]
		);

		const channelVideos = channelVideosResult.rows;

		res.json({
			channelVideos,
			currentPage: parsedPage,
			totalPages,
			totalItems,
		});
	}

	async getWatchLaterVideosByChannelId(req, res) {
		const { channelId } = req.params;
		const { page, limit } = req.query;

		const parsedPage = parseInt(page, 10);
		const parsedLimit = parseInt(limit, 10);

		if (isNaN(parsedPage) || isNaN(parsedLimit) || parsedPage <= 0 || parsedLimit <= 0) {
			return res.status(400).json({ error: 'Page and limit must be positive numbers' });
		}

		if (!channelId) {
			return res.status(400).json({ error: 'Channel ID is required' });
		}

		const offset = (parsedPage - 1) * parsedLimit;

		const countResult = await db.query(
			`SELECT COUNT(*) FROM "watchLater" WHERE "channelId" = $1`,
			[channelId]
		);

		const totalItems = parseInt(countResult.rows[0].count, 10);
		const totalPages = Math.ceil(totalItems / parsedLimit);

		if (totalItems === 0 || (parsedPage > totalPages && totalPages > 0)) {
			return res.json({
				savedVideos: [],
				currentPage: totalItems === 0 ? 1 : totalPages,
				totalPages: totalItems === 0 ? 0 : totalPages,
				totalItems: totalItems,
			});
		}

		const savedVideosResult = await db.query(
			`SELECT
					v.id,
	        v.title,
	        v.description,
	        v."previewUrl",
	        v.duration,
	        v."views",
	        v."createdAt",
	        v.visibility,
	        c.id AS "channelId",
	        c.name AS "channelName",
	        c."avatarUrl" AS "channelAvatar"
	    FROM
	        "watchLater" wl
	    JOIN
	        videos v ON wl."videoId" = v.id
	    JOIN
	        channels c ON v."channelId" = c.id
	    WHERE
	        wl."channelId" = $1
	    ORDER BY
	        wl."createdAt" DESC   
								LIMIT $2 OFFSET $3`,
			[channelId, parsedLimit, offset]
		);
		const savedVideos = savedVideosResult.rows;

		res.json({
			savedVideos,
			currentPage: parsedPage,
			totalPages,
			totalItems,
		});
	}

	async getHistoryVideosByChannelId(req, res) {
		const { channelId } = req.params;
		const { page, limit } = req.query;

		const parsedPage = parseInt(page, 10);
		const parsedLimit = parseInt(limit, 10);

		if (isNaN(parsedPage) || isNaN(parsedLimit) || parsedPage <= 0 || parsedLimit <= 0) {
			return res.status(400).json({ error: 'Page and limit must be positive numbers' });
		}

		if (!channelId) {
			return res.status(400).json({ error: 'Channel ID is required' });
		}

		const offset = (parsedPage - 1) * parsedLimit;

		const countResult = await db.query(
			'SELECT COUNT(*) FROM "watchHistory" WHERE "channelId" = $1',
			[channelId]
		);

		const totalItems = parseInt(countResult.rows[0].count, 10);
		const totalPages = Math.ceil(totalItems / parsedLimit);

		if (totalItems === 0 || (parsedPage > totalPages && totalPages > 0)) {
			return res.json({
				historyVideos: [],
				currentPage: totalItems === 0 ? 1 : totalPages,
				totalPages: totalItems === 0 ? 0 : totalPages,
				totalItems: totalItems,
			});
		}

		const historyVideosResult = await db.query(
			`SELECT
        v.id,
        v.title,
        v.description,
        v."previewUrl",
        v.duration,
        v.views,
        v.visibility,
        c.id AS "channelId",
        c.name AS "channelName",
        c."avatarUrl" AS "channelAvatar",
        wh."watchedAt"
			FROM
				"watchHistory" wh
			JOIN
				videos v ON wh."videoId" = v.id
			JOIN
				channels c ON v."channelId" = c.id
			WHERE
				wh."channelId" = $1
			ORDER BY
				wh."watchedAt" DESC 
			LIMIT $2 OFFSET $3`,
			[channelId, parsedLimit, offset]
		);
		const historyVideos = historyVideosResult.rows;

		res.json({
			historyVideos,
			currentPage: parsedPage,
			totalPages,
			totalItems,
		});
	}

	async getLikedVideosByChannelId(req, res) {
		const { channelId } = req.params;
		const { page, limit } = req.query;

		const parsedPage = parseInt(page, 10);
		const parsedLimit = parseInt(limit, 10);

		if (isNaN(parsedPage) || isNaN(parsedLimit) || parsedPage <= 0 || parsedLimit <= 0) {
			return res.status(400).json({ error: 'Page and limit must be positive numbers' });
		}

		if (!channelId) {
			return res.status(400).json({ error: 'Channel ID is required' });
		}

		const offset = (parsedPage - 1) * parsedLimit;

		const countResult = await db.query(
			`SELECT COUNT(*) FROM "videoReactions" WHERE "channelId" = $1 AND "reactionType" = 'like'`,
			[channelId]
		);

		const totalItems = parseInt(countResult.rows[0].count, 10);
		const totalPages = Math.ceil(totalItems / parsedLimit);

		if (totalItems === 0 || (parsedPage > totalPages && totalPages > 0)) {
			return res.json({
				likedVideos: [],
				currentPage: totalItems === 0 ? 1 : totalPages,
				totalPages: totalItems === 0 ? 0 : totalPages,
				totalItems: totalItems,
			});
		}

		const likedVideosResult = await db.query(
			`SELECT
     v.id,
         v.title,
         v.description,
         v."previewUrl",
         v.duration,
         v."views",
         v."createdAt",
         v.visibility,
         c.id AS "channelId",
         c.name AS "channelName",
         c."avatarUrl" AS "channelAvatar"
     FROM
         "videoReactions" vr
     JOIN
         videos v ON vr."videoId" = v.id
     JOIN
         channels c ON v."channelId" = c.id
     WHERE
         vr."channelId" = $1 AND vr."reactionType" = 'like'
     ORDER BY
         vr."createdAt" DESC
        LIMIT $2 OFFSET $3`,
			[channelId, parsedLimit, offset]
		);
		const likedVideos = likedVideosResult.rows;

		res.json({
			likedVideos,
			currentPage: parsedPage,
			totalPages,
			totalItems,
		});
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

	async addVideoToHistory(req, res) {
		const { channelId, videoId } = req.params;

		if (!channelId || !videoId) {
			return res.status(400).json({ error: 'Channel ID and video ID are required' });
		}

		const isVideoInHistory = await db.query(
			`SELECT * FROM "watchHistory" WHERE "channelId" = $1 AND "videoId" = $2`,
			[channelId, videoId]
		);
		if (isVideoInHistory.rows.length > 0) {
			return res.status(400).json({ error: 'Video already in history' });
		}

		const historyVideoResult = await db.query(
			`INSERT INTO "watchHistory" ("channelId", "videoId")
				VALUES ($1, $2)
			RETURNING *`,
			[channelId, videoId]
		);
		const historyVideo = historyVideoResult.rows[0];

		res.json(historyVideo);
	}

	async deleteVideoFromHistory(req, res) {
		const { channelId, videoId } = req.params;

		if (!channelId || !videoId) {
			return res.status(400).json({ error: 'Channel ID and video ID are required' });
		}

		const historyVideoResult = await db.query(
			`DELETE FROM "watchHistory" 
				WHERE "channelId" = $1 AND "videoId" = $2
			RETURNING *`,
			[channelId, videoId]
		);
		const historyVideo = historyVideoResult.rows[0];

		res.json(historyVideo);
	}

	async uploadVideo(req, res) {
		const { channelId } = req.params;
		const { title, description } = req.body;
		const videoFile = req.files?.videoFile?.[0];
		const previewFile = req.files?.previewFile?.[0];

		if (!channelId) {
			return res.status(400).json({ error: 'Channel ID is required' });
		}

		if (!videoFile) {
			return res.status(400).json({ error: 'Video file is required' });
		}

		if (!previewFile) {
			return res.status(400).json({ error: 'Preview file is required' });
		}

		if (!title) {
			return res.status(400).json({ error: 'Title is required' });
		}

		if (!description) {
			return res.status(400).json({ error: 'Description is required' });
		}

		const tempDir = join(__dirname, '..', 'temp');
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}

		const tempVideoPath = join(tempDir, `${uuidv4()}-${videoFile.originalname}`);

		try {
			fs.writeFileSync(tempVideoPath, videoFile.buffer);
		} catch (writeErr) {
			console.error('Error writing temp file:', writeErr);
			return res.status(500).json({ error: 'Failed to write temporary file' });
		}

		let duration;
		try {
			duration = await getVideoDuration(tempVideoPath);
		} catch (err) {
			console.error('Error getting video duration:', err);

			if (fs.existsSync(tempVideoPath)) {
				fs.unlinkSync(tempVideoPath);
			}
			return res.status(500).json({ error: 'Failed to process video file' });
		} finally {
			if (fs.existsSync(tempVideoPath)) {
				fs.unlinkSync(tempVideoPath);
			}
		}

		const videoKey = `videos/${channelId}/${uuidv4()}-${videoFile.originalname}`;
		const previewKey = `previews/${channelId}/${uuidv4()}-${previewFile.originalname}`;

		const videoUploadParams = {
			Bucket: env('S3_BUCKET_NAME'),
			Key: videoKey,
			Body: videoFile.buffer,
			ContentType: videoFile.mimetype,
		};
		const videoUploadResult = await s3.upload(videoUploadParams).promise();
		const videoUrl = videoUploadResult.Location;

		const previewUploadParams = {
			Bucket: env('S3_BUCKET_NAME'),
			Key: previewKey,
			Body: previewFile.buffer,
			ContentType: previewFile.mimetype,
		};
		const previewUploadResult = await s3.upload(previewUploadParams).promise();
		const previewUrl = previewUploadResult.Location;

		const videoResult = await db.query(
			`INSERT INTO videos (title, description, "videoUrl", "previewUrl", "channelId", "duration", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
			[title, description, videoUrl, previewUrl, channelId, duration]
		);

		const video = videoResult.rows[0];

		res.status(201).json(video);
	}
}

export default new VideoController();
