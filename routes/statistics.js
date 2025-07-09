const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middlewares/auth');

// 월간 통계 (Super Admin만)
router.get('/monthly', auth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const { year, month } = req.query;
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;

    const [ticketStats, projectStats, userStats] = await Promise.all([
      // 티켓 통계
      pool.query(
        `SELECT 
          status,
          COUNT(*) as count
         FROM tickets
         WHERE EXTRACT(YEAR FROM created_at) = $1 
           AND EXTRACT(MONTH FROM created_at) = $2
         GROUP BY status`,
        [targetYear, targetMonth]
      ),
      
      // 프로젝트 통계
      pool.query(
        `SELECT 
          status,
          COUNT(*) as count
         FROM projects
         WHERE EXTRACT(YEAR FROM created_at) = $1 
           AND EXTRACT(MONTH FROM created_at) = $2
         GROUP BY status`,
        [targetYear, targetMonth]
      ),
      
      // 사용자 통계
      pool.query(
        `SELECT 
          role,
          COUNT(*) as count
         FROM users
         WHERE EXTRACT(YEAR FROM created_at) = $1 
           AND EXTRACT(MONTH FROM created_at) = $2
         GROUP BY role`,
        [targetYear, targetMonth]
      )
    ]);

    res.json({
      year: targetYear,
      month: targetMonth,
      ticketStats: ticketStats.rows,
      projectStats: projectStats.rows,
      userStats: userStats.rows
    });
  } catch (err) {
    console.error('월간 통계 조회 오류:', err);
    res.status(500).json({ error: '월간 통계 조회에 실패했습니다.' });
  }
});

// Engineer별 성과 통계 (Super Admin만)
router.get('/engineer-performance', auth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const { start_date, end_date } = req.query;
    let dateFilter = '';
    let params = [];

    if (start_date && end_date) {
      dateFilter = 'WHERE t.created_at BETWEEN $1 AND $2';
      params = [start_date, end_date];
    }

    const result = await pool.query(
      `SELECT 
        u.id,
        u.username,
        u.email,
        COUNT(t.id) as total_tickets,
        COUNT(CASE WHEN t.status = 'complete' THEN 1 END) as completed_tickets,
        COUNT(CASE WHEN t.status = 'closed' THEN 1 END) as closed_tickets,
        AVG(CASE WHEN t.actual_end_date IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (t.actual_end_date - t.created_date)) / 86400 
            ELSE NULL END) as avg_completion_days
       FROM users u
       LEFT JOIN tickets t ON u.id = t.assigned_engineer_id
       WHERE u.role = 'engineer' AND u.is_verified = TRUE
       ${dateFilter ? 'AND ' + dateFilter.replace('WHERE', '') : ''}
       GROUP BY u.id, u.username, u.email
       ORDER BY completed_tickets DESC`,
      params
    );

    res.json({
      engineerPerformance: result.rows
    });
  } catch (err) {
    console.error('Engineer 성과 통계 조회 오류:', err);
    res.status(500).json({ error: 'Engineer 성과 통계 조회에 실패했습니다.' });
  }
});

// 프로젝트별 통계 (Super Admin, Engineer만)
router.get('/project-stats', auth, async (req, res) => {
  try {
    if (!['super_admin', 'engineer'].includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT 
        p.id,
        p.name,
        p.code,
        p.status,
        u.username as owner_name,
        COUNT(t.id) as total_tickets,
        COUNT(CASE WHEN t.status = 'new' THEN 1 END) as new_tickets,
        COUNT(CASE WHEN t.status = 'assigned' THEN 1 END) as assigned_tickets,
        COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tickets,
        COUNT(CASE WHEN t.status = 'on_hold' THEN 1 END) as on_hold_tickets,
        COUNT(CASE WHEN t.status = 'validation' THEN 1 END) as validation_tickets,
        COUNT(CASE WHEN t.status = 'complete' THEN 1 END) as complete_tickets,
        COUNT(CASE WHEN t.status = 'closed' THEN 1 END) as closed_tickets,
        p.created_at
       FROM projects p
       LEFT JOIN users u ON p.owner_id = u.id
       LEFT JOIN tickets t ON p.id = t.project_id
       GROUP BY p.id, p.name, p.code, p.status, u.username, p.created_at
       ORDER BY p.created_at DESC`
    );

    res.json({
      projectStats: result.rows
    });
  } catch (err) {
    console.error('프로젝트 통계 조회 오류:', err);
    res.status(500).json({ error: '프로젝트 통계 조회에 실패했습니다.' });
  }
});

// 티켓 심각도별 통계 (Super Admin, Engineer만)
router.get('/ticket-severity', auth, async (req, res) => {
  try {
    if (!['super_admin', 'engineer'].includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT 
        severity,
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'complete' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_count,
        AVG(CASE WHEN actual_end_date IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (actual_end_date - created_date)) / 86400 
            ELSE NULL END) as avg_completion_days
       FROM tickets
       GROUP BY severity
       ORDER BY 
         CASE severity 
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END`
    );

    res.json({
      severityStats: result.rows
    });
  } catch (err) {
    console.error('티켓 심각도 통계 조회 오류:', err);
    res.status(500).json({ error: '티켓 심각도 통계 조회에 실패했습니다.' });
  }
});

