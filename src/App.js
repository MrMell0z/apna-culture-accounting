import { useState, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const PRODUCT_TYPES = ["Clothing", "Jewelry", "Accessories"];

const CLOTHING_CATEGORIES = [
  "Suit (Stitched)", "Suit (Unstitched)", "Lehnga", "Sharara",
  "Bridal Wear", "Formal / Party Wear", "Casual Wear", "Kurti", "Abaya",
  "Dupatta", "Other Clothing"
];

const JEWELRY_CATEGORIES = [
  "Necklace Set", "Earrings", "Bangles", "Bridal Jewelry Set",
  "Maang Tikka", "Nath (Nose Ring)", "Bracelet", "Ring", "Other Jewelry"
];

const ACCESSORIES_CATEGORIES = ["Clutch / Bag", "Shawl", "Scarf", "Shoes", "Other Accessories"];

const EXPENSE_CATEGORIES = [
  "Shipping", "Packaging", "Customs / Duties", "Rent", "Supplies",
  "Marketing", "Other"
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().split("T")[0];
const fmt   = (n) => "$" + Number(n || 0).toFixed(2);

const categoriesFor = (type) => {
  if (type === "Jewelry")     return JEWELRY_CATEGORIES;
  if (type === "Accessories") return ACCESSORIES_CATEGORIES;
  return CLOTHING_CATEGORIES;
};

// ─── Accounting helpers ───────────────────────────────────────────────────────
// Revenue  = sum of (price × qty) for each sale
// COGS     = sum of (cost × qty) for each sale — pulled from the sale record itself
// OpEx     = sum of manually entered expenses
// TotalExp = COGS + OpEx
// Profit   = Revenue − TotalExp
const calcTotals = (sales, expenses) => {
  const revenue = sales.reduce((s, x)   => s + (Number(x.price) || 0) * (Number(x.qty) || 1), 0);
  const cogs    = sales.reduce((s, x)   => s + (Number(x.cost)  || 0) * (Number(x.qty) || 1), 0);
  const opex    = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalExp = cogs + opex;
  const profit   = revenue - totalExp;
  return { revenue, cogs, opex, totalExp, profit };
};

const filterByMonth = (arr, key, m, y) =>
  arr.filter(x => { const d = new Date(x[key]); return d.getMonth() === m && d.getFullYear() === y; });
const filterByYear = (arr, key, y) =>
  arr.filter(x => new Date(x[key]).getFullYear() === y);

// ─── Demo seed products ───────────────────────────────────────────────────────
const SEED_PRODUCTS = [
  { id:"s1",  type:"Clothing",    category:"Suit (Stitched)",    name:"Light Pink Embroidered Suit",      cost:"65",  price:"110", qty:"3", notes:"" },
  { id:"s2",  type:"Clothing",    category:"Suit (Stitched)",    name:"Royal Blue Chiffon Suit",          cost:"70",  price:"120", qty:"2", notes:"" },
  { id:"s3",  type:"Clothing",    category:"Suit (Unstitched)",  name:"Lawn Printed Suit (3-piece)",      cost:"30",  price:"55",  qty:"5", notes:"" },
  { id:"s4",  type:"Clothing",    category:"Suit (Unstitched)",  name:"Cotton Casual Suit (3-piece)",     cost:"25",  price:"45",  qty:"4", notes:"" },
  { id:"s5",  type:"Clothing",    category:"Lehnga",             name:"Red Bridal Lehnga",                cost:"180", price:"320", qty:"1", notes:"Heavy embroidery" },
  { id:"s6",  type:"Clothing",    category:"Lehnga",             name:"Green Party Lehnga",               cost:"110", price:"200", qty:"2", notes:"" },
  { id:"s7",  type:"Clothing",    category:"Sharara",            name:"Ivory Sharara Set",                cost:"90",  price:"160", qty:"2", notes:"" },
  { id:"s8",  type:"Clothing",    category:"Bridal Wear",        name:"Full Bridal Dress (Red & Gold)",   cost:"350", price:"600", qty:"1", notes:"Includes dupatta" },
  { id:"s9",  type:"Clothing",    category:"Kurti",              name:"Printed Cotton Kurti",             cost:"18",  price:"35",  qty:"8", notes:"" },
  { id:"s10", type:"Clothing",    category:"Kurti",              name:"Silk Formal Kurti",                cost:"40",  price:"70",  qty:"4", notes:"" },
  { id:"s11", type:"Clothing",    category:"Abaya",              name:"Black Nida Abaya (Plain)",         cost:"45",  price:"80",  qty:"3", notes:"" },
  { id:"s12", type:"Clothing",    category:"Abaya",              name:"Embroidered Abaya (Beige)",        cost:"60",  price:"105", qty:"2", notes:"" },
  { id:"s13", type:"Clothing",    category:"Dupatta",            name:"Silk Dupatta (Assorted Colors)",   cost:"20",  price:"38",  qty:"6", notes:"" },
  { id:"s14", type:"Clothing",    category:"Formal / Party Wear",name:"Peach Georgette Party Dress",      cost:"85",  price:"150", qty:"2", notes:"" },
  { id:"j1",  type:"Jewelry",     category:"Bridal Jewelry Set", name:"Gold-Plated Bridal Set (Full)",    cost:"120", price:"220", qty:"2", notes:"Necklace + earrings + tikka" },
  { id:"j2",  type:"Jewelry",     category:"Necklace Set",       name:"Kundan Necklace Set",              cost:"55",  price:"95",  qty:"3", notes:"" },
  { id:"j3",  type:"Jewelry",     category:"Necklace Set",       name:"Pearl Choker Set",                 cost:"40",  price:"75",  qty:"2", notes:"" },
  { id:"j4",  type:"Jewelry",     category:"Earrings",           name:"Jhumka Earrings (Gold)",           cost:"15",  price:"28",  qty:"6", notes:"" },
  { id:"j5",  type:"Jewelry",     category:"Earrings",           name:"Chandbali Earrings",               cost:"22",  price:"40",  qty:"4", notes:"" },
  { id:"j6",  type:"Jewelry",     category:"Bangles",            name:"Gold Bangles Set (6 pcs)",         cost:"35",  price:"65",  qty:"5", notes:"" },
  { id:"j7",  type:"Jewelry",     category:"Bangles",            name:"Stone Bangles (Assorted)",         cost:"20",  price:"38",  qty:"4", notes:"" },
  { id:"j8",  type:"Jewelry",     category:"Maang Tikka",        name:"Kundan Maang Tikka",               cost:"18",  price:"35",  qty:"5", notes:"" },
];

// ─── Theme ────────────────────────────────────────────────────────────────────
const t = {
  bg:"#F8F6F2", card:"#FFFFFF",
  sidebar:"#1B6B4A", sidebarText:"rgba(255,255,255,0.85)", sidebarActive:"rgba(255,255,255,0.18)",
  accent:"#C4883A", accentLight:"#FEF3E6",
  green:"#1E9E56", greenLight:"#E6F7EE",
  red:"#C0392B", redLight:"#FDEDEB",
  blue:"#2471A3", blueLight:"#EAF4FC",
  text:"#2A2725", muted:"#7A756E", border:"#E8E3DC",
  primary:"#1B6B4A", primaryLight:"#E8F4EE",
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:${t.bg}}
  .app{font-family:'DM Sans',sans-serif;display:flex;min-height:100vh;color:${t.text};background:${t.bg}}

  .sidebar{width:220px;background:${t.sidebar};color:white;display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100;transition:transform .28s ease}
  .brand{padding:22px 20px 18px;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:8px}
  .brand-name{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;line-height:1.2;color:white}
  .brand-sub{font-size:11px;opacity:.6;margin-top:3px;letter-spacing:.4px}
  .nav-btn{display:flex;align-items:center;gap:11px;width:100%;padding:12px 20px;background:none;border:none;color:${t.sidebarText};font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;cursor:pointer;text-align:left;transition:background .15s,color .15s;border-right:3px solid transparent}
  .nav-btn:hover{background:rgba(255,255,255,.08);color:white}
  .nav-btn.active{background:${t.sidebarActive};color:white;border-right-color:${t.accent}}

  .main{margin-left:220px;flex:1;padding:32px 28px;max-width:1080px}
  .hamburger{display:none;position:fixed;top:14px;left:14px;z-index:200;background:${t.sidebar};color:white;border:none;border-radius:8px;padding:8px;cursor:pointer;line-height:0}
  .overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.38);z-index:90}
  @media(max-width:768px){
    .sidebar{transform:translateX(-100%)}
    .sidebar.open{transform:translateX(0)}
    .main{margin-left:0;padding:20px 16px;padding-top:60px}
    .hamburger{display:block}
    .overlay.show{display:block}
    .two-col{grid-template-columns:1fr!important}
    .three-col{grid-template-columns:1fr 1fr!important}
  }
  @media(max-width:480px){.three-col{grid-template-columns:1fr!important}}

  .page-title{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:${t.text};margin-bottom:22px}
  .section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:${t.muted};margin-bottom:10px}

  .card{background:${t.card};border-radius:12px;border:1px solid ${t.border};padding:20px;margin-bottom:16px}
  .card-title{font-size:12px;font-weight:700;color:${t.muted};text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px}

  .stat-card{background:${t.card};border-radius:12px;padding:18px 20px;border:1px solid ${t.border}}
  .stat-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${t.muted};margin-bottom:6px}
  .stat-value{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;line-height:1.1}
  .stat-value.green{color:${t.green}}
  .stat-value.red{color:${t.red}}
  .stat-value.gold{color:${t.accent}}
  .stat-value.blue{color:${t.blue}}
  .stat-sub{font-size:12px;color:${t.muted};margin-top:4px}

  .tbl-wrap{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th{text-align:left;padding:9px 12px;font-size:11px;font-weight:700;color:${t.muted};text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${t.border};white-space:nowrap}
  td{padding:10px 12px;border-bottom:1px solid ${t.border};vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:${t.primaryLight}}

  .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;border:none;transition:all .15s;line-height:1}
  .btn-primary{background:${t.primary};color:white}
  .btn-primary:hover{background:#155A3E}
  .btn-outline{background:transparent;border:1.5px solid ${t.border};color:${t.text}}
  .btn-outline:hover{border-color:${t.primary};color:${t.primary}}
  .btn-outline.active{border-color:${t.primary};color:${t.primary};background:${t.primaryLight}}
  .btn-danger{background:${t.redLight};color:${t.red}}
  .btn-danger:hover{background:#F5C6C0}
  .btn-sm{padding:6px 11px;font-size:13px}

  .form-group{margin-bottom:14px}
  label{display:block;font-size:13px;font-weight:600;color:${t.muted};margin-bottom:5px}
  .input{width:100%;padding:11px 13px;border:1.5px solid ${t.border};border-radius:8px;font-size:14px;font-family:'DM Sans',sans-serif;background:${t.bg};color:${t.text};transition:border-color .15s}
  .input:focus{outline:none;border-color:${t.primary}}
  select.input{appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%237A756E' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:520px){.form-row{grid-template-columns:1fr}}

  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px}
  .modal{background:${t.card};border-radius:14px;padding:28px;width:100%;max-width:500px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.18)}
  .modal-title{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;margin-bottom:20px}
  .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}

  .empty{text-align:center;padding:44px 20px;color:${t.muted};font-size:15px}
  .empty-icon{font-size:38px;margin-bottom:10px;opacity:.5}

  .badge{display:inline-block;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600}
  .badge-green{background:${t.greenLight};color:${t.green}}
  .badge-gold{background:${t.accentLight};color:${t.accent}}
  .badge-red{background:${t.redLight};color:${t.red}}
  .badge-blue{background:${t.blueLight};color:${t.blue}}

  .info-box{border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:8px}
  .info-green{background:${t.greenLight};color:${t.green}}
  .info-gold{background:${t.accentLight};color:${t.accent}}
  .info-red{background:${t.redLight};color:${t.red}}
  .info-blue{background:${t.blueLight};color:${t.blue}}

  .report-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid ${t.border};font-size:14px}
  .report-row:last-child{border-bottom:none}
  .report-row .lbl{color:${t.muted}}
  .report-row .val{font-weight:600;font-size:15px}
  .report-total{display:flex;justify-content:space-between;align-items:center;padding:14px 0 0;margin-top:8px;border-top:2px solid ${t.border}}

  .page-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px}
  .search-wrap{margin-bottom:14px}
  hr.divider{border:none;border-top:1px solid ${t.border};margin:12px 0}
