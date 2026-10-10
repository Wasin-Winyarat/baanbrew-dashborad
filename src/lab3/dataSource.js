// Where the Lab 4 tabs get their login state and analytics results from.
// Both sources have the same shape: { onAuth, signIn, signOut, loadAnalytics }.
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, db, googleProvider } from "./firebase.js";
import { buildDemoAnalytics } from "../lab4/demoAnalytics.js";

const DOCS = ["meta", "daily", "rfm", "cohort", "abc"];

// Real Firebase: the 5 summary documents written by `npm run analytics`.
export const firestoreSource = {
  onAuth: (cb) => onAuthStateChanged(auth, cb),
  signIn: () => signInWithPopup(auth, googleProvider),
  signOut: () => signOut(auth),
  async loadAnalytics() {
    const snaps = await Promise.all(DOCS.map((id) => getDoc(doc(db, "analytics", id))));
    if (!snaps[0].exists()) throw new Error("ยังไม่มีผลวิเคราะห์ใน Firestore ให้รัน npm run analytics ก่อน");
    const data = Object.fromEntries(snaps.map((s, i) => [DOCS[i], s.exists() ? s.data() : { error: "ยังไม่มีเอกสารนี้" }]));
    // builtAt is a server timestamp; the UI expects something new Date() accepts.
    const builtAt = data.meta.builtAt;
    data.meta = { ...data.meta, builtAt: builtAt?.toDate ? builtAt.toDate() : builtAt ?? null };
    return { ...data, reads: snaps.length };
  },
};

// ?demo: a pretend signed-in user, analytics computed in the browser from the CSVs.
export function createDemoSource(rows, products, holidays) {
  const user = { displayName: "โหมดสาธิต", email: "demo", photoURL: null };
  return {
    onAuth: (cb) => { cb(user); return () => {}; },
    signIn: async () => {},
    signOut: async () => {},
    loadAnalytics: async () => buildDemoAnalytics(rows, products, holidays),
  };
}
