import { useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

const PRODUCT_TYPES = ["Clothing", "Jewelry", "Accessories"];
const CLOTHING_CATEGORIES = [
  "Suit (Stitched)",
  "Suit (Unstitched)",
  "Lehnga",
  "Sharara",
  "Bridal Wear",
  "Formal / Party Wear",
  "Casual Wear",
  "Kurti",
  "Abaya",
  "Dupatta",
  "Other Clothing",
];
const JEWELRY_CATEGORIES = [
  "Necklace Set",
  "Earrings",
  "Bangles",
  "Bridal Jewelry Set",
  "Maang Tikka",
  "Nath (Nose Ring)",
  "Bracelet",
  "Ring",
  "Other Jewelry",
];
const ACCESSORIES_CATEGORIES = [
  "Clutch / Bag",
  "Shawl",
  "Scarf",
  "Shoes",
  "Other Accessories",
];
const EXPENSE_CATEGORIES = [
  "Shipping",
  "Packaging",
  "Customs / Duties",
  "Rent",
  "Supplies",
  "Marketing",
  "Other",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DEFAULT_RATE = 0.0046;
const RATE_STORAGE_KEY = "ac_rate_state_v2";
const RATE_API_PATH = "/api/exchange-rate";

const toDay = () => new Date().toISOString().split("T")[0];
const toNumber = (value) => Number(value || 0);
const hasAmount = (value) => Math.abs(toNumber(value)) > 0;
const roundTo = (value, places = 2) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Number(numericValue.toFixed(places)) : 0;
};
const fmtCAD = (value) => `$${toNumber(value).toFixed(2)}`;
const fmtPKR = (value) => `₨${Math.round(toNumber(value)).toLocaleString()}`;
const fmtRate = (value) => toNumber(value || DEFAULT_RATE).toFixed(6);
const pkrToCAD = (amount, rate, places = 2) => roundTo(toNumber(amount) * toNumber(rate || DEFAULT_RATE), places);
const derivedRate = (pkrAmount, cadAmount, fallbackRate = DEFAULT_RATE) => {
  const pkr = toNumber(pkrAmount);
  const cad = toNumber(cadAmount);
  if (pkr > 0 && cad > 0) {
    return roundTo(cad / pkr, 8);
  }
  return pkr > 0 ? roundTo(fallbackRate, 8) : null;
};
const salePkrTotal = (sale) => toNumber(sale.unit_cost_pkr) * toNumber(sale.quantity_sold);
const expensePkrTotal = (expense) => (expense.currency === "PKR" ? toNumber(expense.amount_original) : 0);
const categoriesFor = (type) => {
  if (type === "Jewelry") return JEWELRY_CATEGORIES;
  if (type === "Accessories") return ACCESSORIES_CATEGORIES;
  return CLOTHING_CATEGORIES;
};
const filterByMonth = (items, key, month, year) =>
  items.filter((item) => {
    const date = new Date(item[key]);
    return date.getMonth() === month && date.getFullYear() === year;
  });
const filterByYear = (items, key, year) =>
  items.filter((item) => new Date(item[key]).getFullYear() === year);
const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};
const formatProviderDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};
const formatPkrContext = (amount, label = "historical PKR") =>
  hasAmount(amount) ? `(${fmtPKR(amount)} ${label})` : "";
