import express from 'express';
import ChannelController from '../controllers/channel.controller.js';
import { handleError } from '../utils/utils.js';

export const router = express.Router();

router.get('/channels/:requestedChannelId/by/:requesterChannelId', handleError(ChannelController.getChannelById));

