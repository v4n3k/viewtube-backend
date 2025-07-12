import express from 'express';
import VideoController from '../controllers/video.controller.js';
import { handleError } from '../utils/utils.js';

export const router = express.Router();

router.get('/videos', handleError(VideoController.getRecommendedVideos));
router.get('/videos/:id', handleError(VideoController.getVideoById));
router.get('/channels/:channelId/videos', handleError(VideoController.getVideosByChannelId));
router.get('/channels/:channelId/watchLater', handleError(VideoController.getWatchLaterVideosByChannelId));
router.get('/channels/:channelId/history', handleError(VideoController.getHistoryVideosByChannelId));
router.get('/channels/:channelId/liked', handleError(VideoController.getLikedVideosByChannelId));
router.get('/channels/:channelId/subscribed', handleError(VideoController.getSubscribedVideosByChannelIds));
router.post('/channels/:channelId/watchLater/:videoId', handleError(VideoController.addToWatchLater));
router.delete('/channels/:channelId/watchLater/:videoId', handleError(VideoController.deleteFromWatchLater));
router.post('/channels/:channelId/like/:videoId', handleError(VideoController.likeVideo));
router.delete('/channels/:channelId/unlike/:videoId', handleError(VideoController.unlikeVideo));
router.post('/channels/:channelId/dislike/:videoId', handleError(VideoController.dislikeVideo));
router.delete('/channels/:channelId/undislike/:videoId', handleError(VideoController.undislikeVideo));
