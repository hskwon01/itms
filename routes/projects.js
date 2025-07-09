const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middlewares/auth');

// 프로젝트 생성
router.post('/', auth, async (req, res) => {
  const { name, description, code } = req.body;
  const owner_id = req.user.id;

  try {
    // 프로젝트 코드 중복 확인
    const existingProject = await pool.query(
      'SELECT * FROM projects WHERE code = $1',
      [code]
    );

    if (existingProject.rows.length > 0) {
      return res.status(400).json({ error: '이미 존재하는 프로젝트 코드입니다.' });
    }

    const result = await pool.query(
      'INSERT INTO projects (name, description, code, owner_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, code, owner_id]
    );

    res.json({
      message: '프로젝트가 성공적으로 생성되었습니다.',
      project: result.rows[0]
    });
  } catch (err) {
    console.error('프로젝트 생성 오류:', err);
    res.status(500).json({ error: '프로젝트 생성에 실패했습니다.' });
  }
});

// 내 프로젝트 목록 조회
router.get('/my', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE owner_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({
      projects: result.rows
    });
  } catch (err) {
    console.error('프로젝트 조회 오류:', err);
    res.status(500).json({ error: '프로젝트 조회에 실패했습니다.' });
  }
});

// 모든 프로젝트 조회 (Super Admin, Engineer만)
router.get('/', auth, async (req, res) => {
  try {
    if (!['super_admin', 'engineer'].includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT p.*, u.username as owner_name 
       FROM projects p 
       JOIN users u ON p.owner_id = u.id 
       ORDER BY p.created_at DESC`
    );

    res.json({
      projects: result.rows
    });
  } catch (err) {
    console.error('프로젝트 조회 오류:', err);
    res.status(500).json({ error: '프로젝트 조회에 실패했습니다.' });
  }
});

// 특정 프로젝트 조회
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT p.*, u.username as owner_name,
              (SELECT COUNT(*) FROM tickets WHERE project_id = p.id) as ticket_count
       FROM projects p 
       JOIN users u ON p.owner_id = u.id 
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    }

    // 권한 확인 (소유자, Super Admin, Engineer만 접근 가능)
    const project = result.rows[0];
    if (project.owner_id !== req.user.id && 
        !['super_admin', 'engineer'].includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    res.json({
      project: project
    });
  } catch (err) {
    console.error('프로젝트 조회 오류:', err);
    res.status(500).json({ error: '프로젝트 조회에 실패했습니다.' });
  }
});

// 프로젝트 수정
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { name, description, status } = req.body;

  try {
    // 프로젝트 존재 및 권한 확인
    const projectCheck = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    }

    const project = projectCheck.rows[0];
    if (project.owner_id !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '수정 권한이 없습니다.' });
    }

    const result = await pool.query(
      'UPDATE projects SET name = $1, description = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [name, description, status, id]
    );

    res.json({
      message: '프로젝트가 성공적으로 수정되었습니다.',
      project: result.rows[0]
    });
  } catch (err) {
    console.error('프로젝트 수정 오류:', err);
    res.status(500).json({ error: '프로젝트 수정에 실패했습니다.' });
  }
});

// 프로젝트 삭제
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    // 프로젝트 존재 및 권한 확인
    const projectCheck = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    }

    const project = projectCheck.rows[0];
    if (project.owner_id !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }

    // 연관된 티켓이 있는지 확인
    const ticketCheck = await pool.query(
      'SELECT COUNT(*) FROM tickets WHERE project_id = $1',
      [id]
    );

    if (parseInt(ticketCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: '연관된 티켓이 있어 삭제할 수 없습니다.' });
    }

    await pool.query('DELETE FROM projects WHERE id = $1', [id]);

    res.json({
      message: '프로젝트가 성공적으로 삭제되었습니다.'
    });
  } catch (err) {
    console.error('프로젝트 삭제 오류:', err);
    res.status(500).json({ error: '프로젝트 삭제에 실패했습니다.' });
  }
});

module.exports = router; 