`;

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = {
  dashboard:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  products: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M20 7H4a1 1 0 00-1 1v11a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1z"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
  sales:    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>,
  expenses: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  reports:  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 19V6l2-3h9a1 1 0 011 1v12a1 1 0 01-1 1H9z"/><path d="M9 19H5a1 1 0 01-1-1V4a1 1 0 011-1h4"/><line x1="13" y1="9" x2="17" y2="9"/><line x1="13" y1="13" x2="17" y2="13"/></svg>,
  plus: <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  trash:<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>,
  edit: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  menu: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
  close:<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
};

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ data }) {
  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();

  const mSales = filterByMonth(data.sales,    "date", m, y);
  const mExp   = filterByMonth(data.expenses, "date", m, y);
  const mTot   = calcTotals(mSales, mExp);

  const ySales = filterByYear(data.sales,    "date", y);
  const yExp   = filterByYear(data.expenses, "date", y);
  const yTot   = calcTotals(ySales, yExp);

  const allTot = calcTotals(data.sales, data.expenses);

  const recentSales = [...data.sales].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,5);
  const recentExp   = [...data.expenses].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,4);
  const lowStock    = data.products.filter(p => Number(p.qty) <= 3);

  return (
    <div>
      <div className="page-title">Dashboard — {MONTHS[m]} {y}</div>

      <div className="section-label">This Month</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <div className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value gold">{fmt(mTot.revenue)}</div><div className="stat-sub">{mSales.length} sale{mSales.length!==1?"s":""}</div></div>
        <div className="stat-card"><div className="stat-label">COGS</div><div className="stat-value blue">{fmt(mTot.cogs)}</div><div className="stat-sub">Cost of goods sold</div></div>
        <div className="stat-card"><div className="stat-label">Op. Expenses</div><div className="stat-value red">{fmt(mTot.opex)}</div><div className="stat-sub">{mExp.length} entr{mExp.length!==1?"ies":"y"}</div></div>
        <div className="stat-card"><div className="stat-label">Net Profit</div><div className={`stat-value ${mTot.profit>=0?"green":"red"}`}>{fmt(mTot.profit)}</div><div className="stat-sub">{mTot.revenue>0?((mTot.profit/mTot.revenue)*100).toFixed(1)+"% margin":"—"}</div></div>
      </div>

      <div className="section-label">This Year ({y})</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <div className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value gold">{fmt(yTot.revenue)}</div></div>
        <div className="stat-card"><div className="stat-label">COGS</div><div className="stat-value blue">{fmt(yTot.cogs)}</div></div>
        <div className="stat-card"><div className="stat-label">Op. Expenses</div><div className="stat-value red">{fmt(yTot.opex)}</div></div>
        <div className="stat-card"><div className="stat-label">Net Profit</div><div className={`stat-value ${yTot.profit>=0?"green":"red"}`}>{fmt(yTot.profit)}</div></div>
      </div>

      <div className="card" style={{borderLeft:`4px solid ${t.green}`,background:t.greenLight,marginBottom:16}}>
        <div className="card-title" style={{color:t.green}}>All-Time Net Profit</div>
        <div style={{fontSize:32,fontFamily:"'Playfair Display',serif",fontWeight:700,color:allTot.profit>=0?t.green:t.red}}>{fmt(allTot.profit)}</div>
        <div style={{fontSize:13,color:t.muted,marginTop:4}}>Revenue {fmt(allTot.revenue)} · COGS {fmt(allTot.cogs)} · Op. Expenses {fmt(allTot.opex)}</div>
      </div>

      {lowStock.length > 0 && (
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
                  <div style={{fontWeight:600,color:t.accent}}>{fmt(Number(s.price)*Number(s.qty||1))}</div>
                  {s.cost?<div style={{fontSize:11,color:t.blue}}>COGS {fmt(Number(s.cost)*Number(s.qty||1))}</div>:null}
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
                <div style={{fontWeight:600,color:t.red}}>{fmt(e.amount)}</div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── Products ─────────────────────────────────────────────────────────────────
const blankProduct = () => ({ name:"", type:"Clothing", category:CLOTHING_CATEGORIES[0], cost:"", price:"", qty:"1", notes:"" });

function Products({ data, setData }) {
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(blankProduct());
  const [editId, setEditId]     = useState(null);
  const [search, setSearch]     = useState("");
  const [filterType, setFilter] = useState("All");

  const setType = (type) => setForm(f => ({ ...f, type, category: categoriesFor(type)[0] }));

  const handleSave = () => {
    if (!form.name.trim()) return;
    const item = { ...form, id: editId || uid() };
    const prods = editId
      ? data.products.map(p => p.id===editId ? item : p)
      : [...data.products, item];
    setData({ ...data, products: prods });
    setForm(blankProduct()); setShowAdd(false); setEditId(null);
  };

  const openEdit = (p) => { setForm(p); setEditId(p.id); setShowAdd(true); };
  const remove   = (id) => setData({ ...data, products: data.products.filter(p => p.id!==id) });
  const cats     = categoriesFor(form.type);

  let filtered = data.products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category||"").toLowerCase().includes(search.toLowerCase())
  );
  if (filterType !== "All") filtered = filtered.filter(p => p.type===filterType);

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{marginBottom:0}}>Products & Inventory</div>
        <button className="btn btn-primary" onClick={()=>{ setForm(blankProduct()); setEditId(null); setShowAdd(true); }}>
          {Ic.plus} Add Product
        </button>
      </div>

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
        <input className="input" placeholder="Search products…" value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      {filtered.length===0 ? (
        <div className="card empty"><div className="empty-icon">👗</div>{data.products.length===0?"No products yet — add your first item!":"No products match your search."}</div>
      ) : (
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Product</th><th>Type</th><th>Category</th><th>Cost</th><th>Sell Price</th><th>Margin</th><th>Stock</th><th></th></tr></thead>
              <tbody>
                {filtered.map(p=>{
                  const margin = p.cost&&p.price ? (((Number(p.price)-Number(p.cost))/Number(p.price))*100).toFixed(0) : null;
                  return (
                    <tr key={p.id}>
                      <td style={{fontWeight:500}}>{p.name}</td>
                      <td><span className={`badge ${p.type==="Jewelry"?"badge-gold":p.type==="Accessories"?"badge-blue":"badge-green"}`}>{p.type||"—"}</span></td>
                      <td style={{fontSize:12,color:t.muted}}>{p.category}</td>
                      <td>{p.cost?fmt(p.cost):<span style={{color:t.muted}}>—</span>}</td>
                      <td style={{fontWeight:600}}>{p.price?fmt(p.price):<span style={{color:t.muted}}>—</span>}</td>
                      <td style={{fontWeight:600,color:margin>=30?t.green:margin>=10?t.accent:t.red}}>{margin!=null?`${margin}%`:"—"}</td>
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
      )}

      {showAdd && (
        <Modal title={editId?"Edit Product":"Add Product"} onClose={()=>{ setShowAdd(false); setEditId(null); }}>
          <div className="form-group">
            <label>Product Name *</label>
            <input className="input" placeholder="e.g. Pink Embroidered Suit" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
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
          <div className="form-row">
            <div className="form-group">
              <label>Cost Price (CAD)</label>
              <input className="input" type="number" placeholder="0.00" value={form.cost} onChange={e=>setForm({...form,cost:e.target.value})} />
            </div>
            <div className="form-group">
              <label>Selling Price (CAD)</label>
              <input className="input" type="number" placeholder="0.00" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} />
            </div>
          </div>
          {form.cost&&form.price && (
            <div className="info-box info-green">
              Profit per item: {fmt(Number(form.price)-Number(form.cost))} · Margin: {(((Number(form.price)-Number(form.cost))/Number(form.price))*100).toFixed(0)}%
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Quantity in Stock</label>
              <input className="input" type="number" min="0" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})} />
            </div>
            <div className="form-group">
              <label>Notes (optional)</label>
              <input className="input" placeholder="Any details…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={()=>{ setShowAdd(false); setEditId(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>{editId?"Save Changes":"Add Product"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sales ────────────────────────────────────────────────────────────────────
const blankSale = () => ({ date:today(), productId:"", productName:"", customItem:"", qty:"1", price:"", cost:"", notes:"" });

function Sales({ data, setData }) {
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(blankSale());
  const [search, setSearch]     = useState("");
  const [useCustom, setCustom]  = useState(false);

  const selectProduct = (id) => {
    if (!id) { setForm(f=>({...f,productId:"",productName:"",price:"",cost:""})); return; }
    const p = data.products.find(x=>x.id===id);
    if (!p) return;
    setForm(f=>({...f, productId:p.id, productName:p.name, price:p.price||"", cost:p.cost||""}));
  };

  const handleSave = () => {
    const label = useCustom ? form.customItem : form.productName;
    if (!label || !form.price) return;
    let prods = data.products;
    if (!useCustom && form.productId) {
      prods = data.products.map(p =>
        p.id===form.productId ? {...p, qty:Math.max(0,Number(p.qty)-Number(form.qty||1))} : p
      );
    }
    const sale = { ...form, id:uid(), productName:useCustom?"":form.productName, customItem:useCustom?form.customItem:"" };
    setData({...data, sales:[...data.sales, sale], products:prods});
    setForm(blankSale()); setCustom(false); setShowAdd(false);
  };

  const remove = (id) => setData({...data, sales:data.sales.filter(s=>s.id!==id)});

  const sorted   = [...data.sales].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const filtered = sorted.filter(s=>(s.productName||s.customItem).toLowerCase().includes(search.toLowerCase()));

  const allTotals = calcTotals(data.sales, []);
  const qty = Number(form.qty||1);
  const saleRev    = Number(form.price||0)*qty;
  const saleCOGS   = Number(form.cost||0)*qty;
  const saleProfit = form.price ? saleRev - saleCOGS : null;

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{marginBottom:0}}>Sales</div>
        <button className="btn btn-primary" onClick={()=>{ setForm(blankSale()); setCustom(false); setShowAdd(true); }}>
          {Ic.plus} New Sale
        </button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:16}}>
        <div className="stat-card"><div className="stat-label">Total Revenue</div><div className="stat-value gold">{fmt(allTotals.revenue)}</div><div className="stat-sub">{data.sales.length} total sales</div></div>
        <div className="stat-card"><div className="stat-label">Total COGS</div><div className="stat-value blue">{fmt(allTotals.cogs)}</div><div className="stat-sub">Auto from product costs</div></div>
        <div className="stat-card"><div className="stat-label">Gross Profit</div><div className={`stat-value ${allTotals.revenue-allTotals.cogs>=0?"green":"red"}`}>{fmt(allTotals.revenue-allTotals.cogs)}</div><div className="stat-sub">Before operating expenses</div></div>
      </div>

      <div className="search-wrap">
        <input className="input" placeholder="Search sales…" value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      {filtered.length===0 ? (
        <div className="card empty"><div className="empty-icon">🛍️</div>{data.sales.length===0?"No sales recorded yet — add your first sale!":"No sales match your search."}</div>
      ) : (
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Revenue</th><th>COGS</th><th>Gross Profit</th><th></th></tr></thead>
              <tbody>
                {filtered.map(s=>{
                  const q   = Number(s.qty||1);
                  const rev = Number(s.price||0)*q;
                  const cgs = Number(s.cost||0)*q;
                  const gp  = s.cost ? rev-cgs : null;
                  return (
                    <tr key={s.id}>
                      <td style={{whiteSpace:"nowrap"}}>{new Date(s.date).toLocaleDateString()}</td>
                      <td style={{fontWeight:500}}>
                        {s.productName||s.customItem}
                        {!s.productName&&<span style={{fontSize:11,color:t.muted,display:"block"}}>custom item</span>}
                      </td>
                      <td>{q}</td>
                      <td style={{fontWeight:600,color:t.accent}}>{fmt(rev)}</td>
                      <td style={{color:t.blue}}>{s.cost?fmt(cgs):<span style={{color:t.muted}}>—</span>}</td>
                      <td style={{fontWeight:600,color:gp!=null?(gp>=0?t.green:t.red):t.muted}}>{gp!=null?fmt(gp):"—"}</td>
                      <td><button className="btn btn-danger btn-sm" onClick={()=>remove(s.id)}>{Ic.trash}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title="New Sale" onClose={()=>setShowAdd(false)}>
          <div className="form-group">
            <label>Date</label>
            <input className="input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
          </div>

          {!useCustom ? (
            <div className="form-group">
              <label>Select Product <span style={{color:t.muted,fontWeight:400}}>(auto-fills cost & price)</span></label>
              <select className="input" value={form.productId} onChange={e=>selectProduct(e.target.value)}>
                <option value="">— Choose a product —</option>
                {data.products.map(p=><option key={p.id} value={p.id}>{p.name} (Stock: {p.qty})</option>)}
              </select>
              <button style={{background:"none",border:"none",color:t.primary,cursor:"pointer",fontWeight:600,fontSize:13,padding:"6px 0 0",display:"block"}}
                onClick={()=>{ setCustom(true); setForm(f=>({...f,productId:"",productName:"",price:"",cost:""})); }}>
                + Type item name manually instead
              </button>
            </div>
          ) : (
            <div className="form-group">
              <label>Item Name</label>
              <input className="input" placeholder="What was sold?" value={form.customItem} onChange={e=>setForm({...form,customItem:e.target.value})} />
              <button style={{background:"none",border:"none",color:t.primary,cursor:"pointer",fontWeight:600,fontSize:13,padding:"6px 0 0",display:"block"}}
                onClick={()=>{ setCustom(false); setForm(f=>({...f,customItem:""})); }}>
                ← Pick from products instead
              </button>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Quantity Sold</label>
              <input className="input" type="number" min="1" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})} />
            </div>
            <div className="form-group">
              <label>Sale Price per item (CAD) *</label>
              <input className="input" type="number" placeholder="0.00" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} />
            </div>
          </div>

          <div className="form-group">
            <label>Cost Price per item (CAD) <span style={{color:t.muted,fontWeight:400}}>— auto-filled from product</span></label>
            <input className="input" type="number" placeholder="0.00 (this becomes COGS)" value={form.cost} onChange={e=>setForm({...form,cost:e.target.value})} />
          </div>

          {form.price && (
            <div style={{marginBottom:14}}>
              <div className="info-box info-gold">Revenue from this sale: {fmt(saleRev)}</div>
              {form.cost && <>
                <div className="info-box info-blue">COGS (auto-added to expenses): {fmt(saleCOGS)}</div>
                <div className={`info-box ${saleProfit>=0?"info-green":"info-red"}`}>Gross Profit: {fmt(saleProfit)}</div>
              </>}
            </div>
          )}

          <div className="form-group">
            <label>Notes (optional)</label>
            <input className="input" placeholder="Any details…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
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
const blankExp = () => ({ date:today(), title:"", category:EXPENSE_CATEGORIES[0], amount:"", notes:"" });

function Expenses({ data, setData }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState(blankExp());
  const now = new Date();

  const handleSave = () => {
    if (!form.title.trim()||!form.amount) return;
    setData({...data, expenses:[...data.expenses,{...form,id:uid()}]});
    setForm(blankExp()); setShowAdd(false);
  };

  const remove = (id) => setData({...data, expenses:data.expenses.filter(e=>e.id!==id)});

  const sorted = [...data.expenses].sort((a,b)=>new Date(b.date)-new Date(a.date));

  // All-time figures
  const opex  = data.expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const cogs  = data.sales.reduce((s,x)=>s+Number(x.cost||0)*Number(x.qty||1),0);
  const total = opex + cogs;

  // This month
  const mOpex = filterByMonth(data.expenses,"date",now.getMonth(),now.getFullYear()).reduce((s,e)=>s+Number(e.amount||0),0);
  const mCOGS = filterByMonth(data.sales,"date",now.getMonth(),now.getFullYear()).reduce((s,x)=>s+Number(x.cost||0)*Number(x.qty||1),0);

  // Category breakdown (opex only)
  const byCat = {};
  data.expenses.forEach(e=>{ byCat[e.category]=(byCat[e.category]||0)+Number(e.amount||0); });

  // COGS breakdown by product
  const bySaleProd = {};
  data.sales.forEach(s=>{
    if (!s.cost) return;
    const k = s.productName||s.customItem;
    bySaleProd[k]=(bySaleProd[k]||0)+Number(s.cost)*Number(s.qty||1);
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{marginBottom:0}}>Expenses</div>
        <button className="btn btn-primary" onClick={()=>{ setForm(blankExp()); setShowAdd(true); }}>
          {Ic.plus} Add Expense
        </button>
      </div>

      <div className="section-label">This Month</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
        <div className="stat-card"><div className="stat-label">COGS (from Sales)</div><div className="stat-value blue">{fmt(mCOGS)}</div><div className="stat-sub">Auto from recorded sales</div></div>
        <div className="stat-card"><div className="stat-label">Operating Expenses</div><div className="stat-value red">{fmt(mOpex)}</div><div className="stat-sub">Manually entered</div></div>
        <div className="stat-card"><div className="stat-label">Total Expenses</div><div className="stat-value red">{fmt(mCOGS+mOpex)}</div><div className="stat-sub">COGS + Operating</div></div>
      </div>

      <div className="section-label">All Time</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}} className="two-col">

        {/* COGS panel */}
        <div className="card" style={{marginBottom:0,borderTop:`3px solid ${t.blue}`}}>
          <div className="card-title" style={{color:t.blue}}>Cost of Goods Sold (COGS)</div>
          <div style={{fontSize:12,color:t.muted,marginBottom:10,lineHeight:1.5}}>
            Automatically calculated when you record a sale with a cost price. No manual entry needed.
          </div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:t.blue}}>{fmt(cogs)}</div>
          {Object.keys(bySaleProd).length>0 && (
            <>
              <hr className="divider"/>
              {Object.entries(bySaleProd).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,amt])=>(
                <div key={name} className="report-row" style={{padding:"7px 0"}}>
                  <span style={{color:t.text,fontWeight:500,fontSize:13}}>{name}</span>
                  <span style={{fontWeight:600,color:t.blue}}>{fmt(amt)}</span>
                </div>
              ))}
            </>
          )}
          {cogs===0&&<div style={{fontSize:13,color:t.muted,marginTop:8}}>No product costs in sales yet.</div>}
        </div>

        {/* Operating expenses panel */}
        <div className="card" style={{marginBottom:0,borderTop:`3px solid ${t.red}`}}>
          <div className="card-title" style={{color:t.red}}>Operating Expenses</div>
          <div style={{fontSize:12,color:t.muted,marginBottom:10,lineHeight:1.5}}>
            Business costs you add manually — shipping, packaging, rent, supplies, and more.
          </div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:t.red}}>{fmt(opex)}</div>
          {Object.keys(byCat).length>0 && (
            <>
              <hr className="divider"/>
              {Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
                <div key={cat} className="report-row" style={{padding:"7px 0"}}>
                  <span className="lbl">{cat}</span>
                  <span style={{fontWeight:600,color:t.red}}>{fmt(amt)}</span>
                </div>
              ))}
            </>
          )}
          {opex===0&&<div style={{fontSize:13,color:t.muted,marginTop:8}}>No operating expenses yet.</div>}
        </div>
      </div>

      {/* Combined total */}
      <div className="card" style={{background:t.redLight,border:`1px solid ${t.red}`,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>Total Expenses — All Time</div>
            <div style={{fontSize:13,color:t.muted,marginTop:2}}>COGS {fmt(cogs)} + Operating {fmt(opex)}</div>
          </div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,color:t.red}}>{fmt(total)}</div>
        </div>
      </div>

      <div className="section-label">Operating Expense Log</div>
      {sorted.length===0 ? (
        <div className="card empty"><div className="empty-icon">💸</div>No operating expenses recorded yet.</div>
      ) : (
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {sorted.map(e=>(
                  <tr key={e.id}>
                    <td style={{whiteSpace:"nowrap"}}>{new Date(e.date).toLocaleDateString()}</td>
                    <td style={{fontWeight:500}}>{e.title}</td>
                    <td><span className="badge badge-red">{e.category}</span></td>
                    <td style={{fontWeight:600,color:t.red}}>{fmt(e.amount)}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={()=>remove(e.id)}>{Ic.trash}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title="Add Operating Expense" onClose={()=>setShowAdd(false)}>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input className="input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
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
            <input className="input" placeholder="What was this expense for?" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} />
          </div>
          <div className="form-group">
            <label>Amount (CAD) *</label>
            <input className="input" type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} />
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <input className="input" placeholder="Any extra details…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
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

  // Top products by revenue
  const byProd = {};
  sales.forEach(s=>{ const k=s.productName||s.customItem; byProd[k]=(byProd[k]||0)+Number(s.price||0)*Number(s.qty||1); });
  const topProds = Object.entries(byProd).sort((a,b)=>b[1]-a[1]).slice(0,6);

  // OpEx by category
  const byCat = {};
  expenses.forEach(e=>{ byCat[e.category]=(byCat[e.category]||0)+Number(e.amount||0); });

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

      {/* Full P&L */}
      <div className="card">
        <div className="card-title">Profit & Loss — {label}</div>

        <div className="report-row">
          <span className="lbl">Revenue <span style={{fontSize:11}}>(sales)</span></span>
          <span className="val" style={{color:t.accent}}>{fmt(tot.revenue)}</span>
        </div>

        <div className="report-row">
          <span style={{color:t.blue}}>Less: Cost of Goods Sold (COGS)</span>
          <span style={{fontWeight:600,color:t.blue}}>({fmt(tot.cogs)})</span>
        </div>

        <div className="report-row" style={{borderBottom:`2px solid ${t.border}`,paddingBottom:12}}>
          <span style={{fontWeight:600}}>Gross Profit</span>
          <span style={{fontWeight:700,color:grossP>=0?t.green:t.red}}>{fmt(grossP)}</span>
        </div>

        <div className="report-row" style={{paddingTop:12}}>
          <span style={{color:t.red}}>Less: Operating Expenses</span>
          <span style={{fontWeight:600,color:t.red}}>({fmt(tot.opex)})</span>
        </div>

        <div className="report-total">
          <span style={{fontWeight:700,fontSize:16}}>Net Profit</span>
          <span style={{fontWeight:700,fontSize:22,color:tot.profit>=0?t.green:t.red}}>
            {fmt(tot.profit)}
            {tot.revenue>0&&<span style={{fontSize:14,marginLeft:8,fontWeight:500}}>({((tot.profit/tot.revenue)*100).toFixed(1)}% margin)</span>}
          </span>
        </div>
      </div>

      {/* Breakdown */}
      {(topProds.length>0||Object.keys(byCat).length>0) && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}} className="two-col">
          {topProds.length>0&&(
            <div className="card" style={{marginBottom:0}}>
              <div className="card-title">Top Items by Revenue</div>
              {topProds.map(([name,rev])=>(
                <div key={name} className="report-row">
                  <span style={{fontWeight:500}}>{name}</span>
                  <span style={{fontWeight:600,color:t.accent}}>{fmt(rev)}</span>
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
                  <span style={{fontWeight:600,color:t.red}}>{fmt(amt)}</span>
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

// ─── App Root ─────────────────────────────────────────────────────────────────
const DEFAULT = { products:[], sales:[], expenses:[], seeded:false };

const NAV = [
  { id:"dashboard", label:"Dashboard", icon:Ic.dashboard },
  { id:"products",  label:"Products",  icon:Ic.products  },
  { id:"sales",     label:"Sales",     icon:Ic.sales     },
  { id:"expenses",  label:"Expenses",  icon:Ic.expenses  },
  { id:"reports",   label:"Reports",   icon:Ic.reports   },
];

export default function ApnaCulture() {
  const [data, setData] = useState(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage]     = useState("dashboard");
  const [open, setOpen]     = useState(false);

  useEffect(() => {
    (async () => {
      const state = { ...DEFAULT };
      for (const key of ["products","sales","expenses","seeded"]) {
        try { const r = await window.storage.get(`ac3_${key}`); if (r?.value) state[key]=JSON.parse(r.value); } catch {}
      }
      if (!state.seeded) { state.products=SEED_PRODUCTS; state.seeded=true; }
      setData(state); setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        for (const key of ["products","sales","expenses","seeded"]) {
          await window.storage.set(`ac3_${key}`, JSON.stringify(data[key]));
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
        <div className={`overlay ${open?"show":""}`} onClick={()=>setOpen(false)} />

        <div className={`sidebar ${open?"open":""}`}>
          <div className="brand">
            <div className="brand-name">Apna Culture</div>
            <div className="brand-sub">Accounting & Profit Tracker</div>
          </div>
          {NAV.map(n=>(
            <button key={n.id} className={`nav-btn ${page===n.id?"active":""}`} onClick={()=>navigate(n.id)}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>

        <div className="main">
          {page==="dashboard"&&<Dashboard data={data}/>}
          {page==="products" &&<Products  data={data} setData={setData}/>}
          {page==="sales"    &&<Sales     data={data} setData={setData}/>}
          {page==="expenses" &&<Expenses  data={data} setData={setData}/>}
          {page==="reports"  &&<Reports   data={data}/>}
        </div>
      </div>
    </>
  );
}