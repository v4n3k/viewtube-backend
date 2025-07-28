import express from 'express';
import subscriptionController from '../controllers/subscription.controller.js';
import { handleError } from '../utils/utils.js';

export const router = express.Router();

router.post('/subscriptions', handleError(subscriptionController.createSubscription));
router.delete('/subscriptions', handleError(subscriptionController.deleteSubscription));