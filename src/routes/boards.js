const router = require('express').Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

router.use(auth);

// list boards where user is owner or member
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT b.* FROM boards b
     LEFT JOIN board_members bm ON bm.board_id = b.id
     WHERE b.owner_id=$1 OR bm.user_id=$1
     ORDER BY b.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { title, description, background } = req.body;
  if (!title) return res.status(400).json({ message: 'Title required' });
  const { rows } = await pool.query(
    'INSERT INTO boards (title, description, background, owner_id) VALUES ($1,$2,$3,$4) RETURNING *',
    [title, description || '', background || '#0052cc', req.user.id]
  );
  await pool.query('INSERT INTO board_members (board_id, user_id, role) VALUES ($1,$2,$3)', [
    rows[0].id, req.user.id, 'owner'
  ]);
  res.status(201).json(rows[0]);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.*,
       json_agg(DISTINCT jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email, 'role', bm.role)) AS members
     FROM boards b
     JOIN board_members bm ON bm.board_id = b.id
     JOIN users u ON u.id = bm.user_id
     WHERE b.id=$1
     GROUP BY b.id`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Not found' });
  res.json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { title, description, background } = req.body;
  const { rows } = await pool.query(
    'UPDATE boards SET title=COALESCE($1,title), description=COALESCE($2,description), background=COALESCE($3,background) WHERE id=$4 AND owner_id=$5 RETURNING *',
    [title, description, background, req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(403).json({ message: 'Forbidden' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM boards WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.id]);
  res.json({ message: 'Deleted' });
});

// invite member by email
router.post('/:id/members', async (req, res) => {
  const { email } = req.body;
  const user = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
  if (!user.rows.length) return res.status(404).json({ message: 'User not found' });
  await pool.query(
    'INSERT INTO board_members (board_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [req.params.id, user.rows[0].id]
  );
  res.json({ message: 'Member added' });
});

module.exports = router;
