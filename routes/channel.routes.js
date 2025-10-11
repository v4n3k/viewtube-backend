import express from 'express';
import multer from 'multer';
import ChannelController from '../controllers/channel.controller.js';
import { handleError } from '../utils/utils.js';

export const router = express.Router();

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 100 * 1024 * 1024 // 100MB
	}
});

router.get('/channels/:requestedChannelId/by/:requesterChannelId', handleError(ChannelController.getChannelById));
router.get(`/users/:userId/channels`, handleError(ChannelController.getChannelsByUserId));
router.post(
	'/channels',
	upload.fields([
		{ name: 'avatarFile', maxCount: 1 },
		{ name: 'bannerFile', maxCount: 1 }
	]),
	handleError(ChannelController.createChannel)
);
router.get('/channels/select/:channelId', handleError(ChannelController.selectChannel));
router.delete('/channels/:channelId', handleError(ChannelController.deleteChannel));
