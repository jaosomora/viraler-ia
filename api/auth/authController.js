// api/auth/authController.js
import jwt from 'jsonwebtoken';
import db from '../database/schema.js';

// Generar token JWT después de autenticación exitosa
export const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Callback después de autenticación con Google
export const googleCallback = (req, res) => {
  try {
    // En este punto, Passport ya ha autenticado al usuario y lo ha agregado a req.user
    const user = req.user;
    
    // Generar token JWT
    const token = generateToken(user);
    
    // Establecer cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    });
    
    // Redirigir al frontend
    res.redirect('/auth/success');
  } catch (error) {
    res.redirect('/auth/error');
  }
};

// Verificar estado de autenticación
export const checkAuth = (req, res) => {
  res.json({ 
    isAuthenticated: true, 
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      picture: req.user.picture
    }
  });
};

// Cerrar sesión
export const logout = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Sesión cerrada correctamente' });
};

// Obtener perfil del usuario
export const getUserProfile = (req, res) => {
  const userId = req.user.id;
  
  db.get('SELECT id, email, name, picture, created_at FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener perfil' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ user });
  });
};
