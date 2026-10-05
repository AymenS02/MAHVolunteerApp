import express from "express";
import {
  createAdjustment,
  getMyHours,
  getMyHoursSummary,
  getUserHours,
} from "../controllers/hoursController.js";
import {
  changeMyPassword,
  createUser,
  deleteMyAccount,
  deletePushToken,
  savePushToken,
  setNotifications,
  setMyDateOfBirth,
  updateMyProfile,
} from "../controllers/userController.js";
import { adminOnly, auth } from "../middleware/auth.js";
import { requireObjectId, validateBody } from "../middleware/validate.js";
import {
  changePasswordSchema,
  hourAdjustmentSchema,
  notificationsSchema,
  pushTokenSchema,
  setDateOfBirthSchema,
  updateProfileSchema,
} from "../validators/userValidator.js";

export const createUserRoutes = ({ passwordLimiter }) => {
  const router = express.Router();

  router.param("id", requireObjectId("Volunteer not found"));

  router.post("/", createUser);

  // /me routes act on req.user from the token, so users can only ever
  // change themselves. They're declared before the admin /:id routes.
  router.patch("/me", auth, validateBody(updateProfileSchema), updateMyProfile);
  router.put(
    "/me/password",
    auth,
    passwordLimiter,
    validateBody(changePasswordSchema),
    changeMyPassword,
  );
  router.put(
    "/me/date-of-birth",
    auth,
    validateBody(setDateOfBirthSchema),
    setMyDateOfBirth,
  );
  router.post("/me/push-tokens", auth, validateBody(pushTokenSchema), savePushToken);
  router.delete("/me/push-tokens/:token", auth, deletePushToken);
  router.patch(
    "/me/notifications",
    auth,
    validateBody(notificationsSchema),
    setNotifications,
  );
  router.get("/me/hours", auth, getMyHours);
  router.get("/me/hours/summary", auth, getMyHoursSummary);
  router.delete("/me", auth, deleteMyAccount);

  // Admin only: read another user's hours and adjust them.
  router.get("/:id/hours", auth, adminOnly, getUserHours);
  router.post(
    "/:id/hour-adjustments",
    auth,
    adminOnly,
    validateBody(hourAdjustmentSchema),
    createAdjustment,
  );

  return router;
};
