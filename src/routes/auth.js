const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Missing fields' });

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(400).json({ message: 'Email already in use' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1,$2,$3) RETURNING id, name, email',
      [name, email, hash]
    );
    const token = jwt.sign({ id: rows[0].id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: rows[0] });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!rows.length) return res.status(400).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: rows[0].id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...user } = rows[0];
    res.json({ token, user });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get('/me', require('../middleware/auth'), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, avatar, created_at FROM users WHERE id=$1', [req.user.id]
  );
  res.json(rows[0]);
});

router.put('/profile', require('../middleware/auth'), async (req, res) => {
  const { name, current_password, new_password } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Name required' });

  try {
    if (new_password) {
      if (!current_password) return res.status(400).json({ message: 'Current password required' });
      const { rows } = await pool.query('SELECT password FROM users WHERE id=$1', [req.user.id]);
      const valid = await bcrypt.compare(current_password, rows[0].password);
      if (!valid) return res.status(400).json({ message: 'Current password incorrect' });
      const hash = await bcrypt.hash(new_password, 10);
      await pool.query('UPDATE users SET name=$1, password=$2 WHERE id=$3', [name.trim(), hash, req.user.id]);
    } else {
      await pool.query('UPDATE users SET name=$1 WHERE id=$2', [name.trim(), req.user.id]);
    }

    const { rows } = await pool.query(
      'SELECT id, name, email, avatar, created_at FROM users WHERE id=$1', [req.user.id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
