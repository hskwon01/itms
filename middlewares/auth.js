const jwt = require('jsonwebtoken');
const pool = require('../db');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 사용자 정보 조회
    const result = await pool.query(
      'SELECT id, username, email, role, level FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error('인증 오류:', err);
    res.status(401).json({ error: '인증에 실패했습니다.' });
  }
};

module.exports = auth; 