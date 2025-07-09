const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middlewares/auth');

// 티켓의 댓글 목록 조회
router.get('/ticket/:ticketId', auth, async (req, res) => {
  const { ticketId } = req.params;

  try {
    // 티켓 접근 권한 확인
    const ticketCheck = await pool.query(
      'SELECT * FROM tickets WHERE id = $1',
      [ticketId]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({ error: '티켓을 찾을 수 없습니다.' });
    }

    const ticket = ticketCheck.rows[0];
    
    // 권한 확인
    if (ticket.creator_id !== req.user.id && 
        ticket.assigned_engineer_id !== req.user.id &&
        !['super_admin', 'engineer'].includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT c.*, u.username as author_name
       FROM comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.ticket_id = $1
       ORDER BY c.created_at ASC`,
      [ticketId]
    );

    res.json({
      comments: result.rows
    });
  } catch (err) {
    console.error('댓글 조회 오류:', err);
    res.status(500).json({ error: '댓글 조회에 실패했습니다.' });
  }
});

// 댓글 작성
router.post('/', auth, async (req, res) => {
  const { ticket_id, content, attachment_name } = req.body;
  const author_id = req.user.id;

  try {
    // 티켓 존재 및 권한 확인
    const ticketCheck = await pool.query(
      'SELECT * FROM tickets WHERE id = $1',
      [ticket_id]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({ error: '티켓을 찾을 수 없습니다.' });
    }

    const ticket = ticketCheck.rows[0];
    
    // 권한 확인 (티켓 생성자, 배정된 엔지니어, Super Admin, Engineer만)
    if (ticket.creator_id !== req.user.id && 
        ticket.assigned_engineer_id !== req.user.id &&
        !['super_admin', 'engineer'].includes(req.user.role)) {
      return res.status(403).json({ error: '댓글 작성 권한이 없습니다.' });
    }

    // 첨부파일 경로 (실제 구현시 파일 업로드 로직 필요)
    const attachment_path = attachment_name ? `/uploads/${Date.now()}_${attachment_name}` : null;

    const result = await pool.query(
      'INSERT INTO comments (ticket_id, author_id, content, attachment_path, attachment_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [ticket_id, author_id, content, attachment_path, attachment_name]
    );

    // 작성된 댓글 정보 조회
    const commentWithAuthor = await pool.query(
      `SELECT c.*, u.username as author_name
       FROM comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.id = $1`,
      [result.rows[0].id]
    );

    res.json({
      message: '댓글이 성공적으로 작성되었습니다.',
      comment: commentWithAuthor.rows[0]
    });
  } catch (err) {
    console.error('댓글 작성 오류:', err);
    res.status(500).json({ error: '댓글 작성에 실패했습니다.' });
  }
});

// 댓글 수정
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  try {
    // 댓글 존재 및 권한 확인
    const commentCheck = await pool.query(
      'SELECT * FROM comments WHERE id = $1',
      [id]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
    }

    const comment = commentCheck.rows[0];
    
    // 권한 확인 (작성자만 수정 가능)
    if (comment.author_id !== req.user.id) {
      return res.status(403).json({ error: '댓글 수정 권한이 없습니다.' });
    }

    const result = await pool.query(
      'UPDATE comments SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [content, id]
    );

    res.json({
      message: '댓글이 성공적으로 수정되었습니다.',
      comment: result.rows[0]
    });
  } catch (err) {
    console.error('댓글 수정 오류:', err);
    res.status(500).json({ error: '댓글 수정에 실패했습니다.' });
  }
});

// 댓글 삭제
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    // 댓글 존재 및 권한 확인
    const commentCheck = await pool.query(
      'SELECT * FROM comments WHERE id = $1',
      [id]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
    }

    const comment = commentCheck.rows[0];
    
    // 권한 확인 (작성자, Super Admin만 삭제 가능)
    if (comment.author_id !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '댓글 삭제 권한이 없습니다.' });
    }

    await pool.query('DELETE FROM comments WHERE id = $1', [id]);

    res.json({
      message: '댓글이 성공적으로 삭제되었습니다.'
    });
  } catch (err) {
    console.error('댓글 삭제 오류:', err);
    res.status(500).json({ error: '댓글 삭제에 실패했습니다.' });
  }
});

module.exports = router; 