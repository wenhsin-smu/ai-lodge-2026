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
 * Test identity for this browser tab, until real accounts are wired up.
 * sessionStorage is per tab, so two tabs act as two friends sharing one feed.
 */
let identity: Identity | null = null;
export function getIdentity(): Identity {
  if (identity) return identity;
  try {
    const saved = window.sessionStorage.getItem(IDENTITY_KEY);
    if (saved) return (identity = JSON.parse(saved));
  } catch {}
  identity = { id: crypto.randomUUID(), name: NAMES[Math.floor(Math.random() * NAMES.length)] };
  try {
    window.sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {}
  return identity;
}

/** Friends' posts stay covered until this viewer scratches them; your own never are. */
export function isCoveredFor(post: LocalPost, viewer: Identity) {
  return post.authorId !== viewer.id && !post.revealedBy.includes(viewer.id);
}

export function addPost(post: Omit<LocalPost, "id" | "createdAt" | "authorId" | "author" | "revealedBy">) {
  load();
  const me = getIdentity();
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

// Dev helper: fakes a post from a friend so scratch-to-reveal can be tested alone.
export function addSampleFriendPost() {
  load();
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d")!;
  const hue = Math.floor(Math.random() * 360);
  const g = ctx.createLinearGradient(0, 0, 640, 480);
  g.addColorStop(0, `hsl(${hue} 60% 75%)`);
  g.addColorStop(1, `hsl(${(hue + 60) % 360} 60% 55%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 640, 480);
  const notes = ["chapter 4 done!", "coffee #2", "you got this", "library gang", "1 more hour"];
  ctx.fillStyle = "white";
  ctx.font = "bold 56px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(notes[Math.floor(Math.random() * notes.length)], 320, 240);
  const author = NAMES[Math.floor(Math.random() * NAMES.length)];
  save([
    {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      authorId: `simulated-${author}`,
      author,
      kind: "photo",
      image: canvas.toDataURL("image/jpeg", 0.85),
      caption: "",
      revealedBy: [],
    },
    ...posts,
  ]);
}
