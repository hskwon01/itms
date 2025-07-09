const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middlewares/auth');

// 내 알림 목록 조회
router.get('/my', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*, 
              CASE 
                WHEN n.ticket_id IS NOT NULL THEN t.ticket_number
                WHEN n.project_id IS NOT NULL THEN p.name
                ELSE NULL
              END as related_item_name
       FROM notifications n
       LEFT JOIN tickets t ON n.ticket_id = t.id
       LEFT JOIN projects p ON n.project_id = p.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json({
      notifications: result.rows
    });
  } catch (err) {
    console.error('알림 조회 오류:', err);
    res.status(500).json({ error: '알림 조회에 실패했습니다.' });
  }
});

// 읽지 않은 알림 개수 조회
router.get('/unread-count', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );

    res.json({
      unreadCount: parseInt(result.rows[0].count)
    });
  } catch (err) {
    console.error('읽지 않은 알림 개수 조회 오류:', err);
    res.status(500).json({ error: '읽지 않은 알림 개수 조회에 실패했습니다.' });
  }
});

// 알림 읽음 처리
router.put('/:id/read', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
    }

    res.json({
      message: '알림이 읽음 처리되었습니다.',
      notification: result.rows[0]
    });
  } catch (err) {
    console.error('알림 읽음 처리 오류:', err);
    res.status(500).json({ error: '알림 읽음 처리에 실패했습니다.' });
  }
});

// 모든 알림 읽음 처리
router.put('/read-all', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );

    res.json({
      message: '모든 알림이 읽음 처리되었습니다.'
    });
  } catch (err) {
    console.error('모든 알림 읽음 처리 오류:', err);
    res.status(500).json({ error: '모든 알림 읽음 처리에 실패했습니다.' });
  }
});

// 알림 삭제
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
    }

    res.json({
      message: '알림이 성공적으로 삭제되었습니다.'
    });
  } catch (err) {
    console.error('알림 삭제 오류:', err);
    res.status(500).json({ error: '알림 삭제에 실패했습니다.' });
  }
});

// 모든 알림 삭제
router.delete('/delete-all', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM notifications WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      message: '모든 알림이 성공적으로 삭제되었습니다.'
    });
  } catch (err) {
    console.error('모든 알림 삭제 오류:', err);
    res.status(500).json({ error: '모든 알림 삭제에 실패했습니다.' });
  }
});

module.exports = router; 