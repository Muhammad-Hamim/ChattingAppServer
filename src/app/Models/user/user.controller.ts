import { Request, Response } from "express";
import { UserService } from "./user.service";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";

// Create a new user
const createUser = catchAsync(async (req: Request, res: Response) => {
  const userData = req.body;
  console.log(userData)
  const result = await UserService.createUser(userData);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "User created successfully",
    data: result,
  });
});


export const UserController = {
  createUser,
};
