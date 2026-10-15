// Temporary in-browser post store, used until the Supabase backend exists.
// Posts live in localStorage so they survive reloads and sync across tabs.

export type LocalPost = {
  id: string;
  authorId: string;
  author: string;
  kind: "fog" | "photo" | "note";
  image: string; // data URL
  caption: string;
  noteText?: string; // typed text of a stitched note (for moderation later)
  createdAt: number;
  /** Viewers who have scratched this post open. */
  revealedBy: string[];
};

export type Identity = { id: string; name: string };

const STORAGE_KEY = "studybooth.posts.v2";
const IDENTITY_KEY = "studybooth.identity";
const NAMES = ["Mina", "Jo", "Sam", "Ari", "Kai", "Noor", "Lou", "Tae"];
const MAX_POSTS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY: LocalPost[] = [];

let posts: LocalPost[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function prune(list: LocalPost[]) {
  const cutoff = Date.now() - DAY_MS;
  return list.filter((p) => p.createdAt >= cutoff).slice(0, MAX_POSTS);
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    posts = raw ? prune(JSON.parse(raw)) : EMPTY;
  } catch {
    posts = EMPTY;
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    loaded = false;
    load();
    emit();
  });
}

function emit() {
  listeners.forEach((l) => l());
}

function save(next: LocalPost[]) {
  posts = prune(next);
  // Drop the oldest posts if the browser storage quota is hit.
  for (let list = posts; list.length > 0; list = list.slice(0, -1)) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      break;
    } catch {
      continue;
    }
  }
  emit();
}

export function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPosts() {
  load();
  return posts;
}

export function getServerPosts() {
  return EMPTY;
}

/**
 * Test identities for this browser tab, until real accounts are wired up.
 * sessionStorage is per tab, so two tabs act as two friends sharing one feed.
 * A tab can also flip to "view as friend" to see its own posts the way a
 * friend would: covered, ready to scratch.
 */
const VIEW_AS_FRIEND_KEY = "studybooth.viewAsFriend";
let self: Identity | null = null;
let friend: Identity | null = null;
let viewAsFriend = false;
const identityListeners = new Set<() => void>();

function loadIdentities() {
  if (self) return;
  try {
    const saved = window.sessionStorage.getItem(IDENTITY_KEY);
    if (saved) self = JSON.parse(saved);
    viewAsFriend = window.sessionStorage.getItem(VIEW_AS_FRIEND_KEY) === "1";
  } catch {}
  if (!self) {
    self = { id: crypto.randomUUID(), name: NAMES[Math.floor(Math.random() * NAMES.length)] };
    try {
      window.sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(self));
    } catch {}
  }
  const friendName = NAMES[(NAMES.indexOf(self.name) + 1) % NAMES.length];
  friend = { id: `${self.id}:friend`, name: friendName };
}

/** Who is looking at the feed right now in this tab. */
export function getIdentity(): Identity {
  loadIdentities();
  return viewAsFriend ? friend! : self!;
}

export function getSelf(): Identity {
  loadIdentities();
  return self!;
}

export function isViewingAsFriend() {
  loadIdentities();
  return viewAsFriend;
}

export function subscribeIdentity(listener: () => void) {
  identityListeners.add(listener);
  return () => identityListeners.delete(listener);
}

export function setViewAsFriend(on: boolean) {
  loadIdentities();
  if (on) {
    // Fresh covers every time, so the reveal can be shown again and again.
    load();
    const friendId = friend!.id;
    save(posts.map((p) => ({ ...p, revealedBy: p.revealedBy.filter((id) => id !== friendId) })));
  }
  viewAsFriend = on;
  try {
    window.sessionStorage.setItem(VIEW_AS_FRIEND_KEY, on ? "1" : "0");
  } catch {}
  identityListeners.forEach((l) => l());
}

export function addPost(post: Omit<LocalPost, "id" | "createdAt" | "authorId" | "author" | "revealedBy">) {
  load();
  const me = getSelf();
  save([
    { ...post, id: crypto.randomUUID(), createdAt: Date.now(), authorId: me.id, author: me.name, revealedBy: [] },
    ...posts,
  ]);
}

export function markRevealed(id: string) {
  const me = getIdentity();
  save(posts.map((p) => (p.id === id && !p.revealedBy.includes(me.id) ? { ...p, revealedBy: [...p.revealedBy, me.id] } : p)));
}

export function clearPosts() {
  save(EMPTY);
}
