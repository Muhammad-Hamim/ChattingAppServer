import { Request, Response, NextFunction, RequestHandler } from "express";
import admin, { ServiceAccount } from "firebase-admin";
import httpStatus from "http-status";
import AppError from "../errors/AppError";
import catchAsync from "../utils/catchAsync";
import { User } from "../Models/user/user.model";
import serviceAccount from "../../../firebase_service_account_credential.json";

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as ServiceAccount),
});
// Auth middleware to verify Firebase tokens
const auth = (): RequestHandler => {
  return catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Get the authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "Access token is required. Please provide a valid Bearer token."
        );
      }
      // Extract the token
      const token = authHeader.split(" ")[1];

      if (!token) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "Access token is required."
        );
      }
      try {
        // Verify the Firebase token
        const decodedToken = await admin.auth().verifyIdToken(token);
        // Check if user exists in database
        const user = await User.findOne({ uid: decodedToken.uid });
        if (!user) {
          throw new AppError(
            httpStatus.UNAUTHORIZED,
            "User not found. Please register first."
          );
        }

        // Attach user information to request object
        req.user = {
          _id: user._id,
          email: decodedToken.email || user.email,
          name: decodedToken.name || user.name,
          ...decodedToken,
        };

        // Update last login
        await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

        next();
      } catch (error: unknown) {
        // Handle Firebase token verification errors
        if (error && typeof error === "object" && "code" in error) {
          const firebaseError = error as { code: string };

          if (firebaseError.code === "auth/id-token-expired") {
            throw new AppError(
              httpStatus.UNAUTHORIZED,
              "Token has expired. Please refresh your token."
            );
          }

          if (firebaseError.code === "auth/invalid-id-token") {
            throw new AppError(
              httpStatus.UNAUTHORIZED,
              "Invalid token. Please provide a valid access token."
            );
          }

          if (firebaseError.code === "auth/id-token-revoked") {
            throw new AppError(
              httpStatus.UNAUTHORIZED,
              "Token has been revoked. Please login again."
            );
          }
        }

        // If it's already an AppError, throw it as is
        if (error instanceof AppError) {
          throw error;
        }

        // For any other errors
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "Authentication failed. Please provide a valid token."
        );
      }
    }
  );
};

// Optional auth middleware (doesn't throw error if no token)
const optionalAuth = (): RequestHandler => {
  return catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const authHeader = req.headers.authorization;

      // If no auth header, just proceed without user info
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next();
      }

      const token = authHeader.split(" ")[1];

      if (!token) {
        return next();
      }

      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const user = await User.findOne({ uid: decodedToken.uid });

        if (user) {
          req.user = {
            _id: user._id,
            email: decodedToken.email || user.email,
            name: decodedToken.name || user.name,
            ...decodedToken,
          };
        }
      } catch {
        // For optional auth, we don't throw errors, just proceed without user info
        // Silent fail for optional authentication
      }

      next();
    }
  );
};

export { auth, optionalAuth };
