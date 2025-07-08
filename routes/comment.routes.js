import express from 'express';
import CommentController from '../controllers/comment.controller.js';
import { handleError } from '../utils/utils.js';

export const router = express.Router();

router.get('/comments/:videoId', handleError(CommentController.getCommentsByVideoId));
router.get('/comments/:commentId/replies', handleError(CommentController.getRepliesByCommentId));
router.post('/comments', handleError(CommentController.createComment));
