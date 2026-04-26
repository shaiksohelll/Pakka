export type TrustBadge = "bronze" | "silver" | "gold";

export type AppUser = {
  id: string;
  email: string;
  createdAt: string;
  trustBadge: TrustBadge;
};
