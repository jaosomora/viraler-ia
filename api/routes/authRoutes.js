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

// Ruta para verificar estado de autenticación sin middleware
router.get('/status', (req, res) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.json({ isAuthenticated: false });
  }
  
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    res.json({ isAuthenticated: true });
  } catch (error) {
    res.json({ isAuthenticated: false });
  }
});

export default router;