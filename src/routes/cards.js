const router = require('express').Router({ mergeParams: true });
const pool = require('../config/db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.*,
       COALESCE(json_agg(DISTINCT jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email)) FILTER (WHERE u.id IS NOT NULL), '[]') AS members
     FROM cards c
     LEFT JOIN card_members cm ON cm.card_id = c.id
     LEFT JOIN users u ON u.id = cm.user_id
     WHERE c.list_id=$1
     GROUP BY c.id
     ORDER BY c.position`,
    [req.params.listId]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ message: 'Title required' });
  const maxPos = await pool.query(
    'SELECT COALESCE(MAX(position),0) AS pos FROM cards WHERE list_id=$1',
    [req.params.listId]
  );
  const { rows } = await pool.query(
    'INSERT INTO cards (title, list_id, position) VALUES ($1,$2,$3) RETURNING *',
    [title, req.params.listId, maxPos.rows[0].pos + 1000]
  );
  res.status(201).json({ ...rows[0], members: [] });
});

router.put('/:id', async (req, res) => {
  const { title, description, deadline, position, list_id } = req.body;
  const { rows } = await pool.query(
    `UPDATE cards SET
       title=COALESCE($1,title),
       description=COALESCE($2,description),
       deadline=COALESCE($3,deadline),
       position=COALESCE($4,position),
       list_id=COALESCE($5,list_id)
     WHERE id=$6 RETURNING *`,
    [title, description, deadline, position, list_id, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Not found' });

  const members = await pool.query(
    `SELECT u.id, u.name, u.email FROM users u
     JOIN card_members cm ON cm.user_id = u.id WHERE cm.card_id=$1`,
    [req.params.id]
  );
  res.json({ ...rows[0], members: members.rows });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM cards WHERE id=$1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// assign/unassign member
router.post('/:id/members', async (req, res) => {
  const { user_id } = req.body;
  await pool.query(
    'INSERT INTO card_members (card_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [req.params.id, user_id]
  );
  res.json({ message: 'Assigned' });
});

router.delete('/:id/members/:userId', async (req, res) => {
  await pool.query('DELETE FROM card_members WHERE card_id=$1 AND user_id=$2', [
    req.params.id, req.params.userId
  ]);
  res.json({ message: 'Unassigned' });
});

module.exports = router;
