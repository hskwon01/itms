const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middlewares/auth');

// 티켓 번호 생성 함수
const generateTicketNumber = async (projectCode) => {
  const result = await pool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM LENGTH($1) + 6) AS INTEGER)), 0) + 1 as next_sequence
     FROM tickets t
     JOIN projects p ON t.project_id = p.id
     WHERE p.code = $1`,
    [projectCode]
  );
  
  const nextSequence = result.rows[0].next_sequence;
  return `BITM-${projectCode}-${nextSequence.toString().padStart(4, '0')}`;
};

// 티켓 생성
router.post('/', auth, async (req, res) => {
  const {
    project_id,
    title,
    issue_type,
    severity,
    description,
    product_name,
    product_version,
    os_info,
    fix_level,
    requested_end_date
  } = req.body;
  
  const creator_id = req.user.id;

  try {
    // 프로젝트 존재 및 권한 확인
    const projectCheck = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [project_id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    }

    const project = projectCheck.rows[0];
    if (project.owner_id !== req.user.id && req.user.role === 'user') {
      return res.status(403).json({ error: '프로젝트에 티켓을 생성할 권한이 없습니다.' });
    }

    // 티켓 번호 생성
    const ticketNumber = await generateTicketNumber(project.code);

    const result = await pool.query(
      `INSERT INTO tickets (
        ticket_number, project_id, creator_id, title, issue_type, severity, 
        description, product_name, product_version, os_info, fix_level, 
        requested_end_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        ticketNumber, project_id, creator_id, title, issue_type, severity,
        description, product_name, product_version, os_info, fix_level,
        requested_end_date
      ]
    );

    res.json({
      message: '티켓이 성공적으로 생성되었습니다.',
      ticket: result.rows[0]
    });
  } catch (err) {
    console.error('티켓 생성 오류:', err);
    res.status(500).json({ error: '티켓 생성에 실패했습니다.' });
  }
});

// 내 티켓 목록 조회
router.get('/my', auth, async (req, res) => {
  try {
    let query;
    let params = [req.user.id];

    if (req.user.role === 'engineer') {
      // Engineer: 배정된 티켓 조회
      query = `
        SELECT t.*, p.name as project_name, p.code as project_code,
               c.username as creator_name, a.username as assigned_engineer_name
        FROM tickets t
        JOIN projects p ON t.project_id = p.id
        JOIN users c ON t.creator_id = c.id
        LEFT JOIN users a ON t.assigned_engineer_id = a.id
        WHERE t.assigned_engineer_id = $1
        ORDER BY t.created_at DESC
      `;
    } else {
      // User: 내가 생성한 티켓 조회
      query = `
        SELECT t.*, p.name as project_name, p.code as project_code,
               c.username as creator_name, a.username as assigned_engineer_name
        FROM tickets t
        JOIN projects p ON t.project_id = p.id
        JOIN users c ON t.creator_id = c.id
        LEFT JOIN users a ON t.assigned_engineer_id = a.id
        WHERE t.creator_id = $1
        ORDER BY t.created_at DESC
      `;
    }

    const result = await pool.query(query, params);

    res.json({
      tickets: result.rows
    });
  } catch (err) {
    console.error('티켓 조회 오류:', err);
    res.status(500).json({ error: '티켓 조회에 실패했습니다.' });
  }
});

