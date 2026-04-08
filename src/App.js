import { useState, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const PRODUCT_TYPES         = ["Clothing", "Jewelry", "Accessories"];
const CLOTHING_CATEGORIES   = ["Suit (Stitched)","Suit (Unstitched)","Lehnga","Sharara","Bridal Wear","Formal / Party Wear","Casual Wear","Kurti","Abaya","Dupatta","Other Clothing"];
const JEWELRY_CATEGORIES    = ["Necklace Set","Earrings","Bangles","Bridal Jewelry Set","Maang Tikka","Nath (Nose Ring)","Bracelet","Ring","Other Jewelry"];
const ACCESSORIES_CATEGORIES= ["Clutch / Bag","Shawl","Scarf","Shoes","Other Accessories"];
const EXPENSE_CATEGORIES    = ["Shipping","Packaging","Customs / Duties","Rent","Supplies","Marketing","Other"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const DEFAULT_RATE = 0.0046; // 1 PKR = 0.0046 CAD  (≈ 217 PKR per $1 CAD)

const uid    = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const toDay  = () => new Date().toISOString().split("T")[0];
const cad    = (n) => "$" + Number(n || 0).toFixed(2);          // CAD display
const pkr    = (n) => "₨" + Math.round(Number(n || 0)).toLocaleString(); // PKR display
const pkrToCAD = (amount, rate) => Number(amount || 0) * Number(rate || DEFAULT_RATE);

const categoriesFor = (type) => {
  if (type === "Jewelry")     return JEWELRY_CATEGORIES;
  if (type === "Accessories") return ACCESSORIES_CATEGORIES;
  return CLOTHING_CATEGORIES;
};

// ─── Accounting — all values in CAD ─────────────────────────────────────────
// Revenue    = sum(sale.price_cad × qty)
// COGS       = sum(sale.cost_cad  × qty)   ← stored on sale at time of recording
// OpEx       = sum(expense.amount_cad)      ← auto-converted at entry
// Net Profit = Revenue − COGS − OpEx
const calcTotals = (sales, expenses) => {
  const revenue  = sales.reduce   ((s, x) => s + (Number(x.price_cad) || 0) * (Number(x.qty) || 1), 0);
  const cogs     = sales.reduce   ((s, x) => s + (Number(x.cost_cad)  || 0) * (Number(x.qty) || 1), 0);
  const opex     = expenses.reduce((s, e) => s + (Number(e.amount_cad) || 0), 0);
  const totalExp = cogs + opex;
  const profit   = revenue - totalExp;
  return { revenue, cogs, opex, totalExp, profit };
};

const filterByMonth = (arr, key, m, y) =>
  arr.filter(x => { const d = new Date(x[key]); return d.getMonth() === m && d.getFullYear() === y; });
const filterByYear = (arr, key, y) =>
  arr.filter(x => new Date(x[key]).getFullYear() === y);

// ─── Seed data  (cost_pkr = real PKR cost, cost_cad = pkr × DEFAULT_RATE) ───
const mkProd = (id, type, category, name, cost_pkr, price_cad, qty, notes="") => ({
  id, type, category, name,
  cost_pkr: String(cost_pkr),
  cost_cad: (cost_pkr * DEFAULT_RATE).toFixed(4),
  price_cad: String(price_cad),
  qty: String(qty), notes
});

const SEED_PRODUCTS = [
  mkProd("s1",  "Clothing","Suit (Stitched)",    "Light Pink Embroidered Suit",      14000, 110, 3),
  mkProd("s2",  "Clothing","Suit (Stitched)",    "Royal Blue Chiffon Suit",          15000, 120, 2),
  mkProd("s3",  "Clothing","Suit (Unstitched)",  "Lawn Printed Suit (3-piece)",       6500,  55, 5),
  mkProd("s4",  "Clothing","Suit (Unstitched)",  "Cotton Casual Suit (3-piece)",      5500,  45, 4),
  mkProd("s5",  "Clothing","Lehnga",             "Red Bridal Lehnga",                40000, 320, 1, "Heavy embroidery"),
  mkProd("s6",  "Clothing","Lehnga",             "Green Party Lehnga",               24000, 200, 2),
  mkProd("s7",  "Clothing","Sharara",            "Ivory Sharara Set",                20000, 160, 2),
  mkProd("s8",  "Clothing","Bridal Wear",        "Full Bridal Dress (Red & Gold)",   75000, 600, 1, "Includes dupatta"),
  mkProd("s9",  "Clothing","Kurti",              "Printed Cotton Kurti",              4000,  35, 8),
  mkProd("s10", "Clothing","Kurti",              "Silk Formal Kurti",                 9000,  70, 4),
  mkProd("s11", "Clothing","Abaya",              "Black Nida Abaya (Plain)",         10000,  80, 3),
  mkProd("s12", "Clothing","Abaya",              "Embroidered Abaya (Beige)",        13000, 105, 2),
  mkProd("s13", "Clothing","Dupatta",            "Silk Dupatta (Assorted Colors)",    4500,  38, 6),
  mkProd("s14", "Clothing","Formal / Party Wear","Peach Georgette Party Dress",      18500, 150, 2),
  mkProd("j1",  "Jewelry", "Bridal Jewelry Set", "Gold-Plated Bridal Set (Full)",    26000, 220, 2, "Necklace + earrings + tikka"),
  mkProd("j2",  "Jewelry", "Necklace Set",       "Kundan Necklace Set",              12000,  95, 3),
  mkProd("j3",  "Jewelry", "Necklace Set",       "Pearl Choker Set",                  9000,  75, 2),
  mkProd("j4",  "Jewelry", "Earrings",           "Jhumka Earrings (Gold)",            3200,  28, 6),
  mkProd("j5",  "Jewelry", "Earrings",           "Chandbali Earrings",                5000,  40, 4),
  mkProd("j6",  "Jewelry", "Bangles",            "Gold Bangles Set (6 pcs)",          7500,  65, 5),
  mkProd("j7",  "Jewelry", "Bangles",            "Stone Bangles (Assorted)",          4500,  38, 4),
  mkProd("j8",  "Jewelry", "Maang Tikka",        "Kundan Maang Tikka",                4000,  35, 5),
];

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

  /* ── Sidebar ─────────────────────── */
  .sidebar{width:224px;background:${t.sidebar};color:white;display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100;transition:transform .28s ease}
  .brand{padding:22px 20px 18px;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:8px}
  .brand-name{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:white;line-height:1.2}
  .brand-sub{font-size:11px;opacity:.6;margin-top:3px;letter-spacing:.4px}
  .nav-btn{display:flex;align-items:center;gap:11px;width:100%;padding:12px 20px;background:none;border:none;color:${t.sidebarText};font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;cursor:pointer;text-align:left;transition:background .15s;border-right:3px solid transparent}
  .nav-btn:hover{background:rgba(255,255,255,.08);color:white}
  .nav-btn.active{background:${t.sidebarActive};color:white;border-right-color:${t.accent}}
  .nav-divider{border:none;border-top:1px solid rgba(255,255,255,.1);margin:8px 0}

  /* ── Layout ──────────────────────── */
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

  /* ── Typography ──────────────────── */
  .page-title{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:${t.text};margin-bottom:22px}
  .section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:${t.muted};margin-bottom:10px}

  /* ── Cards ───────────────────────── */
  .card{background:${t.card};border-radius:12px;border:1px solid ${t.border};padding:20px;margin-bottom:16px}
  .card-title{font-size:12px;font-weight:700;color:${t.muted};text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px}

  /* ── Stat cards ─────────────────── */
  .stat-card{background:${t.card};border-radius:12px;padding:18px 20px;border:1px solid ${t.border}}
  .stat-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${t.muted};margin-bottom:5px}
  .stat-value{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;line-height:1.1}
  .stat-value.green{color:${t.green}} .stat-value.red{color:${t.red}}
  .stat-value.gold{color:${t.accent}} .stat-value.blue{color:${t.blue}}
  .stat-pkr{font-size:11px;color:${t.muted};margin-top:3px}

  /* ── Table ───────────────────────── */
  .tbl-wrap{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th{text-align:left;padding:9px 12px;font-size:11px;font-weight:700;color:${t.muted};text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${t.border};white-space:nowrap}
  td{padding:10px 12px;border-bottom:1px solid ${t.border};vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:${t.primaryLight}}

  /* ── Buttons ─────────────────────── */
  .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;border:none;transition:all .15s;line-height:1}
  .btn-primary{background:${t.primary};color:white} .btn-primary:hover{background:#155A3E}
  .btn-outline{background:transparent;border:1.5px solid ${t.border};color:${t.text}}
  .btn-outline:hover{border-color:${t.primary};color:${t.primary}}
  .btn-outline.active{border-color:${t.primary};color:${t.primary};background:${t.primaryLight}}
  .btn-danger{background:${t.redLight};color:${t.red}} .btn-danger:hover{background:#F5C6C0}
  .btn-sm{padding:6px 11px;font-size:13px}

  /* ── Currency toggle ─────────────── */
  .cur-toggle{display:flex;border:1.5px solid ${t.border};border-radius:8px;overflow:hidden}
  .cur-btn{flex:1;padding:10px 0;background:none;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;color:${t.muted}}
  .cur-btn.active{background:${t.primary};color:white}

  /* ── Forms ───────────────────────── */
  .form-group{margin-bottom:14px}
  label{display:block;font-size:13px;font-weight:600;color:${t.muted};margin-bottom:5px}
  .input{width:100%;padding:11px 13px;border:1.5px solid ${t.border};border-radius:8px;font-size:14px;font-family:'DM Sans',sans-serif;background:${t.bg};color:${t.text};transition:border-color .15s}
  .input:focus{outline:none;border-color:${t.primary}}
  select.input{appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%237A756E' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:520px){.form-row{grid-template-columns:1fr}}
  .converted-hint{font-size:12px;font-weight:600;padding:8px 12px;border-radius:6px;margin-top:6px;background:${t.blueLight};color:${t.blue}}

  /* ── Modal ───────────────────────── */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px}
  .modal{background:${t.card};border-radius:14px;padding:28px;width:100%;max-width:520px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.18)}
  .modal-title{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;margin-bottom:20px}
  .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}

  /* ── Misc ────────────────────────── */
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
  .rate-bar .rate-input{width:100px;padding:6px 10px;border:1.5px solid #C39BD3;border-radius:6px;font-size:14px;font-family:'DM Sans',sans-serif;background:white;color:${t.text}}
  .rate-bar .rate-input:focus{outline:none;border-color:${t.purple}}
  .rate-bar .rate-hint{font-size:12px;color:${t.purple};opacity:.8}
`;

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = {
  dashboard:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  products: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M20 7H4a1 1 0 00-1 1v11a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1z"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
  sales:    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>,
  expenses: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  reports:  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 19V6l2-3h9a1 1 0 011 1v12a1 1 0 01-1 1H9z"/><path d="M9 19H5a1 1 0 01-1-1V4a1 1 0 011-1h4"/><line x1="13" y1="9" x2="17" y2="9"/><line x1="13" y1="13" x2="17" y2="13"/></svg>,
  settings: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  plus: <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  trash:<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>,
  edit: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  menu: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
  close:<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
};

// ─── Reusable: Modal ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={wide ? {maxWidth:620} : {}} onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

// ─── Reusable: Exchange rate bar (shown on pages where it matters) ─────────────
function RateBar({ rate, setRate }) {
  const cadPer1k = (1000 * Number(rate)).toFixed(2);
  return (
    <div className="rate-bar">
      <label>Exchange Rate:</label>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:13,color:t.purple,fontWeight:600}}>1 PKR =</span>
        <input
          className="rate-input"
          type="number"
          step="0.0001"
          min="0.0001"
          value={rate}
          onChange={e => setRate(e.target.value)}
        />
        <span style={{fontSize:13,color:t.purple,fontWeight:600}}>CAD</span>
      </div>
      <span className="rate-hint">₨1,000 = {cad(cadPer1k)} · Change this whenever the rate updates (Google "PKR to CAD")</span>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ data }) {
  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();

  const mSales = filterByMonth(data.sales,    "date", m, y);
  const mExp   = filterByMonth(data.expenses, "date", m, y);
  const ySales = filterByYear (data.sales,    "date", y);
  const yExp   = filterByYear (data.expenses, "date", y);

  const mTot   = calcTotals(mSales, mExp);
  const yTot   = calcTotals(ySales, yExp);
  const allTot = calcTotals(data.sales, data.expenses);

  const recentSales = [...data.sales].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  const recentExp   = [...data.expenses].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,4);
  const lowStock    = data.products.filter(p => Number(p.qty) <= 3);

  return (
    <div>
      <div className="page-title">Dashboard — {MONTHS[m]} {y}</div>

      <div className="section-label">This Month</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}} className="four-col">
        <div className="stat-card">
          <div className="stat-label">Revenue</div>
          <div className="stat-value gold">{cad(mTot.revenue)}</div>
          <div className="stat-pkr">{mSales.length} sale{mSales.length!==1?"s":""}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">COGS</div>
          <div className="stat-value blue">{cad(mTot.cogs)}</div>
          <div className="stat-pkr">Cost of goods sold</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Op. Expenses</div>
          <div className="stat-value red">{cad(mTot.opex)}</div>
          <div className="stat-pkr">{mExp.length} entr{mExp.length!==1?"ies":"y"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net Profit</div>
          <div className={`stat-value ${mTot.profit>=0?"green":"red"}`}>{cad(mTot.profit)}</div>
          <div className="stat-pkr">{mTot.revenue>0?((mTot.profit/mTot.revenue)*100).toFixed(1)+"% margin":"—"}</div>
        </div>
      </div>

      <div className="section-label">This Year ({y})</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}} className="four-col">
        <div className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value gold">{cad(yTot.revenue)}</div></div>
        <div className="stat-card"><div className="stat-label">COGS</div><div className="stat-value blue">{cad(yTot.cogs)}</div></div>
        <div className="stat-card"><div className="stat-label">Op. Expenses</div><div className="stat-value red">{cad(yTot.opex)}</div></div>
        <div className="stat-card"><div className="stat-label">Net Profit</div><div className={`stat-value ${yTot.profit>=0?"green":"red"}`}>{cad(yTot.profit)}</div></div>
      </div>

      <div className="card" style={{borderLeft:`4px solid ${t.green}`,background:t.greenLight,marginBottom:16}}>
        <div className="card-title" style={{color:t.green}}>All-Time Net Profit</div>
        <div style={{fontSize:32,fontFamily:"'Playfair Display',serif",fontWeight:700,color:allTot.profit>=0?t.green:t.red}}>
          {cad(allTot.profit)}
        </div>
        <div style={{fontSize:13,color:t.muted,marginTop:4}}>
          Revenue {cad(allTot.revenue)} · COGS {cad(allTot.cogs)} · Op. Expenses {cad(allTot.opex)}
        </div>
      </div>

      {lowStock.length>0 && (
        <div className="card" style={{borderLeft:`4px solid ${t.accent}`,background:t.accentLight,marginBottom:16}}>
          <div className="card-title" style={{color:t.accent}}>⚠ Low Stock ({lowStock.length} item{lowStock.length>1?"s":""})</div>
          <div style={{fontSize:13,color:t.text,display:"flex",flexWrap:"wrap",gap:"6px 16px"}}>
            {lowStock.map(p=><span key={p.id}>{p.name} — <strong>{p.qty}</strong> left</span>)}
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}} className="two-col">
        <div className="card" style={{marginBottom:0}}>
          <div className="card-title">Recent Sales</div>
          {recentSales.length===0
            ?<div className="empty" style={{padding:"14px 0"}}><div className="empty-icon">🛍️</div>No sales yet</div>
            :recentSales.map(s=>(
              <div key={s.id} className="report-row">
                <div>
                  <div style={{fontWeight:500}}>{s.productName||s.customItem}</div>
                  <div style={{fontSize:12,color:t.muted}}>{new Date(s.date).toLocaleDateString()}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:600,color:t.accent}}>{cad(Number(s.price_cad)*Number(s.qty||1))}</div>
                  {s.cost_cad&&<div style={{fontSize:11,color:t.blue}}>COGS {cad(Number(s.cost_cad)*Number(s.qty||1))}</div>}
                  {s.cost_pkr&&<div style={{fontSize:11,color:t.muted}}>{pkr(Number(s.cost_pkr)*Number(s.qty||1))} PKR</div>}
                </div>
              </div>
            ))
          }
        </div>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-title">Recent Expenses</div>
          {recentExp.length===0
            ?<div className="empty" style={{padding:"14px 0"}}><div className="empty-icon">💸</div>No expenses yet</div>
            :recentExp.map(e=>(
              <div key={e.id} className="report-row">
                <div>
                  <div style={{fontWeight:500}}>{e.title}</div>
                  <div style={{fontSize:12,color:t.muted}}>{e.category} · {new Date(e.date).toLocaleDateString()}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:600,color:t.red}}>{cad(e.amount_cad)}</div>
                  {e.currency==="PKR"&&<div style={{fontSize:11,color:t.muted}}>{pkr(e.amount_original)} PKR</div>}
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
const blankProduct = (rate) => ({
  name:"", type:"Clothing", category:CLOTHING_CATEGORIES[0],
  cost_pkr:"", cost_cad:"", price_cad:"", qty:"1", notes:""
});

function Products({ data, setData }) {
  const rate = data.rate;
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(blankProduct(rate));
  const [editId, setEditId]     = useState(null);
  const [search, setSearch]     = useState("");
  const [filterType, setFilter] = useState("All");

  const setType = (type) => setForm(f=>({...f, type, category:categoriesFor(type)[0]}));

  // When PKR cost changes, auto-convert to CAD
  const onCostPKR = (val) => {
    const cad_val = pkrToCAD(val, rate);
    setForm(f=>({...f, cost_pkr:val, cost_cad:cad_val.toFixed(4)}));
  };
  // Allow manual CAD override too
  const onCostCAD = (val) => setForm(f=>({...f, cost_cad:val}));

  const handleSave = () => {
    if (!form.name.trim()) return;
    // Recompute cost_cad from cost_pkr at current rate if pkr is set and cad wasn't manually overridden
    const item = { ...form, id: editId || uid() };
    const prods = editId
      ? data.products.map(p=>p.id===editId?item:p)
      : [...data.products, item];
    setData({...data, products:prods});
    setForm(blankProduct(rate)); setShowAdd(false); setEditId(null);
  };

  const openEdit = (p) => { setForm(p); setEditId(p.id); setShowAdd(true); };
  const remove   = (id) => setData({...data, products:data.products.filter(p=>p.id!==id)});
  const cats     = categoriesFor(form.type);

  let filtered = data.products.filter(p=>
    p.name.toLowerCase().includes(search.toLowerCase())||
    (p.category||"").toLowerCase().includes(search.toLowerCase())
  );
  if (filterType!=="All") filtered=filtered.filter(p=>p.type===filterType);

  const profitCAD = (p) => (Number(p.price_cad)||0) - (Number(p.cost_cad)||0);
  const margin    = (p) => p.price_cad&&p.cost_cad
    ? (((Number(p.price_cad)-Number(p.cost_cad))/Number(p.price_cad))*100).toFixed(0)
    : null;

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{marginBottom:0}}>Products & Inventory</div>
        <button className="btn btn-primary" onClick={()=>{setForm(blankProduct(rate));setEditId(null);setShowAdd(true);}}>
          {Ic.plus} Add Product
        </button>
      </div>

      <RateBar rate={rate} setRate={r=>setData({...data,rate:r})} />

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:16}}>
        <div className="stat-card"><div className="stat-label">Total Products</div><div className="stat-value">{data.products.length}</div></div>
        <div className="stat-card"><div className="stat-label">Clothing</div><div className="stat-value">{data.products.filter(p=>p.type==="Clothing").length}</div></div>
        <div className="stat-card"><div className="stat-label">Jewelry</div><div className="stat-value">{data.products.filter(p=>p.type==="Jewelry").length}</div></div>
        <div className="stat-card"><div className="stat-label">Low Stock</div><div className="stat-value" style={{color:t.red}}>{data.products.filter(p=>Number(p.qty)<=3).length}</div></div>
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {["All",...PRODUCT_TYPES].map(tp=>(
          <button key={tp} className={`btn btn-sm btn-outline ${filterType===tp?"active":""}`} onClick={()=>setFilter(tp)}>{tp}</button>
        ))}
      </div>
      <div className="search-wrap">
        <input className="input" placeholder="Search products…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {filtered.length===0
        ?<div className="card empty"><div className="empty-icon">👗</div>{data.products.length===0?"No products yet — add your first item!":"No products match your search."}</div>
        :<div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th><th>Type</th>
                  <th>Cost (PKR)</th><th>Cost (CAD)</th>
                  <th>Sell Price</th><th>Margin</th><th>Stock</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p=>{
                  const mg = margin(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{fontWeight:500}}>{p.name}</div>
                        <div style={{fontSize:11,color:t.muted}}>{p.category}</div>
                      </td>
                      <td><span className={`badge ${p.type==="Jewelry"?"badge-gold":p.type==="Accessories"?"badge-blue":"badge-green"}`}>{p.type||"—"}</span></td>
                      <td style={{color:t.muted}}>{p.cost_pkr?pkr(p.cost_pkr):"—"}</td>
                      <td style={{color:t.blue,fontWeight:500}}>{p.cost_cad?cad(p.cost_cad):"—"}</td>
                      <td style={{fontWeight:600}}>{p.price_cad?cad(p.price_cad):"—"}</td>
                      <td style={{fontWeight:600,color:mg>=30?t.green:mg>=10?t.accent:t.red}}>{mg!=null?`${mg}%`:"—"}</td>
                      <td><span className={`badge ${Number(p.qty)===0?"badge-red":Number(p.qty)<=3?"badge-gold":"badge-green"}`}>{p.qty}</span></td>
                      <td>
                        <div style={{display:"flex",gap:6}}>
                          <button className="btn btn-outline btn-sm" onClick={()=>openEdit(p)}>{Ic.edit}</button>
                          <button className="btn btn-danger btn-sm" onClick={()=>remove(p.id)}>{Ic.trash}</button>
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
        <Modal title={editId?"Edit Product":"Add Product"} onClose={()=>{setShowAdd(false);setEditId(null);}}>
          <div className="form-group">
            <label>Product Name *</label>
            <input className="input" placeholder="e.g. Pink Embroidered Suit" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select className="input" value={form.type} onChange={e=>setType(e.target.value)}>
                {PRODUCT_TYPES.map(tp=><option key={tp}>{tp}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="input" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
                {cats.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* PKR cost → auto-converted CAD */}
          <div style={{background:t.blueLight,borderRadius:10,padding:"14px 16px",marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:t.blue,marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Product Cost</div>
            <div className="form-row" style={{marginBottom:0}}>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Cost in PKR ₨</label>
                <input className="input" type="number" placeholder="e.g. 14000" value={form.cost_pkr} onChange={e=>onCostPKR(e.target.value)}/>
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Auto-converted Cost (CAD)</label>
                <input className="input" type="number" placeholder="auto" value={form.cost_cad ? Number(form.cost_cad).toFixed(2) : ""} onChange={e=>onCostCAD(e.target.value)}/>
              </div>
            </div>
            {form.cost_pkr&&<div style={{fontSize:12,color:t.blue,marginTop:6}}>Using rate: 1 PKR = {Number(rate).toFixed(4)} CAD</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Selling Price (CAD) $</label>
              <input className="input" type="number" placeholder="0.00" value={form.price_cad} onChange={e=>setForm({...form,price_cad:e.target.value})}/>
            </div>
            <div className="form-group">
              <label>Quantity in Stock</label>
              <input className="input" type="number" min="0" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})}/>
            </div>
          </div>

          {form.cost_cad&&form.price_cad&&(
            <div className="info-box info-green">
              Profit per item: {cad(Number(form.price_cad)-Number(form.cost_cad))} ·
              Margin: {(((Number(form.price_cad)-Number(form.cost_cad))/Number(form.price_cad))*100).toFixed(0)}%
            </div>
          )}

          <div className="form-group">
            <label>Notes (optional)</label>
            <input className="input" placeholder="Any details…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
          </div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={()=>{setShowAdd(false);setEditId(null);}}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>{editId?"Save Changes":"Add Product"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sales ────────────────────────────────────────────────────────────────────
const blankSale = () => ({
  date:toDay(), productId:"", productName:"", customItem:"",
  qty:"1", price_cad:"", cost_cad:"", cost_pkr:"", notes:""
});

function Sales({ data, setData }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState(blankSale());
  const [search, setSearch]   = useState("");
  const [useCustom, setCustom]= useState(false);

  const selectProduct = (id) => {
    if (!id) { setForm(f=>({...f,productId:"",productName:"",price_cad:"",cost_cad:"",cost_pkr:""})); return; }
    const p = data.products.find(x=>x.id===id);
    if (!p) return;
    setForm(f=>({...f, productId:p.id, productName:p.name, price_cad:p.price_cad||"", cost_cad:p.cost_cad||"", cost_pkr:p.cost_pkr||""}));
  };

  const handleSave = () => {
    const label = useCustom ? form.customItem : form.productName;
    if (!label||!form.price_cad) return;
    let prods = data.products;
    if (!useCustom&&form.productId) {
      prods = data.products.map(p=>
        p.id===form.productId ? {...p,qty:Math.max(0,Number(p.qty)-Number(form.qty||1))} : p
      );
    }
    const sale={...form, id:uid(), productName:useCustom?"":form.productName, customItem:useCustom?form.customItem:""};
    setData({...data,sales:[...data.sales,sale],products:prods});
    setForm(blankSale()); setCustom(false); setShowAdd(false);
  };

  const remove = (id) => setData({...data,sales:data.sales.filter(s=>s.id!==id)});

  const sorted   = [...data.sales].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const filtered = sorted.filter(s=>(s.productName||s.customItem).toLowerCase().includes(search.toLowerCase()));

  const allTot = calcTotals(data.sales,[]);
  const qty    = Number(form.qty||1);
  const saleRev  = Number(form.price_cad||0)*qty;
  const saleCOGS = Number(form.cost_cad||0)*qty;
  const saleGP   = form.price_cad ? saleRev-saleCOGS : null;

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{marginBottom:0}}>Sales</div>
        <button className="btn btn-primary" onClick={()=>{setForm(blankSale());setCustom(false);setShowAdd(true);}}>
          {Ic.plus} New Sale
        </button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:16}}>
        <div className="stat-card">
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value gold">{cad(allTot.revenue)}</div>
          <div className="stat-pkr">{data.sales.length} total sales</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total COGS</div>
          <div className="stat-value blue">{cad(allTot.cogs)}</div>
          <div className="stat-pkr">Auto from product costs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Gross Profit</div>
          <div className={`stat-value ${allTot.revenue-allTot.cogs>=0?"green":"red"}`}>{cad(allTot.revenue-allTot.cogs)}</div>
          <div className="stat-pkr">Before operating expenses</div>
        </div>
      </div>

      <div className="search-wrap">
        <input className="input" placeholder="Search sales…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {filtered.length===0
        ?<div className="card empty"><div className="empty-icon">🛍️</div>{data.sales.length===0?"No sales recorded yet — add your first sale!":"No sales match your search."}</div>
        :<div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Item</th><th>Qty</th><th>Revenue</th><th>COGS</th><th>PKR Cost</th><th>Gross Profit</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(s=>{
                  const q   = Number(s.qty||1);
                  const rev = Number(s.price_cad||0)*q;
                  const cgs = Number(s.cost_cad||0)*q;
                  const gp  = s.cost_cad ? rev-cgs : null;
                  return (
                    <tr key={s.id}>
                      <td style={{whiteSpace:"nowrap"}}>{new Date(s.date).toLocaleDateString()}</td>
                      <td style={{fontWeight:500}}>
                        {s.productName||s.customItem}
                        {!s.productName&&<span style={{fontSize:11,color:t.muted,display:"block"}}>manual entry</span>}
                      </td>
                      <td>{q}</td>
                      <td style={{fontWeight:600,color:t.accent}}>{cad(rev)}</td>
                      <td style={{color:t.blue}}>{s.cost_cad?cad(cgs):<span style={{color:t.muted}}>—</span>}</td>
                      <td style={{color:t.muted,fontSize:12}}>{s.cost_pkr?pkr(Number(s.cost_pkr)*q):"—"}</td>
                      <td style={{fontWeight:600,color:gp!=null?(gp>=0?t.green:t.red):t.muted}}>{gp!=null?cad(gp):"—"}</td>
                      <td><button className="btn btn-danger btn-sm" onClick={()=>remove(s.id)}>{Ic.trash}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      }

      {showAdd && (
        <Modal title="New Sale" onClose={()=>setShowAdd(false)} wide>
          <div className="form-group">
            <label>Date</label>
            <input className="input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
          </div>

          {!useCustom ? (
            <div className="form-group">
              <label>Select Product <span style={{color:t.muted,fontWeight:400}}>(auto-fills cost & price)</span></label>
              <select className="input" value={form.productId} onChange={e=>selectProduct(e.target.value)}>
                <option value="">— Choose a product —</option>
                {data.products.map(p=><option key={p.id} value={p.id}>{p.name} (Stock: {p.qty})</option>)}
              </select>
              <button style={{background:"none",border:"none",color:t.primary,cursor:"pointer",fontWeight:600,fontSize:13,padding:"6px 0 0",display:"block"}}
                onClick={()=>{setCustom(true);setForm(f=>({...f,productId:"",productName:"",price_cad:"",cost_cad:"",cost_pkr:""}));}}>
                + Type item name manually instead
              </button>
            </div>
          ) : (
            <div className="form-group">
              <label>Item Name</label>
              <input className="input" placeholder="What was sold?" value={form.customItem} onChange={e=>setForm({...form,customItem:e.target.value})}/>
              <button style={{background:"none",border:"none",color:t.primary,cursor:"pointer",fontWeight:600,fontSize:13,padding:"6px 0 0",display:"block"}}
                onClick={()=>{setCustom(false);setForm(f=>({...f,customItem:""}));}}>
                ← Pick from products instead
              </button>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Quantity Sold</label>
              <input className="input" type="number" min="1" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})}/>
            </div>
            <div className="form-group">
              <label>Sale Price (CAD) *</label>
              <input className="input" type="number" placeholder="0.00" value={form.price_cad} onChange={e=>setForm({...form,price_cad:e.target.value})}/>
            </div>
          </div>

          {/* Cost fields — shown auto-filled if from product, editable */}
          <div style={{background:t.blueLight,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:t.blue,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>
              Product Cost (COGS) — auto-filled from product
            </div>
            <div className="form-row" style={{marginBottom:0}}>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Cost (PKR)</label>
                <input className="input" type="number" placeholder="₨ cost" value={form.cost_pkr}
                  onChange={e=>{
                    const cv = pkrToCAD(e.target.value, data.rate);
                    setForm(f=>({...f,cost_pkr:e.target.value,cost_cad:cv.toFixed(4)}));
                  }}/>
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Cost (CAD) — used in accounting</label>
                <input className="input" type="number" placeholder="auto" value={form.cost_cad?Number(form.cost_cad).toFixed(2):""}
                  onChange={e=>setForm({...form,cost_cad:e.target.value})}/>
              </div>
            </div>
          </div>

          {/* Live preview */}
          {form.price_cad&&(
            <div style={{marginBottom:14}}>
              <div className="info-box info-gold">Revenue: {cad(saleRev)}</div>
              {form.cost_cad&&<>
                <div className="info-box info-blue">
                  COGS (auto-recorded): {cad(saleCOGS)}
                  {form.cost_pkr&&<span style={{opacity:.7}}> · {pkr(Number(form.cost_pkr)*qty)} PKR</span>}
                </div>
                <div className={`info-box ${saleGP>=0?"info-green":"info-red"}`}>Gross Profit: {cad(saleGP)}</div>
              </>}
            </div>
          )}

          <div className="form-group">
            <label>Notes (optional)</label>
            <input className="input" placeholder="Any details…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
          </div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={()=>setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save Sale</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
const blankExp = () => ({
  date:toDay(), title:"", category:EXPENSE_CATEGORIES[0],
  currency:"PKR", amount_original:"", amount_cad:"", notes:""
});

function Expenses({ data, setData }) {
  const rate = data.rate;
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState(blankExp());
  const now = new Date();

  // When currency or amount changes, recompute amount_cad
  const onCurrencyChange = (cur) => {
    const converted = cur==="PKR"
      ? pkrToCAD(form.amount_original, rate)
      : Number(form.amount_original||0);
    setForm(f=>({...f, currency:cur, amount_cad:converted.toFixed(2)}));
  };
  const onAmountChange = (val) => {
    const converted = form.currency==="PKR"
      ? pkrToCAD(val, rate)
      : Number(val||0);
    setForm(f=>({...f, amount_original:val, amount_cad:converted.toFixed(2)}));
  };

  const handleSave = () => {
    if (!form.title.trim()||!form.amount_original) return;
    setData({...data, expenses:[...data.expenses,{...form,id:uid()}]});
    setForm(blankExp()); setShowAdd(false);
  };
  const remove = (id) => setData({...data,expenses:data.expenses.filter(e=>e.id!==id)});

  const sorted = [...data.expenses].sort((a,b)=>new Date(b.date)-new Date(a.date));

  // Totals
  const opex  = data.expenses.reduce((s,e)=>s+Number(e.amount_cad||0),0);
  const cogst = data.sales.reduce((s,x)=>s+Number(x.cost_cad||0)*Number(x.qty||1),0);
  const total = opex+cogst;

  const mOpex = filterByMonth(data.expenses,"date",now.getMonth(),now.getFullYear())
    .reduce((s,e)=>s+Number(e.amount_cad||0),0);
  const mCOGS = filterByMonth(data.sales,"date",now.getMonth(),now.getFullYear())
    .reduce((s,x)=>s+Number(x.cost_cad||0)*Number(x.qty||1),0);

  const byCat = {};
  data.expenses.forEach(e=>{byCat[e.category]=(byCat[e.category]||0)+Number(e.amount_cad||0);});

  const bySaleProd = {};
  data.sales.forEach(s=>{
    if(!s.cost_cad) return;
    const k=s.productName||s.customItem;
    bySaleProd[k]=(bySaleProd[k]||0)+Number(s.cost_cad)*Number(s.qty||1);
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{marginBottom:0}}>Expenses</div>
        <button className="btn btn-primary" onClick={()=>{setForm(blankExp());setShowAdd(true);}}>
          {Ic.plus} Add Expense
        </button>
      </div>

      <RateBar rate={rate} setRate={r=>setData({...data,rate:r})}/>

      <div className="section-label">This Month</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
        <div className="stat-card">
          <div className="stat-label">COGS (from Sales)</div>
          <div className="stat-value blue">{cad(mCOGS)}</div>
          <div className="stat-pkr">Auto from recorded sales</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Operating Expenses</div>
          <div className="stat-value red">{cad(mOpex)}</div>
          <div className="stat-pkr">Manually entered</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value red">{cad(mCOGS+mOpex)}</div>
          <div className="stat-pkr">COGS + Operating</div>
        </div>
      </div>

      <div className="section-label">All Time</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}} className="two-col">

        <div className="card" style={{marginBottom:0,borderTop:`3px solid ${t.blue}`}}>
          <div className="card-title" style={{color:t.blue}}>Cost of Goods Sold (COGS)</div>
          <div style={{fontSize:12,color:t.muted,marginBottom:10,lineHeight:1.5}}>
            Auto-calculated from sales. PKR product costs are converted to CAD at the recorded rate.
          </div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:t.blue}}>{cad(cogst)}</div>
          {Object.keys(bySaleProd).length>0&&(
            <>
              <hr className="divider"/>
              {Object.entries(bySaleProd).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,amt])=>(
                <div key={name} className="report-row" style={{padding:"7px 0"}}>
                  <span style={{color:t.text,fontWeight:500,fontSize:13}}>{name}</span>
                  <span style={{fontWeight:600,color:t.blue}}>{cad(amt)}</span>
                </div>
              ))}
            </>
          )}
          {cogst===0&&<div style={{fontSize:13,color:t.muted,marginTop:8}}>No product costs in sales yet.</div>}
        </div>

        <div className="card" style={{marginBottom:0,borderTop:`3px solid ${t.red}`}}>
          <div className="card-title" style={{color:t.red}}>Operating Expenses</div>
          <div style={{fontSize:12,color:t.muted,marginBottom:10,lineHeight:1.5}}>
            Business costs you enter manually. PKR amounts are auto-converted to CAD.
          </div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:t.red}}>{cad(opex)}</div>
          {Object.keys(byCat).length>0&&(
            <>
              <hr className="divider"/>
              {Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
                <div key={cat} className="report-row" style={{padding:"7px 0"}}>
                  <span className="lbl">{cat}</span>
                  <span style={{fontWeight:600,color:t.red}}>{cad(amt)}</span>
                </div>
              ))}
            </>
          )}
          {opex===0&&<div style={{fontSize:13,color:t.muted,marginTop:8}}>No operating expenses yet.</div>}
        </div>
      </div>

      <div className="card" style={{background:t.redLight,border:`1px solid ${t.red}`,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>Total Expenses — All Time</div>
            <div style={{fontSize:13,color:t.muted,marginTop:2}}>COGS {cad(cogst)} + Operating {cad(opex)}</div>
          </div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,color:t.red}}>{cad(total)}</div>
        </div>
      </div>

      <div className="section-label">Operating Expense Log</div>
      {sorted.length===0
        ?<div className="card empty"><div className="empty-icon">💸</div>No operating expenses recorded yet.</div>
        :<div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Category</th><th>Original</th><th>CAD Amount</th><th></th></tr>
              </thead>
              <tbody>
                {sorted.map(e=>(
                  <tr key={e.id}>
                    <td style={{whiteSpace:"nowrap"}}>{new Date(e.date).toLocaleDateString()}</td>
                    <td style={{fontWeight:500}}>{e.title}</td>
                    <td><span className="badge badge-red">{e.category}</span></td>
                    <td style={{color:t.muted,fontSize:13}}>
                      {e.currency==="PKR"
                        ? <>{pkr(e.amount_original)} <span className="badge badge-purple" style={{fontSize:10}}>PKR</span></>
                        : <>{cad(e.amount_original)} <span className="badge badge-green" style={{fontSize:10}}>CAD</span></>
                      }
                    </td>
                    <td style={{fontWeight:600,color:t.red}}>{cad(e.amount_cad)}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={()=>remove(e.id)}>{Ic.trash}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      }

      {showAdd && (
        <Modal title="Add Operating Expense" onClose={()=>setShowAdd(false)} wide>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input className="input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="input" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
                {EXPENSE_CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description *</label>
            <input className="input" placeholder="What was this expense for?" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
          </div>

          {/* Currency toggle */}
          <div className="form-group">
            <label>Currency</label>
            <div className="cur-toggle">
              <button className={`cur-btn ${form.currency==="PKR"?"active":""}`} onClick={()=>onCurrencyChange("PKR")}>₨ PKR</button>
              <button className={`cur-btn ${form.currency==="CAD"?"active":""}`} onClick={()=>onCurrencyChange("CAD")}>$ CAD</button>
            </div>
          </div>

          <div className="form-group">
            <label>Amount {form.currency==="PKR"?"(PKR ₨)":"(CAD $)"} *</label>
            <input className="input" type="number" placeholder={form.currency==="PKR"?"e.g. 5000":"e.g. 25.00"} value={form.amount_original} onChange={e=>onAmountChange(e.target.value)}/>
            {form.currency==="PKR"&&form.amount_original&&(
              <div className="converted-hint">
                = {cad(form.amount_cad)} CAD at current rate (1 PKR = {Number(rate).toFixed(4)} CAD)
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <input className="input" placeholder="Any extra details…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
          </div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={()=>setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save Expense</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────
function Reports({ data }) {
  const now = new Date();
  const [mode,  setMode]  = useState("month");
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());

  const years = [];
  for (let y=2023; y<=now.getFullYear()+1; y++) years.push(y);

  const getSales = () => {
    if (mode==="month") return filterByMonth(data.sales,"date",month,year);
    if (mode==="year")  return filterByYear(data.sales,"date",year);
    return data.sales;
  };
  const getExp = () => {
    if (mode==="month") return filterByMonth(data.expenses,"date",month,year);
    if (mode==="year")  return filterByYear(data.expenses,"date",year);
    return data.expenses;
  };

  const sales    = getSales();
  const expenses = getExp();
  const tot      = calcTotals(sales, expenses);
  const grossP   = tot.revenue - tot.cogs;
  const label    = mode==="month" ? `${MONTHS[month]} ${year}` : mode==="year" ? String(year) : "All Time";

  // Top items by revenue
  const byProd = {};
  sales.forEach(s=>{ const k=s.productName||s.customItem; byProd[k]=(byProd[k]||0)+Number(s.price_cad||0)*Number(s.qty||1); });
  const topProds = Object.entries(byProd).sort((a,b)=>b[1]-a[1]).slice(0,6);

  // OpEx by category
  const byCat = {};
  expenses.forEach(e=>{ byCat[e.category]=(byCat[e.category]||0)+Number(e.amount_cad||0); });

  // PKR-originated expenses total (for info)
  const pkrOriginated = expenses.filter(e=>e.currency==="PKR").reduce((s,e)=>s+Number(e.amount_original||0),0);

  return (
    <div>
      <div className="page-title">Reports</div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16,alignItems:"center"}}>
        {[["month","By Month"],["year","By Year"],["all","All Time"]].map(([v,lbl])=>(
          <button key={v} className={`btn btn-sm ${mode===v?"btn-primary":"btn-outline"}`} onClick={()=>setMode(v)}>{lbl}</button>
        ))}
        {mode==="month"&&<>
          <select className="input" style={{width:"auto",minWidth:130}} value={month} onChange={e=>setMonth(Number(e.target.value))}>
            {MONTHS.map((m,i)=><option key={m} value={i}>{m}</option>)}
          </select>
          <select className="input" style={{width:"auto",minWidth:80}} value={year} onChange={e=>setYear(Number(e.target.value))}>
            {years.map(y=><option key={y}>{y}</option>)}
          </select>
        </>}
        {mode==="year"&&(
          <select className="input" style={{width:"auto",minWidth:80}} value={year} onChange={e=>setYear(Number(e.target.value))}>
            {years.map(y=><option key={y}>{y}</option>)}
          </select>
        )}
      </div>

      {/* P&L Statement */}
      <div className="card">
        <div className="card-title">Profit & Loss — {label} (all values in CAD)</div>

        <div className="report-row">
          <span className="lbl">Revenue <span style={{fontSize:11}}>(total sales)</span></span>
          <span className="val" style={{color:t.accent}}>{cad(tot.revenue)}</span>
        </div>
        <div className="report-row">
          <span style={{color:t.blue}}>Less: Cost of Goods Sold (COGS)</span>
          <span style={{fontWeight:600,color:t.blue}}>({cad(tot.cogs)})</span>
        </div>
        <div className="report-row" style={{borderBottom:`2px solid ${t.border}`,paddingBottom:12}}>
          <span style={{fontWeight:600}}>Gross Profit</span>
          <span style={{fontWeight:700,color:grossP>=0?t.green:t.red}}>{cad(grossP)}</span>
        </div>
        <div className="report-row" style={{paddingTop:12}}>
          <span style={{color:t.red}}>Less: Operating Expenses</span>
          <span style={{fontWeight:600,color:t.red}}>({cad(tot.opex)})</span>
        </div>
        <div className="report-total">
          <span style={{fontWeight:700,fontSize:16}}>Net Profit</span>
          <span style={{fontWeight:700,fontSize:22,color:tot.profit>=0?t.green:t.red}}>
            {cad(tot.profit)}
            {tot.revenue>0&&<span style={{fontSize:14,marginLeft:8,fontWeight:500}}>({((tot.profit/tot.revenue)*100).toFixed(1)}% margin)</span>}
          </span>
        </div>
      </div>

      {/* PKR context note */}
      {pkrOriginated>0&&(
        <div className="card" style={{background:t.purpleLight,border:`1px solid #C39BD3`,marginBottom:16}}>
          <div style={{fontSize:13,color:t.purple,fontWeight:600}}>
            ₨{pkrOriginated.toLocaleString()} PKR in operating expenses converted to CAD using saved exchange rate.
          </div>
        </div>
      )}

      {(topProds.length>0||Object.keys(byCat).length>0)&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}} className="two-col">
          {topProds.length>0&&(
            <div className="card" style={{marginBottom:0}}>
              <div className="card-title">Top Items by Revenue</div>
              {topProds.map(([name,rev])=>(
                <div key={name} className="report-row">
                  <span style={{fontWeight:500}}>{name}</span>
                  <span style={{fontWeight:600,color:t.accent}}>{cad(rev)}</span>
                </div>
              ))}
            </div>
          )}
          {Object.keys(byCat).length>0&&(
            <div className="card" style={{marginBottom:0}}>
              <div className="card-title">Operating Expenses by Category</div>
              {Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
                <div key={cat} className="report-row">
                  <span className="lbl">{cat}</span>
                  <span style={{fontWeight:600,color:t.red}}>{cad(amt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sales.length===0&&expenses.length===0&&(
        <div className="card empty"><div className="empty-icon">📊</div>No data for {label}. Start adding sales and expenses!</div>
      )}
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function Settings({ data, setData }) {
  const rate = data.rate;
  const cadPer1k  = (1000 * Number(rate)).toFixed(2);
  const pkrPer1cad = Number(rate)>0 ? (1/Number(rate)).toFixed(0) : "—";

  const quickRates = [0.0035, 0.0040, 0.0046, 0.0050, 0.0055];

  return (
    <div>
      <div className="page-title">Settings</div>

      <div className="card">
        <div className="card-title">Exchange Rate — PKR to CAD</div>
        <p style={{fontSize:14,color:t.muted,marginBottom:18,lineHeight:1.6}}>
          This rate is used everywhere to convert PKR product costs and PKR expenses into CAD for accounting.
          Update it whenever the rate changes. Google <strong>"PKR to CAD"</strong> to get the latest rate.
        </p>

        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
          <div>
            <label style={{marginBottom:6}}>1 PKR = ? CAD</label>
            <input
              className="input"
              type="number"
              step="0.0001"
              min="0.0001"
              style={{maxWidth:160}}
              value={rate}
              onChange={e=>setData({...data,rate:e.target.value})}
            />
          </div>
          <div style={{fontSize:14,color:t.muted,paddingTop:20}}>
            = {pkrPer1cad} PKR per $1 CAD
          </div>
        </div>

        <div style={{fontSize:13,marginBottom:14,color:t.muted}}>Quick select a common rate:</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
          {quickRates.map(r=>(
            <button
              key={r}
              className={`btn btn-sm btn-outline ${Number(rate)===r?"active":""}`}
              onClick={()=>setData({...data,rate:String(r)})}
            >
              {r}
            </button>
          ))}
        </div>

        <div style={{background:t.greenLight,borderRadius:10,padding:"14px 16px"}}>
          <div style={{fontWeight:700,color:t.green,marginBottom:10}}>Current Conversion Table</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 24px",fontSize:14}}>
            {[1000,2000,5000,10000,20000,50000].map(p=>(
              <div key={p} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${t.border}`}}>
                <span style={{color:t.muted}}>{pkr(p)}</span>
                <span style={{fontWeight:600,color:t.green}}>{cad(pkrToCAD(p,rate))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">About This App</div>
        <div style={{fontSize:14,color:t.muted,lineHeight:1.7}}>
          <strong>Apna Culture</strong> — Accounting & Profit Tracker<br/>
          Built for a small Pakistani women's clothing and jewelry business.<br/><br/>
          <strong>How currency works:</strong><br/>
          • Product costs are entered in PKR and automatically converted to CAD<br/>
          • Manual expenses can be entered in PKR or CAD<br/>
          • All accounting totals (Dashboard, Reports) are shown in CAD<br/>
          • Original PKR amounts are shown in brackets where helpful<br/>
          • Changing the exchange rate updates all future conversions
        </div>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
const DEFAULT = { products:[], sales:[], expenses:[], rate:String(DEFAULT_RATE), seeded:false };

const NAV = [
  { id:"dashboard", label:"Dashboard", icon:Ic.dashboard },
  { id:"products",  label:"Products",  icon:Ic.products  },
  { id:"sales",     label:"Sales",     icon:Ic.sales     },
  { id:"expenses",  label:"Expenses",  icon:Ic.expenses  },
  { id:"reports",   label:"Reports",   icon:Ic.reports   },
  { id:"settings",  label:"Settings",  icon:Ic.settings  },
];

export default function ApnaCulture() {
  const [data, setData] = useState(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage]     = useState("dashboard");
  const [open, setOpen]     = useState(false);

  useEffect(() => {
    (async () => {
      const state = { ...DEFAULT };
      for (const key of ["products","sales","expenses","rate","seeded"]) {
        try { const r = await window.storage.get(`ac4_${key}`); if (r?.value) state[key]=JSON.parse(r.value); } catch {}
      }
      if (!state.seeded) { state.products=SEED_PRODUCTS; state.seeded=true; }
      setData(state); setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        for (const key of ["products","sales","expenses","rate","seeded"]) {
          await window.storage.set(`ac4_${key}`, JSON.stringify(data[key]));
        }
      } catch {}
    })();
  }, [data, loaded]);

  const navigate = (id) => { setPage(id); setOpen(false); };

  if (!loaded) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"'DM Sans',sans-serif",background:"#F8F6F2",color:"#7A756E",fontSize:16}}>
      Loading Apna Culture…
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <button className="hamburger" onClick={()=>setOpen(o=>!o)}>{open?Ic.close:Ic.menu}</button>
        <div className={`overlay ${open?"show":""}`} onClick={()=>setOpen(false)}/>

        <div className={`sidebar ${open?"open":""}`}>
          <div className="brand">
            <div className="brand-name">Apna Culture</div>
            <div className="brand-sub">Accounting & Profit Tracker</div>
          </div>
          {NAV.filter(n=>n.id!=="settings").map(n=>(
            <button key={n.id} className={`nav-btn ${page===n.id?"active":""}`} onClick={()=>navigate(n.id)}>
              {n.icon} {n.label}
            </button>
          ))}
          <hr className="nav-divider"/>
          <button className={`nav-btn ${page==="settings"?"active":""}`} onClick={()=>navigate("settings")}>
            {Ic.settings} Settings
          </button>
          <div style={{marginTop:"auto",padding:"12px 20px",fontSize:11,opacity:.45}}>
            Rate: 1 PKR = {Number(data.rate).toFixed(4)} CAD
          </div>
        </div>

        <div className="main">
          {page==="dashboard"&&<Dashboard data={data}/>}
          {page==="products" &&<Products  data={data} setData={setData}/>}
          {page==="sales"    &&<Sales     data={data} setData={setData}/>}
          {page==="expenses" &&<Expenses  data={data} setData={setData}/>}
          {page==="reports"  &&<Reports   data={data}/>}
          {page==="settings" &&<Settings  data={data} setData={setData}/>}
        </div>
      </div>
    </>
  );
}
