import { supabase } from "../supabase/client";

type SignInOptions = {
  redirectTo?: string;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft" | "lovable",
      opts?: SignInOptions,
    ) => {
      if (provider === "lovable") {
        return { error: new Error("Unsupported provider") };
      }
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as "google" | "apple" | "microsoft",
        options: {
          redirectTo: opts?.redirectTo || window.location.origin,
        },
      });
      if (error) return { error };
      if (data?.url) {
        window.location.href = data.url;
        return { redirected: true };
      }
      return { error: new Error("No redirect URL returned") };
    },
  },
};
