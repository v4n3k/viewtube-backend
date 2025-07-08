import express from 'express';
import VideoController from '../controllers/video.controller.js';
import { handleError } from '../utils/utils.js';

export const router = express.Router();

router.get('/videos', handleError(VideoController.getRecommendedVideos));
router.get('/videos/:id', handleError(VideoController.getVideoById));
