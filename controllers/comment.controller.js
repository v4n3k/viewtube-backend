import { db } from '../db.js';

class CommentController {
	async getCommentsByVideoId(req, res) {
		const { videoId } = req.params;

		if (!videoId) {
			return res.status(400).json({ error: 'Missing required video id' });
		}


		const commentsResult = await db.query(
			`
        SELECT
            c.id AS "commentId",
            c."videoId" AS "commentVideoId",
            c.text AS "commentText",
            c."createdAt" AS "commentCreatedAt",
            c."parentCommentId" AS "commentParentId",

            u_commenter.id AS "commenterUserId",
            u_commenter.username AS "commenterUsername",
            u_commenter."avatarUrl" AS "commenterAvatarUrl",

            ch.id AS "channelId",
            ch.name AS "channelName",
            ch.description AS "channelDescription",
            ch."avatarUrl" AS "channelAvatarUrl"
        FROM
            comments c
        JOIN
            users u_commenter ON c."userId" = u_commenter.id
        LEFT JOIN
            channels ch ON u_commenter.id = ch."userId"
        WHERE
            c."videoId" = $1
        ORDER BY
            c."createdAt" DESC;
        `,
			[videoId]
		);

		const comments = commentsResult.rows.map(row => {
			const channel = row.channelId ? {
				id: row.channelId,
				name: row.channelName,
				description: row.channelDescription,
				avatarUrl: row.channelAvatarUrl,
				author: {
					id: row.commenterUserId,
					name: row.commenterUsername,
					avatarUrl: row.commenterAvatarUrl,
				},
			} : null;

			return {
				id: row.commentId,
				videoId: row.commentVideoId,
				text: row.commentText,
				createdAt: row.commentCreatedAt,
				parentCommentId: row.commentParentId,
				channel: channel,
			};
		});

		res.json(comments);
	}

	async createComment(req, res) {
		const { videoId, text, parentCommentId } = req.body;

		if (!videoId || !text) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		const comment = await db.query(
			`INSERT INTO comments 
				("videoId", text, "userId", "parentCommentId") 
				VALUES ($1, $2, $3, $4)
			RETURNING *`,
			[videoId, text, req.userId, parentCommentId]
		);

		res.status(201).json(comment);
	}
}

export default new CommentController();