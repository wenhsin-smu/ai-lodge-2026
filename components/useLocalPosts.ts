"use client";

import { useSyncExternalStore } from "react";
import { getPosts, getServerPosts, subscribe } from "@/lib/localPosts";

export function useLocalPosts() {
  return useSyncExternalStore(subscribe, getPosts, getServerPosts);
}
