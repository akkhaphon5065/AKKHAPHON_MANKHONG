const express =
  require("express");

const {
  requireAuth,
} =
  require(
    "../middleware/authMiddleware",
  );

const {
  getDashboard,
} =
  require(
    "../controllers/dashboardController",
  );

const router =
  express.Router();

router.get(
  "/",
  requireAuth,
  getDashboard,
);

module.exports =
  router;