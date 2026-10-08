const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

function normalizeStatus(value) {
  const status = String(value || '').trim();
  return ['Active', 'Suspended', 'Offline'].includes(status) ? status : null;
}

// =========================================================
// GET CURRENT SYSTEM STATUS
// =========================================================

async function getCurrentSystemStatus() {
  const [rows] = await pool.query(
    `SELECT setting_value
     FROM system_settings
     WHERE setting_key = 'system_status'
     LIMIT 1`
  );

  if (!rows.length) {
    return 'Online';
  }

  return rows[0].setting_value === 'Maintenance'
    ? 'Maintenance'
    : 'Online';
}

// =========================================================
// DASHBOARD
// =========================================================

async function dashboard(req, res) {
  try {
    const [[users]] = await pool.query(
      "SELECT COUNT(*) AS totalUsers FROM users WHERE role <> 'admin'"
    );

    const [[online]] = await pool.query(
      "SELECT COUNT(*) AS onlineUsers FROM users WHERE role <> 'admin' AND online = 1 AND status = 'Active'"
    );

    const [[today]] = await pool.query(
      "SELECT COUNT(*) AS todayUsage FROM usage_history WHERE DATE(created_at) = CURDATE()"
    );

    const [[ocr]] = await pool.query(
      'SELECT COUNT(*) AS totalOcr FROM ocr_results'
    );

    const [[translations]] = await pool.query(
      'SELECT COUNT(*) AS totalTranslations FROM translations'
    );

    const [[files]] = await pool.query(
      'SELECT COUNT(*) AS totalFiles, COALESCE(SUM(file_size),0) AS totalFileBytes FROM files'
    );

    const [storageRows] = await pool.query(
      `SELECT
         table_name,
         COALESCE(data_length + index_length, 0) AS bytes
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name IN (
           'users',
           'files',
           'ocr_results',
           'translations',
           'usage_history'
         )`
    );

    const storage = Object.fromEntries(
      storageRows.map((row) => [
        row.table_name,
        Number(row.bytes),
      ])
    );

    const totalBytes = Object.values(storage).reduce(
      (sum, value) => sum + value,
      0
    );

    const systemStatus =
      await getCurrentSystemStatus();

    return res.json({
      success: true,

      stats: {
        totalUsers: Number(
          users.totalUsers
        ),

        onlineUsers: Number(
          online.onlineUsers
        ),

        todayUsage: Number(
          today.todayUsage
        ),

        totalOcr: Number(
          ocr.totalOcr
        ),

        totalTranslations: Number(
          translations.totalTranslations
        ),

        totalFiles: Number(
          files.totalFiles
        ),

        totalFileBytes: Number(
          files.totalFileBytes
        ),
      },

      storage: {
        userDataSize:
          storage.users || 0,

        filesDataSize:
          storage.files || 0,

        ocrDataSize:
          storage.ocr_results || 0,

        translationDataSize:
          storage.translations || 0,

        historyDataSize:
          storage.usage_history || 0,

        totalDataSize:
          totalBytes,
      },

      systemStatus,
    });
  } catch (error) {
    console.error(
      'ADMIN DASHBOARD ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'ไม่สามารถโหลด Dashboard Admin ได้',
    });
  }
}

// =========================================================
// GET USERS
// =========================================================

