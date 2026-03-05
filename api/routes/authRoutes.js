// api/routes/authRoutes.js
import express from 'express';
import passport from 'passport';
import { googleCallback, checkAuth, logout, getUserProfile } from '../auth/authController.js';
import { authMiddleware } from '../auth/authMiddleware.js';

const router = express.Router();

// Rutas de autenticación con Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false }), googleCallback);

// Rutas protegidas
router.get('/me', authMiddleware, getUserProfile);
router.get('/check', authMiddleware, checkAuth);
router.post('/logout', authMiddleware, logout);

export default router;
