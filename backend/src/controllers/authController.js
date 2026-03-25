const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

function generateTokens(payload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const result = await pool.query(
      `SELECT u.*, l.nombre as local_nombre, l.logo_url as local_logo
       FROM users u
       LEFT JOIN locals l ON l.id = u.local_id
       WHERE u.email = $1 AND u.activo = TRUE`,
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const payload = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      role: user.role,
      local_id: user.local_id,
      local_nombre: user.local_nombre,
      local_logo: user.local_logo,
    };

    const { accessToken, refreshToken } = generateTokens(payload);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken, user: payload });
  } catch (err) { next(err); }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'Refresh token no encontrado' });

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const result = await pool.query(
      `SELECT u.*, l.nombre as local_nombre, l.logo_url as local_logo
       FROM users u LEFT JOIN locals l ON l.id = u.local_id
       WHERE u.id = $1 AND u.activo = TRUE`,
      [payload.id]
    );
    if (!result.rows[0]) return res.status(401).json({ error: 'Usuario no encontrado' });

    const user = result.rows[0];
    const newPayload = {
      id: user.id, nombre: user.nombre, email: user.email, role: user.role,
      local_id: user.local_id, local_nombre: user.local_nombre, local_logo: user.local_logo,
    };

    const { accessToken, refreshToken: newRefresh } = generateTokens(newPayload);

    res.cookie('refreshToken', newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken, user: newPayload });
  } catch {
    res.status(401).json({ error: 'Refresh token inválido' });
  }
}

function logout(req, res) {
  res.clearCookie('refreshToken');
  res.json({ message: 'Sesión cerrada correctamente' });
}

module.exports = { login, refresh, logout };
