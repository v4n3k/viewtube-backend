import { db } from '../db.js';

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
}

export default new VideoController();
