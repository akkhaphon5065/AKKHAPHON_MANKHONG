// =========================================================
// server.js
// OCRThai Plus Backend
// =========================================================

require(
  "dotenv",
).config();

const express =
  require("express");

const cors =
  require("cors");

const path =
  require("path");

const {
  pool,
} =
  require(
    "./config/db",
  );

// =========================================================
// ROUTES
// =========================================================

const authRoutes =
  require(
    "./routes/authRoutes",
  );

const historyRoutes =
  require(
    "./routes/historyRoutes",
  );

const ocrRoutes =
  require(
    "./routes/ocrRoutes",
  );

const translateRoutes =
  require(
    "./routes/translateRoutes",
  );

const dashboardRoutes =
  require(
    "./routes/dashboardRoutes",
  );

const adminRoutes =
  require(
    "./routes/adminRoutes",
  );

// =========================================================
// APP
// =========================================================

const app =
  express();

const PORT =
  Number(
    process.env.PORT ||
      5000,
  );

// =========================================================
// MIDDLEWARE
// =========================================================

app.use(
  cors({
    origin:
      true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
    ],
  }),
);

app.use(
  express.json({
    limit:
      "10mb",
  }),
);

app.use(
  express.urlencoded({
    extended:
      true,
    limit:
      "10mb",
  }),
);

// =========================================================
// STATIC UPLOADS
// =========================================================

app.use(
  "/uploads",
  express.static(
    path.resolve(
      process.cwd(),
      "uploads",
    ),
  ),
);

// =========================================================
// HEALTH CHECK
// =========================================================

app.get(
  "/",
  (req, res) => {
    res.json({
      success:
        true,
      message:
        "OCRThai Plus Backend is running",
      api:
        "/api",
    });
  },
);

app.get(
  "/api",
  (req, res) => {
    res.json({
      success:
        true,
      message:
        "OCRThai Plus API is running",
    });
  },
);

// =========================================================
// ROUTES
// =========================================================

app.use(
  "/api/auth",
  authRoutes,
);

app.use(
  "/api/ocr",
  ocrRoutes,
);

app.use(
  "/api/translate",
  translateRoutes,
);

app.use(
  "/api/history",
  historyRoutes,
);

app.use(
  "/api/dashboard",
  dashboardRoutes,
);

app.use(
  "/api/admin",
  adminRoutes,
);

// =========================================================
// 404
// =========================================================

app.use(
  (req, res) => {
    res.status(404).json({
      success:
        false,
      message:
        `ไม่พบ API: ${req.method} ${req.originalUrl}`,
    });
  },
);

// =========================================================
// ERROR HANDLER
// =========================================================

app.use(
  (
    error,
    req,
    res,
    next,
  ) => {
    console.error(
      "GLOBAL ERROR:",
      error,
    );

    if (
      error?.name ===
      "MulterError"
    ) {
      return res
        .status(400)
        .json({
          success:
            false,
          message:
            error.message ||
            "Upload Error",
        });
    }

    if (
      error?.message ===
      "ประเภทไฟล์ไม่รองรับ"
    ) {
      return res
        .status(400)
        .json({
          success:
            false,
          message:
            error.message,
        });
    }

    return res
      .status(
        error?.status ||
          500,
      )
      .json({
        success:
          false,
        message:
          error?.message ||
          "Internal Server Error",
      });
  },
);

// =========================================================
// START SERVER
// =========================================================

async function startServer() {
  try {
    console.log(
      "\n======================================",
    );

    console.log(
      "กำลังตรวจสอบ MySQL...",
    );

    console.log(
      "======================================",
    );

    const connection =
      await pool.getConnection();

    const [
      rows,
    ] =
      await connection.query(
        "SELECT VERSION() AS version",
      );

    connection.release();

    console.log(
      "======================================",
    );

    console.log(
      "✅ MySQL Connected Successfully",
    );

    console.log(
      "Database:",
      process.env.DB_NAME ||
        "-",
    );

    console.log(
      "MySQL:",
      rows?.[0]?.version ||
        "-",
    );

    console.log(
      "======================================",
    );

    app.listen(
      PORT,
      () => {
        console.log(
          "\n======================================",
        );

        console.log(
          "OCRThai Plus Backend",
        );

        console.log(
          `Server: http://localhost:${PORT}`,
        );

        console.log(
          `API: http://localhost:${PORT}/api`,
        );

        console.log(
          `Uploads: http://localhost:${PORT}/uploads`,
        );

        console.log(
          "======================================\n",
        );
      },
    );
  } catch (error) {
    console.error(
      "\n❌ Backend Start Error:",
      error,
    );

    process.exit(
      1,
    );
  }
}

startServer();