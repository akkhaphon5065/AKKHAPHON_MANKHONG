const { pool } = require('../config/db');

async function getDashboard(req, res) {
  try {
    const userId = req.user.user_id;

    const [[fileRow]] = await pool.query(
      'SELECT COUNT(*) AS totalFiles FROM files WHERE user_id = ?',
      [userId]
    );
    const [[ocrRow]] = await pool.query(
      `SELECT COUNT(*) AS totalOcr FROM ocr_results o
       INNER JOIN files f ON f.file_id = o.file_id
       WHERE f.user_id = ?`,
      [userId]
    );
    const [[translationRow]] = await pool.query(
      'SELECT COUNT(*) AS totalTranslations FROM translations WHERE user_id = ?',
      [userId]
    );
    const [[historyRow]] = await pool.query(
      'SELECT COUNT(*) AS totalUsage FROM usage_history WHERE user_id = ?',
      [userId]
    );
    const [[todayRow]] = await pool.query(
      'SELECT COUNT(*) AS todayUsage FROM usage_history WHERE user_id = ? AND DATE(created_at) = CURDATE()',
      [userId]
    );

    const [activities] = await pool.query(
      `SELECT history_id, activity_type, created_at
       FROM usage_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    );

    const parseActivity = (value) => {
      const raw = String(value || 'SYSTEM|สำเร็จ');
      const [left, status = 'สำเร็จ'] = raw.split('|');
      const colonIndex = left.indexOf(':');
      if (colonIndex >= 0) {
        return {
          type: left.slice(0, colonIndex).trim(),
          detail: left.slice(colonIndex + 1).trim(),
          status,
        };
      }
      return { type: left.trim(), detail: '-', status };
    };

    return res.json({
      success: true,
      stats: {
        files: Number(fileRow.totalFiles),
        ocrActive: Number(ocrRow.totalOcr),
        translate: Number(translationRow.totalTranslations),
        usage: Number(historyRow.totalUsage),
        todayUsage: Number(todayRow.todayUsage),
        onlineUsers: 1,
      },
      activities: activities.map((item) => ({
        history_id: item.history_id,
        datetime: item.created_at,
        ...parseActivity(item.activity_type),
      })),
    });
  } catch (error) {
    console.error('DASHBOARD ERROR:', error);
    return res.status(500).json({ success: false, message: 'ไม่สามารถโหลด Dashboard ได้' });
  }
}

module.exports = { getDashboard };