// 모든 티켓 조회 (Super Admin, Engineer만)
router.get('/', auth, async (req, res) => {
  try {
    if (!['super_admin', 'engineer'].includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT t.*, p.name as project_name, p.code as project_code,
               c.username as creator_name, a.username as assigned_engineer_name
        FROM tickets t
        JOIN projects p ON t.project_id = p.id
        JOIN users c ON t.creator_id = c.id
        LEFT JOIN users a ON t.assigned_engineer_id = a.id
        ORDER BY t.created_at DESC`
    );

    res.json({
      tickets: result.rows
    });
  } catch (err) {
    console.error('티켓 조회 오류:', err);
    res.status(500).json({ error: '티켓 조회에 실패했습니다.' });
  }
});

// 특정 티켓 조회
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT t.*, p.name as project_name, p.code as project_code,
               c.username as creator_name, a.username as assigned_engineer_name
        FROM tickets t
        JOIN projects p ON t.project_id = p.id
        JOIN users c ON t.creator_id = c.id
        LEFT JOIN users a ON t.assigned_engineer_id = a.id
        WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '티켓을 찾을 수 없습니다.' });
    }

    const ticket = result.rows[0];
    
    // 권한 확인
    if (ticket.creator_id !== req.user.id && 
        ticket.assigned_engineer_id !== req.user.id &&
        !['super_admin', 'engineer'].includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    res.json({
      ticket: ticket
    });
  } catch (err) {
    console.error('티켓 조회 오류:', err);
    res.status(500).json({ error: '티켓 조회에 실패했습니다.' });
  }
});

// 티켓 상태 변경
router.put('/:id/status', auth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    // 티켓 존재 및 권한 확인
    const ticketCheck = await pool.query(
      'SELECT * FROM tickets WHERE id = $1',
      [id]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({ error: '티켓을 찾을 수 없습니다.' });
    }

    const ticket = ticketCheck.rows[0];
    
    // 권한 확인
    if (ticket.assigned_engineer_id !== req.user.id && 
        req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '상태 변경 권한이 없습니다.' });
    }

    // 상태 변경 로직
    let updateQuery = 'UPDATE tickets SET status = $1, updated_at = CURRENT_TIMESTAMP';
    let params = [status];

    if (status === 'complete') {
      updateQuery += ', actual_end_date = CURRENT_DATE';
    }

    updateQuery += ' WHERE id = $2 RETURNING *';
    params.push(id);

    const result = await pool.query(updateQuery, params);

    res.json({
      message: '티켓 상태가 성공적으로 변경되었습니다.',
      ticket: result.rows[0]
    });
  } catch (err) {
    console.error('티켓 상태 변경 오류:', err);
    res.status(500).json({ error: '티켓 상태 변경에 실패했습니다.' });
  }
});

// Engineer 배정 (Super Admin만)
router.put('/:id/assign', auth, async (req, res) => {
  const { id } = req.params;
  const { engineer_id } = req.body;

  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Engineer 배정 권한이 없습니다.' });
    }

    // Engineer 권한 확인
    const engineerCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND role = $2',
      [engineer_id, 'engineer']
    );

    if (engineerCheck.rows.length === 0) {
      return res.status(400).json({ error: '유효하지 않은 Engineer입니다.' });
    }

    const result = await pool.query(
      'UPDATE tickets SET assigned_engineer_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [engineer_id, 'assigned', id]
    );

    res.json({
      message: 'Engineer가 성공적으로 배정되었습니다.',
      ticket: result.rows[0]
    });
  } catch (err) {
    console.error('Engineer 배정 오류:', err);
    res.status(500).json({ error: 'Engineer 배정에 실패했습니다.' });
  }
});

// 티켓 승인 (User Master, Super Admin)
router.put('/:id/approve', auth, async (req, res) => {
  const { id } = req.params;
  const { approval_type } = req.body; // 'user_master' or 'super_admin'

  try {
    if (!['user_master', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: '승인 권한이 없습니다.' });
    }

    let updateQuery = 'UPDATE tickets SET ';
    let params = [];

    if (approval_type === 'user_master' && req.user.role === 'user_master') {
      updateQuery += 'is_approved_by_user_master = TRUE, ';
    } else if (approval_type === 'super_admin' && req.user.role === 'super_admin') {
      updateQuery += 'is_approved_by_super_admin = TRUE, ';
    } else {
      return res.status(403).json({ error: '해당 승인 권한이 없습니다.' });
    }

    updateQuery += 'updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *';
    params.push(id);

    const result = await pool.query(updateQuery, params);

    res.json({
      message: '티켓이 성공적으로 승인되었습니다.',
      ticket: result.rows[0]
    });
  } catch (err) {
    console.error('티켓 승인 오류:', err);
    res.status(500).json({ error: '티켓 승인에 실패했습니다.' });
  }
});

module.exports = router; 