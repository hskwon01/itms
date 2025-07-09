require('dotenv').config();

const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// 회원가입
router.post('/register', async (req, res) => {
  const { username, password, email, role, level, user_master_username } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);
    const verificationToken = Math.random().toString(36).substring(2, 15);

    let userMasterId = null;
    let finalRole = role || 'user';
    let finalLevel = level || 1;

    // User Master 계정인 경우 Super Admin 승인 필요
    if (finalRole === 'user_master') {
      finalLevel = 2; // User Master는 기본적으로 level 2
    }

    // User 계정인 경우 User Master 승인 필요
    if (finalRole === 'user' && user_master_username) {
      // User Master 계정 찾기
      const userMasterResult = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND role = $2 AND is_verified = TRUE AND is_approved_by_super_admin = TRUE',
        [user_master_username, 'user_master']
      );
      
      if (userMasterResult.rowCount === 0) {
        return res.status(400).json({ error: '존재하지 않거나 승인되지 않은 User Master 계정입니다.' });
      }
      
      userMasterId = userMasterResult.rows[0].id;
    }

    const result = await pool.query(
      `INSERT INTO users (
        username, password, email, role, level, verification_token, 
        user_master_id, is_approved_by_user_master, is_approved_by_super_admin
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        username, hashed, email, finalRole, finalLevel, verificationToken,
        userMasterId, 
        finalRole === 'user' ? false : true, // user는 user_master 승인 필요
        finalRole === 'user_master' ? false : true // user_master는 super_admin 승인 필요
      ]
    );

    
    // 이메일 발송
    // (실제 환경에선 .env에 메일 계정 정보 필요)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
 
    const mailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: 'ITMS 이메일 인증',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">ITMS 이메일 인증</h2>
          <p style="color: #666; line-height: 1.6;">안녕하세요! ITMS 회원가입을 완료하기 위해 이메일 인증이 필요합니다.</p>
          <p style="color: #666; line-height: 1.6;">아래 버튼을 클릭하여 이메일 인증을 완료해주세요.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:3000/api/auth/verify?token=${verificationToken}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              이메일 인증하기
            </a>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            버튼이 작동하지 않는 경우, 아래 링크를 복사하여 브라우저에 붙여넣기 하세요:<br>
            <a href="http://localhost:3000/api/auth/verify?token=${verificationToken}" style="color: #007bff;">
              http://localhost:3000/api/auth/verify?token=${verificationToken}
            </a>
          </p>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);

    res.json({ message: '회원가입 성공! 이메일을 확인하세요.' });
  } catch (err) {
    res.status(400).json({ error: '회원가입 실패 ( 이메일 중복 ) ', detail: err.message });
  }
});

// 이메일 인증
router.get('/verify', async (req, res) => {
  const { token } = req.query;
  try {
    const result = await pool.query(
      'UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING *',
      [token]
    );
    if (result.rowCount === 0) return res.status(400).send('잘못된 토큰입니다.');
    res.send('이메일 인증 완료! 이제 로그인하세요.');
  } catch (err) {
    res.status(400).json({ error: '이메일 인증 실패', detail: err.message });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rowCount === 0) return res.status(400).json({ error: '존재하지 않는 사용자' });
    const user = result.rows[0];
    if (!user.is_verified) return res.status(400).json({ error: '이메일 인증 필요' });
    
    // 승인 상태 확인
    if (user.role === 'user_master' && !user.is_approved_by_super_admin) {
      return res.status(400).json({ error: 'Super Admin의 승인이 필요합니다.' });
    }
    if (user.role === 'user' && !user.is_approved_by_user_master) {
      return res.status(400).json({ error: 'User Master의 승인이 필요합니다.' });
    }
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: '비밀번호 불일치' });
    const token = jwt.sign({ id: user.id, role: user.role, level: user.level }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, level: user.level } });
  } catch (err) {
    res.status(400).json({ error: '로그인 실패', detail: err.message });
  }
});

// 현재 사용자 정보 조회
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query('SELECT id, username, email, role, level, is_verified FROM users WHERE id = $1', [decoded.id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const user = result.rows[0];
    res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role, level: user.level, is_verified: user.is_verified } });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '토큰이 만료되었습니다.' });
    }
    res.status(500).json({ error: '사용자 정보 조회 실패', detail: err.message });
  }
});

// Super Admin이 User Master 승인
router.post('/approve-user-master/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Super Admin 권한 확인
    const adminResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [decoded.id]
    );
    
    if (adminResult.rowCount === 0 || adminResult.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Super Admin 권한이 필요합니다.' });
    }

    // User Master 승인
    const result = await pool.query(
      `UPDATE users 
       SET is_approved_by_super_admin = TRUE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND role = 'user_master' AND is_verified = TRUE 
       RETURNING id, username, email, role`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: '승인할 User Master를 찾을 수 없습니다.' });
    }

    res.json({ 
      message: 'User Master 승인이 완료되었습니다.',
      user: result.rows[0]
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
    res.status(500).json({ error: 'User Master 승인 실패', detail: err.message });
  }
});

// User Master가 User 승인
router.post('/approve-user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // User Master 권한 확인
    const userMasterResult = await pool.query(
      'SELECT role FROM users WHERE id = $1 AND is_approved_by_super_admin = TRUE',
      [decoded.id]
    );
    
    if (userMasterResult.rowCount === 0 || userMasterResult.rows[0].role !== 'user_master') {
      return res.status(403).json({ error: 'User Master 권한이 필요합니다.' });
    }

    // User 승인 (자신의 소속 User만)
    const result = await pool.query(
      `UPDATE users 
       SET is_approved_by_user_master = TRUE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND role = 'user' AND user_master_id = $2 AND is_verified = TRUE 
       RETURNING id, username, email, role`,
      [userId, decoded.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: '승인할 User를 찾을 수 없습니다.' });
    }

    res.json({ 
      message: 'User 승인이 완료되었습니다.',
      user: result.rows[0]
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
    res.status(500).json({ error: 'User 승인 실패', detail: err.message });
  }
});

// 승인 대기 중인 사용자 목록 조회
router.get('/pending-approvals', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [decoded.id]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }

    const userRole = userResult.rows[0].role;
    let pendingUsers = [];

    if (userRole === 'super_admin') {
      // Super Admin: 승인 대기 중인 User Master 목록
      const result = await pool.query(
        `SELECT id, username, email, created_at 
         FROM users 
         WHERE role = 'user_master' AND is_verified = TRUE AND is_approved_by_super_admin = FALSE
         ORDER BY created_at ASC`
      );
      pendingUsers = result.rows;
    } else if (userRole === 'user_master') {
      // User Master: 자신의 소속 User 중 승인 대기 중인 목록
      const result = await pool.query(
        `SELECT id, username, email, created_at 
         FROM users 
         WHERE role = 'user' AND user_master_id = $1 AND is_verified = TRUE AND is_approved_by_user_master = FALSE
         ORDER BY created_at ASC`,
        [decoded.id]
      );
      pendingUsers = result.rows;
    } else {
      return res.status(403).json({ error: '승인 권한이 없습니다.' });
    }

    res.json({ pendingUsers });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
    res.status(500).json({ error: '승인 대기 목록 조회 실패', detail: err.message });
  }
});

module.exports = router;