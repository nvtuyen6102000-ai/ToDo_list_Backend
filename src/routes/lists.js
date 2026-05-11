const router = require('express').Router({ mergeParams: true });
const pool = require('../config/db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM lists WHERE board_id=$1 ORDER BY position',
    [req.params.boardId]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ message: 'Title required' });
  const maxPos = await pool.query(
    'SELECT COALESCE(MAX(position),0) AS pos FROM lists WHERE board_id=$1',
    [req.params.boardId]
  );
  const { rows } = await pool.query(
    'INSERT INTO lists (title, board_id, position) VALUES ($1,$2,$3) RETURNING *',
    [title, req.params.boardId, maxPos.rows[0].pos + 1000]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { title, position } = req.body;
  const { rows } = await pool.query(
    'UPDATE lists SET title=COALESCE($1,title), position=COALESCE($2,position) WHERE id=$3 AND board_id=$4 RETURNING *',
    [title, position, req.params.id, req.params.boardId]
  );
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM lists WHERE id=$1 AND board_id=$2', [req.params.id, req.params.boardId]);
  res.json({ message: 'Deleted' });
});

module.exports = router;
