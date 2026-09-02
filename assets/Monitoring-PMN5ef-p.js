import{c as $t,r as N,l as yt,u as zt,h as q,f as $,j as t,B as Qe,T as Ut,e as At}from"./logo-BJJW74Um.js";import{S as Bt,k as Vt,m as Yt,l as Gt}from"./firestoreService-30on5VS-.js";import{t as Ht,v as kt,w as _t,x as qt,A as Jt,F as Ee,f as Kt,H as Le,T as jt,P as Dt,y as Pe,z as St,h as Qt}from"./main-D_-8b9bI.js";import{g as Wt,T as Xt}from"./Toast-DZyl_Y10.js";import{R as Zt,P as ea}from"./TenantDashboard-CXL_yX0H.js";import"./authService-BiH-DU5j.js";import"./contractUnits--AD3R8n2.js";/**
 * @license lucide-react v0.555.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ta=[["path",{d:"m21 16-4 4-4-4",key:"f6ql7i"}],["path",{d:"M17 20V4",key:"1ejh1v"}],["path",{d:"m3 8 4-4 4 4",key:"11wl7u"}],["path",{d:"M7 4v16",key:"1glfcx"}]],aa=$t("arrow-up-down",ta);/**
 * @license lucide-react v0.555.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const na=[["path",{d:"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",key:"3c2336"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]],Rt=$t("badge-check",na),Z=(u,w)=>String(u||"").localeCompare(String(w||""),void 0,{numeric:!0,sensitivity:"base"});function X(u){if(u==null||u==="")return"";if(typeof u=="string"){const w=u.trim(),C=w.match(/^(\d{4}-\d{2}-\d{2})/);if(C)return C[1];const j=new Date(w);return isNaN(j.getTime())?"":q(j)}if(u instanceof Date&&!isNaN(u.getTime()))return q(u);if(typeof u=="object"&&u!==null){const w=u;if(typeof w.toDate=="function")try{const j=w.toDate();if(j instanceof Date&&!isNaN(j.getTime()))return q(j)}catch{}const C=typeof w.seconds=="number"?w.seconds:typeof w._seconds=="number"?w._seconds:NaN;if(!Number.isNaN(C)){const j=new Date(C*1e3);return isNaN(j.getTime())?"":q(j)}}return""}function Ie(u,w){if(!u||!w)return 0;const C=new Date(u+"T12:00:00"),j=new Date(w+"T12:00:00");return isNaN(C.getTime())||isNaN(j.getTime())?0:Math.floor((j.getTime()-C.getTime())/864e5)}const ga=()=>{var nt;const[u,w]=N.useState([]),[C,j]=N.useState([]),[ee,ie]=N.useState([]),[T,ue]=N.useState([]),te=yt(),{t:m,isRTL:I}=zt(),[l,J]=N.useState(()=>te),[n,E]=N.useState([]),[A,K]=N.useState(!1),[z,_]=N.useState(""),[p,re]=N.useState("DAYS"),[U,le]=N.useState("DESC"),[Q,ae]=N.useState("ALL"),W=N.useRef(null);N.useEffect(()=>{(async()=>{const[e,a,r,o]=await Promise.all([Bt({includeDeleted:!0}),Vt(),Yt(),Gt()]);w(e||[]),j(a||[]),ie(r||[]),ue(o||[])})()},[]),N.useEffect(()=>{const e=a=>{A&&W.current&&!W.current.contains(a.target)&&K(!1)};return window.addEventListener("mousedown",e),()=>window.removeEventListener("mousedown",e)},[A]);const ne=u.filter(e=>e.status!=="Active"?!1:n.length===0?!0:n.includes(e.buildingId)),De=e=>Qt({fromDate:e.fromDate,toDate:e.toDate,periodMonths:Number(e.periodMonths)||0,periodDays:Number(e.periodDays)||0,installmentCount:Number(e.installmentCount)||1}),de=ne.flatMap(e=>{var a,r;try{const o=yt(),f=ee.find(s=>s.id===e.customerId)||{},d=T.find(s=>s.id===e.buildingId)||{},D=d.name?String(d.name).trim():e.buildingName?String(e.buildingName).trim():"-",M=new Date,B=o,h=Number(e.installmentCount)>0?Number(e.installmentCount):1,S=Number(e.upfrontPaid||0),P=(u||[]).filter(s=>!s.deleted),V=u||[],F=Ht(T||[],e);let x;const Y=String(e.renewedFromId||"").trim();Y&&(x=V.find(s=>s.id===Y));const pe=String(e.priorLeaseContractNoAtRenewal||"").trim();!x&&pe&&(x=V.find(s=>String(s.contractNo||"").trim()===pe&&s.buildingId===e.buildingId));const he=C.filter(s=>{if(!s||s.feesEntry||!kt(s,e,P))return!1;if(!s.date)return!0;const i=X(s.date);return i?i<=B:!1}),we=he.reduce((s,i)=>s+(Number(i.amountIncludingVAT||i.totalWithVat||i.amount)||0)+(Number(i.discountAmount)||0)+(Number(i.extraAmount)||0)+(Number(i.bonusAmount)||0)-(Number(i.deductionAmount)||0),0),ve=he.reduce((s,i)=>s+(Number(i.amount)||0)+(Number(i.discountAmount)||0)+(Number(i.extraAmount)||0)+(Number(i.bonusAmount)||0)-(Number(i.deductionAmount)||0),0),Oe=we+S,ia=ve+S;let G=Math.max(0,Number(e.priorLeaseOutstandingAtRenewal)||0);if(G===0&&(Number(e.priorLeaseEffectiveTotalAtRenewal)>0||String(e.renewedFromId||"").trim()||String(e.priorLeaseContractNoAtRenewal||"").trim())){const s=Number(e.priorLeaseEffectiveTotalAtRenewal)||0,i=Number(e.priorLeasePaidAtRenewal)||0;s>i+1e-4&&(G=Math.round((s-i)*100)/100)}if(!x&&G>0){const s=X(e.fromDate),i=String(e.customerId||"").trim(),b=String(e.unitName||"").trim(),y=e.buildingId;x=(a=V.filter(c=>c.id!==e.id&&c.buildingId===y&&String(c.unitName||"").trim()===b&&(!i||String(c.customerId||"").trim()===i)).map(c=>({x:c,toY:X(c.toDate),fromY:X(c.fromDate)})).filter(c=>c.toY||c.fromY).filter(c=>!s||!c.toY||c.toY<=s).sort((c,L)=>String(L.toY||L.fromY||"").localeCompare(String(c.toY||c.fromY||"")))[0])==null?void 0:a.x}const ze=Math.max(0,Oe-G),st=Number(e.rentValue||0),Ue=(d==null?void 0:d.propertyType)==="NON_RESIDENTIAL"||(d==null?void 0:d.vatApplicable)===!0,ot=h>0?st/h:0,it=Math.round(ot),rt=Math.round(ot),ra=st,lt=Number(e.totalValue||0),Be=lt+S;let Ve=Number(e.firstInstallment||0)+S;const Ye=Number(e.otherInstallment||0),Tt=Ve+Ye*Math.max(0,h-1);Be>0&&Math.abs(Tt-Be)>Math.max(5,h)&&(Ve=Math.max(0,Be-Ye*Math.max(0,h-1)));const Et=Math.round(Ve),Lt=Math.round(Ye),Ge=!F&&(lt>0||Number(e.firstInstallment)>0||Number(e.otherInstallment)>0),dt=(s,i)=>{const b=Number(s.installmentCount)>0?Number(s.installmentCount):1,y=Number(s.waterFee||0),R=Number(s.internetFee||0),k=Number(s.parkingFee||0),c=y+R+k,L=b>0?c/b:0,oe=Number(s.managementFee||0),qe=Number(s.officeFeeAmount||0),Ne=Number(s.serviceFee||0),Ce=Number(s.insuranceFee||0),ye=Number(s.otherAmount||0),ke=Number(s.otherDeduction||0),Je=oe+qe+Ne+Ce+ye-ke,Te=L+(i===1?Je:0);return Math.max(0,Math.round(Te))},It=F?C.filter(s=>{if(!s||!s.feesEntry||!kt(s,e,P))return!1;if(!s.date)return!0;const i=X(s.date);return i?i<=B:!1}).reduce((s,i)=>s+(Number(i.amount)||0),0):0,Ae=De(e),ge=[],ct=l&&l.trim()?l:null;for(let s=0;s<h;s++){const i=Ae[s];if(!i||isNaN(i.getTime()))continue;const b=q(i),y=s+1;let R,k;F?(R=s===0?it:rt,k=_t(e,y)):Ge?(R=s===0?Et:Lt,k=0):(R=s===0?it:rt,k=dt(e,y)),ge.push({index:y,date:b,dateObj:i,amount:R,feesAmount:k})}const me=s=>{if(!Ue)return{incl:s,excl:s,vat:0};const i=s/1.15;return{incl:s,excl:i,vat:s-i}},pt=h>1?Math.max(1,Math.round((Number(e.periodMonths)||12)/h)):Math.max(1,Number(e.periodMonths)||12),mt=f.mobileNo||f.mobile||e.customerMobile||"";let ut=0,xt=0,Me=0;const gt=[];for(let s=0;s<ge.length;s++){const i=ge[s],b=i.amount,y=i.feesAmount;let R=0,k=0,c=b,L=y;if(F)R=Math.max(0,Math.min(b,ze-ut)),c=Math.max(0,b-R),ut+=b,k=Math.max(0,Math.min(y,It-xt)),L=Math.max(0,y-k),xt+=y;else if(Ge){const O=b,H=Math.max(0,Math.min(O,ze-Me)),je=Math.max(0,O-H);Me+=O,c=je,L=0,R=Math.max(0,O-je),k=0}else{const O=b+y,H=Math.max(0,Math.min(O,ze-Me)),je=Math.max(0,O-H);if(Me+=O,O>0){const Ot=b/O;c=Math.round(je*Ot),L=Math.max(0,Math.round(je-c)),R=Math.max(0,Math.round(b-c)),k=Math.max(0,Math.round(y-L))}else c=0,L=0,R=0,k=0}if(c===0&&L===0)continue;const oe=i.dateObj<M;if(ct&&i.date>ct&&!oe)continue;const qe=oe?Math.max(0,Ie(i.date,o)):0,Ne=oe?c:0,Ce=oe?L:0,ye=c,ke=L,Je=ye+ke,Te=me(b),wt=me(R),vt=me(Ne),Nt=me(ye),Ft=F?y:Ge?dt(e,i.index):y;let Ke="";if(s+1<ge.length)Ke=ge[s+1].date;else{const O=Ae.findIndex(H=>H&&!isNaN(H.getTime())&&q(H)===i.date);if(O>=0&&O+1<Ae.length){const H=Ae[O+1];H&&!isNaN(H.getTime())&&(Ke=q(H))}}gt.push({contract:e,installmentNo:i.index,totalInstallments:h,expected:b,expectedExcl:Te.excl,expectedVat:Te.vat,paid:R,paidExcl:wt.excl,paidVat:wt.vat,overdueAmount:Ne,overdueExcl:vt.excl,overdueVat:vt.vat,dueRent:ye,dueRentExcl:Nt.excl,dueRentVat:Nt.vat,expectedFees:Ft,paidFees:k,feesOverdue:Ce,dueFees:ke,hasFees:y>0&&Math.round(ke||0)>0,totalOverdue:Ne+Ce,totalDue:Je,isVAT:Ue,customer:f,building:d,buildingName:D,daysOverdue:qe,mobile:mt,nextDueDate:i.date,upcomingDueDate:Ke,frequencyMonths:pt,rowKey:`${e.id}-${i.index}`})}const fe=Math.max(0,G-Oe),se=x?X(x.toDate):"",ft=x?X(x.fromDate):"",bt=X(e.fromDate),Pt=V.map(s=>x&&s.id===x.id?{...s,deleted:!1}:s),v=x&&bt?qt({priorContract:x,renewalYmd:bt,buildings:T||[],catalog:Pt,transactions:C}):null;let be=v?q(v.startDate):ft||se||"",He=!1;!be&&G>0&&(be=X(e.fromDate),He=!!be),!be&&G>0&&(be=o);let _e="";v?_e=`Inst. ${v.installmentNo}/${v.totalInstallments} · ${$(v.startDate)} ${m("entry.dateRangeMid")} ${$(v.endDate)}`:x!=null&&x.toDate&&(_e=$(x.toDate));const ht=[...gt];if(G>0&&fe>0){const s=v?q(v.endDate):se,i=(v==null?void 0:v.dueDateYmd)||(!He&&!v&&x?se||ft:""),b=!!i&&i<o||!!s&&s<o||!!se&&se<o&&!v,y=b?i&&i<o?Ie(i,o):s&&s<o?Ie(s,o):se&&se<o?Ie(se,o):0:0,R=Math.min(Oe,G),k=me(fe),c=me(R),L=me(G),oe=((r=ge[0])==null?void 0:r.date)||"";ht.unshift({contract:e,isPriorLeaseRow:!0,installmentNo:(v==null?void 0:v.installmentNo)??0,totalInstallments:(v==null?void 0:v.totalInstallments)??h,expected:G,expectedExcl:L.excl,expectedVat:L.vat,paid:R,paidExcl:c.excl,paidVat:c.vat,overdueAmount:b?fe:0,overdueExcl:b?k.excl:0,overdueVat:b?k.vat:0,dueRent:fe,dueRentExcl:k.excl,dueRentVat:k.vat,expectedFees:0,paidFees:0,feesOverdue:0,dueFees:0,hasFees:!1,totalOverdue:b?fe:0,totalDue:fe,isVAT:Ue,customer:f,building:d,buildingName:D,daysOverdue:y,mobile:mt,nextDueDate:be,upcomingDueDate:oe,frequencyMonths:pt,rowKey:`${e.id}-prior-lease`,priorOldPeriodLabel:_e,priorDateIsRenewalFallback:He})}return ht}catch(o){return console.error("Error processing contract in Monitoring:",o,e),[]}}).filter(e=>{if(!e)return!1;const a=e.nextDueDate&&e.nextDueDate!=="-"?e.nextDueDate:null;return a?e.isPriorLeaseRow&&(Number(e.totalDue)||0)>0||(Number(e.overdueAmount)||0)+(Number(e.feesOverdue)||0)>0?!0:a<=l:!1}),ce=ne.map(e=>{try{let a=0,r="";if(e.toDate)try{const d=new Date(e.toDate),D=new Date;isNaN(d.getTime())||(a=Math.ceil((d.getTime()-D.getTime())/(1e3*60*60*24)),r=q(d))}catch{a=0,r=""}const o=ee.find(d=>d.id===e.customerId)||{},f=T.find(d=>d.id===e.buildingId)||{};return{contract:e,daysRemaining:a,customer:o,building:f,toDateStr:r}}catch(a){return console.error("Error processing expiring contract in Monitoring:",a,e),null}}).filter(e=>!e||!e.toDateStr?!1:e.toDateStr<=l).filter(e=>n.length===0||n.includes(e.contract.buildingId)),We=e=>{if(!z.trim())return!0;const a=z.toLowerCase();return e.some(r=>String(r||"").toLowerCase().includes(a))},Se=N.useCallback(e=>[...e].sort((a,r)=>{var f,d,D,M,B,h,S,P,V,F;let o=0;switch(p){case"DATE":o=String(a.nextDueDate||"").localeCompare(String(r.nextDueDate||"")),o===0&&(o=r.overdueAmount-a.overdueAmount);break;case"BUILDING":o=Z(a.buildingName,r.buildingName),o===0&&(o=Z((f=a.contract)==null?void 0:f.unitName,(d=r.contract)==null?void 0:d.unitName));break;case"UNIT":o=Z((D=a.contract)==null?void 0:D.unitName,(M=r.contract)==null?void 0:M.unitName);break;case"CUSTOMER":{const x=((B=a.customer)==null?void 0:B.nameEn)||((h=a.customer)==null?void 0:h.name)||((S=a.contract)==null?void 0:S.customerName)||"",Y=((P=r.customer)==null?void 0:P.nameEn)||((V=r.customer)==null?void 0:V.name)||((F=r.contract)==null?void 0:F.customerName)||"";o=Z(x,Y);break}case"AMOUNT":o=(a.overdueAmount||0)-(r.overdueAmount||0);break;case"DAYS":{const x=(a.daysOverdue||0)>0?1:0,Y=(r.daysOverdue||0)>0?1:0;if(x!==Y)return Y-x;o=(a.daysOverdue||0)-(r.daysOverdue||0),o===0&&(o=(a.overdueAmount||0)-(r.overdueAmount||0));break}}return U==="ASC"?o:-o}),[p,U]),Xe=N.useMemo(()=>Se(de),[de,Se]),xe=N.useMemo(()=>{const e=de.filter(a=>{var o,f,d,D,M;if(!a)return!1;const r=((o=a.customer)==null?void 0:o.nameEn)||((f=a.customer)==null?void 0:f.name)||((d=a.contract)==null?void 0:d.customerName);return!(!We([r,(D=a.contract)==null?void 0:D.unitName,a.buildingName,a.mobile,(M=a.contract)==null?void 0:M.id])||Q==="OVERDUE"&&!((a.overdueAmount||0)+(a.feesOverdue||0)>0)||Q==="UPCOMING"&&(a.overdueAmount||0)+(a.feesOverdue||0)>0)});return Se(e)},[de,z,p,U,Q,Se]),Re=N.useCallback(e=>[...e].sort((a,r)=>{var f,d,D,M,B,h,S,P,V,F,x,Y,pe,he;let o=0;switch(p){case"DATE":o=(a.daysRemaining||0)-(r.daysRemaining||0);break;case"BUILDING":{const we=((f=a.building)==null?void 0:f.name)||((d=a.contract)==null?void 0:d.buildingName)||"",ve=((D=r.building)==null?void 0:D.name)||((M=r.contract)==null?void 0:M.buildingName)||"";o=Z(we,ve),o===0&&(o=Z((B=a.contract)==null?void 0:B.unitName,(h=r.contract)==null?void 0:h.unitName));break}case"UNIT":o=Z((S=a.contract)==null?void 0:S.unitName,(P=r.contract)==null?void 0:P.unitName);break;case"CUSTOMER":{const we=((V=a.customer)==null?void 0:V.nameEn)||((F=a.customer)==null?void 0:F.name)||((x=a.contract)==null?void 0:x.customerName)||"",ve=((Y=r.customer)==null?void 0:Y.nameEn)||((pe=r.customer)==null?void 0:pe.name)||((he=r.contract)==null?void 0:he.customerName)||"";o=Z(we,ve);break}case"AMOUNT":case"DAYS":o=(r.daysRemaining||0)-(a.daysRemaining||0);break}return U==="ASC"?o:-o}),[p,U]),Ze=N.useMemo(()=>Re(ce),[ce,Re]),$e=N.useMemo(()=>{const e=ce.filter(a=>{var f,d,D,M,B,h,S,P;if(!a)return!1;const r=((f=a.customer)==null?void 0:f.nameEn)||((d=a.customer)==null?void 0:d.name)||((D=a.contract)==null?void 0:D.customerName),o=((M=a.building)==null?void 0:M.name)||((B=a.contract)==null?void 0:B.buildingName);return We([r,(h=a.contract)==null?void 0:h.unitName,o,(S=a.customer)==null?void 0:S.mobileNo,(P=a.customer)==null?void 0:P.mobile])});return Re(e)},[ce,z,p,U,Re]),et=xe.filter(e=>(e.overdueAmount||0)>0||(e.feesOverdue||0)>0).length,Mt=xe.length-et,tt=xe.reduce((e,a)=>e+(a.totalDue||a.totalOverdue||a.overdueAmount||0),0),Ct=()=>{J(te),E([]),_(""),re("DAYS"),le("DESC"),ae("ALL")},at=`${p==="DATE"?"Date":p==="BUILDING"?"Building":p==="UNIT"?"Unit":p==="CUSTOMER"?"Customer":p==="AMOUNT"?"Amount":"Days Overdue"} • ${U==="ASC"?"Ascending":"Descending"}`,Fe=n.length===0?"All Buildings":n.length===1?((nt=T.find(e=>e.id===n[0]))==null?void 0:nt.name)||"1 building":`${n.length} buildings`;return t.jsxs("div",{className:"px-3 sm:px-6 pt-4 pb-10 animate-fade-in max-w-7xl mx-auto",dir:I?"rtl":"ltr",children:[t.jsxs("div",{className:"relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-6 sm:p-8 mb-5 shadow-xl shadow-emerald-900/20",children:[t.jsx("div",{className:"absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-3xl"}),t.jsx("div",{className:"absolute -bottom-16 -left-16 w-56 h-56 bg-cyan-300/20 rounded-full blur-3xl"}),t.jsxs("div",{className:"relative flex flex-col sm:flex-row sm:items-end justify-between gap-5",children:[t.jsxs("div",{children:[t.jsxs("div",{className:"inline-flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-[11px] font-black text-white uppercase tracking-widest border border-white/20",children:[t.jsx(Jt,{className:"w-3.5 h-3.5"})," Live"]}),t.jsx("h2",{className:"mt-3 text-2xl sm:text-3xl font-black text-white flex items-center gap-3 drop-shadow-sm",children:m("monitoring.insights")}),t.jsxs("p",{className:"text-emerald-50/90 mt-1 text-sm font-semibold",children:[m("monitoring.fullReportUpTo")," ",t.jsx("span",{className:"font-black",children:$(l)})]})]}),t.jsxs("div",{className:"grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto",children:[t.jsxs("div",{className:"bg-white/15 backdrop-blur rounded-2xl px-3 py-2.5 border border-white/20 text-center",children:[t.jsx("div",{className:"text-[10px] font-black text-white/80 uppercase tracking-widest",children:"Overdue"}),t.jsx("div",{className:"text-xl sm:text-2xl font-black text-white",children:et})]}),t.jsxs("div",{className:"bg-white/15 backdrop-blur rounded-2xl px-3 py-2.5 border border-white/20 text-center",children:[t.jsx("div",{className:"text-[10px] font-black text-white/80 uppercase tracking-widest",children:"Upcoming"}),t.jsx("div",{className:"text-xl sm:text-2xl font-black text-white",children:Mt})]}),t.jsxs("div",{className:"bg-white/15 backdrop-blur rounded-2xl px-3 py-2.5 border border-white/20 text-center",children:[t.jsx("div",{className:"text-[10px] font-black text-white/80 uppercase tracking-widest",children:"Expiring"}),t.jsx("div",{className:"text-xl sm:text-2xl font-black text-white",children:$e.length})]})]})]}),tt>0&&t.jsxs("div",{className:"relative mt-4 bg-white/10 backdrop-blur rounded-2xl border border-white/20 px-4 py-2.5 inline-flex items-center gap-2 text-white",children:[t.jsx(Ee,{className:"w-4 h-4 text-amber-200"}),t.jsx("span",{className:"text-xs font-bold",children:"Total Overdue:"}),t.jsxs("span",{className:"font-black",children:[tt.toLocaleString()," SAR"]})]})]}),t.jsxs("div",{className:"premium-card p-4 sm:p-5 mb-5 relative z-30",style:{isolation:"isolate"},children:[t.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-12 gap-3 items-end",children:[t.jsxs("div",{className:"md:col-span-4",children:[t.jsx("label",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1",children:"Search"}),t.jsxs("div",{className:"relative",children:[t.jsx(Kt,{className:`absolute ${I?"right-3":"left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`}),t.jsx("input",{value:z,onChange:e=>_(e.target.value),placeholder:"Customer, unit, building, mobile...",className:`w-full ${I?"pr-9 pl-3":"pl-9 pr-3"} py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition`}),z&&t.jsx("button",{onClick:()=>_(""),className:`absolute ${I?"left-2":"right-2"} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600`,children:t.jsx(Wt,{className:"w-4 h-4"})})]})]}),t.jsxs("div",{className:"md:col-span-2",children:[t.jsx("label",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1",children:"Report Up To"}),t.jsx("input",{type:"date",value:l,onChange:e=>J(e.target.value),className:"w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-500/30 outline-none"})]}),t.jsxs("div",{className:"md:col-span-3 relative",ref:W,children:[t.jsx("label",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1",children:"Buildings"}),t.jsxs("button",{type:"button",onClick:()=>K(e=>!e),className:"w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white flex items-center justify-between gap-2 hover:border-emerald-400 transition",children:[t.jsxs("span",{className:"flex items-center gap-2 truncate",children:[t.jsx(Qe,{className:"w-4 h-4 text-emerald-600 shrink-0"}),t.jsx("span",{className:"truncate",children:Fe})]}),t.jsx("span",{className:`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${n.length>0?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-500"}`,children:n.length===0?"ALL":n.length})]}),A&&t.jsxs("div",{className:"absolute z-[70] mt-1 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 min-w-full max-h-72 overflow-y-auto",children:[t.jsxs("div",{className:"flex items-center justify-between px-2 py-1.5 border-b border-slate-100 mb-1",children:[t.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest",children:"Select Buildings"}),t.jsx("button",{onClick:()=>E([]),className:"text-[10px] font-black text-emerald-600 hover:underline",children:"CLEAR"})]}),T.length===0&&t.jsx("div",{className:"text-xs text-slate-400 px-2 py-3",children:"No buildings found."}),T.map(e=>{const a=n.includes(e.id);return t.jsxs("label",{className:`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition ${a?"bg-emerald-50":"hover:bg-slate-50"}`,children:[t.jsx("input",{type:"checkbox",checked:a,onChange:()=>E(r=>r.includes(e.id)?r.filter(o=>o!==e.id):[...r,e.id]),className:"w-4 h-4 accent-emerald-600"}),t.jsx("span",{className:"text-xs font-bold text-slate-700 truncate",children:e.name})]},e.id)})]})]}),t.jsxs("div",{className:"md:col-span-2",children:[t.jsx("label",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1",children:"Sort By"}),t.jsxs("div",{className:"relative",children:[t.jsx(aa,{className:`absolute ${I?"right-3":"left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none`}),t.jsxs("select",{value:p,onChange:e=>re(e.target.value),className:`w-full ${I?"pr-9 pl-3":"pl-9 pr-3"} py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-500/30 outline-none appearance-none`,children:[t.jsx("option",{value:"DATE",children:"Date Wise"}),t.jsx("option",{value:"BUILDING",children:"Building Wise"}),t.jsx("option",{value:"UNIT",children:"Unit Wise"}),t.jsx("option",{value:"CUSTOMER",children:"Customer Name"}),t.jsx("option",{value:"AMOUNT",children:"Amount"}),t.jsx("option",{value:"DAYS",children:"Days Overdue"})]})]})]}),t.jsxs("div",{className:"md:col-span-1",children:[t.jsx("label",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1",children:"Order"}),t.jsx("button",{onClick:()=>le(e=>e==="ASC"?"DESC":"ASC"),className:"w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-black bg-white hover:bg-slate-50 transition text-emerald-700",title:"Toggle ascending/descending",children:U==="ASC"?"▲ ASC":"▼ DESC"})]})]}),t.jsxs("div",{className:"mt-4 flex flex-wrap items-center gap-2",children:[t.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1",children:"Status:"}),[{id:"ALL",label:"All",icon:Le,cls:"from-slate-500 to-slate-600"},{id:"OVERDUE",label:"Overdue",icon:Ee,cls:"from-rose-500 to-orange-500"},{id:"UPCOMING",label:"Upcoming",icon:jt,cls:"from-sky-500 to-indigo-500"}].map(e=>{const a=Q===e.id,r=e.icon;return t.jsxs("button",{onClick:()=>ae(e.id),className:`px-3 py-1.5 rounded-full text-xs font-black transition inline-flex items-center gap-1.5 border ${a?`bg-gradient-to-r ${e.cls} text-white border-transparent shadow-md`:"bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`,children:[t.jsx(r,{className:"w-3.5 h-3.5"}),e.label]},e.id)}),t.jsx("div",{className:"flex-1"}),t.jsxs("button",{onClick:Ct,className:"px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-black inline-flex items-center gap-1.5 transition",children:[t.jsx(Zt,{className:"w-3.5 h-3.5"})," Reset Filters"]})]})]}),t.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-2 gap-5",children:[t.jsxs("div",{className:"premium-card overflow-hidden",children:[t.jsxs("div",{className:"relative bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 p-5 text-white overflow-hidden",children:[t.jsx("div",{className:"absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-2xl"}),t.jsxs("div",{className:"relative flex items-center justify-between gap-3",children:[t.jsxs("div",{className:"flex items-center gap-3",children:[t.jsx("div",{className:"bg-white/20 backdrop-blur rounded-2xl p-2.5 border border-white/25",children:t.jsx(Ut,{className:"w-5 h-5"})}),t.jsxs("div",{children:[t.jsx("div",{className:"text-[10px] font-black uppercase tracking-widest text-white/80",children:"Installments"}),t.jsx("div",{className:"text-lg font-black leading-tight",children:m("monitoring.installmentsDue").replace("{date}",$(l))})]})]}),t.jsxs("div",{className:"flex items-center gap-2",children:[t.jsx("span",{className:"bg-white/25 backdrop-blur px-2.5 py-1 rounded-full text-xs font-black border border-white/20",children:xe.length}),Xe.length>0&&t.jsxs("button",{onClick:()=>sa(Xe,l,at,Fe),className:"px-3 py-1.5 bg-white text-rose-700 rounded-xl text-xs font-black inline-flex items-center gap-1.5 hover:bg-rose-50 transition shadow-sm",title:"Export all dues (ignores search / status filters)",children:[t.jsx(Dt,{size:14})," ",m("history.exportPdf")]})]})]})]}),t.jsxs("div",{className:"p-4 space-y-3 max-h-[70vh] overflow-y-auto",children:[xe.length===0&&t.jsxs("div",{className:"text-center py-10",children:[t.jsx(Rt,{className:"w-10 h-10 text-emerald-500 mx-auto mb-2"}),t.jsx("div",{className:"text-slate-500 font-semibold",children:m("monitoring.noInstallments").replace("{date}",$(l))})]}),xe.map(e=>{var o;const a=e.overdueAmount>0||e.feesOverdue>0,r=((e.customer.nameEn||e.customer.name||e.contract.customerName||"?")+"").trim().split(/\s+/).map(f=>f[0]).slice(0,2).join("").toUpperCase();return t.jsx("div",{className:`relative p-3.5 rounded-2xl border-2 transition hover:-translate-y-0.5 hover:shadow-lg ${a?"border-rose-200 bg-gradient-to-br from-rose-50/70 to-white":"border-sky-200 bg-gradient-to-br from-sky-50/70 to-white"}`,children:t.jsxs("div",{className:"flex items-start gap-3",children:[t.jsx("div",{className:`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md ${a?"bg-gradient-to-br from-rose-500 to-orange-500":"bg-gradient-to-br from-sky-500 to-indigo-500"}`,children:r||"•"}),t.jsxs("div",{className:"flex-1 min-w-0",children:[t.jsxs("div",{className:"flex flex-wrap items-center gap-x-2 gap-y-1",children:[t.jsx("div",{className:"font-black text-slate-800 truncate",children:Pe(e.customer.nameEn||e.customer.name||e.contract.customerName,(o=e.customer)==null?void 0:o.roomNumber)}),e.mobile&&t.jsxs("div",{className:"inline-flex items-center gap-1 text-[11px] font-bold text-slate-500",children:[t.jsx(ea,{className:"w-3 h-3"})," ",e.mobile]})]}),t.jsxs("div",{className:"mt-1 flex flex-wrap gap-1.5",children:[t.jsxs("span",{className:"inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700",children:[t.jsx(Qe,{className:"w-3 h-3"})," ",e.buildingName]}),t.jsxs("span",{className:"inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700",children:[t.jsx(Le,{className:"w-3 h-3"})," ",m("monitoring.unit")," ",e.contract.unitName]}),e.isPriorLeaseRow?t.jsxs("span",{className:"inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200",children:[t.jsx(Xt,{className:"w-3 h-3"})," ",m("entry.priorLeasePaymentLabel")]}):t.jsxs(t.Fragment,{children:[t.jsxs("span",{className:"inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800",children:[t.jsx(jt,{className:"w-3 h-3"})," Every ",e.frequencyMonths,"mo"]}),e.installmentNo?t.jsxs("span",{className:"inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700",children:[t.jsx(Le,{className:"w-3 h-3"})," Inst. ",e.installmentNo,"/",e.totalInstallments]}):null]})]}),t.jsxs("div",{className:"mt-2 grid grid-cols-2 gap-2 text-[11px]",children:[t.jsxs("div",{className:"bg-white/80 rounded-lg px-2 py-1 border border-slate-100",children:[t.jsx("div",{className:"font-black text-slate-400 uppercase tracking-wider text-[9px]",children:e.isPriorLeaseRow?m("entry.priorLeasePeriod"):m("monitoring.nextDue")}),t.jsx("div",{className:"font-bold text-slate-700",children:e.nextDueDate?$(e.nextDueDate):"-"}),e.isPriorLeaseRow&&e.priorDateIsRenewalFallback&&t.jsx("div",{className:"text-[8px] font-bold text-amber-800 leading-tight mt-0.5",children:m("entry.priorLeaseBalanceDue")}),e.isPriorLeaseRow&&e.priorOldPeriodLabel&&t.jsx("div",{className:"text-[9px] font-semibold text-slate-500 leading-tight mt-0.5",children:e.priorOldPeriodLabel}),e.upcomingDueDate&&t.jsxs("div",{className:"text-[9px] font-semibold text-slate-500 leading-tight mt-0.5",children:[m("monitoring.upcoming"),": ",t.jsx("span",{className:"font-bold text-slate-600",children:$(e.upcomingDueDate)})]})]}),t.jsxs("div",{className:`rounded-lg px-2 py-1 border ${a&&(e.dueRent||0)>0?"bg-amber-50/90 border-amber-200":"bg-white/80 border-slate-100"}`,children:[t.jsxs("div",{className:"font-black text-slate-400 uppercase tracking-wider text-[9px]",children:[e.isPriorLeaseRow?m("entry.priorLeasePaymentLabel"):m("monitoring.rentOutstanding"),e.isVAT?t.jsxs("span",{className:"text-[8px] text-sky-600",children:[" (",m("monitoring.inclVat"),")"]}):""]}),t.jsx("div",{className:`font-bold ${(e.dueRent||0)>0?"text-sky-700":"text-slate-400"}`,children:Math.round(e.dueRent||0).toLocaleString()}),e.isVAT&&(e.dueRent||0)>0&&t.jsxs("div",{className:"text-[9px] font-semibold text-slate-500 leading-tight",children:[Math.round(e.dueRentExcl).toLocaleString()," + ",m("monitoring.vat")," ",Math.round(e.dueRentVat).toLocaleString()]})]})]}),e.hasFees&&t.jsxs("div",{className:"mt-1.5 grid grid-cols-2 gap-2 text-[11px]",children:[t.jsxs("div",{className:`rounded-lg px-2 py-1 border ${a&&(e.dueFees||0)>0?"bg-amber-50 border-amber-200":"bg-white/80 border-slate-100"}`,children:[t.jsxs("div",{className:"font-black text-slate-400 uppercase tracking-wider text-[9px]",children:[m("monitoring.feesExpected")," ",t.jsxs("span",{className:"text-[8px] text-slate-500",children:["(",m("monitoring.noVat"),")"]})]}),t.jsx("div",{className:"font-bold text-slate-700",children:Number(e.expectedFees).toLocaleString()})]}),t.jsxs("div",{className:`rounded-lg px-2 py-1 border ${a&&(e.dueFees||0)>0?"bg-rose-50 border-rose-200":"bg-white/80 border-slate-100"}`,children:[t.jsx("div",{className:"font-black text-slate-400 uppercase tracking-wider text-[9px]",children:m("monitoring.feesOutstanding")}),t.jsx("div",{className:`font-bold ${(e.dueFees||0)>0?a?"text-rose-600":"text-sky-600":"text-slate-400"}`,children:Math.round(e.dueFees||0).toLocaleString()})]})]})]}),t.jsxs("div",{className:"text-end shrink-0",children:[t.jsx("div",{className:`font-black text-lg leading-tight ${a?"text-rose-600":"text-sky-600"}`,children:Number(e.totalDue||e.totalOverdue||0).toLocaleString()}),((e.dueRent||0)>0||(e.dueFees||0)>0)&&t.jsxs("div",{className:"text-[9px] font-semibold text-slate-500 leading-tight mt-0.5",children:[(e.dueRent||0)>0&&t.jsxs(t.Fragment,{children:["Rent: ",Math.round(e.dueRent).toLocaleString(),e.isVAT?` (Excl ${Math.round(e.dueRentExcl).toLocaleString()} + VAT ${Math.round(e.dueRentVat).toLocaleString()})`:"",t.jsx("br",{})]}),(e.dueFees||0)>0&&t.jsxs(t.Fragment,{children:["Fees: ",Math.round(e.dueFees).toLocaleString()]})]}),t.jsxs("div",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest",children:["SAR ",a?"· OVERDUE":"· DUE"]}),a&&t.jsxs("div",{className:"mt-1 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white",children:[t.jsx(Ee,{className:"w-3 h-3"}),e.daysOverdue,"d"]})]})]})},e.rowKey||e.contract.id)})]})]}),t.jsxs("div",{className:"premium-card overflow-hidden",children:[t.jsxs("div",{className:"relative bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 p-5 text-white overflow-hidden",children:[t.jsx("div",{className:"absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-2xl"}),t.jsxs("div",{className:"relative flex items-center justify-between gap-3",children:[t.jsxs("div",{className:"flex items-center gap-3",children:[t.jsx("div",{className:"bg-white/20 backdrop-blur rounded-2xl p-2.5 border border-white/25",children:t.jsx(St,{className:"w-5 h-5"})}),t.jsxs("div",{children:[t.jsx("div",{className:"text-[10px] font-black uppercase tracking-widest text-white/80",children:"Contracts"}),t.jsx("div",{className:"text-lg font-black leading-tight",children:m("monitoring.contractsExpiring").replace("{date}",$(l))})]})]}),t.jsxs("div",{className:"flex items-center gap-2",children:[t.jsx("span",{className:"bg-white/25 backdrop-blur px-2.5 py-1 rounded-full text-xs font-black border border-white/20",children:$e.length}),Ze.length>0&&t.jsxs("button",{onClick:()=>oa(Ze,l,at,Fe),className:"px-3 py-1.5 bg-white text-indigo-700 rounded-xl text-xs font-black inline-flex items-center gap-1.5 hover:bg-indigo-50 transition shadow-sm",title:"Export all expiring contracts (ignores search filter)",children:[t.jsx(Dt,{size:14})," ",m("history.exportPdf")]})]})]})]}),t.jsxs("div",{className:"p-4 space-y-3 max-h-[70vh] overflow-y-auto",children:[$e.length===0&&t.jsxs("div",{className:"text-center py-10",children:[t.jsx(Rt,{className:"w-10 h-10 text-emerald-500 mx-auto mb-2"}),t.jsx("div",{className:"text-slate-500 font-semibold",children:m("monitoring.noContractsExpiring").replace("{date}",$(l))})]}),$e.map((e,a)=>{var V,F,x,Y;if(!e||!e.contract)return null;const r=e.contract,o=((V=e.customer)==null?void 0:V.nameEn)||((F=e.customer)==null?void 0:F.name)||r.customerName||"-",f=Pe(o,(x=e.customer)==null?void 0:x.roomNumber),d=((Y=e.building)==null?void 0:Y.name)||r.buildingName||"-",D=r.unitName||"-",M=typeof e.daysRemaining=="number"?e.daysRemaining:0,B=r.toDate?$(r.toDate):"-",h=f.trim().split(/\s+/).map(pe=>pe[0]).slice(0,2).join("").toUpperCase(),S=M<=7,P=M<=30;return t.jsx("div",{className:`relative p-3.5 rounded-2xl border-2 transition hover:-translate-y-0.5 hover:shadow-lg ${S?"border-rose-200 bg-gradient-to-br from-rose-50/70 to-white":P?"border-amber-200 bg-gradient-to-br from-amber-50/70 to-white":"border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white"}`,children:t.jsxs("div",{className:"flex items-start gap-3",children:[t.jsx("div",{className:`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md ${S?"bg-gradient-to-br from-rose-500 to-orange-500":P?"bg-gradient-to-br from-amber-500 to-yellow-500":"bg-gradient-to-br from-indigo-500 to-purple-500"}`,children:h||"•"}),t.jsxs("div",{className:"flex-1 min-w-0",children:[t.jsx("div",{className:"font-black text-slate-800 truncate",children:f}),t.jsxs("div",{className:"mt-1 flex flex-wrap gap-1.5",children:[t.jsxs("span",{className:"inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700",children:[t.jsx(Qe,{className:"w-3 h-3"})," ",d]}),t.jsxs("span",{className:"inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700",children:[t.jsx(Le,{className:"w-3 h-3"})," ",m("monitoring.unit")," ",D]})]}),t.jsxs("div",{className:"mt-2 text-[11px] font-bold text-slate-500 inline-flex items-center gap-1",children:[t.jsx(St,{className:"w-3 h-3"}),m("monitoring.ends"),": ",t.jsx("span",{className:"text-slate-700",children:B})]})]}),t.jsxs("div",{className:"text-end shrink-0",children:[t.jsx("div",{className:`font-black text-2xl leading-none ${S?"text-rose-600":P?"text-amber-600":"text-indigo-600"}`,children:M}),t.jsx("div",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5",children:m("monitoring.days")}),S&&t.jsxs("div",{className:"mt-1 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white",children:[t.jsx(Ee,{className:"w-3 h-3"})," URGENT"]})]})]})},r.id||a)})]})]})]})]})};function g(u){return String(u??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}function sa(u,w,C,j){const ee=w||new Date().toISOString().split("T")[0],ie=`Installments Due (Up To ${$(ee)})`,T=[...u].sort((n,E)=>{var K,z,_,p;const A=String(n.nextDueDate||"").localeCompare(String(E.nextDueDate||""));return A!==0?A:Z(String(n.buildingName||((K=n.building)==null?void 0:K.name)||((z=n.contract)==null?void 0:z.buildingName)||""),String(E.buildingName||((_=E.building)==null?void 0:_.name)||((p=E.contract)==null?void 0:p.buildingName)||""))}),ue=T.map((n,E)=>{var re,U,le,Q,ae,W,ne;const A=(Number(n.overdueAmount)||0)+(Number(n.feesOverdue)||0)>0,K=`data-row ${A?"is-overdue":"is-scheduled"}${n.isPriorLeaseRow?" is-prior":""}`,z=A?"amt-overdue":"amt-scheduled",_=n.isPriorLeaseRow?A?"P!":"P":A?"!":"·",p=n.isPriorLeaseRow?A?"Prior lease, overdue":"Prior lease":A?"Overdue":"Scheduled / upcoming";return`<tr class="${K}">
      <td class="tc num">${E+1}</td>
      <td class="tc sym-cell" title="${g(p)}">${_}</td>
      <td class="td-strong">${g(((re=n.building)==null?void 0:re.name)||n.buildingName||((U=n.contract)==null?void 0:U.buildingName)||"-")}</td>
      <td class="tc td-strong">${g(((le=n.contract)==null?void 0:le.unitName)||"-")}</td>
      <td>${g(Pe(((Q=n.customer)==null?void 0:Q.nameEn)||((ae=n.customer)==null?void 0:ae.name)||((W=n.contract)==null?void 0:W.customerName)||"-",(ne=n.customer)==null?void 0:ne.roomNumber))}</td>
      <td class="td-mono">${g(n.mobile||"-")}</td>
      <td class="tr ${z}">${Number(n.totalDue||n.totalOverdue||0).toLocaleString()}<span class="sar"> SAR</span>${(Number(n.dueRent)||0)>0||(Number(n.dueFees)||0)>0?`<div class="sub">${(Number(n.dueRent)||0)>0?`Rent ${Math.round(Number(n.dueRent)).toLocaleString()}${n.isVAT?` (Excl ${Math.round(Number(n.dueRentExcl)).toLocaleString()} · VAT ${Math.round(Number(n.dueRentVat)).toLocaleString()})`:""}`:""}${(Number(n.dueRent)||0)>0&&(Number(n.dueFees)||0)>0?" · ":""}${(Number(n.dueFees)||0)>0?`Fees ${Math.round(Number(n.dueFees)).toLocaleString()}`:""}${A?` · <span class="tag-overdue">Overdue ${Number(n.daysOverdue)||0}d</span>`:""}</div>`:""}</td>
      <td class="tr td-muted">${Number(n.expected).toLocaleString()}${n.isVAT?`<div class="sub">Excl ${Math.round(Number(n.expectedExcl)).toLocaleString()} · VAT ${Math.round(Number(n.expectedVat)).toLocaleString()}</div>`:""}${n.hasFees?`<div class="sub">Fees ${Math.round(Number(n.expectedFees)).toLocaleString()}</div>`:""}</td>
      <td class="tc">${n.isPriorLeaseRow?"—":`Every ${n.frequencyMonths}mo`}</td>
      <td class="tc">${g($(n.nextDueDate||""))}${n.isPriorLeaseRow?`<div class="sub">${n.priorOldPeriodLabel?g(n.priorOldPeriodLabel):"Old lease (renewal)"}</div>`:n.installmentNo?`<div class="sub">Inst. ${n.installmentNo}/${n.totalInstallments}</div>`:""}${n.upcomingDueDate?`<div class="sub">Upcoming: ${g($(n.upcomingDueDate))}</div>`:""}</td>
      <td class="tc"><span class="days-pill ${A?"days-hot":"days-cool"}">${n.daysOverdue}</span></td>
    </tr>`}).join(""),te=T.reduce((n,E)=>n+(E.totalDue||E.totalOverdue||E.overdueAmount||0),0),m=T.filter(n=>(Number(n.overdueAmount)||0)+(Number(n.feesOverdue)||0)>0).length,I=T.filter(n=>n.isPriorLeaseRow).length,l=`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${g(ie)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,600&display=swap" rel="stylesheet" />
    <style>
      :root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--surface:#ffffff;--accent:#0d9488;--accent2:#059669;--danger:#be123c;--danger-bg:#fff1f2;--cool:#0369a1;--cool-bg:#f0f9ff;--radius:20px}
      *{box-sizing:border-box}
      body{margin:0;padding:28px 20px 40px;font-family:'Plus Jakarta Sans',system-ui,-apple-system,Segoe UI,sans-serif;background:linear-gradient(165deg,#ecfdf5 0%,#f8fafc 38%,#f1f5f9 100%);color:var(--ink);font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased}
      .sheet{max-width:1120px;margin:0 auto;background:var(--surface);border-radius:var(--radius);box-shadow:0 25px 50px -12px rgba(15,23,42,.12),0 0 0 1px rgba(15,23,42,.04);overflow:hidden}
      .hero{position:relative;padding:32px 36px 28px;background:linear-gradient(145deg,#042f2e 0%,#0f766e 42%,#115e59 100%);color:#ecfdf5}
      .hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:4px;background:linear-gradient(90deg,#fbbf24,#34d399,#2dd4bf)}
      .brand-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:10px}
      .brand{display:flex;align-items:center;gap:12px}
      .brand img{height:40px;width:auto;object-fit:contain;filter:brightness(0) invert(1) opacity(.92)}
      .eyebrow{font-size:10px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;opacity:.72}
      .hero h1{margin:6px 0 0;font-size:clamp(20px,2.4vw,26px);font-weight:800;letter-spacing:-.02em;line-height:1.2}
      .hero-sub{margin-top:10px;font-size:13px;font-weight:500;opacity:.88}
      .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
      .chip{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(6px)}
      .chip b{font-weight:800;opacity:1}
      .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:22px 36px;background:linear-gradient(180deg,#f8fafc,#fff);border-bottom:1px solid var(--line)}
      @media(max-width:720px){.summary{grid-template-columns:1fr}}
      .kpi{padding:16px 18px;border-radius:14px;border:1px solid var(--line);background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.04)}
      .kpi-label{display:block;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
      .kpi-value{font-size:22px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
      .kpi-value .unit{font-size:12px;font-weight:700;color:var(--muted);margin-left:4px}
      .kpi-note{font-size:11px;color:var(--muted);margin-top:6px;font-weight:500}
      .legend{display:flex;flex-wrap:wrap;gap:16px;padding:14px 36px 0;font-size:11px;font-weight:600;color:var(--muted)}
      .legend span{display:inline-flex;align-items:center;gap:8px}
      .sym-key{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:900;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;padding:1px 6px}
      .dot{width:10px;height:10px;border-radius:50%}
      .dot-overdue{background:var(--danger)}
      .dot-scheduled{background:var(--cool)}
      .dot-prior{background:#7c3aed}
      .table-wrap{padding:18px 36px 28px;overflow-x:auto}
      .section-h{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}
      .table-print{width:100%;table-layout:fixed;border-collapse:collapse;font-size:11px;border:2px solid #64748b}
      .table-print th,.table-print td{border:1px solid #cbd5e1;padding:8px 6px;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word}
      .table-print thead th{text-align:left;font-size:8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#1e293b;background:#e2e8f0;border-bottom:2px solid #64748b;white-space:normal;line-height:1.2}
      .table-print thead th.tc{text-align:center}
      .table-print thead th.tr{text-align:right}
      .table-print tbody td{background:#fff}
      .table-print .sym-cell{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:900;font-size:13px;line-height:1;padding:8px 4px;white-space:nowrap;width:1%}
      .data-row.is-overdue:not(.is-prior) .sym-cell{color:var(--danger)}
      .data-row.is-scheduled:not(.is-prior) .sym-cell{color:var(--cool)}
      .data-row.is-prior .sym-cell{color:#6d28d9}
      .data-row:hover td{background:#fafafa}
      .data-row td:first-child::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:0 2px 2px 0}
      .data-row.is-overdue:not(.is-prior) td:first-child::before{background:var(--danger)}
      .data-row.is-prior.is-overdue td:first-child::before{background:linear-gradient(180deg,#6d28d9 0%,#be123c 100%)}
      .data-row.is-prior:not(.is-overdue) td:first-child::before{background:#7c3aed}
      .data-row.is-scheduled:not(.is-prior) td:first-child::before{background:#38bdf8}
      .data-row td{position:relative}
      .data-row td:first-child{padding-left:14px}
      .data-row.is-overdue:not(.is-prior) td{background:linear-gradient(90deg,var(--danger-bg) 0%,transparent 52%)}
      .data-row.is-scheduled:not(.is-prior) td{background:linear-gradient(90deg,var(--cool-bg) 0%,transparent 48%)}
      .data-row.is-prior:not(.is-overdue) td{background:linear-gradient(90deg,#f5f3ff 0%,transparent 48%)}
      .data-row.is-prior.is-overdue td{background:linear-gradient(90deg,#fff1f2 0%,#f5f3ff 42%,transparent 58%)}
      .tc{text-align:center}
      .tr{text-align:right}
      .num{font-variant-numeric:tabular-nums;font-weight:700;color:var(--muted)}
      .td-strong{font-weight:600;color:#1e293b}
      .td-mono{font-variant-numeric:tabular-nums;font-size:11.5px;color:#475569}
      .amt-overdue{color:var(--danger);font-weight:800;font-variant-numeric:tabular-nums}
      .amt-scheduled{color:var(--cool);font-weight:800;font-variant-numeric:tabular-nums}
      .sar{font-size:10px;font-weight:700;opacity:.75;margin-left:2px}
      .td-muted{color:#475569;font-weight:600;font-variant-numeric:tabular-nums}
      .sub{font-size:10px;font-weight:600;color:var(--muted);margin-top:4px;line-height:1.35;max-width:280px;margin-left:auto}
      tr .sub{margin-left:0;margin-right:0}
      .tr .sub{max-width:220px;margin-left:auto;text-align:right}
      .tag-overdue{display:inline-block;margin-top:2px;padding:2px 8px;border-radius:999px;font-size:9px;font-weight:800;background:#fecdd3;color:#9f1239}
      .days-pill{display:inline-flex;min-width:2rem;justify-content:center;padding:4px 8px;border-radius:8px;font-weight:800;font-size:12px;font-variant-numeric:tabular-nums}
      .days-hot{background:#ffe4e6;color:#9f1239}
      .days-cool{background:#e0f2fe;color:#075985}
      tfoot td{padding:12px 8px;font-weight:800;font-size:12px;background:#0f766e!important;color:#fff!important;border:1px solid #0f766e!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      tfoot .grand{font-size:14px;letter-spacing:-.02em}
      .doc-foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding:16px 36px 22px;font-size:10px;font-weight:600;color:var(--muted);border-top:1px solid var(--line);background:#fafafa}
      @media print{
        @page{size:A4 landscape;margin:8mm 10mm}
        body{padding:0!important;background:#fff!important;font-size:10pt}
        .sheet{box-shadow:none!important;border-radius:0!important;max-width:none!important}
        .hero{border-radius:0!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:14px 18px!important}
        .hero h1{font-size:16pt!important}
        .chips,.hero-sub{display:none!important}
        .summary{grid-template-columns:repeat(3,1fr)!important;padding:10px 14px!important;gap:8px!important}
        .kpi{padding:10px 12px!important}
        .kpi-value{font-size:14pt!important}
        .legend{padding:8px 14px 0!important;font-size:9pt}
        .table-wrap{padding:10px 14px 14px!important}
        .table-print{font-size:8pt!important;border-color:#334155!important}
        .table-print th,.table-print td{border-color:#64748b!important;padding:4px 4px!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .table-print thead th{font-size:7pt!important;line-height:1.15!important}
        .table-print .sym-cell{font-size:11pt!important;padding:4px 2px!important}
        .sub{font-size:7pt!important;max-width:none!important}
        .days-pill{padding:2px 5px!important;font-size:8pt!important}
        .data-row td:first-child::before{display:none!important}
        .data-row td:first-child{padding-left:6px!important}
        .data-row td{background:#fff!important}
        .data-row:hover td{background:#fff!important}
        .summary,.kpi,.doc-foot{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        thead{display:table-header-group}
        tfoot{display:table-footer-group}
        tbody tr{page-break-inside:auto;break-inside:auto}
        thead tr,tfoot tr{page-break-inside:avoid;break-inside:avoid}
      }
    </style>
  </head><body>
    <div class="sheet">
      <header class="hero">
        <div class="brand-row">
          <div class="brand">
            <img src="/images/cologo.png" alt="" onerror="this.style.display='none'" />
            <div>
              <div class="eyebrow">Monitoring · Collections</div>
              <h1>${g(ie)}</h1>
              <p class="hero-sub">Outstanding installments and prior lease balances — print or save as PDF.</p>
            </div>
          </div>
        </div>
        <div class="chips">
          <span class="chip">Sort <b>${g(C||"Default")}</b></span>
          <span class="chip">Buildings <b>${g(j||"All")}</b></span>
          <span class="chip">Report date <b>${g($(ee))}</b></span>
          <span class="chip">Generated <b>${g(At(new Date))}</b></span>
        </div>
      </header>
      <section class="summary">
        <div class="kpi">
          <span class="kpi-label">Total due (this view)</span>
          <span class="kpi-value grand">${te.toLocaleString()}<span class="unit">SAR</span></span>
          <p class="kpi-note">Sum of “Due” column for all listed rows.</p>
        </div>
        <div class="kpi">
          <span class="kpi-label">Lines on report</span>
          <span class="kpi-value">${T.length}</span>
          <p class="kpi-note">${T.length-m} not yet overdue${I?` · ${I} prior-lease row${I===1?"":"s"}`:""}</p>
        </div>
        <div class="kpi">
          <span class="kpi-label">Overdue lines</span>
          <span class="kpi-value">${m}</span>
          <p class="kpi-note">Use “Days” + color cues to prioritize follow-up.</p>
        </div>
      </section>
      <div class="legend">
        <span><span class="sym-key">!</span> Overdue</span>
        <span><span class="sym-key">&#183;</span> Scheduled / upcoming</span>
        <span><span class="sym-key">P</span> Prior lease</span>
        <span><span class="sym-key">P!</span> Prior + overdue</span>
        <span style="margin-left:8px;opacity:.85">(Symbol column prints clearly in B/W PDF.)</span>
      </div>
      <div class="table-wrap">
        <p class="section-h">Detail</p>
        <table class="table-print" role="table">
          <colgroup>
            <col style="width:3%" /><col style="width:3.5%" /><col style="width:12%" /><col style="width:7%" /><col style="width:14%" /><col style="width:9%" />
            <col style="width:10%" /><col style="width:10%" /><col style="width:6%" /><col style="width:14%" /><col style="width:5.5%" />
          </colgroup>
          <thead><tr>
            <th class="tc">#</th><th class="tc" title="Status">St</th><th>Building</th><th class="tc">Unit</th><th>Customer</th><th class="tc">Mobile</th>
            <th class="tr">Due</th>
            <th class="tr">Expected</th>
            <th class="tc">Freq</th><th class="tc">Next due</th><th class="tc">Days</th>
          </tr></thead>
          <tbody>${ue}</tbody>
          <tfoot><tr>
            <td colspan="6" class="tr" style="font-weight:800">Grand total due</td>
            <td class="tr grand">${te.toLocaleString()} SAR</td>
            <td colspan="4" style="opacity:.92;font-weight:600;font-size:11px">All buildings in this export</td>
          </tr></tfoot>
        </table>
      </div>
      <footer class="doc-foot"><span>Amlak · Property management</span><span>Confidential — for internal use</span></footer>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print()},320)};<\/script>
  </body></html>`,J=window.open("","_blank","width=1120,height=900");J&&(J.document.write(l),J.document.close(),J.focus())}function oa(u,w,C,j){const ee=w||new Date().toISOString().split("T")[0],ie=`Contracts Expiring (Up To ${$(ee)})`,T=u.map((l,J)=>{var ae,W,ne,De,de,ce;const n=l.contract,E=((ae=l.building)==null?void 0:ae.name)||n.buildingName||"-",A=((W=l.customer)==null?void 0:W.nameEn)||((ne=l.customer)==null?void 0:ne.name)||n.customerName||"-",K=Pe(A,(De=l.customer)==null?void 0:De.roomNumber),z=n.unitName||"-",_=n.toDate?$(n.toDate):"-",p=typeof l.daysRemaining=="number"?l.daysRemaining:NaN,re=Number.isFinite(p)?p<=30?"data-row is-urgent":p<=90?"data-row is-soon":"data-row is-normal":"data-row is-unknown",U=Number.isFinite(p)?`<span class="days-pill ${p<=30?"pill-critical":p<=90?"pill-warn":"pill-ok"}">${p}</span>`:'<span class="days-pill pill-na">—</span>',le=Number.isFinite(p)?p<=30?"H":p<=90?"M":"L":"?",Q=Number.isFinite(p)?p<=30?"Critical: 30 days or less":p<=90?"Soon: 31–90 days":"Later: 91+ days":"No end date";return`<tr class="${re}">
      <td class="tc num">${J+1}</td>
      <td class="tc sym-cell" title="${g(Q)}">${le}</td>
      <td class="td-strong">${g(E)}</td>
      <td class="tc td-strong">${g(z)}</td>
      <td>${g(K)}</td>
      <td class="td-mono">${g(((de=l.customer)==null?void 0:de.mobileNo)||((ce=l.customer)==null?void 0:ce.mobile)||"-")}</td>
      <td class="tc td-strong">${g(_)}</td>
      <td class="tc">${U}</td>
    </tr>`}).join(""),ue=u.filter(l=>typeof l.daysRemaining=="number"&&l.daysRemaining<=30).length,te=u.filter(l=>typeof l.daysRemaining=="number"&&l.daysRemaining>30&&l.daysRemaining<=90).length,m=`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${g(ie)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,600&display=swap" rel="stylesheet" />
    <style>
      :root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--surface:#fff;--indigo:#4338ca;--violet:#6d28d9;--amber:#d97706;--rose:#be123c;--radius:20px}
      *{box-sizing:border-box}
      body{margin:0;padding:28px 20px 40px;font-family:'Plus Jakarta Sans',system-ui,-apple-system,Segoe UI,sans-serif;background:linear-gradient(165deg,#eef2ff 0%,#f8fafc 45%,#faf5ff 100%);color:var(--ink);font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased}
      .sheet{max-width:960px;margin:0 auto;background:var(--surface);border-radius:var(--radius);box-shadow:0 25px 50px -12px rgba(30,27,75,.14),0 0 0 1px rgba(15,23,42,.04);overflow:hidden}
      .hero{position:relative;padding:32px 36px 28px;background:linear-gradient(135deg,#1e1b4b 0%,#4338ca 38%,#5b21b6 100%);color:#eef2ff}
      .hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:4px;background:linear-gradient(90deg,#fbbf24,#f472b6,#a78bfa)}
      .brand-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
      .brand{display:flex;align-items:center;gap:12px}
      .brand img{height:40px;width:auto;object-fit:contain;filter:brightness(0) invert(1) opacity(.9)}
      .eyebrow{font-size:10px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;opacity:.72}
      .hero h1{margin:6px 0 0;font-size:clamp(20px,2.4vw,26px);font-weight:800;letter-spacing:-.02em;line-height:1.2}
      .hero-sub{margin-top:10px;font-size:13px;font-weight:500;opacity:.88;max-width:52ch}
      .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
      .chip{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22)}
      .chip b{font-weight:800}
      .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:22px 36px;background:linear-gradient(180deg,#f8fafc,#fff);border-bottom:1px solid var(--line)}
      @media(max-width:700px){.summary{grid-template-columns:1fr}}
      .kpi{padding:16px 18px;border-radius:14px;border:1px solid var(--line);background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.04)}
      .kpi-label{display:block;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
      .kpi-value{font-size:22px;font-weight:800;letter-spacing:-.02em}
      .kpi-note{font-size:11px;color:var(--muted);margin-top:6px;font-weight:500}
      .legend{display:flex;flex-wrap:wrap;gap:16px;padding:14px 36px 0;font-size:11px;font-weight:600;color:var(--muted)}
      .legend span{display:inline-flex;align-items:center;gap:8px}
      .sym-key{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:900;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;padding:1px 6px}
      .dot{width:10px;height:10px;border-radius:50%}
      .dot-c{background:var(--rose)}
      .dot-w{background:var(--amber)}
      .dot-n{background:#22c55e}
      .table-wrap{padding:18px 36px 28px;overflow-x:auto}
      .section-h{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}
      .table-print{width:100%;table-layout:fixed;border-collapse:collapse;font-size:12px;border:2px solid #64748b}
      .table-print th,.table-print td{border:1px solid #cbd5e1;padding:9px 7px;vertical-align:middle;word-wrap:break-word;overflow-wrap:break-word}
      .table-print thead th{text-align:left;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#1e293b;background:#e0e7ff;border-bottom:2px solid #6366f1;line-height:1.2;white-space:normal}
      .table-print thead th.tc{text-align:center}
      .table-print tbody td{background:#fff;position:relative}
      .table-print .sym-cell{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:900;font-size:14px;line-height:1;padding:9px 4px;white-space:nowrap;width:1%}
      .data-row.is-urgent .sym-cell{color:var(--rose)}
      .data-row.is-soon .sym-cell{color:var(--amber)}
      .data-row.is-normal .sym-cell{color:#047857}
      .data-row td:first-child::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:0 2px 2px 0}
      .data-row.is-urgent td:first-child::before{background:var(--rose)}
      .data-row.is-soon td:first-child::before{background:var(--amber)}
      .data-row.is-normal td:first-child::before{background:#34d399}
      .data-row td:first-child{padding-left:14px}
      .data-row.is-urgent td{background:linear-gradient(90deg,#fff1f2 0%,transparent 50%)}
      .data-row.is-soon td{background:linear-gradient(90deg,#fffbeb 0%,transparent 48%)}
      .data-row.is-normal td{background:linear-gradient(90deg,#ecfdf5 0%,transparent 42%)}
      .data-row.is-unknown .sym-cell{color:#64748b}
      .data-row.is-unknown td:first-child::before{background:#94a3b8}
      .data-row.is-unknown td{background:linear-gradient(90deg,#f1f5f9 0%,transparent 40%)}
      .tc{text-align:center}
      .num{font-variant-numeric:tabular-nums;font-weight:700;color:var(--muted)}
      .td-strong{font-weight:600;color:#1e293b}
      .td-mono{font-variant-numeric:tabular-nums;font-size:11.5px;color:#475569}
      .days-pill{display:inline-flex;min-width:2.25rem;justify-content:center;padding:5px 10px;border-radius:10px;font-weight:800;font-size:12px;font-variant-numeric:tabular-nums}
      .pill-critical{background:#ffe4e6;color:#9f1239}
      .pill-warn{background:#fef3c7;color:#92400e}
      .pill-ok{background:#d1fae5;color:#065f46}
      .pill-na{background:#f1f5f9;color:#94a3b8}
      .doc-foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding:16px 36px 22px;font-size:10px;font-weight:600;color:var(--muted);border-top:1px solid var(--line);background:#fafafa}
      @media print{
        @page{size:A4 landscape;margin:8mm 10mm}
        body{padding:0!important;background:#fff!important;font-size:10pt}
        .sheet{box-shadow:none!important;border-radius:0!important;max-width:none!important}
        .hero{-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:14px 18px!important}
        .hero h1{font-size:16pt!important}
        .chips,.hero-sub{display:none!important}
        .summary{grid-template-columns:repeat(3,1fr)!important;padding:10px 14px!important;gap:8px!important}
        .kpi{padding:10px 12px!important}
        .kpi-value{font-size:14pt!important}
        .legend{padding:8px 14px 0!important;font-size:9pt}
        .table-wrap{padding:10px 14px 14px!important}
        .table-print{font-size:9pt!important;border-color:#334155!important}
        .table-print th,.table-print td{border-color:#64748b!important;padding:5px 6px!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .table-print thead th{font-size:8pt!important}
        .table-print .sym-cell{font-size:12pt!important}
        .data-row td:first-child::before{display:none!important}
        .data-row td:first-child{padding-left:6px!important}
        .data-row td{background:#fff!important}
        .summary,.kpi,.doc-foot{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        thead{display:table-header-group}
        tbody tr{page-break-inside:auto;break-inside:auto}
        thead tr{page-break-inside:avoid;break-inside:avoid}
      }
    </style>
  </head><body>
    <div class="sheet">
      <header class="hero">
        <div class="brand-row">
          <div class="brand">
            <img src="/images/cologo.png" alt="" onerror="this.style.display='none'" />
            <div>
              <div class="eyebrow">Monitoring · Renewals</div>
              <h1>${g(ie)}</h1>
              <p class="hero-sub">Active contracts approaching end date — plan renewals, notices, and unit turnover.</p>
            </div>
          </div>
        </div>
        <div class="chips">
          <span class="chip">Sort <b>${g(C||"Default")}</b></span>
          <span class="chip">Buildings <b>${g(j||"All")}</b></span>
          <span class="chip">Report date <b>${g($(ee))}</b></span>
          <span class="chip">Generated <b>${g(At(new Date))}</b></span>
        </div>
      </header>
      <section class="summary">
        <div class="kpi">
          <span class="kpi-label">Contracts listed</span>
          <span class="kpi-value">${u.length}</span>
          <p class="kpi-note">Every row is one active contract in the expiring window.</p>
        </div>
        <div class="kpi">
          <span class="kpi-label">≤ 30 days left</span>
          <span class="kpi-value" style="color:var(--rose)">${ue}</span>
          <p class="kpi-note">Highest priority for renewal outreach.</p>
        </div>
        <div class="kpi">
          <span class="kpi-label">31–90 days left</span>
          <span class="kpi-value" style="color:var(--amber)">${te}</span>
          <p class="kpi-note">${Math.max(0,u.length-ue-te)} contracts beyond 90 days.</p>
        </div>
      </section>
      <div class="legend">
        <span><span class="sym-key">H</span> High — ≤30 days</span>
        <span><span class="sym-key">M</span> Medium — 31–90 days</span>
        <span><span class="sym-key">L</span> Low — 91+ days</span>
        <span><span class="sym-key">?</span> No end date</span>
      </div>
      <div class="table-wrap">
        <p class="section-h">Expiring contracts</p>
        <table class="table-print" role="table">
          <colgroup>
            <col style="width:4%" /><col style="width:4%" /><col style="width:18%" /><col style="width:10%" /><col style="width:22%" /><col style="width:12%" /><col style="width:14%" /><col style="width:10%" />
          </colgroup>
          <thead><tr>
            <th class="tc">#</th><th class="tc" title="Urgency tier">St</th><th>Building</th><th class="tc">Unit</th><th>Customer</th><th class="tc">Mobile</th>
            <th class="tc">Contract end</th><th class="tc">Days left</th>
          </tr></thead>
          <tbody>${T}</tbody>
        </table>
      </div>
      <footer class="doc-foot"><span>Amlak · Property management</span><span>Confidential — for internal use</span></footer>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print()},320)};<\/script>
  </body></html>`,I=window.open("","_blank","width=1020,height=880");I&&(I.document.write(m),I.document.close(),I.focus())}export{ga as default};
