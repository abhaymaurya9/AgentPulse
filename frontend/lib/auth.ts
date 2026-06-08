import { supabase } from "./supabase";

export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
  } catch (err) {
    console.warn("Failed to get current user:", err);
    return null;
  }
};

export const signOut = async () => {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Failed to sign out from Supabase:", err);
  }
};
