// Temporary in-browser post store, used until the Supabase backend exists.
// Posts live in localStorage so they survive reloads and sync across tabs.

export type LocalPost = {
  id: string;
  author: string;
  fromMe: boolean;
  kind: "fog" | "photo";
  image: string; // data URL
  caption: string;
  createdAt: number;
  revealed: boolean;
};

const STORAGE_KEY = "studybooth.posts.v1";
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

export function addPost(post: Omit<LocalPost, "id" | "createdAt">) {
  load();
  save([{ ...post, id: crypto.randomUUID(), createdAt: Date.now() }, ...posts]);
}

export function markRevealed(id: string) {
  save(posts.map((p) => (p.id === id ? { ...p, revealed: true } : p)));
}

export function clearPosts() {
  save(EMPTY);
}

// Dev helper: fakes a post from a friend so scratch-to-reveal can be tested alone.
export function addSampleFriendPost() {
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
  const names = ["Mina", "Jo", "Sam", "Ari"];
  addPost({
    author: names[Math.floor(Math.random() * names.length)],
    fromMe: false,
    kind: "photo",
    image: canvas.toDataURL("image/jpeg", 0.85),
    caption: "",
    revealed: false,
  });
}
