const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middlewares/auth');

// 대시보드 메인 데이터
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let dashboardData = {};

    if (userRole === 'user') {
      // User 대시보드
      const [myProjects, myTickets, ticketStats] = await Promise.all([
        // 내 프로젝트 수
        pool.query('SELECT COUNT(*) FROM projects WHERE owner_id = $1', [userId]),
        
        // 내 티켓 목록 (최근 5개)
        pool.query(
          `SELECT t.*, p.name as project_name, p.code as project_code
           FROM tickets t
           JOIN projects p ON t.project_id = p.id
           WHERE t.creator_id = $1
           ORDER BY t.created_at DESC
           LIMIT 5`,
          [userId]
        ),
        
        // 티켓 통계
        pool.query(
          `SELECT 
            status,
            COUNT(*) as count
           FROM tickets t
           JOIN projects p ON t.project_id = p.id
           WHERE t.creator_id = $1
           GROUP BY status`,
          [userId]
        )
      ]);

      dashboardData = {
        projectCount: parseInt(myProjects.rows[0].count),
        recentTickets: myTickets.rows,
        ticketStats: ticketStats.rows,
        role: userRole
      };

    } else if (userRole === 'engineer') {
      // Engineer 대시보드
      const [assignedTickets, ticketStats, projectStats] = await Promise.all([
        // 배정된 티켓 목록 (최근 5개)
        pool.query(
          `SELECT t.*, p.name as project_name, p.code as project_code,
                  c.username as creator_name
           FROM tickets t
           JOIN projects p ON t.project_id = p.id
           JOIN users c ON t.creator_id = c.id
           WHERE t.assigned_engineer_id = $1
           ORDER BY t.created_at DESC
           LIMIT 5`,
          [userId]
        ),
        
        // 티켓 통계
        pool.query(
          `SELECT 
            status,
            COUNT(*) as count
           FROM tickets
           WHERE assigned_engineer_id = $1
           GROUP BY status`,
          [userId]
        ),
        
        // 프로젝트별 통계
        pool.query(
          `SELECT 
            p.name as project_name,
            COUNT(t.id) as ticket_count,
            COUNT(CASE WHEN t.status = 'complete' THEN 1 END) as completed_count
           FROM tickets t
           JOIN projects p ON t.project_id = p.id
           WHERE t.assigned_engineer_id = $1
           GROUP BY p.id, p.name`,
          [userId]
        )
      ]);

      dashboardData = {
        assignedTickets: assignedTickets.rows,
        ticketStats: ticketStats.rows,
        projectStats: projectStats.rows,
        role: userRole
      };

    } else if (userRole === 'user_master') {
      // User Master 대시보드
      const [userStats, ticketStats, productStats] = await Promise.all([
        // 소속 User 통계
        pool.query(
          `SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified_users
           FROM users
           WHERE user_master_id = $1`,
          [userId]
        ),
        
        // 티켓 통계
        pool.query(
          `SELECT 
            t.status,
            COUNT(*) as count
           FROM tickets t
           JOIN projects p ON t.project_id = p.id
           JOIN users u ON p.owner_id = u.id
           WHERE u.user_master_id = $1
           GROUP BY t.status`,
          [userId]
        ),
        
        // 제품정보 통계
        pool.query(
          `SELECT 
            COUNT(*) as total_products,
            COUNT(CASE WHEN monitoring_solution = TRUE THEN 1 END) as monitoring_products
           FROM product_info
           WHERE user_master_id = $1`,
          [userId]
        )
      ]);

      dashboardData = {
        userStats: userStats.rows[0],
        ticketStats: ticketStats.rows,
        productStats: productStats.rows[0],
        role: userRole
      };

    } else if (userRole === 'super_admin') {
      // Super Admin 대시보드
      const [userStats, ticketStats, projectStats, engineerStats] = await Promise.all([
        // 전체 사용자 통계
        pool.query(
          `SELECT 
            role,
            COUNT(*) as count
           FROM users
           WHERE is_verified = TRUE
           GROUP BY role`
        ),
        
        // 전체 티켓 통계
        pool.query(
          `SELECT 
            status,
            COUNT(*) as count
           FROM tickets
           GROUP BY status`
        ),
        
        // 프로젝트 통계
        pool.query(
          `SELECT 
            COUNT(*) as total_projects,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects
           FROM projects`
        ),
        
        // Engineer별 배정된 티켓 수
        pool.query(
          `SELECT 
            u.username,
            COUNT(t.id) as assigned_tickets,
            COUNT(CASE WHEN t.status = 'complete' THEN 1 END) as completed_tickets
           FROM users u
           LEFT JOIN tickets t ON u.id = t.assigned_engineer_id
           WHERE u.role = 'engineer'
           GROUP BY u.id, u.username
           ORDER BY assigned_tickets DESC`
        )
      ]);

      dashboardData = {
        userStats: userStats.rows,
        ticketStats: ticketStats.rows,
        projectStats: projectStats.rows[0],
        engineerStats: engineerStats.rows,
        role: userRole
      };
    }

    res.json(dashboardData);
  } catch (err) {
    console.error('대시보드 조회 오류:', err);
    res.status(500).json({ error: '대시보드 조회에 실패했습니다.' });
  }
});

