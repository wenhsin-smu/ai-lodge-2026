"use client";

import { useSyncExternalStore } from "react";
import { getIdentity, subscribeIdentity, type Identity } from "@/lib/localPosts";

/** Current viewer identity for this tab; null during server rendering. */
export function useIdentity(): Identity | null {
  return useSyncExternalStore(subscribeIdentity, getIdentity, () => null);
}
