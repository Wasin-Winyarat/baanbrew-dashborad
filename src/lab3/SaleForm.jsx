// Lab 3.2 · ฟอร์มบันทึกยอดขาย
// ตรวจด้วย validateSaleForm และสร้างเอกสารด้วย buildSale (saleModel.js) จึงได้โครงสร้างเดียวกับข้อมูลที่ import
// บันทึกแล้ว onSnapshot ใน LiveTab จะเห็นเอกสารใหม่เองโดยไม่ต้องสั่งรีเฟรช
import { useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { BRANCHES, MAX_QTY, PAYMENTS, buildSale, validateSaleForm } from "./saleModel.js";
import { formatBaht } from "../lib/metrics.js";
import { CARD_CLASS } from "../theme.js";

// Lab 3.3 จะเปลี่ยนเป็น uid ของผู้ใช้ที่ล็อกอิน
const UID = "anonymous";
const EMPTY = { branch: "", product_id: "", qty: "1", payment_method: "", customer_id: "" };

const INPUT =
  "h-10 w-full rounded-xl border bg-paper/60 px-3 text-sm text-ink transition-colors focus:bg-card focus:outline-none focus:ring-4";
const inputClass = (bad) =>
  `${INPUT} ${bad ? "border-danger focus:border-danger focus:ring-danger/15" : "border-line focus:border-accent focus:ring-accent/15"}`;

function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs tracking-wide text-muted">
        {label}
        {hint && <span className="text-[11px] text-muted/80">{hint}</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </label>
  );
}

export default function SaleForm({ products, productsError }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { ok: true, text } | { ok: false, text }

  const product = products.find((p) => p.product_id === form.product_id);
  const check = useMemo(() => validateSaleForm(form, products), [form, products]);
  // ยอดรวมก่อนบันทึกใช้ buildSale ตัวเดียวกับตอนบันทึก ตัวเลขที่เห็นจึงตรงกับที่จะเขียนลง Firestore
  const preview = product && !check.qty ? buildSale(form, product, { uid: UID }).data.revenue : null;

  const set = (name) => (e) => {
    const next = { ...form, [name]: e.target.value };
    setForm(next);
    // หลังกดบันทึกครั้งแรก ให้ error หายทันทีเมื่อแก้ช่องนั้นถูก
    if (submitted) setErrors(validateSaleForm(next, products));
    setResult(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setErrors(check);
    if (Object.keys(check).length > 0) return;

    const { id, data } = buildSale(form, product, { uid: UID });
    setSaving(true);
    setResult(null);
    try {
      await setDoc(doc(db, "sales", id), { ...data, created_at: serverTimestamp() });
      setResult({ ok: true, text: `บันทึกแล้ว ${data.order_id} · ${product.product_name} × ${data.qty} = ${formatBaht(data.revenue)}` });
      // เก็บสาขาและวิธีชำระไว้ เพราะพนักงานมักขายที่สาขาเดิมต่อเนื่อง
      setForm({ ...EMPTY, branch: form.branch, payment_method: form.payment_method });
      setSubmitted(false);
      setErrors({});
    } catch (err) {
      console.error(err);
      setResult({
        ok: false,
        text: err.code === "permission-denied" ? "ถูกปฏิเสธโดย Security Rules" : `บันทึกไม่สำเร็จ (${err.code ?? err.message})`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className={`${CARD_CLASS} space-y-4 p-4 sm:p-6`}>
      <div>
        <h2 className="text-base font-medium text-ink">บันทึกยอดขาย</h2>
        <p className="mt-0.5 text-xs text-muted">1 รายการ = 1 เมนูในบิล · ราคาดึงจากเมนูอัตโนมัติ</p>
      </div>

      {productsError && (
        <p role="alert" className="rounded-xl bg-blush/50 px-3 py-2 text-xs text-blush-ink">❌ {productsError}</p>
      )}

      <Field label="สาขา" error={errors.branch}>
        <select value={form.branch} onChange={set("branch")} className={inputClass(errors.branch)}>
          <option value="">เลือกสาขา</option>
          {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </Field>

      <Field label="เมนู" error={errors.product_id}>
        <select
          value={form.product_id}
          onChange={set("product_id")}
          disabled={products.length === 0}
          className={inputClass(errors.product_id)}
        >
          <option value="">{products.length ? "เลือกเมนู" : "กำลังโหลดเมนู…"}</option>
          {products.map((p) => (
            <option key={p.product_id} value={p.product_id}>
              {p.product_name} · {formatBaht(p.price)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="จำนวน" hint={`1–${MAX_QTY} แก้ว`} error={errors.qty}>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_QTY}
          step={1}
          value={form.qty}
          onChange={set("qty")}
          className={inputClass(errors.qty)}
        />
      </Field>

      <Field label="วิธีชำระเงิน" error={errors.payment_method}>
        <select value={form.payment_method} onChange={set("payment_method")} className={inputClass(errors.payment_method)}>
          <option value="">เลือกวิธีชำระเงิน</option>
          {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>

      <Field label="รหัสสมาชิก" hint="ไม่บังคับ" error={errors.customer_id}>
        <input
          type="text"
          value={form.customer_id}
          onChange={set("customer_id")}
          placeholder="เช่น C01234"
          autoComplete="off"
          className={inputClass(errors.customer_id)}
        />
      </Field>

      <div className="flex items-baseline justify-between rounded-xl bg-paper px-4 py-3">
        <span className="text-sm text-muted">ยอดรวม</span>
        <span className="text-2xl font-medium tabular-nums tracking-tight text-ink">
          {preview == null ? "—" : formatBaht(preview)}
        </span>
      </div>

      <button
        type="submit"
        disabled={saving || products.length === 0}
        className="h-11 w-full rounded-xl bg-sage-ink text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "กำลังบันทึก…" : "บันทึกยอดขาย"}
      </button>

      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={`rounded-xl px-3 py-2 text-sm ${result.ok ? "bg-sage text-sage-ink" : "bg-blush text-blush-ink"}`}
        >
          {result.ok ? "✅ " : "❌ "}
          {result.text}
        </p>
      )}
    </form>
  );
}