// 임박한 티켓 조회
router.get('/upcoming-tickets', auth, async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'user') {
      // User: 내가 생성한 티켓 중 임박한 것
      query = `
        SELECT t.*, p.name as project_name
        FROM tickets t
        JOIN projects p ON t.project_id = p.id
        WHERE t.creator_id = $1 
          AND t.requested_end_date IS NOT NULL
          AND t.requested_end_date <= CURRENT_DATE + INTERVAL '7 days'
          AND t.status NOT IN ('complete', 'closed')
        ORDER BY t.requested_end_date ASC
        LIMIT 10
      `;
      params = [req.user.id];
    } else if (req.user.role === 'engineer') {
      // Engineer: 배정된 티켓 중 임박한 것
      query = `
        SELECT t.*, p.name as project_name, c.username as creator_name
        FROM tickets t
        JOIN projects p ON t.project_id = p.id
        JOIN users c ON t.creator_id = c.id
        WHERE t.assigned_engineer_id = $1 
          AND t.requested_end_date IS NOT NULL
          AND t.requested_end_date <= CURRENT_DATE + INTERVAL '7 days'
          AND t.status NOT IN ('complete', 'closed')
        ORDER BY t.requested_end_date ASC
        LIMIT 10
      `;
      params = [req.user.id];
    } else if (req.user.role === 'super_admin') {
      // Super Admin: 모든 임박한 티켓
      query = `
        SELECT t.*, p.name as project_name, c.username as creator_name, a.username as assigned_engineer_name
        FROM tickets t
        JOIN projects p ON t.project_id = p.id
        JOIN users c ON t.creator_id = c.id
        LEFT JOIN users a ON t.assigned_engineer_id = a.id
        WHERE t.requested_end_date IS NOT NULL
          AND t.requested_end_date <= CURRENT_DATE + INTERVAL '7 days'
          AND t.status NOT IN ('complete', 'closed')
        ORDER BY t.requested_end_date ASC
        LIMIT 10
      `;
    }

    if (query) {
      const result = await pool.query(query, params);
      res.json({ upcomingTickets: result.rows });
    } else {
      res.json({ upcomingTickets: [] });
    }
  } catch (err) {
    console.error('임박한 티켓 조회 오류:', err);
    res.status(500).json({ error: '임박한 티켓 조회에 실패했습니다.' });
  }
});

// 월간 통계
router.get('/monthly-stats', auth, async (req, res) => {
  try {
    if (!['super_admin', 'user_master'].includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    let query;
    let params = [];

    if (req.user.role === 'user_master') {
      // User Master: 소속 User들의 티켓 통계
      query = `
        SELECT 
          DATE_TRUNC('day', t.created_at) as date,
          COUNT(*) as ticket_count,
          COUNT(CASE WHEN t.status = 'complete' THEN 1 END) as completed_count
        FROM tickets t
        JOIN projects p ON t.project_id = p.id
        JOIN users u ON p.owner_id = u.id
        WHERE u.user_master_id = $1
          AND EXTRACT(MONTH FROM t.created_at) = $2
          AND EXTRACT(YEAR FROM t.created_at) = $3
        GROUP BY DATE_TRUNC('day', t.created_at)
        ORDER BY date
      `;
      params = [req.user.id, currentMonth, currentYear];
    } else {
      // Super Admin: 전체 티켓 통계
      query = `
        SELECT 
          DATE_TRUNC('day', t.created_at) as date,
          COUNT(*) as ticket_count,
          COUNT(CASE WHEN t.status = 'complete' THEN 1 END) as completed_count
        FROM tickets t
        WHERE EXTRACT(MONTH FROM t.created_at) = $1
          AND EXTRACT(YEAR FROM t.created_at) = $2
        GROUP BY DATE_TRUNC('day', t.created_at)
        ORDER BY date
      `;
      params = [currentMonth, currentYear];
    }

    const result = await pool.query(query, params);
    res.json({ monthlyStats: result.rows });
  } catch (err) {
    console.error('월간 통계 조회 오류:', err);
    res.status(500).json({ error: '월간 통계 조회에 실패했습니다.' });
  }
});

module.exports = router; 