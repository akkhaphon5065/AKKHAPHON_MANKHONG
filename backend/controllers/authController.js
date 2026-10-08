const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// =========================================================
// SIGN TOKEN
// =========================================================

function signToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      name: user.display_name,
    },
    process.env.JWT_SECRET,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN ||
        '7d',
    }
  );
}

// =========================================================
// PUBLIC USER
// =========================================================

function publicUser(row) {
  return {
    user_id: row.user_id,

    name: row.display_name,

    display_name:
      row.display_name,

    email: row.email,

    role: row.role,

    status: row.status,

    privacy_status:
      row.privacy_status,

    online: Boolean(
      row.online
    ),

    last_login_at:
      row.last_login_at,

    last_seen_at:
      row.last_seen_at,

    created_at:
      row.created_at,

    updated_at:
      row.updated_at,
  };
}

// =========================================================
// REGISTER
// =========================================================

async function register(
  req,
  res
) {
  try {
    const {
      displayName,
      name,
      email,
      password,
    } = req.body || {};

    const finalName =
      String(
        displayName ||
          name ||
          ''
      ).trim();

    const finalEmail =
      String(
        email ||
          ''
      )
        .trim()
        .toLowerCase();

    const finalPassword =
      String(
        password ||
          ''
      );

    if (!finalName) {
      return res.status(400).json({
        success: false,
        message:
          'กรุณากรอกชื่อที่แสดง',
      });
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        finalEmail
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'รูปแบบอีเมลไม่ถูกต้อง',
      });
    }

    if (
      finalPassword.length <
      6
    ) {
      return res.status(400).json({
        success: false,
        message:
          'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
      });
    }

    const [existing] =
      await pool.query(
        'SELECT user_id FROM users WHERE email = ? LIMIT 1',
        [finalEmail]
      );

    if (existing.length) {
      return res.status(409).json({
        success: false,
        message:
          'อีเมลนี้ถูกใช้งานแล้ว',
      });
    }

    const hash =
      await bcrypt.hash(
        finalPassword,
        12
      );

    const [result] =
      await pool.query(
        `INSERT INTO users
          (
            display_name,
            email,
            password_hash,
            role,
            status,
            privacy_status,
            online,
            created_at,
            updated_at
          )
         VALUES
          (
            ?,
            ?,
            ?,
            'user',
            'Active',
            'accepted',
            0,
            NOW(),
            NOW()
          )`,
        [
          finalName,
          finalEmail,
          hash,
        ]
      );

    const [rows] =
      await pool.query(
        'SELECT * FROM users WHERE user_id = ?',
        [result.insertId]
      );

    return res.status(201).json({
      success: true,
      message:
        'สร้างบัญชีผู้ใช้สำเร็จ',
      user: publicUser(
        rows[0]
      ),
    });
  } catch (error) {
    console.error(
      'REGISTER ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'ไม่สามารถสมัครสมาชิกได้',
    });
  }
}

// =========================================================
// LOGIN
// =========================================================

async function login(
  req,
  res
) {
  try {
    const email =
      String(
        req.body?.email ||
          ''
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        req.body?.password ||
          ''
      );

    if (
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          'กรุณากรอกอีเมลและรหัสผ่าน',
      });
    }

    const [rows] =
      await pool.query(
        'SELECT * FROM users WHERE email = ? LIMIT 1',
        [email]
      );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message:
          'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    const user =
      rows[0];

    if (
      String(
        user.status
      ).toLowerCase() ===
      'suspended'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'บัญชีนี้ถูกระงับการใช้งาน',
      });
    }

    // =====================================================
    // CHECK SYSTEM MAINTENANCE
    // Admin ยัง Login ได้
    // User Login ไม่ได้
    // =====================================================

    if (
      String(
        user.role
      ).toLowerCase() ===
      'user'
    ) {
      const [systemRows] =
        await pool.query(
          `SELECT setting_value
           FROM system_settings
           WHERE setting_key = 'system_status'
           LIMIT 1`
        );

      const systemStatus =
        systemRows.length
          ? systemRows[0]
              .setting_value
          : 'Online';

      if (
        systemStatus ===
        'Maintenance'
      ) {
        return res.status(503).json({
          success: false,

          code:
            'SYSTEM_MAINTENANCE',

          systemStatus:
            'Maintenance',

          message:
            'ขณะนี้ระบบอยู่ระหว่างการบำรุงรักษา บัญชี User ไม่สามารถเข้าสู่ระบบได้ กรุณารอจนกว่าระบบจะกลับสู่ Online',
        });
      }
    }

    const valid =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!valid) {
      return res.status(401).json({
        success: false,
        message:
          'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    await pool.query(
      `UPDATE users
       SET
         online = 1,
         last_login_at = NOW(),
         last_seen_at = NOW(),
         updated_at = NOW()
       WHERE user_id = ?`,
      [user.user_id]
    );

    const freshUser = {
      ...user,

      online: 1,

      last_login_at:
        new Date(),

      last_seen_at:
        new Date(),
    };

    const token =
      signToken(
        freshUser
      );

    return res.json({
      success: true,

      message:
        'เข้าสู่ระบบสำเร็จ',

      token,

      user:
        publicUser(
          freshUser
        ),
    });
  } catch (error) {
    console.error(
      'LOGIN ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'ไม่สามารถเข้าสู่ระบบได้',
    });
  }
}

