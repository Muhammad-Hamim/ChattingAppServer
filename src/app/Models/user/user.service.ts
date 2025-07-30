import { TUser } from "./user.interface";
import { User } from "./user.model";

// Create a new user
const createUser = async (userData: TUser): Promise<TUser> => {
  console.log(userData)
  const result = await User.create(userData);
  return result;
};


export const UserService = {
  createUser,
};
