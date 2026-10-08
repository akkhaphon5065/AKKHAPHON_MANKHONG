// =========================================================
// middleware/uploadMiddleware.js
// OCRThai Plus
// =========================================================

const multer =
  require("multer");

const fs =
  require("fs");

const path =
  require("path");

// =========================================================
// UPLOAD DIRECTORY
// =========================================================

const uploadDir =
  path.resolve(
    process.cwd(),
    "uploads",
  );

if (
  !fs.existsSync(
    uploadDir,
  )
) {
  fs.mkdirSync(
    uploadDir,
    {
      recursive:
        true,
    },
  );
}

// =========================================================
// STORAGE
// =========================================================

const storage =
  multer.diskStorage({
    destination:
      (
        req,
        file,
        cb,
      ) => {
        cb(
          null,
          uploadDir,
        );
      },

    filename:
      (
        req,
        file,
        cb,
      ) => {
        const ext =
          path.extname(
            file.originalname ||
              "",
          );

        const base =
          path
            .basename(
              file.originalname ||
                "file",
              ext,
            )
            .replace(
              /[^a-zA-Z0-9ก-๙_-]/g,
              "_",
            );

        const unique =
          `${Date.now()}_${Math.round(
            Math.random() *
              1e9,
          )}`;

        cb(
          null,
          `${base}_${unique}${ext}`,
        );
      },
  });

// =========================================================
// FILE FILTER
// =========================================================

function fileFilter(
  req,
  file,
  cb,
) {
  const name =
    String(
      file.originalname ||
        "",
    ).toLowerCase();

  const mimetype =
    String(
      file.mimetype ||
        "",
    ).toLowerCase();

  const allowed =
    mimetype.startsWith(
      "image/",
    ) ||
    mimetype ===
      "application/pdf" ||
    mimetype ===
      "text/plain" ||
    name.endsWith(
      ".txt",
    ) ||
    name.endsWith(
      ".pdf",
    ) ||
    name.endsWith(
      ".jpg",
    ) ||
    name.endsWith(
      ".jpeg",
    ) ||
    name.endsWith(
      ".png",
    );

  if (!allowed) {
    return cb(
      new Error(
        "ประเภทไฟล์ไม่รองรับ",
      ),
    );
  }

  cb(
    null,
    true,
  );
}

// =========================================================
// MULTER
// =========================================================

const upload =
  multer({
    storage,

    fileFilter,

    limits: {
      fileSize:
        20 *
        1024 *
        1024,
    },
  });

module.exports =
  upload;