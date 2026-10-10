// Login pieces shared by the Lab 4 tabs. They take callbacks instead of
// calling Firebase directly, so the ?demo source can drive them too.
import { useState } from "react";
import { CARD_CLASS } from "../theme";

const AUTH_ERROR_TEXT = {
  "auth/unauthorized-domain": "โดเมนนี้ยังไม่ได้รับอนุญาต เพิ่มโดเมนของเว็บใน Firebase Console → Authentication → Settings → Authorized domains",
  "auth/operation-not-allowed": "ยังไม่ได้เปิดการล็อกอินด้วย Google เปิดได้ที่ Firebase Console → Authentication → Sign-in method → Google",
  "auth/popup-blocked": "เบราว์เซอร์บล็อกหน้าต่างล็อกอิน อนุญาตป๊อปอัปสำหรับเว็บนี้แล้วกดปุ่มอีกครั้ง",
  "auth/popup-closed-by-user": "ปิดหน้าต่างล็อกอินก่อนเสร็จ กดปุ่มอีกครั้งเพื่อเข้าสู่ระบบ",
};
export const authErrorText = (err) => AUTH_ERROR_TEXT[err.code] ?? `เข้าสู่ระบบไม่สำเร็จ (${err.code ?? err.message})`;

export function LoginCard({ onSignIn, error }) {
  const [busy, setBusy] = useState(false);
  const login = () => {
    setBusy(true);
    // onSignIn handles its own error; on success the tab switches away from this card.
    Promise.resolve(onSignIn()).finally(() => setBusy(false));
  };
  return (
    <div className={`${CARD_CLASS} mx-auto max-w-md p-6 text-center sm:p-8`}>
      <h1 className="text-2xl font-light tracking-tight text-ink">ผลวิเคราะห์สำหรับพนักงาน</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">เข้าสู่ระบบด้วยบัญชี Google เพื่อดูผลวิเคราะห์ลูกค้าและเมนู</p>
      <button
        type="button"
        onClick={login}
        disabled={busy}
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl border border-line bg-card text-sm font-medium text-ink transition-colors hover:bg-paper disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบด้วย Google"}
      </button>
      {error && <p role="alert" className="mt-4 rounded-xl bg-blush/60 px-3 py-2 text-left text-sm text-blush-ink">❌ {error}</p>}
    </div>
  );
}

export function UserChip({ user, onSignOut }) {
  const name = user.displayName || user.email || "ผู้ใช้";
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-1">
      {user.photoURL && !failed ? (
        // Google ไม่ให้โหลดรูปถ้าส่ง referrer ไปด้วย
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-7 w-7 rounded-full" />
      ) : (
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-medium text-brand-ink">{name.slice(0, 1).toUpperCase()}</span>
      )}
      <span className="max-w-[10rem] truncate text-sm text-ink" title={user.email ?? undefined}>{name}</span>
      <button
        type="button"
        onClick={() => Promise.resolve(onSignOut()).catch((err) => console.error(err))}
        className="rounded-full px-3 py-1 text-xs text-muted transition-colors hover:bg-blush hover:text-blush-ink"
      >
        ออกจากระบบ
      </button>
    </div>
  );
}
