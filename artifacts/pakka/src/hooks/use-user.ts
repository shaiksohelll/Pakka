"use client";

import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"] | null;

type UseUserResult = {
  user: User | null;
  profile: Profile;
  isLoading: boolean;
};

export function useUser(): UseUserResult {
  const query = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { user: null, profile: null };
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      return { user, profile: profile ?? null };
    },
  });

  return {
    user: query.data?.user ?? null,
    profile: query.data?.profile ?? null,
    isLoading: query.isLoading,
  };
}
