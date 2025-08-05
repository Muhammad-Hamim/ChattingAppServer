export type TUser = {
  _id?: string;
  name: string;
  uid: string; // Unique identifier for the user
  email: string;
  lastLogin?: Date;
  status?: "online" | "offline";
  lastSeen?: Date;
};