// =========================================================
// ME
// =========================================================

async function me(
  req,
  res
) {
  try {
    const [rows] =
      await pool.query(
        'SELECT * FROM users WHERE user_id = ? LIMIT 1',
        [req.user.user_id]
      );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message:
          'ไม่พบผู้ใช้งาน',
      });
    }

    await pool.query(
      `UPDATE users
       SET
         last_seen_at = NOW(),
         updated_at = NOW()
       WHERE user_id = ?`,
      [req.user.user_id]
    );

    return res.json({
      success: true,
      user:
        publicUser(
          rows[0]
        ),
    });
  } catch (error) {
    console.error(
      'ME ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'ไม่สามารถโหลดข้อมูลผู้ใช้งานได้',
    });
  }
}

// =========================================================
// UPDATE PROFILE
// =========================================================

async function updateProfile(
  req,
  res
) {
  try {
    const {
      displayName,
      name,
      email,
      password,
    } = req.body || {};

    const newName =
      String(
        displayName ||
          name ||
          ''
      ).trim();

    const newEmail =
      String(
        email ||
          ''
      )
        .trim()
        .toLowerCase();

    if (!newName) {
      return res.status(400).json({
        success: false,
        message:
          'กรุณากรอกชื่อที่แสดง',
      });
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        newEmail
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'รูปแบบอีเมลไม่ถูกต้อง',
      });
    }

    const [duplicate] =
      await pool.query(
        `SELECT user_id
         FROM users
         WHERE
           email = ?
           AND user_id <> ?
         LIMIT 1`,
        [
          newEmail,
          req.user.user_id,
        ]
      );

    if (duplicate.length) {
      return res.status(409).json({
        success: false,
        message:
          'อีเมลนี้ถูกใช้งานแล้ว',
      });
    }

    if (password) {
      if (
        String(password).length <
        6
      ) {
        return res.status(400).json({
          success: false,
          message:
            'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร',
        });
      }

      const hash =
        await bcrypt.hash(
          String(password),
          12
        );

      await pool.query(
        `UPDATE users
         SET
           display_name = ?,
           email = ?,
           password_hash = ?,
           updated_at = NOW()
         WHERE user_id = ?`,
        [
          newName,
          newEmail,
          hash,
          req.user.user_id,
        ]
      );
    } else {
      await pool.query(
        `UPDATE users
         SET
           display_name = ?,
           email = ?,
           updated_at = NOW()
         WHERE user_id = ?`,
        [
          newName,
          newEmail,
          req.user.user_id,
        ]
      );
    }

    const [rows] =
      await pool.query(
        'SELECT * FROM users WHERE user_id = ?',
        [req.user.user_id]
      );

    const updated =
      rows[0];

    const token =
      signToken(
        updated
      );

    return res.json({
      success: true,

      message:
        'บันทึกข้อมูลส่วนตัวสำเร็จ',

      token,

      user:
        publicUser(
          updated
        ),
    });
  } catch (error) {
    console.error(
      'PROFILE UPDATE ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'ไม่สามารถแก้ไขข้อมูลได้',
    });
  }
}

// =========================================================
// LOGOUT
// =========================================================

async function logout(
  req,
  res
) {
  try {
    if (
      req.user?.user_id
    ) {
      await pool.query(
        `UPDATE users
         SET
           online = 0,
           last_seen_at = NOW(),
           updated_at = NOW()
         WHERE user_id = ?`,
        [req.user.user_id]
      );
    }

    return res.json({
      success: true,
      message:
        'ออกจากระบบสำเร็จ',
    });
  } catch (error) {
    console.error(
      'LOGOUT ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'ออกจากระบบไม่สำเร็จ',
    });
  }
}

module.exports = {
  register,
  login,
  me,
  updateProfile,
  logout,
};