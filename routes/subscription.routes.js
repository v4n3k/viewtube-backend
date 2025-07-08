import express from 'express';
import subscriptionController from '../controllers/subscription.controller.js';
import { handleError } from '../utils/utils.js';

export const router = express.Router();

router.get('/subscriptions/:userId',
	handleError(subscriptionController.getSubscriptionsByUserId)
);
