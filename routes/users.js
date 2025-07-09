const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middlewares/auth');
const bcrypt = require('bcrypt');

// 모든 사용자 조회 (Super Admin만)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT id, username, email, role, level, is_verified, user_master_id, created_at
       FROM users 
       ORDER BY created_at DESC`
    );

    res.json({
      users: result.rows
    });
  } catch (err) {
    console.error('사용자 조회 오류:', err);
    res.status(500).json({ error: '사용자 조회에 실패했습니다.' });
  }
});

// 특정 사용자 조회
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    // 권한 확인 (자신의 정보 또는 Super Admin)
    if (parseInt(id) !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT id, username, email, role, level, is_verified, user_master_id, created_at
       FROM users 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    res.json({
      user: result.rows[0]
    });
  } catch (err) {
    console.error('사용자 조회 오류:', err);
    res.status(500).json({ error: '사용자 조회에 실패했습니다.' });
  }
});

// 내 정보 조회
router.get('/me/profile', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, role, level, is_verified, user_master_id, created_at
       FROM users 
       WHERE id = $1`,
      [req.user.id]
    );

    res.json({
      user: result.rows[0]
    });
  } catch (err) {
    console.error('프로필 조회 오류:', err);
    res.status(500).json({ error: '프로필 조회에 실패했습니다.' });
  }
});

// 내 정보 수정
router.put('/me/profile', auth, async (req, res) => {
  const { username, email } = req.body;

  try {
    // 중복 확인
    if (username) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, req.user.id]
      );
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: '이미 존재하는 사용자명입니다.' });
      }
    }

    if (email) {
      const existingEmail = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, req.user.id]
      );
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: '이미 존재하는 이메일입니다.' });
      }
    }

    const result = await pool.query(
      `UPDATE users SET 
        username = COALESCE($1, username),
        email = COALESCE($2, email),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING id, username, email, role, level, is_verified, user_master_id, created_at`,
      [username, email, req.user.id]
    );

    res.json({
      message: '프로필이 성공적으로 수정되었습니다.',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('프로필 수정 오류:', err);
    res.status(500).json({ error: '프로필 수정에 실패했습니다.' });
  }
});

// 비밀번호 변경
router.put('/me/password', auth, async (req, res) => {
  const { current_password, new_password } = req.body;

  try {
    // 현재 비밀번호 확인
    const userCheck = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [req.user.id]
    );

    const match = await bcrypt.compare(current_password, userCheck.rows[0].password);
    if (!match) {
      return res.status(400).json({ error: '현재 비밀번호가 일치하지 않습니다.' });
    }

    // 새 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(new_password, 10);

    await pool.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({
      message: '비밀번호가 성공적으로 변경되었습니다.'
    });
  } catch (err) {
    console.error('비밀번호 변경 오류:', err);
    res.status(500).json({ error: '비밀번호 변경에 실패했습니다.' });
  }
});

// 사용자 수정 (Super Admin만)
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { username, email, role, level, user_master_id } = req.body;

  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '수정 권한이 없습니다.' });
    }

    // 중복 확인
    if (username) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, id]
      );
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: '이미 존재하는 사용자명입니다.' });
      }
    }

    if (email) {
      const existingEmail = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: '이미 존재하는 이메일입니다.' });
      }
    }

    const result = await pool.query(
      `UPDATE users SET 
        username = COALESCE($1, username),
        email = COALESCE($2, email),
        role = COALESCE($3, role),
        level = COALESCE($4, level),
        user_master_id = COALESCE($5, user_master_id),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING id, username, email, role, level, is_verified, user_master_id, created_at`,
      [username, email, role, level, user_master_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    res.json({
      message: '사용자 정보가 성공적으로 수정되었습니다.',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('사용자 수정 오류:', err);
    res.status(500).json({ error: '사용자 수정에 실패했습니다.' });
  }
});

// 사용자 삭제 (Super Admin만)
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }

    // 자신을 삭제하려는 경우 방지
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: '자신의 계정을 삭제할 수 없습니다.' });
    }

    // 연관된 데이터 확인
    const [projectCheck, ticketCheck, commentCheck] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM projects WHERE owner_id = $1', [id]),
      pool.query('SELECT COUNT(*) FROM tickets WHERE creator_id = $1 OR assigned_engineer_id = $1', [id]),
      pool.query('SELECT COUNT(*) FROM comments WHERE author_id = $1', [id])
    ]);

    if (parseInt(projectCheck.rows[0].count) > 0 || 
        parseInt(ticketCheck.rows[0].count) > 0 || 
        parseInt(commentCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: '연관된 데이터가 있어 삭제할 수 없습니다.' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({
      message: '사용자가 성공적으로 삭제되었습니다.'
    });
  } catch (err) {
    console.error('사용자 삭제 오류:', err);
    res.status(500).json({ error: '사용자 삭제에 실패했습니다.' });
  }
});

// Engineer 목록 조회 (Super Admin만)
router.get('/engineers/list', auth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT id, username, email, level, is_verified
       FROM users 
       WHERE role = 'engineer' AND is_verified = TRUE
       ORDER BY username`
    );

    res.json({
      engineers: result.rows
    });
  } catch (err) {
    console.error('Engineer 목록 조회 오류:', err);
    res.status(500).json({ error: 'Engineer 목록 조회에 실패했습니다.' });
  }
});

// User Master별 소속 User 목록 조회
router.get('/user-master/:userMasterId/users', auth, async (req, res) => {
  const { userMasterId } = req.params;

  try {
    // 권한 확인 (User Master는 자신의 소속 User만, Super Admin은 모든 User)
    if (parseInt(userMasterId) !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT id, username, email, role, level, is_verified, created_at
       FROM users 
       WHERE user_master_id = $1
       ORDER BY created_at DESC`,
      [userMasterId]
    );

    res.json({
      users: result.rows
    });
  } catch (err) {
    console.error('소속 User 목록 조회 오류:', err);
    res.status(500).json({ error: '소속 User 목록 조회에 실패했습니다.' });
  }
});

module.exports = router; 