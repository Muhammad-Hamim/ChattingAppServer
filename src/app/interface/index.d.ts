import { JwtPayload } from "jsonwebtoken";
import { DecodedIdToken } from "firebase-admin/auth";

declare global {
  namespace Express {
    interface Request {
      user: JwtPayload &
        DecodedIdToken & {
          _id?: string;
          uid?: string;
          email?: string;
          name?: string;
          lastLogin?: Date;
        };
    }
  }
}
