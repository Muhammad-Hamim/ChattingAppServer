import { TUser } from "./user.interface";
import { User } from "./user.model";

// Create a new user
const createUser = async (userData: TUser): Promise<TUser> => {
  console.log(userData);
  const result = await User.create(userData);
  return result;
};

// Update user status (online/offline)
const updateUserStatus = async (
  userId: string,
  status: "online" | "offline"
): Promise<void> => {
  await User.findByIdAndUpdate(userId, {
    status,
    lastSeen: new Date(),
    ...(status === "online" && { lastLogin: new Date() }),
  });
};

// Update user last login
const updateLastLogin = async (userId: string): Promise<void> => {
  await User.findByIdAndUpdate(userId, {
    lastLogin: new Date(),
    status: "online",
  });
};

// Get user by UID (for socket authentication)
const getUserByUID = async (uid: string): Promise<TUser | null> => {
  const user = await User.findOne({ uid });
  return user;
};

export const UserService = {
  createUser,
  updateUserStatus,
  updateLastLogin,
  getUserByUID,
};
