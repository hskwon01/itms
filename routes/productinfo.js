const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middlewares/auth');

// 내 제품정보 조회 (User Master)
router.get('/my', auth, async (req, res) => {
  try {
    if (req.user.role !== 'user_master') {
      return res.status(403).json({ error: 'User Master만 접근 가능합니다.' });
    }

    const result = await pool.query(
      'SELECT * FROM product_info WHERE user_master_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({
      products: result.rows
    });
  } catch (err) {
    console.error('제품정보 조회 오류:', err);
    res.status(500).json({ error: '제품정보 조회에 실패했습니다.' });
  }
});

// User Master의 제품정보 조회 (Super Admin, Engineer)
router.get('/user-master/:userMasterId', auth, async (req, res) => {
  const { userMasterId } = req.params;

  try {
    if (!['super_admin', 'engineer'].includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const result = await pool.query(
      'SELECT * FROM product_info WHERE user_master_id = $1 ORDER BY created_at DESC',
      [userMasterId]
    );

    res.json({
      products: result.rows
    });
  } catch (err) {
    console.error('제품정보 조회 오류:', err);
    res.status(500).json({ error: '제품정보 조회에 실패했습니다.' });
  }
});

// 모든 제품정보 조회 (Super Admin, Engineer만)
router.get('/', auth, async (req, res) => {
  try {
    if (!['super_admin', 'engineer'].includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT pi.*, u.username as user_master_name
       FROM product_info pi
       JOIN users u ON pi.user_master_id = u.id
       ORDER BY pi.created_at DESC`
    );

    res.json({
      products: result.rows
    });
  } catch (err) {
    console.error('제품정보 조회 오류:', err);
    res.status(500).json({ error: '제품정보 조회에 실패했습니다.' });
  }
});

// 특정 제품정보 조회
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT pi.*, u.username as user_master_name
       FROM product_info pi
       JOIN users u ON pi.user_master_id = u.id
       WHERE pi.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '제품정보를 찾을 수 없습니다.' });
    }

    const product = result.rows[0];
    
    // 권한 확인 (User Master는 자신의 제품만, Super Admin/Engineer는 모든 제품)
    if (product.user_master_id !== req.user.id && 
        !['super_admin', 'engineer'].includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    res.json({
      product: product
    });
  } catch (err) {
    console.error('제품정보 조회 오류:', err);
    res.status(500).json({ error: '제품정보 조회에 실패했습니다.' });
  }
});

// 제품정보 생성
router.post('/', auth, async (req, res) => {
  const {
    product_name,
    version,
    license_info,
    eos_date,
    monitoring_solution,
    patch_history
  } = req.body;

  try {
    if (req.user.role !== 'user_master') {
      return res.status(403).json({ error: 'User Master만 제품정보를 생성할 수 있습니다.' });
    }

    const result = await pool.query(
      `INSERT INTO product_info (
        user_master_id, product_name, version, license_info, eos_date, 
        monitoring_solution, patch_history
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.user.id, product_name, version, license_info, eos_date,
        monitoring_solution || false, patch_history
      ]
    );

    res.json({
      message: '제품정보가 성공적으로 생성되었습니다.',
      product: result.rows[0]
    });
  } catch (err) {
    console.error('제품정보 생성 오류:', err);
    res.status(500).json({ error: '제품정보 생성에 실패했습니다.' });
  }
});

// 제품정보 수정
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const {
    product_name,
    version,
    license_info,
    eos_date,
    monitoring_solution,
    patch_history
  } = req.body;

  try {
    // 제품정보 존재 및 권한 확인
    const productCheck = await pool.query(
      'SELECT * FROM product_info WHERE id = $1',
      [id]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: '제품정보를 찾을 수 없습니다.' });
    }

    const product = productCheck.rows[0];
    
    // 권한 확인 (User Master는 자신의 제품만, Super Admin은 모든 제품)
    if (product.user_master_id !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '수정 권한이 없습니다.' });
    }

    const result = await pool.query(
      `UPDATE product_info SET 
        product_name = $1, version = $2, license_info = $3, eos_date = $4,
        monitoring_solution = $5, patch_history = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [
        product_name, version, license_info, eos_date,
        monitoring_solution, patch_history, id
      ]
    );

    res.json({
      message: '제품정보가 성공적으로 수정되었습니다.',
      product: result.rows[0]
    });
  } catch (err) {
    console.error('제품정보 수정 오류:', err);
    res.status(500).json({ error: '제품정보 수정에 실패했습니다.' });
  }
});

// 제품정보 삭제
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    // 제품정보 존재 및 권한 확인
    const productCheck = await pool.query(
      'SELECT * FROM product_info WHERE id = $1',
      [id]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: '제품정보를 찾을 수 없습니다.' });
    }

    const product = productCheck.rows[0];
    
    // 권한 확인 (User Master는 자신의 제품만, Super Admin은 모든 제품)
    if (product.user_master_id !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }

    await pool.query('DELETE FROM product_info WHERE id = $1', [id]);

    res.json({
      message: '제품정보가 성공적으로 삭제되었습니다.'
    });
  } catch (err) {
    console.error('제품정보 삭제 오류:', err);
    res.status(500).json({ error: '제품정보 삭제에 실패했습니다.' });
  }
});

module.exports = router; 