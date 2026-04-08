import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const PRODUCT_TYPES          = ["Clothing", "Jewelry", "Accessories"];
const CLOTHING_CATEGORIES    = ["Suit (Stitched)","Suit (Unstitched)","Lehnga","Sharara","Bridal Wear","Formal / Party Wear","Casual Wear","Kurti","Abaya","Dupatta","Other Clothing"];
const JEWELRY_CATEGORIES     = ["Necklace Set","Earrings","Bangles","Bridal Jewelry Set","Maang Tikka","Nath (Nose Ring)","Bracelet","Ring","Other Jewelry"];
const ACCESSORIES_CATEGORIES = ["Clutch / Bag","Shawl","Scarf","Shoes","Other Accessories"];
const EXPENSE_CATEGORIES     = ["Shipping","Packaging","Customs / Duties","Rent","Supplies","Marketing","Other"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DEFAULT_RATE = 0.0046;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toDay    = () => new Date().toISOString().split("T")[0];
const fmtCAD   = (n) => "$" + Number(n || 0).toFixed(2);
const fmtPKR   = (n) => "₨" + Math.round(Number(n || 0)).toLocaleString();
const pkrToCAD = (amount, rate) => Number(amount || 0) * Number(rate || DEFAULT_RATE);
const categoriesFor = (type) => {
  if (type === "Jewelry")     return JEWELRY_CATEGORIES;
  if (type === "Accessories") return ACCESSORIES_CATEGORIES;
  return CLOTHING_CATEGORIES;
};

// ─── Accounting (all CAD) ─────────────────────────────────────────────────────
// Uses exact Supabase column names from the sales + expenses tables.
// sales.total_revenue_cad  → Revenue
// sales.total_cogs_cad     → COGS
// expenses.amount_cad      → Operating Expenses
const calcTotals = (sales, expenses) => {
  const revenue  = sales.reduce   ((s, x) => s + Number(x.total_revenue_cad || 0), 0);
  const cogs     = sales.reduce   ((s, x) => s + Number(x.total_cogs_cad    || 0), 0);
  const opex     = expenses.reduce((s, e) => s + Number(e.amount_cad        || 0), 0);
  const totalExp = cogs + opex;
  const profit   = revenue - totalExp;
  return { revenue, cogs, opex, totalExp, profit };
};

const filterByMonth = (arr, key, m, y) =>
  arr.filter(x => { const d = new Date(x[key]); return d.getMonth() === m && d.getFullYear() === y; });
const filterByYear = (arr, key, y) =>
  arr.filter(x => new Date(x[key]).getFullYear() === y);

// ─── Theme ────────────────────────────────────────────────────────────────────
const t = {
  bg:"#F8F6F2", card:"#FFFFFF",
  sidebar:"#1B6B4A", sidebarText:"rgba(255,255,255,0.85)", sidebarActive:"rgba(255,255,255,0.18)",
  accent:"#C4883A", accentLight:"#FEF3E6",
  green:"#1E9E56", greenLight:"#E6F7EE",
  red:"#C0392B",   redLight:"#FDEDEB",
  blue:"#2471A3",  blueLight:"#EAF4FC",
  purple:"#7D3C98",purpleLight:"#F5EEF8",
  text:"#2A2725",  muted:"#7A756E", border:"#E8E3DC",
  primary:"#1B6B4A", primaryLight:"#E8F4EE",
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:${t.bg}}
  .app{font-family:'DM Sans',sans-serif;display:flex;min-height:100vh;color:${t.text};background:${t.bg}}

  .sidebar{width:224px;background:${t.sidebar};color:white;display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100;transition:transform .28s ease}
  .brand{padding:22px 20px 18px;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:8px}
  .brand-name{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:white;line-height:1.2}
  .brand-sub{font-size:11px;opacity:.6;margin-top:3px;letter-spacing:.4px}
  .nav-btn{display:flex;align-items:center;gap:11px;width:100%;padding:12px 20px;background:none;border:none;color:${t.sidebarText};font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;cursor:pointer;text-align:left;transition:background .15s;border-right:3px solid transparent}
  .nav-btn:hover{background:rgba(255,255,255,.08);color:white}
  .nav-btn.active{background:${t.sidebarActive};color:white;border-right-color:${t.accent}}
  .nav-divider{border:none;border-top:1px solid rgba(255,255,255,.1);margin:8px 0}

  .main{margin-left:224px;flex:1;padding:32px 28px;max-width:1100px}
  .hamburger{display:none;position:fixed;top:14px;left:14px;z-index:200;background:${t.sidebar};color:white;border:none;border-radius:8px;padding:8px;cursor:pointer;line-height:0}
  .overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.38);z-index:90}
  @media(max-width:768px){
    .sidebar{transform:translateX(-100%)}
    .sidebar.open{transform:translateX(0)}
    .main{margin-left:0;padding:20px 16px;padding-top:60px}
    .hamburger{display:block}
    .overlay.show{display:block}
    .two-col{grid-template-columns:1fr!important}
    .four-col{grid-template-columns:1fr 1fr!important}
  }
  @media(max-width:480px){.four-col{grid-template-columns:1fr!important}}

  .page-title{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:${t.text};margin-bottom:22px}
  .section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:${t.muted};margin-bottom:10px}

  .card{background:${t.card};border-radius:12px;border:1px solid ${t.border};padding:20px;margin-bottom:16px}
  .card-title{font-size:12px;font-weight:700;color:${t.muted};text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px}

  .stat-card{background:${t.card};border-radius:12px;padding:18px 20px;border:1px solid ${t.border}}
  .stat-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${t.muted};margin-bottom:5px}
  .stat-value{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;line-height:1.1}
  .stat-value.green{color:${t.green}} .stat-value.red{color:${t.red}}
  .stat-value.gold{color:${t.accent}} .stat-value.blue{color:${t.blue}}
  .stat-sub{font-size:12px;color:${t.muted};margin-top:3px}

  .tbl-wrap{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th{text-align:left;padding:9px 12px;font-size:11px;font-weight:700;color:${t.muted};text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${t.border};white-space:nowrap}
  td{padding:10px 12px;border-bottom:1px solid ${t.border};vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:${t.primaryLight}}

  .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;border:none;transition:all .15s;line-height:1}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .btn-primary{background:${t.primary};color:white} .btn-primary:hover:not(:disabled){background:#155A3E}
  .btn-outline{background:transparent;border:1.5px solid ${t.border};color:${t.text}}
  .btn-outline:hover:not(:disabled){border-color:${t.primary};color:${t.primary}}
  .btn-outline.active{border-color:${t.primary};color:${t.primary};background:${t.primaryLight}}
  .btn-danger{background:${t.redLight};color:${t.red}} .btn-danger:hover:not(:disabled){background:#F5C6C0}
  .btn-sm{padding:6px 11px;font-size:13px}

  .cur-toggle{display:flex;border:1.5px solid ${t.border};border-radius:8px;overflow:hidden}
  .cur-btn{flex:1;padding:10px 0;background:none;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;color:${t.muted}}
  .cur-btn.active{background:${t.primary};color:white}

  .form-group{margin-bottom:14px}
  label{display:block;font-size:13px;font-weight:600;color:${t.muted};margin-bottom:5px}
  .input{width:100%;padding:11px 13px;border:1.5px solid ${t.border};border-radius:8px;font-size:14px;font-family:'DM Sans',sans-serif;background:${t.bg};color:${t.text};transition:border-color .15s}
  .input:focus{outline:none;border-color:${t.primary}}
  .input:disabled{opacity:.6;cursor:not-allowed}
  select.input{appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%237A756E' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:520px){.form-row{grid-template-columns:1fr}}
  .converted-hint{font-size:12px;font-weight:600;padding:8px 12px;border-radius:6px;margin-top:6px;background:${t.blueLight};color:${t.blue}}

  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px}
  .modal{background:${t.card};border-radius:14px;padding:28px;width:100%;max-width:520px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.18)}
  .modal-wide{max-width:620px}
  .modal-title{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;margin-bottom:20px}
  .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}

  .empty{text-align:center;padding:44px 20px;color:${t.muted};font-size:15px}
  .empty-icon{font-size:38px;margin-bottom:10px;opacity:.5}

  .badge{display:inline-block;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600}
  .badge-green{background:${t.greenLight};color:${t.green}}
  .badge-gold{background:${t.accentLight};color:${t.accent}}
  .badge-red{background:${t.redLight};color:${t.red}}
  .badge-blue{background:${t.blueLight};color:${t.blue}}
  .badge-purple{background:${t.purpleLight};color:${t.purple}}

  .info-box{border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:8px}
  .info-green{background:${t.greenLight};color:${t.green}}
  .info-gold{background:${t.accentLight};color:${t.accent}}
  .info-red{background:${t.redLight};color:${t.red}}
  .info-blue{background:${t.blueLight};color:${t.blue}}

  .report-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid ${t.border};font-size:14px;gap:8px}
  .report-row:last-child{border-bottom:none}
  .report-row .lbl{color:${t.muted};flex-shrink:0}
  .report-row .val{font-weight:600;font-size:15px;text-align:right}
  .report-total{display:flex;justify-content:space-between;align-items:center;padding:14px 0 0;margin-top:8px;border-top:2px solid ${t.border}}

  .page-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px}
  .search-wrap{margin-bottom:14px}
  hr.divider{border:none;border-top:1px solid ${t.border};margin:12px 0}

  .rate-bar{display:flex;align-items:center;gap:10px;background:${t.purpleLight};border:1px solid #C39BD3;border-radius:10px;padding:10px 16px;margin-bottom:20px;flex-wrap:wrap}
  .rate-bar label{margin:0;font-size:13px;font-weight:600;color:${t.purple};white-space:nowrap}
  .rate-input{width:100px;padding:6px 10px;border:1.5px solid #C39BD3;border-radius:6px;font-size:14px;font-family:'DM Sans',sans-serif;background:white;color:${t.text}}
  .rate-input:focus{outline:none;border-color:${t.purple}}

  /* Error + loading banners */
  .err-bar{background:${t.redLight};border:1px solid ${t.red};border-radius:8px;padding:10px 16px;margin-bottom:14px;font-size:13px;color:${t.red};font-weight:600}
  .saving-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.accent};margin-left:8px;animation:pulse 1s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
`;

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = {
  dashboard:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  products: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M20 7H4a1 1 0 00-1 1v11a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1z"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
  sales:    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>,
  expenses: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  reports:  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 19V6l2-3h9a1 1 0 011 1v12a1 1 0 01-1 1H9z"/><path d="M9 19H5a1 1 0 01-1-1V4a1 1 0 011-1h4"/><line x1="13" y1="9" x2="17" y2="9"/><line x1="13" y1="13" x2="17" y2="13"/></svg>,
  settings: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  plus:  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  trash: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>,
  edit:  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  menu:  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
  close: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
};

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Modal({ title, onClose, wide, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

function ErrBar({ msg }) {
  if (!msg) return null;
  return <div className="err-bar">⚠ {msg}</div>;
}

function RateBar({ rate, onChange }) {
  const cadPer1k = (1000 * Number(rate)).toFixed(2);
  return (
    <div className="rate-bar">
      <label>Exchange Rate:</label>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <span style={{ fontSize:13, color:t.purple, fontWeight:600 }}>1 PKR =</span>
        <input className="rate-input" type="number" step="0.0001" min="0.0001"
          value={rate} onChange={e => onChange(e.target.value)} />
        <span style={{ fontSize:13, color:t.purple, fontWeight:600 }}>CAD</span>
      </div>
      <span style={{ fontSize:12, color:t.purple, opacity:.8 }}>
        ₨1,000 = {fmtCAD(cadPer1k)} · Update this when the rate changes (Google "PKR to CAD")
      </span>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ products, sales, expenses }) {
  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();

  // sales use sale_date; expenses use expense_date
  const mSales = filterByMonth(sales,    "sale_date",    m, y);
  const mExp   = filterByMonth(expenses, "expense_date", m, y);
  const ySales = filterByYear (sales,    "sale_date",    y);
  const yExp   = filterByYear (expenses, "expense_date", y);

  const mTot   = calcTotals(mSales, mExp);
  const yTot   = calcTotals(ySales, yExp);
  const allTot = calcTotals(sales,  expenses);

  const recentSales = [...sales].sort((a,b) => new Date(b.sale_date) - new Date(a.sale_date)).slice(0, 5);
  const recentExp   = [...expenses].sort((a,b) => new Date(b.expense_date) - new Date(a.expense_date)).slice(0, 4);
  const lowStock    = products.filter(p => Number(p.quantity) <= 3);

  return (
    <div>
      <div className="page-title">Dashboard — {MONTHS[m]} {y}</div>

      <div className="section-label">This Month</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:20 }} className="four-col">
        <div className="stat-card">
          <div className="stat-label">Revenue</div>
          <div className="stat-value gold">{fmtCAD(mTot.revenue)}</div>
          <div className="stat-sub">{mSales.length} sale{mSales.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">COGS</div>
          <div className="stat-value blue">{fmtCAD(mTot.cogs)}</div>
          <div className="stat-sub">Cost of goods sold</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Op. Expenses</div>
          <div className="stat-value red">{fmtCAD(mTot.opex)}</div>
          <div className="stat-sub">{mExp.length} entr{mExp.length !== 1 ? "ies" : "y"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net Profit</div>
          <div className={`stat-value ${mTot.profit >= 0 ? "green" : "red"}`}>{fmtCAD(mTot.profit)}</div>
          <div className="stat-sub">{mTot.revenue > 0 ? ((mTot.profit/mTot.revenue)*100).toFixed(1) + "% margin" : "—"}</div>
        </div>
      </div>

      <div className="section-label">This Year ({y})</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:20 }} className="four-col">
        <div className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value gold">{fmtCAD(yTot.revenue)}</div></div>
        <div className="stat-card"><div className="stat-label">COGS</div><div className="stat-value blue">{fmtCAD(yTot.cogs)}</div></div>
        <div className="stat-card"><div className="stat-label">Op. Expenses</div><div className="stat-value red">{fmtCAD(yTot.opex)}</div></div>
        <div className="stat-card"><div className="stat-label">Net Profit</div><div className={`stat-value ${yTot.profit >= 0 ? "green" : "red"}`}>{fmtCAD(yTot.profit)}</div></div>
      </div>

      <div className="card" style={{ borderLeft:`4px solid ${t.green}`, background:t.greenLight, marginBottom:16 }}>
        <div className="card-title" style={{ color:t.green }}>All-Time Net Profit</div>
        <div style={{ fontSize:32, fontFamily:"'Playfair Display',serif", fontWeight:700, color:allTot.profit >= 0 ? t.green : t.red }}>
          {fmtCAD(allTot.profit)}
        </div>
        <div style={{ fontSize:13, color:t.muted, marginTop:4 }}>
          Revenue {fmtCAD(allTot.revenue)} · COGS {fmtCAD(allTot.cogs)} · Op. Expenses {fmtCAD(allTot.opex)}
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="card" style={{ borderLeft:`4px solid ${t.accent}`, background:t.accentLight, marginBottom:16 }}>
          <div className="card-title" style={{ color:t.accent }}>⚠ Low Stock ({lowStock.length} item{lowStock.length > 1 ? "s" : ""})</div>
          <div style={{ fontSize:13, color:t.text, display:"flex", flexWrap:"wrap", gap:"6px 16px" }}>
            {lowStock.map(p => <span key={p.id}>{p.name} — <strong>{p.quantity}</strong> left</span>)}
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }} className="two-col">
        <div className="card" style={{ marginBottom:0 }}>
          <div className="card-title">Recent Sales</div>
          {recentSales.length === 0
            ? <div className="empty" style={{ padding:"14px 0" }}><div className="empty-icon">🛍️</div>No sales yet</div>
            : recentSales.map(s => (
              <div key={s.id} className="report-row">
                <div>
                  <div style={{ fontWeight:500 }}>{s.product_name}</div>
                  <div style={{ fontSize:12, color:t.muted }}>{new Date(s.sale_date).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:600, color:t.accent }}>{fmtCAD(s.total_revenue_cad)}</div>
                  {s.total_cogs_cad > 0 && <div style={{ fontSize:11, color:t.blue }}>COGS {fmtCAD(s.total_cogs_cad)}</div>}
                  {s.unit_cost_pkr > 0 && <div style={{ fontSize:11, color:t.muted }}>{fmtPKR(s.unit_cost_pkr * s.quantity_sold)} PKR</div>}
                </div>
              </div>
            ))
          }
        </div>
        <div className="card" style={{ marginBottom:0 }}>
          <div className="card-title">Recent Expenses</div>
          {recentExp.length === 0
            ? <div className="empty" style={{ padding:"14px 0" }}><div className="empty-icon">💸</div>No expenses yet</div>
            : recentExp.map(e => (
              <div key={e.id} className="report-row">
                <div>
                  <div style={{ fontWeight:500 }}>{e.title}</div>
                  <div style={{ fontSize:12, color:t.muted }}>{e.category} · {new Date(e.expense_date).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:600, color:t.red }}>{fmtCAD(e.amount_cad)}</div>
                  {e.currency === "PKR" && <div style={{ fontSize:11, color:t.muted }}>{fmtPKR(e.amount_original)} PKR</div>}
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── Products ─────────────────────────────────────────────────────────────────
const blankProduct = () => ({
  name:"", type:"Clothing", category:CLOTHING_CATEGORIES[0],
  cost_pkr:"", cost_cad:"", selling_price_cad:"", quantity:"1", notes:""
});

function Products({ products, setProducts, rate }) {
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(blankProduct());
  const [editId, setEditId]     = useState(null);
  const [search, setSearch]     = useState("");
  const [filterType, setFilter] = useState("All");
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");

  const setType = (type) => setForm(f => ({ ...f, type, category:categoriesFor(type)[0] }));

  const onCostPKR = (val) => {
    const converted = pkrToCAD(val, rate);
    setForm(f => ({ ...f, cost_pkr:val, cost_cad:converted.toFixed(4) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setErr("");
    const payload = {
      name: form.name.trim(),
      type: form.type,
      category: form.category,
      cost_pkr: Number(form.cost_pkr) || null,
      cost_cad: Number(form.cost_cad) || null,
      selling_price_cad: Number(form.selling_price_cad) || null,
      quantity: Number(form.quantity) || 0,
      notes: form.notes || null,
    };

    try {
      if (editId) {
        const { data, error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editId)
          .select()
          .single();
        if (error) throw error;
        setProducts(prev => prev.map(p => p.id === editId ? data : p));
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setProducts(prev => [...prev, data]);
      }
      setForm(blankProduct()); setShowAdd(false); setEditId(null);
    } catch (e) {
      setErr(e.message || "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p) => {
    setForm({
      name: p.name, type: p.type, category: p.category,
      cost_pkr: p.cost_pkr ?? "", cost_cad: p.cost_cad ?? "",
      selling_price_cad: p.selling_price_cad ?? "",
      quantity: p.quantity ?? "1", notes: p.notes ?? ""
    });
    setEditId(p.id); setShowAdd(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  let filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || "").toLowerCase().includes(search.toLowerCase())
  );
  if (filterType !== "All") filtered = filtered.filter(p => p.type === filterType);

  const marginPct = (p) => {
    if (!p.cost_cad || !p.selling_price_cad) return null;
    return (((Number(p.selling_price_cad) - Number(p.cost_cad)) / Number(p.selling_price_cad)) * 100).toFixed(0);
  };

  const cats = categoriesFor(form.type);

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{ marginBottom:0 }}>Products & Inventory</div>
        <button className="btn btn-primary" onClick={() => { setForm(blankProduct()); setEditId(null); setShowAdd(true); }}>
          {Ic.plus} Add Product
        </button>
      </div>

      <RateBar rate={rate} onChange={() => {}} />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:16 }}>
        <div className="stat-card"><div className="stat-label">Total Products</div><div className="stat-value">{products.length}</div></div>
        <div className="stat-card"><div className="stat-label">Clothing</div><div className="stat-value">{products.filter(p => p.type === "Clothing").length}</div></div>
        <div className="stat-card"><div className="stat-label">Jewelry</div><div className="stat-value">{products.filter(p => p.type === "Jewelry").length}</div></div>
        <div className="stat-card"><div className="stat-label">Low Stock</div><div className="stat-value" style={{ color:t.red }}>{products.filter(p => Number(p.quantity) <= 3).length}</div></div>
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
        {["All", ...PRODUCT_TYPES].map(tp => (
          <button key={tp} className={`btn btn-sm btn-outline ${filterType === tp ? "active" : ""}`} onClick={() => setFilter(tp)}>{tp}</button>
        ))}
      </div>
      <div className="search-wrap">
        <input className="input" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0
        ? <div className="card empty"><div className="empty-icon">👗</div>{products.length === 0 ? "No products yet — add your first item!" : "No products match your search."}</div>
        : <div className="card" style={{ padding:0, overflow:"hidden" }}>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Product</th><th>Type</th><th>Cost (PKR)</th><th>Cost (CAD)</th><th>Sell Price</th><th>Margin</th><th>Stock</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const mg = marginPct(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight:500 }}>{p.name}</div>
                        <div style={{ fontSize:11, color:t.muted }}>{p.category}</div>
                      </td>
                      <td><span className={`badge ${p.type === "Jewelry" ? "badge-gold" : p.type === "Accessories" ? "badge-blue" : "badge-green"}`}>{p.type || "—"}</span></td>
                      <td style={{ color:t.muted }}>{p.cost_pkr ? fmtPKR(p.cost_pkr) : "—"}</td>
                      <td style={{ color:t.blue, fontWeight:500 }}>{p.cost_cad ? fmtCAD(p.cost_cad) : "—"}</td>
                      <td style={{ fontWeight:600 }}>{p.selling_price_cad ? fmtCAD(p.selling_price_cad) : "—"}</td>
                      <td style={{ fontWeight:600, color:mg >= 30 ? t.green : mg >= 10 ? t.accent : t.red }}>{mg != null ? `${mg}%` : "—"}</td>
                      <td><span className={`badge ${Number(p.quantity) === 0 ? "badge-red" : Number(p.quantity) <= 3 ? "badge-gold" : "badge-green"}`}>{p.quantity}</span></td>
                      <td>
                        <div style={{ display:"flex", gap:6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>{Ic.edit}</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>{Ic.trash}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      }

      {showAdd && (
        <Modal title={editId ? "Edit Product" : "Add Product"} onClose={() => { setShowAdd(false); setEditId(null); }}>
          <ErrBar msg={err} />
          <div className="form-group">
            <label>Product Name *</label>
            <input className="input" placeholder="e.g. Pink Embroidered Suit" value={form.name} onChange={e => setForm({ ...form, name:e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select className="input" value={form.type} onChange={e => setType(e.target.value)}>
                {PRODUCT_TYPES.map(tp => <option key={tp}>{tp}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="input" value={form.category} onChange={e => setForm({ ...form, category:e.target.value })}>
                {cats.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ background:t.blueLight, borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:t.blue, marginBottom:10, textTransform:"uppercase", letterSpacing:.5 }}>Product Cost</div>
            <div className="form-row" style={{ marginBottom:0 }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label>Cost in PKR ₨</label>
                <input className="input" type="number" placeholder="e.g. 14000" value={form.cost_pkr} onChange={e => onCostPKR(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label>Auto-converted (CAD)</label>
                <input className="input" type="number" placeholder="auto" value={form.cost_cad ? Number(form.cost_cad).toFixed(2) : ""} onChange={e => setForm({ ...form, cost_cad:e.target.value })} />
              </div>
            </div>
            {form.cost_pkr && <div style={{ fontSize:12, color:t.blue, marginTop:6 }}>Rate: 1 PKR = {Number(rate).toFixed(4)} CAD</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Selling Price (CAD) $</label>
              <input className="input" type="number" placeholder="0.00" value={form.selling_price_cad} onChange={e => setForm({ ...form, selling_price_cad:e.target.value })} />
            </div>
            <div className="form-group">
              <label>Quantity in Stock</label>
              <input className="input" type="number" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity:e.target.value })} />
            </div>
          </div>

          {form.cost_cad && form.selling_price_cad && (
            <div className="info-box info-green">
              Profit per item: {fmtCAD(Number(form.selling_price_cad) - Number(form.cost_cad))} ·
              Margin: {(((Number(form.selling_price_cad) - Number(form.cost_cad)) / Number(form.selling_price_cad)) * 100).toFixed(0)}%
            </div>
          )}

          <div className="form-group">
            <label>Notes (optional)</label>
            <input className="input" placeholder="Any details…" value={form.notes} onChange={e => setForm({ ...form, notes:e.target.value })} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => { setShowAdd(false); setEditId(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editId ? "Save Changes" : "Add Product"}
              {saving && <span className="saving-dot" />}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sales ────────────────────────────────────────────────────────────────────
const blankSale = () => ({
  sale_date: toDay(), product_id:"", product_name:"", custom_item:"",
  quantity_sold:"1", sale_price_cad:"", unit_cost_pkr:"", unit_cost_cad:"", notes:""
});

function Sales({ products, setProducts, sales, setSales, rate }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState(blankSale());
  const [search, setSearch]   = useState("");
  const [useCustom, setCustom]= useState(false);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");

  const selectProduct = (id) => {
    if (!id) { setForm(f => ({ ...f, product_id:"", product_name:"", sale_price_cad:"", unit_cost_pkr:"", unit_cost_cad:"" })); return; }
    const p = products.find(x => x.id === id);
    if (!p) return;
    setForm(f => ({
      ...f,
      product_id: p.id,
      product_name: p.name,
      sale_price_cad: p.selling_price_cad ?? "",
      unit_cost_pkr:  p.cost_pkr  ?? "",
      unit_cost_cad:  p.cost_cad  ?? "",
    }));
  };

  const handleSave = async () => {
    const label = useCustom ? form.custom_item : form.product_name;
    if (!label || !form.sale_price_cad) return;
    setSaving(true); setErr("");

    const qty      = Number(form.quantity_sold) || 1;
    const unitCostCAD = Number(form.unit_cost_cad) || 0;
    const unitCostPKR = Number(form.unit_cost_pkr) || 0;
    const unitPrice   = Number(form.sale_price_cad) || 0;

    const payload = {
      sale_date:        form.sale_date,
      product_id:       (!useCustom && form.product_id) ? form.product_id : null,
      product_name:     label,
      quantity_sold:    qty,
      unit_cost_pkr:    unitCostPKR || null,
      unit_cost_cad:    unitCostCAD || null,
      sale_price_cad:   unitPrice,
      total_revenue_cad: unitPrice * qty,
      total_cogs_cad:   unitCostCAD * qty,
      notes:            form.notes || null,
    };

    try {
      // Insert sale
      const { data: saleRow, error: saleErr } = await supabase
        .from("sales")
        .insert(payload)
        .select()
        .single();
      if (saleErr) throw saleErr;

      // Deduct stock from product
      if (!useCustom && form.product_id) {
        const product = products.find(p => p.id === form.product_id);
        if (product) {
          const newQty = Math.max(0, Number(product.quantity) - qty);
          const { data: updatedProd, error: prodErr } = await supabase
            .from("products")
            .update({ quantity: newQty })
            .eq("id", form.product_id)
            .select()
            .single();
          if (prodErr) throw prodErr;
          setProducts(prev => prev.map(p => p.id === form.product_id ? updatedProd : p));
        }
      }

      setSales(prev => [saleRow, ...prev]);
      setForm(blankSale()); setCustom(false); setShowAdd(false);
    } catch (e) {
      setErr(e.message || "Failed to save sale.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this sale?")) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setSales(prev => prev.filter(s => s.id !== id));
  };

  const sorted   = [...sales].sort((a,b) => new Date(b.sale_date) - new Date(a.sale_date));
  const filtered = sorted.filter(s => (s.product_name || "").toLowerCase().includes(search.toLowerCase()));

  const allTot  = calcTotals(sales, []);
  const qty     = Number(form.quantity_sold || 1);
  const saleRev = Number(form.sale_price_cad || 0) * qty;
  const saleCOGS= Number(form.unit_cost_cad  || 0) * qty;
  const saleGP  = form.sale_price_cad ? saleRev - saleCOGS : null;

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{ marginBottom:0 }}>Sales</div>
        <button className="btn btn-primary" onClick={() => { setForm(blankSale()); setCustom(false); setShowAdd(true); }}>
          {Ic.plus} New Sale
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:16 }}>
        <div className="stat-card">
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value gold">{fmtCAD(allTot.revenue)}</div>
          <div className="stat-sub">{sales.length} total sales</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total COGS</div>
          <div className="stat-value blue">{fmtCAD(allTot.cogs)}</div>
          <div className="stat-sub">Auto from product costs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Gross Profit</div>
          <div className={`stat-value ${allTot.revenue - allTot.cogs >= 0 ? "green" : "red"}`}>{fmtCAD(allTot.revenue - allTot.cogs)}</div>
          <div className="stat-sub">Before operating expenses</div>
        </div>
      </div>

      <div className="search-wrap">
        <input className="input" placeholder="Search sales…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0
        ? <div className="card empty"><div className="empty-icon">🛍️</div>{sales.length === 0 ? "No sales recorded yet — add your first sale!" : "No sales match your search."}</div>
        : <div className="card" style={{ padding:0, overflow:"hidden" }}>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Item</th><th>Qty</th><th>Revenue</th><th>COGS</th><th>PKR Cost</th><th>Gross Profit</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const gp = s.total_cogs_cad != null ? s.total_revenue_cad - s.total_cogs_cad : null;
                  return (
                    <tr key={s.id}>
                      <td style={{ whiteSpace:"nowrap" }}>{new Date(s.sale_date).toLocaleDateString()}</td>
                      <td style={{ fontWeight:500 }}>{s.product_name}</td>
                      <td>{s.quantity_sold}</td>
                      <td style={{ fontWeight:600, color:t.accent }}>{fmtCAD(s.total_revenue_cad)}</td>
                      <td style={{ color:t.blue }}>{s.total_cogs_cad ? fmtCAD(s.total_cogs_cad) : <span style={{ color:t.muted }}>—</span>}</td>
                      <td style={{ color:t.muted, fontSize:12 }}>{s.unit_cost_pkr ? fmtPKR(s.unit_cost_pkr * s.quantity_sold) : "—"}</td>
                      <td style={{ fontWeight:600, color:gp != null ? (gp >= 0 ? t.green : t.red) : t.muted }}>{gp != null ? fmtCAD(gp) : "—"}</td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>{Ic.trash}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      }

      {showAdd && (
        <Modal title="New Sale" onClose={() => setShowAdd(false)} wide>
          <ErrBar msg={err} />
          <div className="form-group">
            <label>Date</label>
            <input className="input" type="date" value={form.sale_date} onChange={e => setForm({ ...form, sale_date:e.target.value })} />
          </div>

          {!useCustom ? (
            <div className="form-group">
              <label>Select Product <span style={{ color:t.muted, fontWeight:400 }}>(auto-fills cost & price)</span></label>
              <select className="input" value={form.product_id} onChange={e => selectProduct(e.target.value)}>
                <option value="">— Choose a product —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.quantity})</option>)}
              </select>
              <button style={{ background:"none", border:"none", color:t.primary, cursor:"pointer", fontWeight:600, fontSize:13, padding:"6px 0 0", display:"block" }}
                onClick={() => { setCustom(true); setForm(f => ({ ...f, product_id:"", product_name:"", sale_price_cad:"", unit_cost_pkr:"", unit_cost_cad:"" })); }}>
                + Type item name manually instead
              </button>
            </div>
          ) : (
            <div className="form-group">
              <label>Item Name</label>
              <input className="input" placeholder="What was sold?" value={form.custom_item} onChange={e => setForm({ ...form, custom_item:e.target.value })} />
              <button style={{ background:"none", border:"none", color:t.primary, cursor:"pointer", fontWeight:600, fontSize:13, padding:"6px 0 0", display:"block" }}
                onClick={() => { setCustom(false); setForm(f => ({ ...f, custom_item:"" })); }}>
                ← Pick from products instead
              </button>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Quantity Sold</label>
              <input className="input" type="number" min="1" value={form.quantity_sold} onChange={e => setForm({ ...form, quantity_sold:e.target.value })} />
            </div>
            <div className="form-group">
              <label>Sale Price per item (CAD) *</label>
              <input className="input" type="number" placeholder="0.00" value={form.sale_price_cad} onChange={e => setForm({ ...form, sale_price_cad:e.target.value })} />
            </div>
          </div>

          <div style={{ background:t.blueLight, borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:t.blue, marginBottom:8, textTransform:"uppercase", letterSpacing:.5 }}>
              Product Cost (COGS) — auto-filled from product
            </div>
            <div className="form-row" style={{ marginBottom:0 }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label>Cost per item (PKR)</label>
                <input className="input" type="number" placeholder="₨ cost" value={form.unit_cost_pkr}
                  onChange={e => {
                    const cv = pkrToCAD(e.target.value, rate);
                    setForm(f => ({ ...f, unit_cost_pkr:e.target.value, unit_cost_cad:cv.toFixed(4) }));
                  }} />
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label>Cost per item (CAD)</label>
                <input className="input" type="number" placeholder="auto"
                  value={form.unit_cost_cad ? Number(form.unit_cost_cad).toFixed(2) : ""}
                  onChange={e => setForm({ ...form, unit_cost_cad:e.target.value })} />
              </div>
            </div>
          </div>

          {form.sale_price_cad && (
            <div style={{ marginBottom:14 }}>
              <div className="info-box info-gold">Revenue: {fmtCAD(saleRev)}</div>
              {form.unit_cost_cad && <>
                <div className="info-box info-blue">
                  COGS: {fmtCAD(saleCOGS)}
                  {form.unit_cost_pkr && <span style={{ opacity:.7 }}> · {fmtPKR(Number(form.unit_cost_pkr)*qty)} PKR</span>}
                </div>
                <div className={`info-box ${saleGP >= 0 ? "info-green" : "info-red"}`}>Gross Profit: {fmtCAD(saleGP)}</div>
              </>}
            </div>
          )}

          <div className="form-group">
            <label>Notes (optional)</label>
            <input className="input" placeholder="Any details…" value={form.notes} onChange={e => setForm({ ...form, notes:e.target.value })} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Sale"}
              {saving && <span className="saving-dot" />}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
const blankExp = () => ({
  expense_date:toDay(), title:"", category:EXPENSE_CATEGORIES[0],
  currency:"PKR", amount_original:"", amount_cad:"", notes:""
});

function Expenses({ expenses, setExpenses, sales, rate }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState(blankExp());
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");
  const now = new Date();

  const onCurrencyChange = (cur) => {
    const converted = cur === "PKR" ? pkrToCAD(form.amount_original, rate) : Number(form.amount_original || 0);
    setForm(f => ({ ...f, currency:cur, amount_cad:converted.toFixed(2) }));
  };

  const onAmountChange = (val) => {
    const converted = form.currency === "PKR" ? pkrToCAD(val, rate) : Number(val || 0);
    setForm(f => ({ ...f, amount_original:val, amount_cad:converted.toFixed(2) }));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.amount_original) return;
    setSaving(true); setErr("");
    const payload = {
      expense_date:    form.expense_date,
      title:           form.title.trim(),
      category:        form.category,
      amount_original: Number(form.amount_original),
      currency:        form.currency,
      amount_cad:      Number(form.amount_cad),
      notes:           form.notes || null,
    };
    try {
      const { data, error } = await supabase.from("expenses").insert(payload).select().single();
      if (error) throw error;
      setExpenses(prev => [data, ...prev]);
      setForm(blankExp()); setShowAdd(false);
    } catch (e) {
      setErr(e.message || "Failed to save expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const sorted = [...expenses].sort((a,b) => new Date(b.expense_date) - new Date(a.expense_date));

  const opex  = expenses.reduce((s,e) => s + Number(e.amount_cad || 0), 0);
  const cogst = sales.reduce((s,x) => s + Number(x.total_cogs_cad || 0), 0);

  const mOpex = filterByMonth(expenses, "expense_date", now.getMonth(), now.getFullYear())
    .reduce((s,e) => s + Number(e.amount_cad || 0), 0);
  const mCOGS = filterByMonth(sales, "sale_date", now.getMonth(), now.getFullYear())
    .reduce((s,x) => s + Number(x.total_cogs_cad || 0), 0);

  const byCat = {};
  expenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount_cad || 0); });

  const bySaleProd = {};
  sales.forEach(s => {
    if (!s.total_cogs_cad) return;
    const k = s.product_name;
    bySaleProd[k] = (bySaleProd[k] || 0) + Number(s.total_cogs_cad);
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{ marginBottom:0 }}>Expenses</div>
        <button className="btn btn-primary" onClick={() => { setForm(blankExp()); setShowAdd(true); }}>
          {Ic.plus} Add Expense
        </button>
      </div>

      <RateBar rate={rate} onChange={() => {}} />

      <div className="section-label">This Month</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
        <div className="stat-card"><div className="stat-label">COGS (from Sales)</div><div className="stat-value blue">{fmtCAD(mCOGS)}</div><div className="stat-sub">Auto from sales</div></div>
        <div className="stat-card"><div className="stat-label">Operating Expenses</div><div className="stat-value red">{fmtCAD(mOpex)}</div><div className="stat-sub">Manually entered</div></div>
        <div className="stat-card"><div className="stat-label">Total Expenses</div><div className="stat-value red">{fmtCAD(mCOGS + mOpex)}</div><div className="stat-sub">COGS + Operating</div></div>
      </div>

      <div className="section-label">All Time</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }} className="two-col">
        <div className="card" style={{ marginBottom:0, borderTop:`3px solid ${t.blue}` }}>
          <div className="card-title" style={{ color:t.blue }}>Cost of Goods Sold (COGS)</div>
          <div style={{ fontSize:12, color:t.muted, marginBottom:10, lineHeight:1.5 }}>Auto-calculated from sales. PKR costs converted at time of sale.</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, color:t.blue }}>{fmtCAD(cogst)}</div>
          {Object.keys(bySaleProd).length > 0 && (
            <>
              <hr className="divider" />
              {Object.entries(bySaleProd).sort((a,b) => b[1]-a[1]).slice(0,5).map(([name, amt]) => (
                <div key={name} className="report-row" style={{ padding:"7px 0" }}>
                  <span style={{ color:t.text, fontWeight:500, fontSize:13 }}>{name}</span>
                  <span style={{ fontWeight:600, color:t.blue }}>{fmtCAD(amt)}</span>
                </div>
              ))}
            </>
          )}
          {cogst === 0 && <div style={{ fontSize:13, color:t.muted, marginTop:8 }}>No product costs in sales yet.</div>}
        </div>

        <div className="card" style={{ marginBottom:0, borderTop:`3px solid ${t.red}` }}>
          <div className="card-title" style={{ color:t.red }}>Operating Expenses</div>
          <div style={{ fontSize:12, color:t.muted, marginBottom:10, lineHeight:1.5 }}>Business costs entered manually. PKR converted to CAD at entry.</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, color:t.red }}>{fmtCAD(opex)}</div>
          {Object.keys(byCat).length > 0 && (
            <>
              <hr className="divider" />
              {Object.entries(byCat).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => (
                <div key={cat} className="report-row" style={{ padding:"7px 0" }}>
                  <span className="lbl">{cat}</span>
                  <span style={{ fontWeight:600, color:t.red }}>{fmtCAD(amt)}</span>
                </div>
              ))}
            </>
          )}
          {opex === 0 && <div style={{ fontSize:13, color:t.muted, marginTop:8 }}>No operating expenses yet.</div>}
        </div>
      </div>

      <div className="card" style={{ background:t.redLight, border:`1px solid ${t.red}`, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>Total Expenses — All Time</div>
            <div style={{ fontSize:13, color:t.muted, marginTop:2 }}>COGS {fmtCAD(cogst)} + Operating {fmtCAD(opex)}</div>
          </div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:30, fontWeight:700, color:t.red }}>{fmtCAD(cogst + opex)}</div>
        </div>
      </div>

      <div className="section-label">Operating Expense Log</div>
      {sorted.length === 0
        ? <div className="card empty"><div className="empty-icon">💸</div>No operating expenses recorded yet.</div>
        : <div className="card" style={{ padding:0, overflow:"hidden" }}>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Original</th><th>CAD Amount</th><th></th></tr></thead>
              <tbody>
                {sorted.map(e => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace:"nowrap" }}>{new Date(e.expense_date).toLocaleDateString()}</td>
                    <td style={{ fontWeight:500 }}>{e.title}</td>
                    <td><span className="badge badge-red">{e.category}</span></td>
                    <td style={{ color:t.muted, fontSize:13 }}>
                      {e.currency === "PKR"
                        ? <>{fmtPKR(e.amount_original)} <span className="badge badge-purple" style={{ fontSize:10 }}>PKR</span></>
                        : <>{fmtCAD(e.amount_original)} <span className="badge badge-green" style={{ fontSize:10 }}>CAD</span></>
                      }
                    </td>
                    <td style={{ fontWeight:600, color:t.red }}>{fmtCAD(e.amount_cad)}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)}>{Ic.trash}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      }

      {showAdd && (
        <Modal title="Add Operating Expense" onClose={() => setShowAdd(false)} wide>
          <ErrBar msg={err} />
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input className="input" type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date:e.target.value })} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="input" value={form.category} onChange={e => setForm({ ...form, category:e.target.value })}>
                {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description *</label>
            <input className="input" placeholder="What was this expense for?" value={form.title} onChange={e => setForm({ ...form, title:e.target.value })} />
          </div>
          <div className="form-group">
            <label>Currency</label>
            <div className="cur-toggle">
              <button className={`cur-btn ${form.currency === "PKR" ? "active" : ""}`} onClick={() => onCurrencyChange("PKR")}>₨ PKR</button>
              <button className={`cur-btn ${form.currency === "CAD" ? "active" : ""}`} onClick={() => onCurrencyChange("CAD")}>$ CAD</button>
            </div>
          </div>
          <div className="form-group">
            <label>Amount {form.currency === "PKR" ? "(PKR ₨)" : "(CAD $)"} *</label>
            <input className="input" type="number" placeholder={form.currency === "PKR" ? "e.g. 5000" : "e.g. 25.00"}
              value={form.amount_original} onChange={e => onAmountChange(e.target.value)} />
            {form.currency === "PKR" && form.amount_original && (
              <div className="converted-hint">= {fmtCAD(form.amount_cad)} CAD at current rate (1 PKR = {Number(rate).toFixed(4)} CAD)</div>
            )}
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <input className="input" placeholder="Any extra details…" value={form.notes} onChange={e => setForm({ ...form, notes:e.target.value })} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Expense"}
              {saving && <span className="saving-dot" />}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────
function Reports({ sales, expenses }) {
  const now = new Date();
  const [mode,  setMode]  = useState("month");
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());

  const years = [];
  for (let y = 2023; y <= now.getFullYear() + 1; y++) years.push(y);

  const getSales = () => {
    if (mode === "month") return filterByMonth(sales,    "sale_date",    month, year);
    if (mode === "year")  return filterByYear (sales,    "sale_date",    year);
    return sales;
  };
  const getExp = () => {
    if (mode === "month") return filterByMonth(expenses, "expense_date", month, year);
    if (mode === "year")  return filterByYear (expenses, "expense_date", year);
    return expenses;
  };

  const sl  = getSales();
  const ex  = getExp();
  const tot = calcTotals(sl, ex);
  const gp  = tot.revenue - tot.cogs;
  const label = mode === "month" ? `${MONTHS[month]} ${year}` : mode === "year" ? String(year) : "All Time";

  const byProd = {};
  sl.forEach(s => { byProd[s.product_name] = (byProd[s.product_name] || 0) + Number(s.total_revenue_cad || 0); });
  const topProds = Object.entries(byProd).sort((a,b) => b[1]-a[1]).slice(0,6);

  const byCat = {};
  ex.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount_cad || 0); });

  const pkrOriginated = ex.filter(e => e.currency === "PKR").reduce((s,e) => s + Number(e.amount_original || 0), 0);

  return (
    <div>
      <div className="page-title">Reports</div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
        {[["month","By Month"],["year","By Year"],["all","All Time"]].map(([v,lbl]) => (
          <button key={v} className={`btn btn-sm ${mode === v ? "btn-primary" : "btn-outline"}`} onClick={() => setMode(v)}>{lbl}</button>
        ))}
        {mode === "month" && <>
          <select className="input" style={{ width:"auto", minWidth:130 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m,i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select className="input" style={{ width:"auto", minWidth:80 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        </>}
        {mode === "year" && (
          <select className="input" style={{ width:"auto", minWidth:80 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        )}
      </div>

      <div className="card">
        <div className="card-title">Profit & Loss — {label} (all values in CAD)</div>
        <div className="report-row">
          <span className="lbl">Revenue <span style={{ fontSize:11 }}>(total sales)</span></span>
          <span className="val" style={{ color:t.accent }}>{fmtCAD(tot.revenue)}</span>
        </div>
        <div className="report-row">
          <span style={{ color:t.blue }}>Less: Cost of Goods Sold (COGS)</span>
          <span style={{ fontWeight:600, color:t.blue }}>({fmtCAD(tot.cogs)})</span>
        </div>
        <div className="report-row" style={{ borderBottom:`2px solid ${t.border}`, paddingBottom:12 }}>
          <span style={{ fontWeight:600 }}>Gross Profit</span>
          <span style={{ fontWeight:700, color:gp >= 0 ? t.green : t.red }}>{fmtCAD(gp)}</span>
        </div>
        <div className="report-row" style={{ paddingTop:12 }}>
          <span style={{ color:t.red }}>Less: Operating Expenses</span>
          <span style={{ fontWeight:600, color:t.red }}>({fmtCAD(tot.opex)})</span>
        </div>
        <div className="report-total">
          <span style={{ fontWeight:700, fontSize:16 }}>Net Profit</span>
          <span style={{ fontWeight:700, fontSize:22, color:tot.profit >= 0 ? t.green : t.red }}>
            {fmtCAD(tot.profit)}
            {tot.revenue > 0 && <span style={{ fontSize:14, marginLeft:8, fontWeight:500 }}>({((tot.profit/tot.revenue)*100).toFixed(1)}% margin)</span>}
          </span>
        </div>
      </div>

      {pkrOriginated > 0 && (
        <div className="card" style={{ background:t.purpleLight, border:`1px solid #C39BD3`, marginBottom:16 }}>
          <div style={{ fontSize:13, color:t.purple, fontWeight:600 }}>
            {fmtPKR(pkrOriginated)} PKR in operating expenses — converted to CAD using saved exchange rate.
          </div>
        </div>
      )}

      {(topProds.length > 0 || Object.keys(byCat).length > 0) && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }} className="two-col">
          {topProds.length > 0 && (
            <div className="card" style={{ marginBottom:0 }}>
              <div className="card-title">Top Items by Revenue</div>
              {topProds.map(([name, rev]) => (
                <div key={name} className="report-row">
                  <span style={{ fontWeight:500 }}>{name}</span>
                  <span style={{ fontWeight:600, color:t.accent }}>{fmtCAD(rev)}</span>
                </div>
              ))}
            </div>
          )}
          {Object.keys(byCat).length > 0 && (
            <div className="card" style={{ marginBottom:0 }}>
              <div className="card-title">Operating Expenses by Category</div>
              {Object.entries(byCat).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => (
                <div key={cat} className="report-row">
                  <span className="lbl">{cat}</span>
                  <span style={{ fontWeight:600, color:t.red }}>{fmtCAD(amt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sl.length === 0 && ex.length === 0 && (
        <div className="card empty"><div className="empty-icon">📊</div>No data for {label}. Start adding sales and expenses!</div>
      )}
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function Settings({ rate, setRate }) {
  const pkrPer1cad = Number(rate) > 0 ? (1 / Number(rate)).toFixed(0) : "—";
  const quickRates = [0.0035, 0.0040, 0.0046, 0.0050, 0.0055];

  return (
    <div>
      <div className="page-title">Settings</div>
      <div className="card">
        <div className="card-title">Exchange Rate — PKR to CAD</div>
        <p style={{ fontSize:14, color:t.muted, marginBottom:18, lineHeight:1.6 }}>
          Used everywhere to convert PKR product costs and expenses into CAD.
          Update it whenever the rate changes. Google <strong>"PKR to CAD"</strong> for the latest rate.
        </p>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
          <div>
            <label style={{ marginBottom:6 }}>1 PKR = ? CAD</label>
            <input className="input" type="number" step="0.0001" min="0.0001" style={{ maxWidth:160 }}
              value={rate} onChange={e => setRate(e.target.value)} />
          </div>
          <div style={{ fontSize:14, color:t.muted, paddingTop:20 }}>= {pkrPer1cad} PKR per $1 CAD</div>
        </div>
        <div style={{ fontSize:13, marginBottom:10, color:t.muted }}>Quick select:</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
          {quickRates.map(r => (
            <button key={r} className={`btn btn-sm btn-outline ${Number(rate) === r ? "active" : ""}`}
              onClick={() => setRate(String(r))}>{r}</button>
          ))}
        </div>
        <div style={{ background:t.greenLight, borderRadius:10, padding:"14px 16px" }}>
          <div style={{ fontWeight:700, color:t.green, marginBottom:10 }}>Conversion Table</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 24px", fontSize:14 }}>
            {[1000,2000,5000,10000,20000,50000].map(p => (
              <div key={p} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:`1px solid ${t.border}` }}>
                <span style={{ color:t.muted }}>{fmtPKR(p)}</span>
                <span style={{ fontWeight:600, color:t.green }}>{fmtCAD(pkrToCAD(p, rate))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard", label:"Dashboard", icon:Ic.dashboard },
  { id:"products",  label:"Products",  icon:Ic.products  },
  { id:"sales",     label:"Sales",     icon:Ic.sales     },
  { id:"expenses",  label:"Expenses",  icon:Ic.expenses  },
  { id:"reports",   label:"Reports",   icon:Ic.reports   },
  { id:"settings",  label:"Settings",  icon:Ic.settings  },
];

export default function App() {
  const [products, setProducts] = useState([]);
  const [sales,    setSales   ] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [rate,     setRate    ] = useState(String(DEFAULT_RATE));
  const [loading,  setLoading ] = useState(true);
  const [loadErr,  setLoadErr ] = useState("");
  const [page,     setPage    ] = useState("dashboard");
  const [open,     setOpen    ] = useState(false);

  // ── Initial load from Supabase ─────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true); setLoadErr("");
    try {
      const [{ data: prods, error: e1 }, { data: sls, error: e2 }, { data: exps, error: e3 }] =
        await Promise.all([
          supabase.from("products").select("*").order("created_at", { ascending:false }),
          supabase.from("sales").select("*").order("sale_date", { ascending:false }),
          supabase.from("expenses").select("*").order("expense_date", { ascending:false }),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      setProducts(prods || []);
      setSales(sls     || []);
      setExpenses(exps || []);
    } catch (e) {
      setLoadErr(e.message || "Failed to load data from Supabase.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Persist exchange rate in localStorage (lightweight, not business data) ──
  useEffect(() => {
    const saved = localStorage.getItem("ac_rate");
    if (saved) setRate(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("ac_rate", rate);
  }, [rate]);

  const navigate = (id) => { setPage(id); setOpen(false); };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", fontFamily:"'DM Sans',sans-serif", background:"#F8F6F2", color:"#7A756E", gap:12 }}>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, color:"#1B6B4A", fontWeight:700 }}>Apna Culture</div>
      <div style={{ fontSize:14 }}>Loading your data…</div>
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <button className="hamburger" onClick={() => setOpen(o => !o)}>{open ? Ic.close : Ic.menu}</button>
        <div className={`overlay ${open ? "show" : ""}`} onClick={() => setOpen(false)} />

        <div className={`sidebar ${open ? "open" : ""}`}>
          <div className="brand">
            <div className="brand-name">Apna Culture</div>
            <div className="brand-sub">Accounting & Profit Tracker</div>
          </div>
          {NAV.filter(n => n.id !== "settings").map(n => (
            <button key={n.id} className={`nav-btn ${page === n.id ? "active" : ""}`} onClick={() => navigate(n.id)}>
              {n.icon} {n.label}
            </button>
          ))}
          <hr className="nav-divider" />
          <button className={`nav-btn ${page === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}>
            {Ic.settings} Settings
          </button>
          <div style={{ marginTop:"auto", padding:"12px 20px", fontSize:11, opacity:.45 }}>
            Rate: 1 PKR = {Number(rate).toFixed(4)} CAD
          </div>
        </div>

        <div className="main">
          {loadErr && <div className="err-bar">⚠ {loadErr} — <button style={{ background:"none", border:"none", color:t.red, cursor:"pointer", fontWeight:700 }} onClick={loadAll}>Retry</button></div>}

          {page === "dashboard" && <Dashboard products={products} sales={sales} expenses={expenses} />}
          {page === "products"  && <Products  products={products} setProducts={setProducts} rate={rate} />}
          {page === "sales"     && <Sales     products={products} setProducts={setProducts} sales={sales} setSales={setSales} rate={rate} />}
          {page === "expenses"  && <Expenses  expenses={expenses} setExpenses={setExpenses} sales={sales} rate={rate} />}
          {page === "reports"   && <Reports   sales={sales} expenses={expenses} />}
          {page === "settings"  && <Settings  rate={rate} setRate={setRate} />}
        </div>
      </div>
    </>
  );
}
