import express from 'express';
import AuthController from '../controllers/auth.controller.js';
import { handleError } from '../utils/utils.js';

export const router = express.Router();

router.post('/auth/sign_up', handleError(AuthController.signUp));
router.post('/auth/sign_in', handleError(AuthController.signIn));
router.post('/auth/sign_out', handleError(AuthController.signOut));
router.get('/auth/check_token', handleError(AuthController.checkIsAuth));