const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const buildCsv = (rows) => rows.map((row) => row.map(csvCell).join(",")).join("\n");
const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const downloadTextFile = (filename, content, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const calcTotals = (sales, expenses) => {
  const revenue = sales.reduce((sum, sale) => sum + toNumber(sale.total_revenue_cad), 0);
  const cogsCad = sales.reduce((sum, sale) => sum + toNumber(sale.total_cogs_cad), 0);
  const cogsPkr = sales.reduce((sum, sale) => sum + salePkrTotal(sale), 0);
  const opexCad = expenses.reduce((sum, expense) => sum + toNumber(expense.amount_cad), 0);
  const opexPkr = expenses.reduce((sum, expense) => sum + expensePkrTotal(expense), 0);
  const totalExpCad = cogsCad + opexCad;
  const totalExpPkr = cogsPkr + opexPkr;
  const profit = revenue - totalExpCad;
  return { revenue, cogsCad, cogsPkr, opexCad, opexPkr, totalExpCad, totalExpPkr, profit };
};

const buildRateState = (input = {}) => {
  const parsedRate = Number(input.rate);
  return {
    rate: Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : DEFAULT_RATE,
    fetchedAt: input.fetchedAt || null,
    providerDate: input.providerDate || null,
    source: input.source || "Frankfurter",
    isFallback: Boolean(input.isFallback),
  };
};

const loadStoredRateState = () => {
  if (typeof window === "undefined") {
    return buildRateState({ rate: DEFAULT_RATE, isFallback: true });
  }
  try {
    const raw = window.localStorage.getItem(RATE_STORAGE_KEY);
    if (!raw) {
      return buildRateState({ rate: DEFAULT_RATE, isFallback: true });
    }
    return buildRateState(JSON.parse(raw));
  } catch {
    return buildRateState({ rate: DEFAULT_RATE, isFallback: true });
  }
};

const t = {
  bg: "#F8F6F2",
  card: "#FFFFFF",
  sidebar: "#1B6B4A",
  sidebarText: "rgba(255,255,255,0.85)",
  sidebarActive: "rgba(255,255,255,0.18)",
  accent: "#C4883A",
  accentLight: "#FEF3E6",
  green: "#1E9E56",
  greenLight: "#E6F7EE",
  red: "#C0392B",
  redLight: "#FDEDEB",
  blue: "#2471A3",
  blueLight: "#EAF4FC",
  purple: "#7D3C98",
  purpleLight: "#F5EEF8",
  text: "#2A2725",
  muted: "#7A756E",
  border: "#E8E3DC",
  primary: "#1B6B4A",
  primaryLight: "#E8F4EE",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:${t.bg}}
  .app{font-family:'DM Sans',sans-serif;display:flex;min-height:100vh;color:${t.text};background:${t.bg}}
  .sidebar{width:224px;background:${t.sidebar};color:white;display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100;transition:transform .28s ease}
  .brand{padding:22px 20px 18px;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:8px}
  .brand-logo{display:block;width:64px;height:64px;object-fit:cover;border-radius:18px;margin-bottom:12px;background:#050505}
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
  .stat-value.green{color:${t.green}}
  .stat-value.red{color:${t.red}}
  .stat-value.gold{color:${t.accent}}
  .stat-value.blue{color:${t.blue}}
  .stat-sub{font-size:12px;color:${t.muted};margin-top:3px}
  .pkr-note{display:block;font-size:12px;color:${t.muted};margin-top:4px}
  .pkr-inline{font-size:12px;color:${t.muted}}
  .muted-line{font-size:12px;color:${t.muted}}
  .rate-panel{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;background:${t.purpleLight};border:1px solid #C39BD3;border-radius:12px;padding:16px 18px;margin-bottom:20px;flex-wrap:wrap}
  .rate-panel.compact{margin-bottom:0}
  .rate-head{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:${t.purple};margin-bottom:6px}
  .rate-value{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:${t.purple};line-height:1.1}
  .rate-meta{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:8px;font-size:12px;color:${t.purple}}
  .value-stack{display:flex;flex-direction:column;align-items:flex-start}
  .tbl-wrap{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th{text-align:left;padding:9px 12px;font-size:11px;font-weight:700;color:${t.muted};text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${t.border};white-space:nowrap}
  td{padding:10px 12px;border-bottom:1px solid ${t.border};vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:${t.primaryLight}}
  .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;border:none;transition:all .15s;line-height:1}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .btn-primary{background:${t.primary};color:white}
  .btn-primary:hover:not(:disabled){background:#155A3E}
  .btn-outline{background:transparent;border:1.5px solid ${t.border};color:${t.text}}
  .btn-outline:hover:not(:disabled){border-color:${t.primary};color:${t.primary}}
  .btn-outline.active{border-color:${t.primary};color:${t.primary};background:${t.primaryLight}}
  .btn-danger{background:${t.redLight};color:${t.red}}
  .btn-danger:hover:not(:disabled){background:#F5C6C0}
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
  .err-bar{background:${t.redLight};border:1px solid ${t.red};border-radius:8px;padding:10px 16px;margin-bottom:14px;font-size:13px;color:${t.red};font-weight:600}
  .saving-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.accent};margin-left:8px;animation:pulse 1s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
`;

const Ic = {
  dashboard: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  products: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M20 7H4a1 1 0 00-1 1v11a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1z" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg>,
  sales: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 14l2 2 4-4" /></svg>,
  expenses: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>,
  reports: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 19V6l2-3h9a1 1 0 011 1v12a1 1 0 01-1 1H9z" /><path d="M9 19H5a1 1 0 01-1-1V4a1 1 0 011-1h4" /><line x1="13" y1="9" x2="17" y2="9" /><line x1="13" y1="13" x2="17" y2="13" /></svg>,
  settings: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
  plus: <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>,
  trash: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" /></svg>,
  edit: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
  menu: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
  close: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>,
};

function Modal({ title, onClose, wide, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} onClick={(event) => event.stopPropagation()}>
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

function PkrBracket({ amount, label = "historical PKR", inline = false }) {
  if (!hasAmount(amount)) return null;
  return (
    <span className={inline ? "pkr-inline" : "pkr-note"}>
      ({fmtPKR(amount)} {label})
    </span>
  );
}

function RateWidget({ rateInfo, onRefresh, refreshing, compact = false }) {
  const updatedLabel = rateInfo.fetchedAt ? formatDateTime(rateInfo.fetchedAt) : "Using saved fallback rate";
  return (
    <div className={`rate-panel ${compact ? "compact" : ""}`}>
      <div>
        <div className="rate-head">Live PKR to CAD</div>
        <div className="rate-value">1 PKR = {fmtRate(rateInfo.rate)} CAD</div>
        <div className="rate-meta">
          <span>Last updated: {updatedLabel}</span>
          {rateInfo.providerDate && <span>Provider date: {formatProviderDate(rateInfo.providerDate)}</span>}
          <span>Source: {rateInfo.source}</span>
        </div>
      </div>
      <button className="btn btn-outline" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? "Refreshing…" : "Refresh Rate"}
        {refreshing && <span className="saving-dot" />}
      </button>
    </div>
  );
}

function Dashboard({ products, sales, expenses, rateInfo, onRefreshRate, refreshingRate }) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const monthSales = filterByMonth(sales, "sale_date", month, year);
  const monthExpenses = filterByMonth(expenses, "expense_date", month, year);
  const yearSales = filterByYear(sales, "sale_date", year);
  const yearExpenses = filterByYear(expenses, "expense_date", year);

  const monthTotals = calcTotals(monthSales, monthExpenses);
  const yearTotals = calcTotals(yearSales, yearExpenses);
  const allTotals = calcTotals(sales, expenses);

  const recentSales = [...sales].sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date)).slice(0, 5);
  const recentExpenses = [...expenses].sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date)).slice(0, 4);
  const lowStock = products.filter((product) => Number(product.quantity) <= 3);

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{ marginBottom: 0 }}>
          Dashboard — {MONTHS[month]} {year}
        </div>
      </div>

      <RateWidget rateInfo={rateInfo} onRefresh={onRefreshRate} refreshing={refreshingRate} />

      <div className="section-label">This Month</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }} className="four-col">
        <div className="stat-card">
          <div className="stat-label">Revenue</div>
          <div className="stat-value gold">{fmtCAD(monthTotals.revenue)}</div>
          <div className="stat-sub">{monthSales.length} sale{monthSales.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">COGS</div>
          <div className="stat-value blue">{fmtCAD(monthTotals.cogsCad)}</div>
          {hasAmount(monthTotals.cogsPkr) ? <PkrBracket amount={monthTotals.cogsPkr} label="historical PKR" /> : <div className="stat-sub">Cost of goods sold</div>}
        </div>
        <div className="stat-card">
          <div className="stat-label">Op. Expenses</div>
          <div className="stat-value red">{fmtCAD(monthTotals.opexCad)}</div>
          {hasAmount(monthTotals.opexPkr) ? <PkrBracket amount={monthTotals.opexPkr} label="from PKR entries" /> : <div className="stat-sub">{monthExpenses.length} entr{monthExpenses.length !== 1 ? "ies" : "y"}</div>}
        </div>
        <div className="stat-card">
          <div className="stat-label">Net Profit</div>
          <div className="stat-value green">{fmtCAD(monthTotals.profit)}</div>
          <div className="stat-sub">{monthTotals.revenue > 0 ? `${((monthTotals.profit / monthTotals.revenue) * 100).toFixed(1)}% margin` : "—"}</div>
        </div>
      </div>

      <div className="section-label">This Year ({year})</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }} className="four-col">
        <div className="stat-card">
          <div className="stat-label">Revenue</div>
          <div className="stat-value gold">{fmtCAD(yearTotals.revenue)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">COGS</div>
          <div className="stat-value blue">{fmtCAD(yearTotals.cogsCad)}</div>
          <PkrBracket amount={yearTotals.cogsPkr} label="historical PKR" />
        </div>
        <div className="stat-card">
          <div className="stat-label">Op. Expenses</div>
          <div className="stat-value red">{fmtCAD(yearTotals.opexCad)}</div>
          <PkrBracket amount={yearTotals.opexPkr} label="from PKR entries" />
        </div>
        <div className="stat-card">
          <div className="stat-label">Net Profit</div>
          <div className="stat-value green">{fmtCAD(yearTotals.profit)}</div>
        </div>
      </div>

      <div className="card" style={{ borderLeft: `4px solid ${t.green}`, background: t.greenLight, marginBottom: 16 }}>
        <div className="card-title" style={{ color: t.green }}>All-Time Net Profit</div>
        <div style={{ fontSize: 32, fontFamily: "'Playfair Display',serif", fontWeight: 700, color: t.green }}>
          {fmtCAD(allTotals.profit)}
        </div>
        <div style={{ fontSize: 13, color: t.muted, marginTop: 4, lineHeight: 1.6 }}>
          Revenue {fmtCAD(allTotals.revenue)} · COGS {fmtCAD(allTotals.cogsCad)} {formatPkrContext(allTotals.cogsPkr, "historical PKR")} · Op. Expenses {fmtCAD(allTotals.opexCad)} {formatPkrContext(allTotals.opexPkr, "from PKR entries")}
        </div>
        {hasAmount(allTotals.totalExpPkr) && (
          <div className="muted-line" style={{ marginTop: 6 }}>
            Total expenses: {fmtCAD(allTotals.totalExpCad)} {formatPkrContext(allTotals.totalExpPkr, "from PKR entries")}
          </div>
        )}
      </div>

      {lowStock.length > 0 && (
        <div className="card" style={{ borderLeft: `4px solid ${t.accent}`, background: t.accentLight, marginBottom: 16 }}>
          <div className="card-title" style={{ color: t.accent }}>⚠ Low Stock ({lowStock.length} item{lowStock.length > 1 ? "s" : ""})</div>
          <div style={{ fontSize: 13, color: t.text, display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
            {lowStock.map((product) => (
              <span key={product.id}>
                {product.name} — <strong>{product.quantity}</strong> left
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="two-col">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">Recent Sales</div>
          {recentSales.length === 0 ? (
            <div className="empty" style={{ padding: "14px 0" }}>
              <div className="empty-icon">🛍️</div>
              No sales yet
            </div>
          ) : (
            recentSales.map((sale) => (
              <div key={sale.id} className="report-row">
                <div>
                  <div style={{ fontWeight: 500 }}>{sale.product_name}</div>
                  <div style={{ fontSize: 12, color: t.muted }}>{new Date(sale.sale_date).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 600, color: t.accent }}>{fmtCAD(sale.total_revenue_cad)}</div>
                  {hasAmount(sale.total_cogs_cad) && (
                    <div style={{ fontSize: 11, color: t.blue }}>
                      COGS {fmtCAD(sale.total_cogs_cad)} {hasAmount(salePkrTotal(sale)) ? `(${fmtPKR(salePkrTotal(sale))} PKR)` : ""}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">Recent Expenses</div>
          {recentExpenses.length === 0 ? (
            <div className="empty" style={{ padding: "14px 0" }}>
              <div className="empty-icon">💸</div>
              No expenses yet
            </div>
          ) : (
            recentExpenses.map((expense) => (
              <div key={expense.id} className="report-row">
                <div>
                  <div style={{ fontWeight: 500 }}>{expense.title}</div>
                  <div style={{ fontSize: 12, color: t.muted }}>
                    {expense.category} · {new Date(expense.expense_date).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 600, color: t.red }}>
                    {fmtCAD(expense.amount_cad)} {expense.currency === "PKR" && `(${fmtPKR(expense.amount_original)} PKR)`}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const blankProduct = () => ({
  name: "",
  type: "Clothing",
  category: CLOTHING_CATEGORIES[0],
  cost_pkr: "",
  cost_cad: "",
  selling_price_cad: "",
  quantity: "1",
  notes: "",
});

function Products({ products, setProducts, rateInfo }) {
  const rate = rateInfo.rate;
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(blankProduct());
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilter] = useState("All");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const setType = (type) => setForm((current) => ({ ...current, type, category: categoriesFor(type)[0] }));

  const onCostPKR = (value) => {
    const converted = value === "" ? "" : pkrToCAD(value, rate, 4).toFixed(4);
    setForm((current) => ({ ...current, cost_pkr: value, cost_cad: converted }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setErr("");

    const costExchangeRate = hasAmount(form.cost_pkr) && hasAmount(form.cost_cad) ? derivedRate(form.cost_pkr, form.cost_cad, rate) : null;
    const payload = {
      name: form.name.trim(),
      type: form.type,
      category: form.category,
      cost_pkr: hasAmount(form.cost_pkr) ? toNumber(form.cost_pkr) : null,
      cost_cad: hasAmount(form.cost_cad) ? toNumber(form.cost_cad) : null,
      cost_exchange_rate: costExchangeRate,
      cost_converted_at: costExchangeRate ? new Date().toISOString() : null,
      selling_price_cad: hasAmount(form.selling_price_cad) ? toNumber(form.selling_price_cad) : null,
      quantity: Number(form.quantity) || 0,
      notes: form.notes || null,
    };

    try {
      if (editId) {
        const { data, error } = await supabase.from("products").update(payload).eq("id", editId).select().single();
        if (error) throw error;
        setProducts((current) => current.map((product) => (product.id === editId ? data : product)));
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select().single();
        if (error) throw error;
        setProducts((current) => [...current, data]);
      }
      setForm(blankProduct());
      setShowAdd(false);
      setEditId(null);
    } catch (error) {
      setErr(error.message || "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (product) => {
    setForm({
      name: product.name,
      type: product.type,
      category: product.category,
      cost_pkr: product.cost_pkr ?? "",
      cost_cad: product.cost_cad ?? "",
      selling_price_cad: product.selling_price_cad ?? "",
      quantity: product.quantity ?? "1",
      notes: product.notes ?? "",
    });
    setEditId(product.id);
    setShowAdd(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setProducts((current) => current.filter((product) => product.id !== id));
  };

  let filtered = products.filter(
    (product) =>
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.category || "").toLowerCase().includes(search.toLowerCase()),
  );
  if (filterType !== "All") {
    filtered = filtered.filter((product) => product.type === filterType);
  }

  const marginPct = (product) => {
    if (!product.cost_cad || !product.selling_price_cad) return null;
    return (((toNumber(product.selling_price_cad) - toNumber(product.cost_cad)) / toNumber(product.selling_price_cad)) * 100).toFixed(0);
  };

  const effectiveProductRate = derivedRate(form.cost_pkr, form.cost_cad, rate);
  const categories = categoriesFor(form.type);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>Products & Inventory</div>
          <div className="muted-line">New PKR product costs use the live rate: 1 PKR = {fmtRate(rate)} CAD</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(blankProduct()); setEditId(null); setShowAdd(true); }}>
          {Ic.plus} Add Product
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-label">Total Products</div><div className="stat-value">{products.length}</div></div>
        <div className="stat-card"><div className="stat-label">Clothing</div><div className="stat-value">{products.filter((product) => product.type === "Clothing").length}</div></div>
        <div className="stat-card"><div className="stat-label">Jewelry</div><div className="stat-value">{products.filter((product) => product.type === "Jewelry").length}</div></div>
        <div className="stat-card"><div className="stat-label">Low Stock</div><div className="stat-value" style={{ color: t.red }}>{products.filter((product) => Number(product.quantity) <= 3).length}</div></div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {["All", ...PRODUCT_TYPES].map((type) => (
          <button key={type} className={`btn btn-sm btn-outline ${filterType === type ? "active" : ""}`} onClick={() => setFilter(type)}>
            {type}
          </button>
        ))}
      </div>
      <div className="search-wrap">
        <input className="input" placeholder="Search products…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">👗</div>
          {products.length === 0 ? "No products yet — add your first item!" : "No products match your search."}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Cost (PKR)</th>
                  <th>Cost (CAD)</th>
                  <th>Sell Price</th>
                  <th>Margin</th>
                  <th>Stock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const margin = marginPct(product);
                  return (
                    <tr key={product.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{product.name}</div>
                        <div style={{ fontSize: 11, color: t.muted }}>{product.category}</div>
                      </td>
                      <td><span className={`badge ${product.type === "Jewelry" ? "badge-gold" : product.type === "Accessories" ? "badge-blue" : "badge-green"}`}>{product.type || "—"}</span></td>
                      <td style={{ color: t.muted }}>{product.cost_pkr ? fmtPKR(product.cost_pkr) : "—"}</td>
                      <td style={{ color: t.blue, fontWeight: 500 }}>{product.cost_cad ? fmtCAD(product.cost_cad) : "—"}</td>
                      <td style={{ fontWeight: 600 }}>{product.selling_price_cad ? fmtCAD(product.selling_price_cad) : "—"}</td>
                      <td style={{ fontWeight: 600, color: margin >= 30 ? t.green : margin >= 10 ? t.accent : t.red }}>{margin != null ? `${margin}%` : "—"}</td>
                      <td><span className={`badge ${Number(product.quantity) === 0 ? "badge-red" : Number(product.quantity) <= 3 ? "badge-gold" : "badge-green"}`}>{product.quantity}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(product)}>{Ic.edit}</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(product.id)}>{Ic.trash}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title={editId ? "Edit Product" : "Add Product"} onClose={() => { setShowAdd(false); setEditId(null); }}>
          <ErrBar msg={err} />
          <div className="form-group">
            <label>Product Name *</label>
            <input className="input" placeholder="e.g. Pink Embroidered Suit" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select className="input" value={form.type} onChange={(event) => setType(event.target.value)}>
                {PRODUCT_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>
          </div>

          <div style={{ background: t.blueLight, borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.blue, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Product Cost</div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Cost in PKR ₨</label>
                <input className="input" type="number" placeholder="e.g. 14000" value={form.cost_pkr} onChange={(event) => onCostPKR(event.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Converted CAD</label>
                <input className="input" type="number" placeholder="auto" value={form.cost_cad} onChange={(event) => setForm({ ...form, cost_cad: event.target.value })} />
              </div>
            </div>
            <div className="muted-line" style={{ marginTop: 8, color: t.blue }}>
              Live rate: 1 PKR = {fmtRate(rate)} CAD · Last updated {formatDateTime(rateInfo.fetchedAt)}
            </div>
            {form.cost_pkr && effectiveProductRate && (
              <div className="muted-line" style={{ marginTop: 4, color: t.blue }}>
                This product will save with rate 1 PKR = {fmtRate(effectiveProductRate)} CAD
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Selling Price (CAD) $</label>
              <input className="input" type="number" placeholder="0.00" value={form.selling_price_cad} onChange={(event) => setForm({ ...form, selling_price_cad: event.target.value })} />
            </div>
            <div className="form-group">
              <label>Quantity in Stock</label>
              <input className="input" type="number" min="0" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
            </div>
          </div>

          {form.cost_cad && form.selling_price_cad && (
            <div className="info-box info-green">
              Profit per item: {fmtCAD(toNumber(form.selling_price_cad) - toNumber(form.cost_cad))} · Margin: {(((toNumber(form.selling_price_cad) - toNumber(form.cost_cad)) / toNumber(form.selling_price_cad)) * 100).toFixed(0)}%
            </div>
          )}

          <div className="form-group">
            <label>Notes (optional)</label>
            <input className="input" placeholder="Any details…" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
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

const blankSale = () => ({
  sale_date: toDay(),
  product_id: "",
  product_name: "",
  custom_item: "",
  quantity_sold: "1",
  sale_price_cad: "",
  unit_cost_pkr: "",
  unit_cost_cad: "",
  notes: "",
});

function Sales({ products, setProducts, sales, setSales, rateInfo }) {
  const rate = rateInfo.rate;
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(blankSale());
  const [search, setSearch] = useState("");
  const [useCustom, setCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const selectProduct = (id) => {
    if (!id) {
      setForm((current) => ({ ...current, product_id: "", product_name: "", sale_price_cad: "", unit_cost_pkr: "", unit_cost_cad: "" }));
      return;
    }
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setForm((current) => ({
      ...current,
      product_id: product.id,
      product_name: product.name,
      sale_price_cad: product.selling_price_cad ?? "",
      unit_cost_pkr: product.cost_pkr ?? "",
      unit_cost_cad: product.cost_cad ?? "",
    }));
  };

  const handleSave = async () => {
    const label = useCustom ? form.custom_item : form.product_name;
    if (!label || !form.sale_price_cad) return;
    setSaving(true);
    setErr("");

    const quantitySold = Number(form.quantity_sold) || 1;
    const unitCostCad = toNumber(form.unit_cost_cad);
    const unitCostPkr = toNumber(form.unit_cost_pkr);
    const salePriceCad = toNumber(form.sale_price_cad);
    const unitCostExchangeRate = hasAmount(unitCostPkr) && hasAmount(unitCostCad) ? derivedRate(unitCostPkr, unitCostCad, rate) : null;

    const payload = {
      sale_date: form.sale_date,
      product_id: !useCustom && form.product_id ? form.product_id : null,
      product_name: label,
      quantity_sold: quantitySold,
      unit_cost_pkr: unitCostPkr || null,
      unit_cost_cad: unitCostCad || null,
      unit_cost_exchange_rate: unitCostExchangeRate,
      sale_price_cad: salePriceCad,
      total_revenue_cad: salePriceCad * quantitySold,
      total_cogs_cad: unitCostCad * quantitySold,
      notes: form.notes || null,
    };

    try {
      const { data: saleRow, error: saleError } = await supabase.from("sales").insert(payload).select().single();
      if (saleError) throw saleError;

      if (!useCustom && form.product_id) {
        const product = products.find((item) => item.id === form.product_id);
        if (product) {
          const newQty = Math.max(0, Number(product.quantity) - quantitySold);
          const { data: updatedProduct, error: productError } = await supabase.from("products").update({ quantity: newQty }).eq("id", form.product_id).select().single();
          if (productError) throw productError;
          setProducts((current) => current.map((item) => (item.id === form.product_id ? updatedProduct : item)));
        }
      }

      setSales((current) => [saleRow, ...current]);
      setForm(blankSale());
      setCustom(false);
      setShowAdd(false);
    } catch (error) {
      setErr(error.message || "Failed to save sale.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this sale?")) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setSales((current) => current.filter((sale) => sale.id !== id));
  };

  const sortedSales = [...sales].sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));
  const filteredSales = sortedSales.filter((sale) => (sale.product_name || "").toLowerCase().includes(search.toLowerCase()));

  const allTotals = calcTotals(sales, []);
  const quantity = Number(form.quantity_sold || 1);
  const saleRevenue = toNumber(form.sale_price_cad) * quantity;
  const saleCogs = toNumber(form.unit_cost_cad) * quantity;
  const saleCogsPkr = toNumber(form.unit_cost_pkr) * quantity;
  const grossProfit = form.sale_price_cad ? saleRevenue - saleCogs : null;
  const effectiveSaleRate = derivedRate(form.unit_cost_pkr, form.unit_cost_cad, rate);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>Sales</div>
          <div className="muted-line">COGS snapshots stay fixed per sale even when the live rate changes later.</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(blankSale()); setCustom(false); setShowAdd(true); }}>
          {Ic.plus} New Sale
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value gold">{fmtCAD(allTotals.revenue)}</div>
          <div className="stat-sub">{sales.length} total sales</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total COGS</div>
          <div className="stat-value blue">{fmtCAD(allTotals.cogsCad)}</div>
          <PkrBracket amount={allTotals.cogsPkr} />
        </div>
        <div className="stat-card">
          <div className="stat-label">Gross Profit</div>
          <div className="stat-value green">{fmtCAD(allTotals.revenue - allTotals.cogsCad)}</div>
          <div className="stat-sub">Before operating expenses</div>
        </div>
      </div>

      <div className="search-wrap">
        <input className="input" placeholder="Search sales…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {filteredSales.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">🛍️</div>
          {sales.length === 0 ? "No sales recorded yet — add your first sale!" : "No sales match your search."}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Revenue</th>
                  <th>COGS</th>
                  <th>Gross Profit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => {
                  const saleGrossProfit = sale.total_cogs_cad != null ? toNumber(sale.total_revenue_cad) - toNumber(sale.total_cogs_cad) : null;
                  const totalSalePkr = salePkrTotal(sale);
                  return (
                    <tr key={sale.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(sale.sale_date).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 500 }}>{sale.product_name}</td>
                      <td>{sale.quantity_sold}</td>
                      <td style={{ fontWeight: 600, color: t.accent }}>{fmtCAD(sale.total_revenue_cad)}</td>
                      <td>
                        <div style={{ color: t.blue, fontWeight: 600 }}>{hasAmount(sale.total_cogs_cad) ? fmtCAD(sale.total_cogs_cad) : "—"}</div>
                        <PkrBracket amount={totalSalePkr} />
                      </td>
                      <td style={{ fontWeight: 600, color: saleGrossProfit != null ? t.green : t.muted }}>
                        {saleGrossProfit != null ? fmtCAD(saleGrossProfit) : "—"}
                      </td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(sale.id)}>{Ic.trash}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title="New Sale" onClose={() => setShowAdd(false)} wide>
          <ErrBar msg={err} />
          <div className="form-group">
            <label>Date</label>
            <input className="input" type="date" value={form.sale_date} onChange={(event) => setForm({ ...form, sale_date: event.target.value })} />
          </div>

          {!useCustom ? (
            <div className="form-group">
              <label>Select Product <span style={{ color: t.muted, fontWeight: 400 }}>(auto-fills cost & price)</span></label>
              <select className="input" value={form.product_id} onChange={(event) => selectProduct(event.target.value)}>
                <option value="">— Choose a product —</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} (Stock: {product.quantity})
                  </option>
                ))}
              </select>
              <button
                style={{ background: "none", border: "none", color: t.primary, cursor: "pointer", fontWeight: 600, fontSize: 13, padding: "6px 0 0", display: "block" }}
                onClick={() => { setCustom(true); setForm((current) => ({ ...current, product_id: "", product_name: "", sale_price_cad: "", unit_cost_pkr: "", unit_cost_cad: "" })); }}
              >
                + Type item name manually instead
              </button>
            </div>
          ) : (
            <div className="form-group">
              <label>Item Name</label>
              <input className="input" placeholder="What was sold?" value={form.custom_item} onChange={(event) => setForm({ ...form, custom_item: event.target.value })} />
              <button
                style={{ background: "none", border: "none", color: t.primary, cursor: "pointer", fontWeight: 600, fontSize: 13, padding: "6px 0 0", display: "block" }}
                onClick={() => { setCustom(false); setForm((current) => ({ ...current, custom_item: "" })); }}
              >
                ← Pick from products instead
              </button>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Quantity Sold</label>
              <input className="input" type="number" min="1" value={form.quantity_sold} onChange={(event) => setForm({ ...form, quantity_sold: event.target.value })} />
            </div>
            <div className="form-group">
              <label>Sale Price per item (CAD) *</label>
              <input className="input" type="number" placeholder="0.00" value={form.sale_price_cad} onChange={(event) => setForm({ ...form, sale_price_cad: event.target.value })} />
            </div>
          </div>

          <div style={{ background: t.blueLight, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.blue, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Product Cost (COGS)</div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Cost per item (PKR)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="₨ cost"
                  value={form.unit_cost_pkr}
                  onChange={(event) => {
                    const converted = event.target.value === "" ? "" : pkrToCAD(event.target.value, rate, 4).toFixed(4);
                    setForm((current) => ({ ...current, unit_cost_pkr: event.target.value, unit_cost_cad: converted }));
                  }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Cost per item (CAD)</label>
                <input className="input" type="number" placeholder="auto" value={form.unit_cost_cad} onChange={(event) => setForm({ ...form, unit_cost_cad: event.target.value })} />
              </div>
            </div>
            <div className="muted-line" style={{ marginTop: 8, color: t.blue }}>
              Live rate: 1 PKR = {fmtRate(rate)} CAD · Last updated {formatDateTime(rateInfo.fetchedAt)}
            </div>
            {form.unit_cost_pkr && effectiveSaleRate && (
              <div className="muted-line" style={{ marginTop: 4, color: t.blue }}>
                This sale will save with rate 1 PKR = {fmtRate(effectiveSaleRate)} CAD
              </div>
            )}
          </div>

          {form.sale_price_cad && (
            <div style={{ marginBottom: 14 }}>
              <div className="info-box info-gold">Revenue: {fmtCAD(saleRevenue)}</div>
              {form.unit_cost_cad && (
                <>
                  <div className="info-box info-blue">
                    COGS: {fmtCAD(saleCogs)}
                    {form.unit_cost_pkr && <span style={{ opacity: 0.8 }}> ({fmtPKR(saleCogsPkr)} PKR)</span>}
                  </div>
                  <div className="info-box info-green">Gross Profit: {fmtCAD(grossProfit)}</div>
                </>
              )}
            </div>
          )}

          <div className="form-group">
            <label>Notes (optional)</label>
            <input className="input" placeholder="Any details…" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
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

const blankExp = () => ({
  expense_date: toDay(),
  title: "",
  category: EXPENSE_CATEGORIES[0],
  currency: "PKR",
  amount_original: "",
  amount_cad: "",
  notes: "",
});

function Expenses({ expenses, setExpenses, sales, rateInfo }) {
  const rate = rateInfo.rate;
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(blankExp());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const now = new Date();

  const onCurrencyChange = (currency) => {
    const converted = currency === "PKR" ? pkrToCAD(form.amount_original, rate, 2) : toNumber(form.amount_original);
    setForm((current) => ({ ...current, currency, amount_cad: current.amount_original === "" ? "" : converted.toFixed(2) }));
  };

  const onAmountChange = (value) => {
    const converted = form.currency === "PKR" ? pkrToCAD(value, rate, 2) : toNumber(value);
    setForm((current) => ({ ...current, amount_original: value, amount_cad: value === "" ? "" : converted.toFixed(2) }));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.amount_original) return;
    setSaving(true);
    setErr("");

    const exchangeRateUsed = form.currency === "PKR" ? derivedRate(form.amount_original, form.amount_cad, rate) : null;
    const payload = {
      expense_date: form.expense_date,
      title: form.title.trim(),
      category: form.category,
      amount_original: toNumber(form.amount_original),
      currency: form.currency,
      amount_cad: toNumber(form.amount_cad),
      exchange_rate_used: exchangeRateUsed,
      converted_at: exchangeRateUsed ? new Date().toISOString() : null,
      notes: form.notes || null,
    };

    try {
      const { data, error } = await supabase.from("expenses").insert(payload).select().single();
      if (error) throw error;
      setExpenses((current) => [data, ...current]);
      setForm(blankExp());
      setShowAdd(false);
    } catch (error) {
      setErr(error.message || "Failed to save expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setExpenses((current) => current.filter((expense) => expense.id !== id));
  };

  const sortedExpenses = [...expenses].sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));

  const monthSales = filterByMonth(sales, "sale_date", now.getMonth(), now.getFullYear());
  const monthExpenses = filterByMonth(expenses, "expense_date", now.getMonth(), now.getFullYear());
  const monthTotals = calcTotals(monthSales, monthExpenses);
  const allTotals = calcTotals(sales, expenses);

  const byCategory = {};
  expenses.forEach((expense) => {
    if (!byCategory[expense.category]) {
      byCategory[expense.category] = { cad: 0, pkr: 0 };
    }
    byCategory[expense.category].cad += toNumber(expense.amount_cad);
    byCategory[expense.category].pkr += expensePkrTotal(expense);
  });

  const bySaleProduct = {};
  sales.forEach((sale) => {
    if (!hasAmount(sale.total_cogs_cad)) return;
    const key = sale.product_name;
    if (!bySaleProduct[key]) {
      bySaleProduct[key] = { cad: 0, pkr: 0 };
    }
    bySaleProduct[key].cad += toNumber(sale.total_cogs_cad);
    bySaleProduct[key].pkr += salePkrTotal(sale);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>Expenses</div>
          <div className="muted-line">PKR expenses keep the saved rate and CAD snapshot from the day they were entered.</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(blankExp()); setShowAdd(true); }}>
          {Ic.plus} Add Expense
        </button>
      </div>

      <div className="section-label">This Month</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">COGS (from Sales)</div>
          <div className="stat-value blue">{fmtCAD(monthTotals.cogsCad)}</div>
          <PkrBracket amount={monthTotals.cogsPkr} label="historical PKR" />
        </div>
        <div className="stat-card">
          <div className="stat-label">Operating Expenses</div>
          <div className="stat-value red">{fmtCAD(monthTotals.opexCad)}</div>
          <PkrBracket amount={monthTotals.opexPkr} label="from PKR entries" />
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value red">{fmtCAD(monthTotals.totalExpCad)}</div>
          <PkrBracket amount={monthTotals.totalExpPkr} label="from PKR entries" />
        </div>
      </div>

      <div className="section-label">All Time</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }} className="two-col">
        <div className="card" style={{ marginBottom: 0, borderTop: `3px solid ${t.blue}` }}>
          <div className="card-title" style={{ color: t.blue }}>Cost of Goods Sold (COGS)</div>
          <div style={{ fontSize: 12, color: t.muted, marginBottom: 10, lineHeight: 1.5 }}>Auto-calculated from sales. Historical sale rows keep their original PKR and CAD cost snapshot.</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: t.blue }}>
            {fmtCAD(allTotals.cogsCad)}
          </div>
          <PkrBracket amount={allTotals.cogsPkr} label="historical PKR" />
          {Object.keys(bySaleProduct).length > 0 && (
            <>
              <hr className="divider" />
              {Object.entries(bySaleProduct).sort((a, b) => b[1].cad - a[1].cad).slice(0, 5).map(([name, values]) => (
                <div key={name} className="report-row" style={{ padding: "7px 0" }}>
                  <span style={{ color: t.text, fontWeight: 500, fontSize: 13 }}>{name}</span>
                  <span style={{ fontWeight: 600, color: t.blue }}>
                    {fmtCAD(values.cad)} {formatPkrContext(values.pkr, "historical PKR")}
                  </span>
                </div>
              ))}
            </>
          )}
          {allTotals.cogsCad === 0 && <div style={{ fontSize: 13, color: t.muted, marginTop: 8 }}>No product costs in sales yet.</div>}
        </div>

        <div className="card" style={{ marginBottom: 0, borderTop: `3px solid ${t.red}` }}>
          <div className="card-title" style={{ color: t.red }}>Operating Expenses</div>
          <div style={{ fontSize: 12, color: t.muted, marginBottom: 10, lineHeight: 1.5 }}>Business costs entered manually. PKR rows store the original amount, the rate used, and the saved CAD amount.</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: t.red }}>
            {fmtCAD(allTotals.opexCad)}
          </div>
          <PkrBracket amount={allTotals.opexPkr} label="from PKR entries" />
          {Object.keys(byCategory).length > 0 && (
            <>
              <hr className="divider" />
              {Object.entries(byCategory).sort((a, b) => b[1].cad - a[1].cad).map(([category, values]) => (
                <div key={category} className="report-row" style={{ padding: "7px 0" }}>
                  <span className="lbl">{category}</span>
                  <span style={{ fontWeight: 600, color: t.red }}>
                    {fmtCAD(values.cad)} {formatPkrContext(values.pkr, "from PKR entries")}
                  </span>
                </div>
              ))}
            </>
          )}
          {allTotals.opexCad === 0 && <div style={{ fontSize: 13, color: t.muted, marginTop: 8 }}>No operating expenses yet.</div>}
        </div>
      </div>

      <div className="card" style={{ background: t.redLight, border: `1px solid ${t.red}`, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Total Expenses — All Time</div>
            <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
              COGS {fmtCAD(allTotals.cogsCad)} {formatPkrContext(allTotals.cogsPkr, "historical PKR")} + Operating {fmtCAD(allTotals.opexCad)} {formatPkrContext(allTotals.opexPkr, "from PKR entries")}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, fontWeight: 700, color: t.red }}>{fmtCAD(allTotals.totalExpCad)}</div>
            <PkrBracket amount={allTotals.totalExpPkr} label="from PKR entries" />
          </div>
        </div>
      </div>

      <div className="section-label">Operating Expense Log</div>
      {sortedExpenses.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">💸</div>
          No operating expenses recorded yet.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Original</th>
                  <th>CAD Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(expense.expense_date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 500 }}>{expense.title}</td>
                    <td><span className="badge badge-red">{expense.category}</span></td>
                    <td style={{ color: t.muted, fontSize: 13 }}>
                      {expense.currency === "PKR" ? (
                        <>{fmtPKR(expense.amount_original)} <span className="badge badge-purple" style={{ fontSize: 10 }}>PKR</span></>
                      ) : (
                        <>{fmtCAD(expense.amount_original)} <span className="badge badge-green" style={{ fontSize: 10 }}>CAD</span></>
                      )}
                    </td>
                    <td style={{ fontWeight: 600, color: t.red }}>{fmtCAD(expense.amount_cad)}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(expense.id)}>{Ic.trash}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title="Add Operating Expense" onClose={() => setShowAdd(false)} wide>
          <ErrBar msg={err} />
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input className="input" type="date" value={form.expense_date} onChange={(event) => setForm({ ...form, expense_date: event.target.value })} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description *</label>
            <input className="input" placeholder="What was this expense for?" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
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
            <input className="input" type="number" placeholder={form.currency === "PKR" ? "e.g. 5000" : "e.g. 25.00"} value={form.amount_original} onChange={(event) => onAmountChange(event.target.value)} />
            {form.currency === "PKR" && form.amount_original && (
              <div className="converted-hint">
                = {fmtCAD(form.amount_cad)} CAD at saved rate 1 PKR = {fmtRate(derivedRate(form.amount_original, form.amount_cad, rate))} CAD
              </div>
            )}
            <div className="muted-line" style={{ marginTop: 6 }}>
              Current live rate last updated {formatDateTime(rateInfo.fetchedAt)}
            </div>
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <input className="input" placeholder="Any extra details…" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
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

function Reports({ sales, expenses }) {
  const now = new Date();
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const years = [];
  for (let currentYear = 2023; currentYear <= now.getFullYear() + 1; currentYear += 1) {
    years.push(currentYear);
  }

  const selectedSales = () => {
    if (mode === "month") return filterByMonth(sales, "sale_date", month, year);
    if (mode === "year") return filterByYear(sales, "sale_date", year);
    return sales;
  };
  const selectedExpenses = () => {
    if (mode === "month") return filterByMonth(expenses, "expense_date", month, year);
    if (mode === "year") return filterByYear(expenses, "expense_date", year);
    return expenses;
  };

  const scopedSales = selectedSales();
  const scopedExpenses = selectedExpenses();
  const totals = calcTotals(scopedSales, scopedExpenses);
  const grossProfit = totals.revenue - totals.cogsCad;
  const label = mode === "month" ? `${MONTHS[month]} ${year}` : mode === "year" ? String(year) : "All Time";

  const byProduct = {};
  scopedSales.forEach((sale) => {
    byProduct[sale.product_name] = (byProduct[sale.product_name] || 0) + toNumber(sale.total_revenue_cad);
  });
  const topProducts = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const byCategory = {};
  scopedExpenses.forEach((expense) => {
    if (!byCategory[expense.category]) {
      byCategory[expense.category] = { cad: 0, pkr: 0 };
    }
    byCategory[expense.category].cad += toNumber(expense.amount_cad);
    byCategory[expense.category].pkr += expensePkrTotal(expense);
  });

  const exportRows = [
    ["Report", label],
    ["Revenue (CAD)", fmtCAD(totals.revenue)],
    ["COGS (CAD)", fmtCAD(totals.cogsCad)],
    ["COGS (historical PKR)", hasAmount(totals.cogsPkr) ? fmtPKR(totals.cogsPkr) : ""],
    ["Gross Profit (CAD)", fmtCAD(grossProfit)],
    ["Operating Expenses (CAD)", fmtCAD(totals.opexCad)],
    ["Operating Expenses (PKR entries)", hasAmount(totals.opexPkr) ? fmtPKR(totals.opexPkr) : ""],
    ["Total Expenses (CAD)", fmtCAD(totals.totalExpCad)],
    ["Total Expenses (PKR entries)", hasAmount(totals.totalExpPkr) ? fmtPKR(totals.totalExpPkr) : ""],
    ["Net Profit (CAD)", fmtCAD(totals.profit)],
  ];

  const handleExportExcel = () => {
    const rows = [...exportRows];
    if (topProducts.length > 0) {
      rows.push([]);
      rows.push(["Top Items by Revenue"]);
      topProducts.forEach(([name, revenue]) => rows.push([name, fmtCAD(revenue)]));
    }
    const categoryEntries = Object.entries(byCategory).sort((a, b) => b[1].cad - a[1].cad);
    if (categoryEntries.length > 0) {
      rows.push([]);
      rows.push(["Operating Expenses by Category"]);
      categoryEntries.forEach(([category, values]) => {
        rows.push([category, fmtCAD(values.cad), hasAmount(values.pkr) ? fmtPKR(values.pkr) : ""]);
      });
    }
    downloadTextFile(`apna-culture-report-${label.toLowerCase().replaceAll(" ", "-")}.csv`, buildCsv(rows), "text/csv;charset=utf-8");
  };

  const handleExportPdf = () => {
    const categoryEntries = Object.entries(byCategory).sort((a, b) => b[1].cad - a[1].cad);
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;

    const summaryRows = exportRows
      .map(([name, value]) => `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(value)}</td></tr>`)
      .join("");
    const topProductRows = topProducts
      .map(([name, revenue]) => `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(fmtCAD(revenue))}</td></tr>`)
      .join("");
    const categoryRows = categoryEntries
      .map(([category, values]) => `<tr><td>${escapeHtml(category)}</td><td>${escapeHtml(fmtCAD(values.cad))}</td><td>${escapeHtml(hasAmount(values.pkr) ? fmtPKR(values.pkr) : "")}</td></tr>`)
      .join("");

    popup.document.write(`<!DOCTYPE html>
      <html>
        <head>
          <title>Apna Culture Report - ${escapeHtml(label)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #2A2725; }
            h1 { margin: 0 0 8px; }
            h2 { margin: 24px 0 10px; font-size: 18px; }
            p { margin: 0 0 18px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #f4efe7; }
          </style>
        </head>
        <body>
          <h1>Apna Culture Report</h1>
          <p>${escapeHtml(label)}</p>
          <h2>Summary</h2>
          <table>
            <tbody>${summaryRows}</tbody>
          </table>
          ${topProducts.length > 0 ? `<h2>Top Items by Revenue</h2><table><tbody>${topProductRows}</tbody></table>` : ""}
          ${categoryEntries.length > 0 ? `<h2>Operating Expenses by Category</h2><table><thead><tr><th>Category</th><th>CAD</th><th>PKR Entries</th></tr></thead><tbody>${categoryRows}</tbody></table>` : ""}
        </body>
      </html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <div>
      <div className="page-title">Reports</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        {[["month", "By Month"], ["year", "By Year"], ["all", "All Time"]].map(([value, text]) => (
          <button key={value} className={`btn btn-sm ${mode === value ? "btn-primary" : "btn-outline"}`} onClick={() => setMode(value)}>
            {text}
          </button>
        ))}
        {mode === "month" && (
          <>
            <select className="input" style={{ width: "auto", minWidth: 130 }} value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {MONTHS.map((monthName, index) => <option key={monthName} value={index}>{monthName}</option>)}
            </select>
            <select className="input" style={{ width: "auto", minWidth: 80 }} value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {years.map((yearOption) => <option key={yearOption}>{yearOption}</option>)}
            </select>
          </>
        )}
        {mode === "year" && (
          <select className="input" style={{ width: "auto", minWidth: 80 }} value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((yearOption) => <option key={yearOption}>{yearOption}</option>)}
          </select>
        )}
        <button className="btn btn-sm btn-outline" onClick={handleExportExcel}>Export to Excel</button>
        <button className="btn btn-sm btn-outline" onClick={handleExportPdf}>Export to PDF</button>
      </div>

      <div className="card">
        <div className="card-title">Profit & Loss — {label} (CAD-first)</div>
        <div className="report-row">
          <span className="lbl">Revenue <span style={{ fontSize: 11 }}>(total sales)</span></span>
          <span className="val" style={{ color: t.accent }}>{fmtCAD(totals.revenue)}</span>
        </div>
        <div className="report-row">
          <span style={{ color: t.blue }}>Less: Cost of Goods Sold (COGS)</span>
          <span style={{ fontWeight: 600, color: t.blue }}>
            ({fmtCAD(totals.cogsCad)}) {formatPkrContext(totals.cogsPkr, "historical PKR")}
          </span>
        </div>
        <div className="report-row" style={{ borderBottom: `2px solid ${t.border}`, paddingBottom: 12 }}>
          <span style={{ fontWeight: 600 }}>Gross Profit</span>
          <span style={{ fontWeight: 700, color: t.green }}>{fmtCAD(grossProfit)}</span>
        </div>
        <div className="report-row" style={{ paddingTop: 12 }}>
          <span style={{ color: t.red }}>Less: Operating Expenses</span>
          <span style={{ fontWeight: 600, color: t.red }}>
            ({fmtCAD(totals.opexCad)}) {formatPkrContext(totals.opexPkr, "from PKR entries")}
          </span>
        </div>
        <div className="report-row">
          <span className="lbl">Total Expenses</span>
          <span className="val" style={{ color: t.red }}>
            {fmtCAD(totals.totalExpCad)} {formatPkrContext(totals.totalExpPkr, "from PKR entries")}
          </span>
        </div>
        <div className="report-total">
          <span style={{ fontWeight: 700, fontSize: 16 }}>Net Profit</span>
          <span style={{ fontWeight: 700, fontSize: 22, color: t.green }}>
            {fmtCAD(totals.profit)}
            {totals.revenue > 0 && <span style={{ fontSize: 14, marginLeft: 8, fontWeight: 500 }}>({((totals.profit / totals.revenue) * 100).toFixed(1)}% margin)</span>}
          </span>
        </div>
      </div>

      {(topProducts.length > 0 || Object.keys(byCategory).length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="two-col">
          {topProducts.length > 0 && (
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title">Top Items by Revenue</div>
              {topProducts.map(([name, revenue]) => (
                <div key={name} className="report-row">
                  <span style={{ fontWeight: 500 }}>{name}</span>
                  <span style={{ fontWeight: 600, color: t.accent }}>{fmtCAD(revenue)}</span>
                </div>
              ))}
            </div>
          )}
          {Object.keys(byCategory).length > 0 && (
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title">Operating Expenses by Category</div>
              {Object.entries(byCategory).sort((a, b) => b[1].cad - a[1].cad).map(([category, values]) => (
                <div key={category} className="report-row">
                  <span className="lbl">{category}</span>
                  <span style={{ fontWeight: 600, color: t.red }}>
                    {fmtCAD(values.cad)} {formatPkrContext(values.pkr, "from PKR entries")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {scopedSales.length === 0 && scopedExpenses.length === 0 && (
        <div className="card empty">
          <div className="empty-icon">📊</div>
          No data for {label}. Start adding sales and expenses!
        </div>
      )}
    </div>
  );
}

function Settings({ rateInfo, onRefreshRate, refreshingRate }) {
  const pkrPerCad = rateInfo.rate > 0 ? (1 / rateInfo.rate).toFixed(0) : "—";

  return (
    <div>
      <div className="page-title">Settings</div>
      <div className="card">
        <div className="card-title">Exchange Rate — PKR to CAD</div>
        <p style={{ fontSize: 14, color: t.muted, marginBottom: 18, lineHeight: 1.6 }}>
          The app fetches the live PKR to CAD rate from the Vercel API route and uses it only for new PKR entries.
          Existing historical products, sales, and expenses keep their saved CAD snapshot and saved rate.
        </p>
        <RateWidget rateInfo={rateInfo} onRefresh={onRefreshRate} refreshing={refreshingRate} compact />
        <div style={{ fontSize: 14, color: t.muted, marginBottom: 18 }}>
          Equivalent view: about {pkrPerCad} PKR per $1 CAD
        </div>
        <div style={{ background: t.greenLight, borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontWeight: 700, color: t.green, marginBottom: 10 }}>Quick Conversion Table</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", fontSize: 14 }}>
            {[1000, 2000, 5000, 10000, 20000, 50000].map((pkrAmount) => (
              <div key={pkrAmount} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${t.border}` }}>
                <span style={{ color: t.muted }}>{fmtPKR(pkrAmount)}</span>
                <span style={{ fontWeight: 600, color: t.green }}>{fmtCAD(pkrToCAD(pkrAmount, rateInfo.rate, 2))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: Ic.dashboard },
  { id: "products", label: "Products", icon: Ic.products },
  { id: "sales", label: "Sales", icon: Ic.sales },
  { id: "expenses", label: "Expenses", icon: Ic.expenses },
  { id: "reports", label: "Reports", icon: Ic.reports },
  { id: "settings", label: "Settings", icon: Ic.settings },
];

export default function App() {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [rateInfo, setRateInfo] = useState(() => loadStoredRateState());
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [rateErr, setRateErr] = useState("");
  const [refreshingRate, setRefreshingRate] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [open, setOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadErr("");
    try {
      const [{ data: productRows, error: productError }, { data: saleRows, error: saleError }, { data: expenseRows, error: expenseError }] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("sales").select("*").order("sale_date", { ascending: false }),
        supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
      ]);
      if (productError) throw productError;
      if (saleError) throw saleError;
      if (expenseError) throw expenseError;
      setProducts(productRows || []);
      setSales(saleRows || []);
      setExpenses(expenseRows || []);
    } catch (error) {
      setLoadErr(error.message || "Failed to load data from Supabase.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRate = useCallback(async (force = false) => {
    setRefreshingRate(true);
    setRateErr("");
    try {
      const query = force ? `?refresh=1&t=${Date.now()}` : "";
      const response = await fetch(`${RATE_API_PATH}${query}`, {
        headers: force ? { "Cache-Control": "no-cache", Pragma: "no-cache" } : {},
      });
      if (!response.ok) {
        throw new Error("Could not load the latest PKR to CAD rate.");
      }
      const data = await response.json();
      const nextRateInfo = buildRateState(data);
      setRateInfo(nextRateInfo);
    } catch (error) {
      setRateErr(error.message || "Could not refresh the exchange rate. Using the last saved rate.");
    } finally {
      setRefreshingRate(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    fetchRate(false);
  }, [fetchRate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RATE_STORAGE_KEY, JSON.stringify(rateInfo));
  }, [rateInfo]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const registerServiceWorker = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    window.addEventListener("load", registerServiceWorker, { once: true });
    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let mode = null;

    const isStandalone = () =>
      window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

    const isInteractiveTarget = (target) =>
      target instanceof Element && Boolean(target.closest("input, textarea, select, button, a"));

    const onTouchStart = (event) => {
      if (window.innerWidth > 1024 || event.touches.length !== 1 || isInteractiveTarget(event.target)) return;

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      lastX = touch.clientX;
      mode = null;

      if (open) {
        mode = "close";
        return;
      }

      if (isStandalone() && startX >= 16 && startX <= 40) {
        mode = "open";
      }
    };

    const onTouchMove = (event) => {
      if (!mode || event.touches.length !== 1) return;
      const touch = event.touches[0];
      lastX = touch.clientX;
      if (Math.abs(touch.clientY - startY) > Math.abs(touch.clientX - startX)) {
        mode = null;
      }
    };

    const onTouchEnd = () => {
      if (!mode) return;
      const deltaX = lastX - startX;
      if (mode === "open" && deltaX > 70) {
        setOpen(true);
      }
      if (mode === "close" && deltaX < -70) {
        setOpen(false);
      }
      mode = null;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [open]);

  const navigate = (id) => {
    setPage(id);
    setOpen(false);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'DM Sans',sans-serif", background: "#F8F6F2", color: "#7A756E", gap: 12 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: "#1B6B4A", fontWeight: 700 }}>Apna Culture</div>
        <div style={{ fontSize: 14 }}>Loading your data…</div>
      </div>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <button className="hamburger" onClick={() => setOpen((current) => !current)}>{open ? Ic.close : Ic.menu}</button>
        <div className={`overlay ${open ? "show" : ""}`} onClick={() => setOpen(false)} />

        <div className={`sidebar ${open ? "open" : ""}`}>
          <div className="brand">
            <img className="brand-logo" src="/icons/brand-logo.png" alt="Apna Culture logo" />
            <div className="brand-name">Apna Culture</div>
            <div className="brand-sub">Accounting & Profit Tracker</div>
          </div>
          {NAV.filter((item) => item.id !== "settings").map((item) => (
            <button key={item.id} className={`nav-btn ${page === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}>
              {item.icon} {item.label}
            </button>
          ))}
          <hr className="nav-divider" />
          <button className={`nav-btn ${page === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}>
            {Ic.settings} Settings
          </button>
          <div style={{ marginTop: "auto", padding: "12px 20px", fontSize: 11, opacity: 0.75, lineHeight: 1.5 }}>
            <div>Live rate: 1 PKR = {fmtRate(rateInfo.rate)} CAD</div>
            <div>{rateInfo.fetchedAt ? `Updated ${new Date(rateInfo.fetchedAt).toLocaleDateString()}` : "Using saved fallback rate"}</div>
          </div>
        </div>

        <div className="main">
          {loadErr && (
            <div className="err-bar">
              ⚠ {loadErr} — <button style={{ background: "none", border: "none", color: t.red, cursor: "pointer", fontWeight: 700 }} onClick={loadAll}>Retry</button>
            </div>
          )}
          {rateErr && <div className="err-bar">⚠ {rateErr}</div>}

          {page === "dashboard" && <Dashboard products={products} sales={sales} expenses={expenses} rateInfo={rateInfo} onRefreshRate={() => fetchRate(true)} refreshingRate={refreshingRate} />}
          {page === "products" && <Products products={products} setProducts={setProducts} rateInfo={rateInfo} />}
          {page === "sales" && <Sales products={products} setProducts={setProducts} sales={sales} setSales={setSales} rateInfo={rateInfo} />}
          {page === "expenses" && <Expenses expenses={expenses} setExpenses={setExpenses} sales={sales} rateInfo={rateInfo} />}
          {page === "reports" && <Reports sales={sales} expenses={expenses} />}
          {page === "settings" && <Settings rateInfo={rateInfo} onRefreshRate={() => fetchRate(true)} refreshingRate={refreshingRate} />}
        </div>
      </div>
    </>
  );
}
