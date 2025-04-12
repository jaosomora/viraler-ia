// api/config/passport.js
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import db from '../database/schema.js';

export const setupPassport = () => {
  // Configurar estrategia de Google
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback',
    scope: ['profile', 'email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Extraer información del perfil de Google
      const googleId = profile.id;
      const email = profile.emails[0].value;
      const name = profile.displayName;
      const picture = profile.photos[0].value;
      
      // Buscar usuario existente
      db.get('SELECT * FROM users WHERE google_id = ?', [googleId], (err, user) => {
        if (err) {
          return done(err);
        }
        
        if (user) {
          // Actualizar último login
          db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
          return done(null, user);
        } else {
          // Crear nuevo usuario
          db.run(
            'INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)',
            [googleId, email, name, picture],
            function(err) {
              if (err) {
                return done(err);
              }
              
              const newUser = {
                id: this.lastID,
                google_id: googleId,
                email,
                name,
                picture
              };
              
              return done(null, newUser);
            }
          );
        }
      });
    } catch (error) {
      return done(error);
    }
  }));

  // Serializar y deserializar usuario
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
      done(err, user);
    });
  });
};