async function getUsers(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         user_id,
         display_name,
         email,
         role,
         status,
         privacy_status,
         online,
         last_login_at,
         last_seen_at,
         created_at,
         updated_at
       FROM users
       ORDER BY user_id DESC`
    );

    return res.json({
      success: true,

      data: rows.map((row) => ({
        ...row,
        online: Boolean(row.online),
      })),
    });
  } catch (error) {
    console.error(
      'ADMIN GET USERS ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'ไม่สามารถโหลดรายชื่อผู้ใช้ได้',
    });
  }
}

// =========================================================
// UPDATE USER STATUS
// =========================================================

async function updateUserStatus(req, res) {
  try {
    const userId = Number(
      req.params.userId
    );

    const status = normalizeStatus(
      req.body?.status
    );

    if (!status) {
      return res.status(400).json({
        success: false,
        message:
          'สถานะไม่ถูกต้อง',
      });
    }

    if (
      userId ===
      Number(req.user.user_id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'ไม่สามารถเปลี่ยนสถานะบัญชี Admin ที่กำลังใช้งานได้',
      });
    }

    const [result] =
      await pool.query(
        `UPDATE users
         SET
           status = ?,
           online =
             CASE
               WHEN ? = 'Active'
               THEN online
               ELSE 0
             END,
           updated_at = NOW()
         WHERE
           user_id = ?
           AND role <> 'admin'`,
        [
          status,
          status,
          userId,
        ]
      );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message:
          'ไม่พบผู้ใช้งาน',
      });
    }

    return res.json({
      success: true,
      message:
        'อัปเดตสถานะผู้ใช้งานสำเร็จ',
    });
  } catch (error) {
    console.error(
      'ADMIN STATUS ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'ไม่สามารถอัปเดตสถานะได้',
    });
  }
}

// =========================================================
// DELETE USER
// =========================================================

async function deleteUser(req, res) {
  const connection =
    await pool.getConnection();

  try {
    const userId = Number(
      req.params.userId
    );

    if (
      userId ===
      Number(req.user.user_id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'ไม่สามารถลบบัญชี Admin ที่กำลังใช้งานได้',
      });
    }

    await connection.beginTransaction();

    const [userRows] =
      await connection.query(
        'SELECT role FROM users WHERE user_id = ? LIMIT 1',
        [userId]
      );

    if (!userRows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'ไม่พบผู้ใช้งาน',
      });
    }

    if (
      userRows[0].role ===
      'admin'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'ไม่สามารถลบบัญชี Admin ผ่านหน้านี้',
      });
    }

    const [files] =
      await connection.query(
        'SELECT file_id, file_path FROM files WHERE user_id = ?',
        [userId]
      );

    const fileIds =
      files.map(
        (r) => r.file_id
      );

    if (fileIds.length) {
      await connection.query(
        `DELETE FROM ocr_results
         WHERE file_id IN (
           ${fileIds
             .map(() => '?')
             .join(',')}
         )`,
        fileIds
      );

      await connection.query(
        `DELETE FROM files
         WHERE file_id IN (
           ${fileIds
             .map(() => '?')
             .join(',')}
         )`,
        fileIds
      );
    }

    await connection.query(
      'DELETE FROM translations WHERE user_id = ?',
      [userId]
    );

    await connection.query(
      'DELETE FROM usage_history WHERE user_id = ?',
      [userId]
    );

    await connection.query(
      'DELETE FROM users WHERE user_id = ?',
      [userId]
    );

    await connection.commit();

    const fs = require('fs');

    for (const file of files) {
      if (file.file_path) {
        try {
          fs.unlinkSync(
            file.file_path
          );
        } catch (_) {}
      }
    }

    return res.json({
      success: true,
      message:
        'ลบผู้ใช้งานเรียบร้อยแล้ว',
    });
  } catch (error) {
    await connection.rollback();

    console.error(
      'ADMIN DELETE USER ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'ไม่สามารถลบผู้ใช้งานได้',
    });
  } finally {
    connection.release();
  }
}

// =========================================================
// CHANGE ADMIN PASSWORD
// =========================================================

async function changeAdminPassword(
  req,
  res
) {
  try {
    const currentPassword =
      String(
        req.body?.currentPassword ||
          ''
      );

    const newPassword =
      String(
        req.body?.newPassword ||
          ''
      );

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message:
          'กรุณากรอกรหัสผ่านปัจจุบัน',
      });
    }

    if (
      newPassword.length <
      6
    ) {
      return res.status(400).json({
        success: false,
        message:
          'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร',
      });
    }

    const [rows] =
      await pool.query(
        'SELECT * FROM users WHERE user_id = ? LIMIT 1',
        [req.user.user_id]
      );

    if (
      !rows.length ||
      rows[0].role !==
        'admin'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'เฉพาะ Admin เท่านั้น',
      });
    }

    const valid =
      await bcrypt.compare(
        currentPassword,
        rows[0].password_hash
      );

    if (!valid) {
      return res.status(400).json({
        success: false,
        message:
          'รหัสผ่านปัจจุบันไม่ถูกต้อง',
      });
    }

    const hash =
      await bcrypt.hash(
        newPassword,
        12
      );

    await pool.query(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
      [
        hash,
        req.user.user_id,
      ]
    );

    return res.json({
      success: true,
      message:
        'เปลี่ยนรหัสผ่านผู้ดูแลระบบสำเร็จ',
    });
  } catch (error) {
    console.error(
      'ADMIN PASSWORD ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'ไม่สามารถเปลี่ยนรหัสผ่านได้',
    });
  }
}

// =========================================================
// GET SYSTEM STATUS
// =========================================================

async function getSystemStatus(
  req,
  res
) {
  try {
    const systemStatus =
      await getCurrentSystemStatus();

    return res.json({
      success: true,
      systemStatus,
    });
  } catch (error) {
    console.error(
      'GET SYSTEM STATUS ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'ไม่สามารถตรวจสอบสถานะระบบได้',
    });
  }
}

// =========================================================
// UPDATE SYSTEM STATUS
// =========================================================

async function updateSystemStatus(
  req,
  res
) {
  try {
    const next =
      String(
        req.body?.status ||
          ''
      ).trim();

    if (
      ![
        'Online',
        'Maintenance',
      ].includes(next)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'สถานะระบบไม่ถูกต้อง',
      });
    }

    await pool.query(
      `INSERT INTO system_settings
         (setting_key, setting_value)
       VALUES
         ('system_status', ?)
       ON DUPLICATE KEY UPDATE
         setting_value = VALUES(setting_value)`,
      [next]
    );

    return res.json({
      success: true,
      systemStatus: next,

      message:
        next ===
        'Maintenance'
          ? 'เปิดโหมด Maintenance แล้ว'
          : 'ระบบกลับสู่สถานะ Online แล้ว',
    });
  } catch (error) {
    console.error(
      'UPDATE SYSTEM STATUS ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'ไม่สามารถเปลี่ยนสถานะระบบได้',
    });
  }
}

// =========================================================
// EXPORT DATA
// =========================================================

async function exportData(
  req,
  res
) {
  try {
    const [users] =
      await pool.query(
        `SELECT
           user_id,
           display_name,
           email,
           role,
           status,
           privacy_status,
           online,
           last_login_at,
           last_seen_at,
           created_at,
           updated_at
         FROM users
         ORDER BY user_id`
      );

    const [files] =
      await pool.query(
        `SELECT
           file_id,
           file_name,
           file_type,
           file_size,
           created_at,
           user_id
         FROM files
         ORDER BY file_id`
      );

    const [ocrResults] =
      await pool.query(
        `SELECT
           ocr_id,
           raw_text,
           processed_text,
           processing_time,
           created_at,
           file_id,
           approved,
           approved_at
         FROM ocr_results
         ORDER BY ocr_id`
      );

    const [translations] =
      await pool.query(
        `SELECT
           translation_id,
           source_text,
           translated_text,
           source_language,
           target_language,
           processing_time,
           created_at,
           user_id,
           approved,
           approved_at
         FROM translations
         ORDER BY translation_id`
      );

    const [usageHistory] =
      await pool.query(
        `SELECT
           history_id,
           activity_type,
           created_at,
           user_id
         FROM usage_history
         ORDER BY history_id`
      );

    const systemStatus =
      await getCurrentSystemStatus();

    return res.json({
      success: true,

      exportedAt:
        new Date().toISOString(),

      systemStatus,

      users,

      files,

      ocrResults,

      translations,

      usageHistory,
    });
  } catch (error) {
    console.error(
      'ADMIN EXPORT ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'ไม่สามารถสำรองข้อมูลได้',
    });
  }
}

module.exports = {
  dashboard,
  getUsers,
  updateUserStatus,
  deleteUser,
  changeAdminPassword,
  getSystemStatus,
  updateSystemStatus,
  exportData,
};