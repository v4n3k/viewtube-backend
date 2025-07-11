import { db } from '../db.js';

class CommentController {
	async getCommentsByVideoId(req, res) {
		const { videoId } = req.params;
		const { page, limit } = req.query;

		const parsedPage = parseInt(page, 10);
		const parsedLimit = parseInt(limit, 10);

		if (!videoId) {
			return res.status(400).json({ error: 'Missing required video id' });
		}

		if (isNaN(parsedPage) || isNaN(parsedLimit) || parsedPage <= 0 || parsedLimit <= 0) {
			return res.status(400).json({ error: 'Page and limit must be positive numbers' });
		}

		const offset = (parsedPage - 1) * parsedLimit;

		const countResult = await db.query(
			`SELECT COUNT(*) FROM comments WHERE "videoId" = $1 AND "parentCommentId" IS NULL`,
			[videoId]
		);

		const totalItems = parseInt(countResult.rows[0].count, 10);
		const totalPages = Math.ceil(totalItems / parsedLimit);

		if (parsedPage > totalPages && totalPages > 0) {
			return res.json({
				comments: [],
				currentPage: parsedPage,
				totalPages: totalPages,
				totalItems: totalItems,
			});
		}

		const commentsResult = await db.query(
			`
        SELECT
            c.id AS "commentId",
            c."videoId" AS "commentVideoId",
            c.text AS "commentText",
            c."createdAt" AS "commentCreatedAt",
            c."parentCommentId" AS "parentCommentId",
            ch.id AS "channelId",
            ch.name AS "channelName",
            ch.description AS "channelDescription",
            ch."avatarUrl" AS "channelAvatarUrl",
            u_commenter.id AS "commenterUserId",
            u_commenter.username AS "commenterUsername",
            u_commenter."avatarUrl" AS "commenterAvatarUrl",
            COUNT(r.id) AS "repliesCount"
        FROM
            comments c
        JOIN
            channels ch ON c."channelId" = ch.id
        JOIN
            users u_commenter ON ch."userId" = u_commenter.id
        LEFT JOIN
            comments r ON c.id = r."parentCommentId"
        WHERE
            c."videoId" = $1 AND c."parentCommentId" IS NULL
        GROUP BY
            c.id, ch.id, u_commenter.id
        ORDER BY
            c."createdAt" DESC
        LIMIT $2 OFFSET $3;
        `,
			[videoId, parsedLimit, offset]
		);

		const comments = commentsResult.rows.map(row => {
			const channel = {
				id: row.channelId,
				name: row.channelName,
				description: row.channelDescription,
				avatarUrl: row.channelAvatarUrl,
				author: {
					id: row.commenterUserId,
					name: row.commenterUsername,
					avatarUrl: row.commenterAvatarUrl,
				},
			};

			return {
				id: row.commentId,
				videoId: row.commentVideoId,
				text: row.commentText,
				createdAt: row.commentCreatedAt,
				parentCommentId: row.parentCommentId,
				channel: channel,
				repliesCount: parseInt(row.repliesCount, 10),
			};
		});


		res.json({
			comments: comments,
			currentPage: parsedPage,
			totalPages: totalPages,
			totalItems: totalItems,
		});
	}

	async getRepliesByCommentId(req, res) {
		const commentId = parseInt(req.params.commentId);

		if (!commentId) {
			return res.status(400).json({ error: 'Missing required comment id' });
		}

		const repliesResult = await db.query(
			`
				SELECT
					c.id AS "commentId",
					c."videoId" AS "commentVideoId",
					c.text AS "commentText",
					c."createdAt" AS "commentCreatedAt",
					c."parentCommentId" AS "parentCommentId",
					ch.id AS "channelId",
					ch.name AS "channelName",
					ch.description AS "channelDescription",
					ch."avatarUrl" AS "channelAvatarUrl",
					u_commenter.id AS "commenterUserId",
					u_commenter.username AS "commenterUsername",
					u_commenter."avatarUrl" AS "commenterAvatarUrl"
				FROM
					comments c
				JOIN
					channels ch ON c."channelId" = ch.id
				JOIN
					users u_commenter ON ch."userId" = u_commenter.id
				WHERE
					c."parentCommentId" = $1
				ORDER BY
					c."createdAt" DESC;
			`,
			[commentId]
		);

		const replies = repliesResult.rows.map(row => {
			const channel = {
				id: row.channelId,
				name: row.channelName,
				description: row.channelDescription,
				avatarUrl: row.channelAvatarUrl,
				author: {
					id: row.commenterUserId,
					name: row.commenterUsername,
					avatarUrl: row.commenterAvatarUrl,
				},
			};

			return {
				id: row.commentId,
				videoId: row.commentVideoId,
				text: row.commentText,
				createdAt: row.commentCreatedAt,
				parentCommentId: row.parentCommentId,
				channel: channel,
			};
		});

		res.json(replies);
	}

	async createComment(req, res) {
		const { channelId, videoId, text, parentCommentId } = req.body;

		if (!videoId || !text) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		const comment = await db.query(
			`INSERT INTO comments 
				("videoId", text, "channelId", "parentCommentId") 
				VALUES ($1, $2, $3, $4)
			RETURNING *`,
			[videoId, text, channelId, parentCommentId]
		);

		res.status(201).json(comment);
	}
}

export default new CommentController();