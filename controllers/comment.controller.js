
class CommentController {
	async getCommentsByVideoId(req, res) {
		const { videoId } = req.params;

		if (!videoId) {
			res.status(400).json({ error: 'Missing required video id' });
		}

		const commentsResult = await db.query(
			`SELECT * FROM comments 
				WHERE id = $1 
				ORDER BY "createdAt"`,
			[videoId]
		);
		const comments = commentsResult.rows;

		res.json(comments);
	};

	async createComment(req, res) {
		const { userId, parentCommentId, text } = req.body;

		if (!userId || !parentCommentId || !text) {
			res.status(400).json({ error: 'Missing required fields' });
		}

		const commentResult = await db.query(
			`INSERT INTO comments 
				("userId", "parentCommentId", "text") 
				VALUES ($1, $2, $3)
				RETURNING *`,
			[userId, parentCommentId, text]
		);
		const comment = commentResult.rows;

		res.status(201).json(comment);
	};
}

export default new CommentController();
