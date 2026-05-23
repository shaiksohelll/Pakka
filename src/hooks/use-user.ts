"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();

  // G9 fix: clear stale "current-user" cache on sign-out so downstream
  // components don't render with a phantom user for up to staleTime (5 min).
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        queryClient.removeQueries({ queryKey: ["current-user"] });
      } else if (event === "SIGNED_IN") {
        queryClient.invalidateQueries({ queryKey: ["current-user"] });
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const query = useQuery({
    queryKey: ["current-user"],
    staleTime: 5 * 60 * 1000, // user identity stable for 5 min
    gcTime: 30 * 60 * 1000, // keep across SPA navigation
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
