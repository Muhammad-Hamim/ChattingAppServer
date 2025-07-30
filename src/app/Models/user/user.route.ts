import { Router } from "express";
import { UserController } from "./user.controller";
import validateRequest from "../../middlewares/validateRequest";
import { UserValidation } from "./user.validation";

const router = Router();


// Create a new user
router.post(
  "/",
  validateRequest(UserValidation.createUserValidationSchema),
  UserController.createUser
);


export const UserRouter = router;