// 티켓 이슈 타입별 통계 (Super Admin, Engineer만)
router.get('/ticket-issue-type', auth, async (req, res) => {
  try {
    if (!['super_admin', 'engineer'].includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT 
        issue_type,
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'complete' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_count,
        AVG(CASE WHEN actual_end_date IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (actual_end_date - created_date)) / 86400 
            ELSE NULL END) as avg_completion_days
       FROM tickets
       GROUP BY issue_type
       ORDER BY total_count DESC`
    );

    res.json({
      issueTypeStats: result.rows
    });
  } catch (err) {
    console.error('티켓 이슈 타입 통계 조회 오류:', err);
    res.status(500).json({ error: '티켓 이슈 타입 통계 조회에 실패했습니다.' });
  }
});

// User Master별 통계 (Super Admin만)
router.get('/user-master-stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT 
        um.id,
        um.username,
        um.email,
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT p.id) as total_projects,
        COUNT(DISTINCT t.id) as total_tickets,
        COUNT(DISTINCT CASE WHEN t.status = 'complete' THEN t.id END) as completed_tickets,
        COUNT(DISTINCT pi.id) as total_products
       FROM users um
       LEFT JOIN users u ON um.id = u.user_master_id
       LEFT JOIN projects p ON u.id = p.owner_id
       LEFT JOIN tickets t ON p.id = t.project_id
       LEFT JOIN product_info pi ON um.id = pi.user_master_id
       WHERE um.role = 'user_master'
       GROUP BY um.id, um.username, um.email
       ORDER BY total_tickets DESC`
    );

    res.json({
      userMasterStats: result.rows
    });
  } catch (err) {
    console.error('User Master 통계 조회 오류:', err);
    res.status(500).json({ error: 'User Master 통계 조회에 실패했습니다.' });
  }
});

// 전체 시스템 요약 통계 (Super Admin만)
router.get('/system-summary', auth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const [userStats, projectStats, ticketStats, productStats] = await Promise.all([
      // 사용자 통계
      pool.query(
        `SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified_users,
          COUNT(CASE WHEN role = 'user' THEN 1 END) as user_count,
          COUNT(CASE WHEN role = 'engineer' THEN 1 END) as engineer_count,
          COUNT(CASE WHEN role = 'user_master' THEN 1 END) as user_master_count,
          COUNT(CASE WHEN role = 'super_admin' THEN 1 END) as super_admin_count
         FROM users`
      ),
      
      // 프로젝트 통계
      pool.query(
        `SELECT 
          COUNT(*) as total_projects,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
          COUNT(CASE WHEN status = 'on_hold' THEN 1 END) as on_hold_projects
         FROM projects`
      ),
      
      // 티켓 통계
      pool.query(
        `SELECT 
          COUNT(*) as total_tickets,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new_tickets,
          COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned_tickets,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tickets,
          COUNT(CASE WHEN status = 'on_hold' THEN 1 END) as on_hold_tickets,
          COUNT(CASE WHEN status = 'validation' THEN 1 END) as validation_tickets,
          COUNT(CASE WHEN status = 'complete' THEN 1 END) as complete_tickets,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
          AVG(CASE WHEN actual_end_date IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (actual_end_date - created_date)) / 86400 
              ELSE NULL END) as avg_completion_days
         FROM tickets`
      ),
      
      // 제품정보 통계
      pool.query(
        `SELECT 
          COUNT(*) as total_products,
          COUNT(CASE WHEN monitoring_solution = TRUE THEN 1 END) as monitoring_products,
          COUNT(CASE WHEN eos_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1 END) as expiring_soon
         FROM product_info`
      )
    ]);

    res.json({
      systemSummary: {
        users: userStats.rows[0],
        projects: projectStats.rows[0],
        tickets: ticketStats.rows[0],
        products: productStats.rows[0]
      }
    });
  } catch (err) {
    console.error('시스템 요약 통계 조회 오류:', err);
    res.status(500).json({ error: '시스템 요약 통계 조회에 실패했습니다.' });
  }
});

module.exports = router; 