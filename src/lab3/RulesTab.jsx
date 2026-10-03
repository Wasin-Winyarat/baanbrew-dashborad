// แท็บ "ทดสอบ Rules" · ห่อ RulesTester (ไฟล์จาก starter) ให้อยู่ในกรอบเดียวกับแท็บอื่น
// และแสดง SetupGuide ถ้ายังไม่ได้ตั้งค่า Firebase
import { db } from "./firebase.js";
import RulesTester from "./RulesTester.jsx";
import SetupGuide from "./SetupGuide.jsx";

export default function RulesTab() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {db ? <RulesTester /> : <SetupGuide />}
    </div>
  );
}
