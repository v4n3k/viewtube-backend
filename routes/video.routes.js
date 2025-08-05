import express from 'express';
import { default as VideoController } from '../controllers/video.controller.js';
import { handleError } from '../utils/utils.js';

export const router = express.Router();

router.get('/videos', handleError(VideoController.getRecommendedVideos));
router.get('/channels/:channelId/videos/:videoId', handleError(VideoController.getVideoById));
router.get('/channels/:channelId/videos', handleError(VideoController.getVideosByChannelId));
router.get('/channels/:channelId/watchLater', handleError(VideoController.getWatchLaterVideosByChannelId));
router.get('/channels/:channelId/history', handleError(VideoController.getHistoryVideosByChannelId));
router.get('/channels/:channelId/liked', handleError(VideoController.getLikedVideosByChannelId));
router.get('/channels/:channelId/subscribed', handleError(VideoController.getSubscribedVideosByChannelIds));
router.post('/channels/:channelId/videos/:videoId/watchLater', handleError(VideoController.addToWatchLater));
router.delete('/channels/:channelId/videos/:videoId/watchLater', handleError(VideoController.deleteFromWatchLater));
router.post('/channels/:channelId/videos/:videoId/like', handleError(VideoController.likeVideo));
router.delete('/channels/:channelId/videos/:videoId/unlike', handleError(VideoController.unlikeVideo));
router.post('/channels/:channelId/videos/:videoId/dislike', handleError(VideoController.dislikeVideo));
router.delete('/channels/:channelId/videos/:videoId/undislike', handleError(VideoController.undislikeVideo));
