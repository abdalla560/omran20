/* ==========================================================================
   Digitals EGYPT — النواة المشتركة
   تخزين + مصادقة + تحليل الرقم القومي + توليد بيانات متسقة + مكونات واجهة
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- أدوات */
  const pad = (n, l) => String(n).padStart(l || 2, '0');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toEn = s => String(s == null ? '' : s).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776);
  const fmt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const fmtDate = d => { d = d instanceof Date ? d : new Date(d); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
  const NOW = new Date();
  const ANCHOR = new Date(NOW.getFullYear(), NOW.getMonth(), 1);   // مرجع ثابت طوال الشهر ليبقى التوليد مستقراً
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const addYears = (d, n) => new Date(d.getFullYear() + n, d.getMonth(), d.getDate());
  const normName = s => String(s || '').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();

  /* ----------------------------------------------------------- مولد عشوائي */
  function hash(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed) { let a = hash(seed); return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const I = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const digits = (r, n) => { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(r() * 10); return s; };
  const refCode = s => { const h = hash(s).toString(36).toUpperCase().padStart(7, '0'); return h.slice(0, 4) + '-' + h.slice(4, 8).padEnd(4, 'X'); };

  /* ------------------------------------------------------- الرقم القومي */
  const GOV = { '01': 'القاهرة', '02': 'الإسكندرية', '03': 'بورسعيد', '04': 'السويس', '11': 'دمياط', '12': 'الدقهلية', '13': 'الشرقية', '14': 'القليوبية', '15': 'كفر الشيخ', '16': 'الغربية', '17': 'المنوفية', '18': 'البحيرة', '19': 'الإسماعيلية', '21': 'الجيزة', '22': 'بني سويف', '23': 'الفيوم', '24': 'المنيا', '25': 'أسيوط', '26': 'سوهاج', '27': 'قنا', '28': 'أسوان', '29': 'الأقصر', '31': 'البحر الأحمر', '32': 'الوادي الجديد', '33': 'مطروح', '34': 'شمال سيناء', '35': 'جنوب سيناء', '88': 'مولود خارج الجمهورية' };
  function parseNid(raw) {
    const n = toEn(raw).replace(/\s/g, '');
    if (!/^\d{14}$/.test(n)) return { ok: false, err: 'الرقم القومي يجب أن يتكون من 14 رقماً.' };
    if (n[0] !== '2' && n[0] !== '3') return { ok: false, err: 'رقم قومي غير صحيح: أول رقم يجب أن يكون 2 أو 3.' };
    const y = (n[0] === '2' ? 1900 : 2000) + (+n.slice(1, 3)), m = +n.slice(3, 5), d = +n.slice(5, 7), dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d || dt > NOW) return { ok: false, err: 'تاريخ الميلاد داخل الرقم القومي غير صحيح.' };
    const g = n.slice(7, 9);
    if (!GOV[g]) return { ok: false, err: 'كود المحافظة داخل الرقم القومي غير صحيح.' };
    const male = (+n[12]) % 2 === 1;
    let age = NOW.getFullYear() - y; if (NOW < new Date(NOW.getFullYear(), m - 1, d)) age--;
    return { ok: true, nid: n, y, m, d, dob: y + '-' + pad(m) + '-' + pad(d), age, gov: GOV[g], govCode: g, male, gender: male ? 'ذكر' : 'أنثى' };
  }
  const normPhone = x => { x = toEn(x).replace(/[\s\-().]/g, ''); if (x.indexOf('+20') === 0) x = '0' + x.slice(3); else if (x.indexOf('0020') === 0) x = '0' + x.slice(4); else if (/^20\d{10}$/.test(x)) x = '0' + x.slice(2); return x; };
  const validPhone = x => /^01[0125]\d{8}$/.test(normPhone(x));
  const maskPhone = x => x.slice(0, 3) + '•••••' + x.slice(-3);
  const validName = s => { s = String(s || '').trim().replace(/\s+/g, ' '); return s.split(' ').length >= 3 && /^[\p{L}\s'’.\-]+$/u.test(s) && s.length <= 80; };

  /* ----------------------------------------------------------------- تخزين */
  const NS = 'idegypt:v1', WN = 'idegypt:';
  const blank = () => ({ users: {}, session: null, state: {}, lock: {}, ts: 0 });
  function readLS() { try { const r = localStorage.getItem(NS); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function readWN() { try { return String(window.name).indexOf(WN) === 0 ? JSON.parse(window.name.slice(WN.length)) : null; } catch (e) { return null; } }
  function load() { const a = readLS(), b = readWN(); const best = (a && b) ? (b.ts > a.ts ? b : a) : (a || b); return Object.assign(blank(), best || {}); }
  let db = load();
  function save() {
    db.ts = Date.now(); const s = JSON.stringify(db);
    try { localStorage.setItem(NS, s); } catch (e) { /* التخزين غير متاح */ }
    try { if (window.name === '' || String(window.name).indexOf(WN) === 0) window.name = WN + s; } catch (e) { }
  }

  /* ------------------------------------------------------ المستخدم والجلسة */
  let userCache = null;
  function user() {
    if (!db.session || !db.users[db.session]) return null;
    if (userCache && userCache.nid === db.session) return userCache;
    const p = db.users[db.session], n = parseNid(p.nid);
    if (!n.ok) return null;
    const first = String(p.name).trim().split(' ')[0];
    return (userCache = Object.assign({}, p, n, { first }));
  }
  function state() {
    const u = user(); if (!u) return {};
    const st = db.state[u.nid] || (db.state[u.nid] = {});
    ['activity', 'appointments', 'proxies', 'attest', 'receipts', 'requests', 'companies', 'heirs'].forEach(k => { if (!Array.isArray(st[k])) st[k] = []; });
    ['paid', 'util', 'docs'].forEach(k => { if (!st[k] || typeof st[k] !== 'object') st[k] = {}; });
    if (typeof st.spent !== 'number') st.spent = 0;
    return st;
  }
  function log(title, text) {
    const st = state(); st.activity.unshift({ t: Date.now(), title, text: text || '' });
    st.activity = st.activity.slice(0, 60); save();
  }
  function addUser(p) {
    const n = parseNid(p.nid); if (!n.ok) return { ok: false, err: n.err };
    if (!validPhone(p.phone)) return { ok: false, err: 'رقم الموبايل غير صحيح (مثال: 01012345678).' };
    if (db.users[n.nid]) return { ok: false, err: 'هذا الرقم القومي مسجل بالفعل. استخدم «دخول النظام».', exists: true };
    db.users[n.nid] = Object.assign({}, p, { nid: n.nid, phone: normPhone(p.phone), name: String(p.name).trim().replace(/\s+/g, ' '), createdAt: Date.now() });
    db.state[n.nid] = { activity: [{ t: Date.now(), title: 'إنشاء الملف الرقمي', text: 'تم تفعيل هويتك الرقمية' }] };
    save(); return { ok: true };            // لا تُنشأ جلسة هنا: الدخول يكون برمز التحقق فقط
  }

  /* ------------------------------------------------- تسجيل الدخول برمز OTP -------------------------------------------------
     لا تُنشأ الجلسة إلا في verifyOtp بعد مطابقة الرمز. في النسخة التجريبية يُولَّد الرمز في المتصفح ويُعرض كرسالة SMS محاكاة.
     في الإنتاج يجب أن يتم التوليد والإرسال والتحقق في الخادم (sms.send و verifyOtp هما نقطة الاستبدال). */
  const OTP_TTL = 5 * 60e3, OTP_COOLDOWN = 30e3, OTP_TRIES = 3, LOCK_AFTER = 5, LOCK_MS = 15 * 60e3;
  let chal = null;
  async function sha(x) { try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)); return Array.prototype.map.call(new Uint8Array(b), v => v.toString(16).padStart(2, '0')).join(''); } catch (e) { return 'h' + hash(x); } }
  function randCode() { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(a[0] % 1000000).padStart(6, '0'); }
  function showSms(phone, code) {
    const old = document.querySelector('.sms-sim'); if (old) old.remove();
    const d = document.createElement('div'); d.className = 'sms-sim'; d.setAttribute('role', 'status');
    d.innerHTML = '<div class="h"><b> رسالة SMS (محاكاة)</b><button type="button" aria-label="إغلاق">×</button></div><div class="to">إلى: <span class="ltr">' + esc(maskPhone(phone)) + '</span></div><p>Digitals EGYPT: رمز التحقق الخاص بك هو <b class="code ltr">' + code + '</b>. صالح 5 دقائق. لا تشاركه مع أي شخص.</p><small>في النسخة الحقيقية يصل الرمز إلى هاتفك فقط ولا يظهر على الشاشة.</small>';
    d.querySelector('button').onclick = () => d.remove(); document.body.appendChild(d); setTimeout(() => d.remove(), 90e3);
  }
  const sms = { send(phone, code) { showSms(phone, code); return Promise.resolve(true); } };   // ← استبدله باستدعاء خادم/مزود SMS
  async function issue(nid) {
    const p = db.users[nid], code = randCode(), salt = randCode() + Date.now();
    chal = { nid, salt, hash: await sha(salt + code), exp: Date.now() + OTP_TTL, sentAt: Date.now(), tries: 0 };
    await sms.send(p.phone, code);
    return { ok: true, masked: maskPhone(p.phone) };
  }
  async function startLogin(name, nid, phone) {
    const n = parseNid(nid); if (!n.ok) return { ok: false, err: n.err };
    const p = db.users[n.nid]; if (!p) return { ok: false, notFound: true, err: 'هذا الرقم القومي غير مسجل. اضغط «تسجيل لأول مرة» لإنشاء ملفك.' };
    const L = db.lock[n.nid]; if (L && L.until > Date.now()) return { ok: false, err: 'تم إيقاف المحاولات مؤقتاً بسبب كثرة الأخطاء. حاول بعد ' + Math.ceil((L.until - Date.now()) / 60000) + ' دقيقة.' };
    if (normName(p.name) !== normName(name)) return { ok: false, err: 'الاسم لا يطابق الاسم المسجل بهذا الرقم القومي.' };
    if (!p.phone) {      // حساب قديم بلا موبايل (تهجير لمرة واحدة، لبيانات محلية فقط)
      if (!phone) return { ok: false, needPhone: true, err: 'هذا الحساب بلا رقم موبايل. أدخل رقمك ليُربط بالحساب ويصلك الرمز عليه.' };
      if (!validPhone(phone)) return { ok: false, needPhone: true, err: 'رقم الموبايل غير صحيح (مثال: 01012345678).' };
      p.phone = normPhone(phone); save();
    }
    return issue(n.nid);
  }
  async function resendOtp() {
    if (!chal) return { ok: false, err: 'ابدأ تسجيل الدخول من جديد.' };
    const w = OTP_COOLDOWN - (Date.now() - chal.sentAt); if (w > 0) return { ok: false, err: 'انتظر ' + Math.ceil(w / 1000) + ' ثانية قبل إعادة الإرسال.' };
    return issue(chal.nid);
  }
  const otpInfo = () => chal ? { exp: chal.exp, sentAt: chal.sentAt, cooldown: OTP_COOLDOWN } : null;
  async function verifyOtp(code) {
    if (!chal) return { ok: false, restart: true, err: 'انتهت العملية. ابدأ تسجيل الدخول من جديد.' };
    if (Date.now() > chal.exp) { chal = null; return { ok: false, restart: true, err: 'انتهت صلاحية الرمز. اطلب رمزاً جديداً.' }; }
    code = toEn(code).trim(); if (!/^\d{6}$/.test(code)) return { ok: false, err: 'اكتب الرمز المكوّن من 6 أرقام.' };
    if ((await sha(chal.salt + code)) !== chal.hash) {
      const nid = chal.nid, L = db.lock[nid] || (db.lock[nid] = { n: 0, until: 0 }); L.n++; if (L.n >= LOCK_AFTER) { L.until = Date.now() + LOCK_MS; L.n = 0; } save();
      chal.tries++; if (chal.tries >= OTP_TRIES || L.until > Date.now()) { chal = null; return { ok: false, restart: true, err: 'تجاوزت عدد المحاولات المسموح بها. ابدأ من جديد.' }; }
      return { ok: false, err: 'الرمز غير صحيح. المحاولات المتبقية: ' + (OTP_TRIES - chal.tries) };
    }
    const nid = chal.nid; chal = null; delete db.lock[nid]; db.session = nid; userCache = null; save(); log('تسجيل دخول', 'تم التحقق برمز OTP'); return { ok: true };
  }
  const DEMO = { name: 'محمد أحمد علي حسن', nid: '29001010123456', phone: '01012345678', uni: 'جامعة القاهرة', faculty: 'الحاسبات والمعلومات', gradYear: '2012', degree: 'ماجستير', thesis: 'استخدام التعلم الآلي في تحسين خدمات الحكومة الإلكترونية' };
  function demo() { if (!db.users[DEMO.nid]) { db.users[DEMO.nid] = Object.assign({ createdAt: Date.now() }, DEMO); db.state[DEMO.nid] = { activity: [{ t: Date.now(), title: 'حساب تجريبي', text: 'تم إنشاء الحساب التجريبي' }] }; } else if (!db.users[DEMO.nid].phone) db.users[DEMO.nid].phone = DEMO.phone; save(); return DEMO; }
  function updateUser(patch) { const u = user(); if (!u) return; Object.assign(db.users[u.nid], patch); userCache = null; save(); }
  function logout() { db.session = null; userCache = null; save(); location.href = 'index.html'; }
  function wipeUser() { const u = user(); if (!u) return; delete db.users[u.nid]; delete db.state[u.nid]; db.session = null; userCache = null; save(); }

  /* ------------------------------------------------------------ مولدات */
  const FX = 48.55;                                     // سعر صرف تجريبي موحد USD/EGP
  const memo = {};
  const G = (key, fn) => { const u = user(); const k = (u ? u.nid : '0') + '|' + key; return memo[k] || (memo[k] = fn(u, rng(k))); };
  const adult = u => u.age >= 18;
  const D = {};

  D.bank = () => G('bank', (u, r) => {
    const a = adult(u);
    return {
      ahli: { bank: 'البنك الأهلي المصري', type: 'حساب جاري', mask: '****' + I(r, 1000, 9999), base: a ? I(r, 90, 800) * 1000 + I(r, 0, 999) : I(r, 1, 20) * 100 },
      misr: { bank: 'بنك مصر', type: 'حساب ادخاري (USD)', mask: '****' + I(r, 1000, 9999), usd: a ? I(r, 3, 35) * 1000 : 0 },
      cib: { bank: 'البنك التجاري الدولي', type: 'حساب توفير', mask: '****' + I(r, 1000, 9999), base: a ? I(r, 25, 300) * 1000 : 0 },
      loans: !a ? [] : [{ name: 'تمويل سيارة', total: I(r, 200, 700) * 1000, left: I(r, 6, 48), paid: I(r, 20, 80) }].concat(r() > .55 ? [{ name: 'تمويل عقاري', total: I(r, 800, 2500) * 1000, left: I(r, 60, 180), paid: I(r, 5, 35) }] : []),
      cardDue: a ? I(r, 10, 90) * 100 : 0, monthly: a ? I(r, 6, 25) * 1000 : 0, growth: (I(r, 30, 180) / 10).toFixed(1), cardNo: '2026'
    };
  });
  D.balances = () => {
    const b = D.bank(), st = state(), out = Math.min(st.usdOut || 0, b.misr.usd);
    const ahli = Math.max(0, b.ahli.base - (st.spent || 0) + Math.round(out * FX)), usd = b.misr.usd - out;
    return { ahli, cib: b.cib.base, usd, total: Math.round(ahli + b.cib.base + usd * FX), banks: 1 + (b.misr.usd ? 1 : 0) + (b.cib.base ? 1 : 0) };
  };
  function pay(amount, title, o) {
    o = o || {};
    amount = Math.round(Number(amount)); if (!amount || amount <= 0) return { ok: false, err: 'مبلغ غير صحيح.' };
    const bal = D.balances().ahli;
    if (amount > bal) return { ok: false, err: 'الرصيد غير كافٍ في حسابك الجاري (المتاح ' + fmt(bal) + ' جم).' };
    const st = state(), u = user(), bk = D.bank();
    st.spent += amount; log(title, 'تم خصم ' + fmt(amount) + ' جم من الحساب الجاري');
    const rec = { id: 'R-' + refCode(u.nid + title + Date.now() + amount).replace('-', ''), t: Date.now(), kind: 'pay', title, service: o.service || title, org: o.org || '', amount, acct: bk.ahli.bank + ' ' + bk.ahli.mask, details: o.details || [], pickup: o.pickup || null, doc: o.doc || null };
    st.receipts.unshift(rec); st.receipts = st.receipts.slice(0, 80); save();
    if (!o.manual && window.Gov) setTimeout(() => window.Gov.receipt(rec.id), 350);
    return { ok: true, rec };
  }

  const PROPS = [['شقة سكنية - مدينتي - مجموعة 12', 3200000], ['قطعة أرض زراعية - محافظة المنوفية', 1800000], ['وحدة تجارية - العاصمة الإدارية الجديدة', 4500000], ['شقة مصيفية - الساحل الشمالي', 3800000], ['عقار سكني - حي المعادي', 6500000]];
  D.props = () => G('props', (u, r) => {
    if (u.age < 21) return [];
    const n = I(r, 1, 3), idx = shuffle(r, [0, 1, 2, 3, 4]).slice(0, n), minY = Math.max(2000, u.y + 21);
    return idx.map(i => ({ name: PROPS[i][0], value: Math.round(PROPS[i][1] * (.8 + r() * .5) / 10000) * 10000, ref: I(r, 100000, 999999), year: I(r, minY, Math.max(minY, NOW.getFullYear() - 1)) }));
  });
  const ORD = { m: ['الأول', 'الثاني', 'الثالث', 'الرابع'], f: ['الأولى', 'الثانية', 'الثالثة', 'الرابعة'] };
  D.family = () => G('family', (u, r) => {
    const heirs = []; let spouse = false, kids = 0;
    if (u.age >= 22 && r() < .85) { spouse = true; heirs.push(u.male ? 'الزوجة' : 'الزوج'); }
    if (spouse && u.age >= 24) { kids = I(r, 0, 4); let m = 0, f = 0; for (let i = 0; i < kids; i++) { if (r() < .5) heirs.push('الابن ' + ORD.m[m++]); else heirs.push('الابنة ' + ORD.f[f++]); } }
    if (r() < .85) heirs.push('الأم'); if (r() < .7) heirs.push('الأب');
    if (!heirs.length) heirs.push('الأم');
    return { heirs, spouse, kids, supplyCount: 1 + (spouse ? 1 : 0) + kids };
  });
  D.assets = () => { const b = D.balances(), p = D.props(); return { bank: b.total, propCount: p.length, prop: p.reduce((s, x) => s + x.value, 0) }; };

  D.supply = () => G('supply', (u, r) => ({ card: '1' + digits(r, 11), credit: I(r, 50, 300), bread: I(r, 10, 150), last: addDays(ANCHOR, -I(r, 1, 25)) }));

  D.traffic = () => G('traffic', (u, r) => {
    const L = 'أبجدرسصطعقكلمنهوي'.split(''), a = adult(u);
    const T = [['تجاوز السرعة المقررة', 300], ['عدم ربط حزام الأمان', 100], ['الانتظار في مكان ممنوع', 150], ['استخدام الهاتف أثناء القيادة', 200], ['تجاوز الإشارة الحمراء', 500]];
    const viol = []; const n = a ? I(r, 0, 3) : 0;
    for (let i = 0; i < n; i++) { const t = pick(r, T); viol.push({ id: 'V' + I(r, 100000, 999999), desc: t[0], amount: t[1], date: addDays(ANCHOR, -I(r, 5, 200)) }); }
    const issue = addDays(ANCHOR, -I(r, 200, 2500));
    return { plate: [0, 1, 2].map(() => pick(r, L)).join(' ') + ' ' + I(r, 100, 9999), viol, licNo: digits(r, 8), licIssue: issue, hasLicense: u.age >= 18 };
  });
  D.civil = () => G('civil', (u, r) => ({ issue: addDays(ANCHOR, -I(r, 100, 2000)), addr: pick(r, ['شارع ' + I(r, 1, 40) + '، حي الأمل', 'شارع ' + I(r, 1, 30) + '، المنطقة ' + pick(r, ['الأولى', 'الثانية', 'الثالثة', 'السابعة']), 'عمارة ' + I(r, 1, 90) + '، شارع النصر']) }));

  D.passport = () => G('passport', (u, r) => {
    const P = ['مطار القاهرة - مبنى 3', 'مطار دبي الدولي', 'منفذ السلوم البري', 'مطار برج العرب', 'مطار الملك خالد - الرياض', 'ميناء سفاجا'];
    const issue = addDays(ANCHOR, -I(r, 100, 1500)), moves = []; let d = I(r, 5, 40);
    for (let i = 0; i < 4; i++) { moves.push({ date: addDays(ANCHOR, -d), port: pick(r, P), type: i % 2 === 0 ? 'وصول' : 'مغادرة' }); d += I(r, 10, 70); }
    return { no: 'A' + I(r, 10000000, 99999999), issue, expiry: addYears(issue, 7), moves: u.age >= 1 ? moves : [] };
  });
  D.mil = () => G('mil', (u, r) => {
    if (!u.male) return { st: 'female' };
    if (u.age < 18) return { st: 'minor', year: u.y + 18 };
    const triple = I(r, 100, 999) + ' / ' + (u.y + 18) + ' / ' + I(r, 100, 999);
    if (u.age < 21) return { st: 'deferred', label: 'مؤجل - لم يتم الاستدعاء بعد', triple };
    const x = r();
    if (x < .65) return { st: 'done', label: 'أدى الخدمة العسكرية (إنهاء الخدمة)', triple, release: addDays(ANCHOR, -I(r, 300, 2000)) };
    if (x < .85) return { st: 'exempt', label: 'معفى نهائياً', triple };
    return { st: 'deferred', label: 'مؤجل لاستكمال الدراسة', triple };
  });

  const SUBJ = {
    primary: [['اللغة العربية', 80], ['اللغة الإنجليزية', 60], ['الرياضيات', 60], ['العلوم', 40], ['الدراسات الاجتماعية', 40]],
    prep: [['اللغة العربية', 80], ['اللغة الإنجليزية', 60], ['الرياضيات', 60], ['العلوم', 40], ['الدراسات الاجتماعية', 40]],
    sec: [['اللغة العربية', 80], ['اللغة الإنجليزية', 60], ['اللغة الأجنبية الثانية', 40], ['الرياضيات', 60], ['الفيزياء', 60], ['الكيمياء', 60]]
  };
  const gradeOf = p => p >= 85 ? 'امتياز' : p >= 75 ? 'جيد جداً' : p >= 65 ? 'جيد' : 'مقبول';
  D.edu = () => G('edu', (u, r) => {
    const defs = [['primary', 'الشهادة الابتدائية', 'الصف السادس الابتدائي', 12], ['prep', 'الشهادة الإعدادية', 'الصف الثالث الإعدادي', 15], ['sec', 'الثانوية العامة', 'الصف الثالث الثانوي', 18]];
    return defs.map(d => {
      const year = u.y + d[3], done = year < NOW.getFullYear() || (year === NOW.getFullYear() && NOW.getMonth() >= 6);
      let tm = 0, ts = 0; const rows = SUBJ[d[0]].map(s => { const sc = Math.round(s[1] * (.78 + .22 * r())); tm += s[1]; ts += sc; return { n: s[0], max: s[1], score: sc }; });
      const pct = Math.round(ts / tm * 1000) / 10;
      return { key: d[0], name: d[1], cls: d[2], year, done, rows, total: ts, max: tm, pct, grade: gradeOf(pct) };
    });
  });
  D.exam = () => G('exam', (u, r) => {
    const st = D.edu(), cur = st.find(s => !s.done) || st[2];
    return { stage: cur, seat: I(r, 100000, 999999), school: pick(r, ['مدرسة المتفوقين الثانوية', 'مدرسة النصر الثانوية', 'مدرسة الشهيد الثانوية المشتركة', 'مدرسة الأورمان الثانوية']), committee: I(r, 1, 60), hall: pick(r, ['مدرسة النصر الرسمية', 'مدرسة الجمهورية الثانوية', 'مدرسة التحرير الإعدادية']), area: pick(r, ['حي الشرق', 'حي الغرب', 'المركز', 'حي الجامعة']) + ' - شارع ' + I(r, 1, 40) };
  });

  const MAJORS = { 'الحاسبات والمعلومات': ['علوم الحاسب', 'نظم المعلومات', 'الذكاء الاصطناعي'], 'الهندسة': ['الهندسة الكهربائية', 'الهندسة المدنية', 'هندسة الميكانيكا'], 'التجارة والاقتصاد': ['المحاسبة', 'إدارة الأعمال', 'الاقتصاد'], 'الطب': ['الطب والجراحة'], 'الحقوق': ['القانون العام', 'القانون الخاص'], 'نظم معلومات الأعمال': ['نظم معلومات الأعمال'], 'العلوم': ['الفيزياء', 'الكيمياء', 'الرياضيات'], 'الآداب': ['اللغة العربية', 'التاريخ', 'علم الاجتماع'] };
  const THESES = ['تطبيقات التحول الرقمي في تحسين كفاءة الخدمات الحكومية', 'نموذج مقترح لتحليل البيانات الضخمة لدعم اتخاذ القرار المؤسسي', 'أثر التقنيات الحديثة على جودة الأداء المؤسسي في مصر', 'دراسة تحليلية لتطوير منظومة الأمن المعلوماتي للمؤسسات'];
  D.uniInfo = () => G('uniinfo', (u, r) => {
    const fac = u.faculty || '', gy = +u.gradYear || 0, ny = NOW.getFullYear(), maj = MAJORS[fac] || [fac];
    const g = pick(r, [['امتياز مع مرتبة الشرف', 85], ['جيد جداً', 75], ['جيد جداً مرتفع', 80], ['امتياز', 88]]);
    return {
      has: !!(fac && gy), level: u.degree === 'دكتوراه' ? 3 : u.degree === 'ماجستير' ? 2 : 1, uni: u.uni || 'جامعة القاهرة', faculty: fac, major: pick(r, maj), grade: g[0], gradYear: gy,
      mYear: Math.min(ny, gy + 3), pYear: Math.min(ny, gy + 7), mThesis: u.degree === 'ماجستير' && u.thesis ? u.thesis : pick(r, THESES), pThesis: u.degree === 'دكتوراه' && u.thesis ? u.thesis : pick(r, THESES),
      mGrade: pick(r, ['ممتاز', 'جيد جداً']), pGrade: 'امتياز مع مرتبة الشرف'
    };
  });
  D.uni = D.uniInfo;

  D.health = () => G('health', (u, r) => ({
    blood: pick(r, ['A+', 'B+', 'O+', 'AB+', 'A-', 'O-', 'B-', 'AB-']),
    ins: 'H-EGY-' + digits(r, 8),
    med: pick(r, [{ d: 'Concor 5mg', t: 'مرة يومياً بعد الإفطار' }, { d: 'Augmentin 1g', t: 'كل 12 ساعة لمدة أسبوع' }, { d: 'Panadol Joint', t: 'عند اللزوم' }, { d: 'Vitamin C', t: 'مرة يومياً وسط الغداء' }]),
    vac: shuffle(r, ['كورونا (جرعة تنشيطية)', 'الالتهاب الكبدي الوبائي', 'شلل الأطفال', 'الإنفلونزا الموسمية']),
    next: addDays(ANCHOR, I(r, 60, 200)), rxDate: addDays(ANCHOR, -I(r, 3, 40)),
    hosp: ['المستشفى العام', 'المستشفى الجامعي', 'مستشفى التأمين الصحي'].map(n => n + ' - ' + u.gov)
  }));

  const STK = [['البنك التجاري الدولي (CIB)', 'COMI', 92.4], ['مجموعة طلعت مصطفى (TMG)', 'TMGH', 68.2], ['بلتون القابضة', 'BTFH', 5.1], ['إي فاينانس', 'EFIH', 21.5], ['طاقة عربية', 'TAQA', 4.9]];
  const GLB = [['NVIDIA', 'NVDA', 130], ['Apple', 'AAPL', 230], ['Tesla', 'TSLA', 250]];
  D.finance = () => G('finance', (u, r) => {
    const a = adult(u), mk = (L, n, lo, hi) => shuffle(r, L).slice(0, n).map(x => { const qty = I(r, lo, hi), val = qty * x[2], pl = I(r, -60, 250) / 10; return { name: x[0], sym: x[1], price: x[2], qty, val, plPct: pl, pl: Math.round(val * pl / 100) }; });
    const egx = a ? mk(STK, 3, 100, 3000) : [], glob = a ? mk(GLB, 3, 5, 40) : [];
    const chart = []; let v = 100; for (let i = 0; i < 24; i++) { v += (r() - .42) * 6; chart.push(Math.max(60, v)); }
    return { egx, glob, egxTotal: egx.reduce((s, x) => s + x.val, 0), globTotal: glob.reduce((s, x) => s + x.val, 0), chart, taxNo: digits(r, 3) + '-' + digits(r, 3) + '-' + digits(r, 3), customsFee: I(r, 5, 30) * 100, ship: pick(r, ['طرد شخصي (معدات إلكترونية)', 'طرد شخصي (ملابس وأحذية)', 'شحنة أجهزة منزلية']) };
  });

  /* ------------------------------------------------------- واجهة المستخدم */
  const $ = (s, c) => (c || document).querySelector(s);
  function toast(msg, bad) {
    let t = $('.id-toast'); if (!t) { t = document.createElement('div'); t.className = 'id-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle('err', !!bad); void t.offsetWidth; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2800);
  }
  /* نافذة عامة: تأكيد أو نموذج. تُرجع كائن القيم أو null عند الإلغاء */
  function dialog(o) {
    return new Promise(res => {
      const prev = document.activeElement, F = o.fields || [], ov = document.createElement('div');
      ov.className = 'id-overlay open'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      const body = F.map((f, i) => {
        const id = 'dlg-' + i, lab = '<label for="' + id + '">' + esc(f.label) + '</label>';
        if (f.options) return lab + '<select id="' + id + '">' + f.options.map(x => '<option' + (x === f.value ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select><div class="ferr"></div>';
        return lab + '<input id="' + id + '" type="' + (f.type || 'text') + '" value="' + esc(f.value || '') + '"' + (f.min ? ' min="' + esc(f.min) + '"' : '') + (f.inputmode ? ' inputmode="' + f.inputmode + '"' : '') + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + ' autocomplete="off"><div class="ferr"></div>';
      }).join('');
      ov.innerHTML = '<div class="id-modal"><h2>' + esc(o.title) + '</h2>' + (o.note ? '<p class="note">' + esc(o.note) + '</p>' : '') + '<div>' + body + '</div><div class="row"><button class="button ' + (o.danger ? 'danger' : '') + '" data-ok>' + esc(o.ok || 'تأكيد') + '</button><button class="button ghost" data-no>' + esc(o.cancel || 'إلغاء') + '</button></div></div>';
      document.body.appendChild(ov);
      const els = F.map((f, i) => $('#dlg-' + i, ov));
      const close = v => { document.removeEventListener('keydown', key, true); ov.remove(); if (prev && prev.focus) prev.focus(); res(v); };
      const submit = () => {
        const vals = {}; let first = null;
        F.forEach((f, i) => { const el = els[i], v = (f.options ? el.value : toEn(el.value)).trim(); vals[f.id] = v; if (!f.test) return; const ok = f.test(v), er = el.nextElementSibling; if (er) er.textContent = ok ? '' : (f.msg || 'قيمة غير صحيحة.'); el.setAttribute('aria-invalid', String(!ok)); if (!ok && !first) first = el; });
        if (first) { first.focus(); return; } close(vals);
      };
      function key(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(null); }
        else if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); }
        else if (e.key === 'Tab') { const f = [...ov.querySelectorAll('input,select,button')]; if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
      }
      document.addEventListener('keydown', key, true);
      $('[data-ok]', ov).onclick = submit; $('[data-no]', ov).onclick = () => close(null);
      ov.addEventListener('mousedown', e => { if (e.target === ov) close(null); });
      (els[0] || $('[data-ok]', ov)).focus();
    });
  }

  /* نافذة السجل الأكاديمي (تُستخدم من صفحات التعليم العالي) */
  function academicDialog() {
    const u = user(), fac = Object.keys(MAJORS), yMin = u.y + 20, yMax = NOW.getFullYear();
    return dialog({
      title: 'السجل الأكاديمي', note: 'أدخل بياناتك الأكاديمية لإصدار الشهادات.', ok: 'حفظ',
      fields: [
        { id: 'uni', label: 'الجامعة', value: u.uni || '', test: v => v.length >= 3, msg: 'اكتب اسم الجامعة.' },
        { id: 'faculty', label: 'الكلية', options: fac, value: u.faculty },
        { id: 'gradYear', label: 'سنة التخرج', type: 'number', inputmode: 'numeric', value: u.gradYear || '', test: v => /^\d{4}$/.test(v) && +v >= yMin && +v <= yMax, msg: 'سنة غير منطقية (من ' + yMin + ' إلى ' + yMax + ').' },
        { id: 'degree', label: 'أعلى درجة علمية', options: ['بكالوريوس', 'ماجستير', 'دكتوراه'], value: u.degree },
        { id: 'thesis', label: 'عنوان الرسالة (للماجستير/الدكتوراه فقط)', value: u.thesis || '' }
      ]
    }).then(v => {
      if (!v) return false;
      if (v.degree !== 'بكالوريوس' && v.thesis.length < 10) { toast('اكتب عنوان الرسالة (10 أحرف على الأقل).', true); return false; }
      updateUser({ uni: v.uni, faculty: v.faculty, gradYear: v.gradYear, degree: v.degree, thesis: v.degree === 'بكالوريوس' ? '' : v.thesis });
      log('السجل الأكاديمي', 'تم تحديث البيانات الأكاديمية'); return true;
    });
  }
  const confirmBox = (title, note, ok, danger) => dialog({ title, note, ok, danger }).then(v => !!v);

  /* رموز QR تتجدد تلقائياً كل ساعة (عند بداية كل ساعة) ويُضمَّن رقم الساعة في محتوى الرمز */
  const hourIdx = () => Math.floor(Date.now() / 3600000), qrReg = [];
  function drawQr(r) {
    const h = hourIdx(); r.h = h;
    try { const q = qrcode(0, 'M'); q.addData(r.text + '|H' + h + '|' + refCode(r.text + '#' + h)); q.make(); r.el.innerHTML = q.createSvgTag({ cellSize: r.cell || 4, margin: 0, scalable: true }) + '<small class="qr-ttl"></small>'; r.el.setAttribute('role', 'img'); r.el.setAttribute('aria-label', 'رمز QR للتحقق يتجدد كل ساعة'); }
    catch (e) { r.el.textContent = 'QR'; }
  }
  function tickQr() {
    const h = hourIdx(), left = 3600 - Math.floor(Date.now() / 1000) % 3600, t = pad(Math.floor(left / 60)) + ':' + pad(left % 60);
    for (let i = qrReg.length - 1; i >= 0; i--) {
      const r = qrReg[i]; if (!document.contains(r.el)) { qrReg.splice(i, 1); continue; }
      if (r.h !== h) drawQr(r);
      const c = r.el.querySelector('.qr-ttl'); if (c) { c.textContent = '⟳ ' + t; c.title = 'يتجدد الرمز تلقائياً كل ساعة'; }
    }
  }
  function qr(el, text, cell) { let r = qrReg.find(x => x.el === el); if (!r) qrReg.push(r = { el }); r.text = String(text); r.cell = cell; drawQr(r); tickQr(); }
  setInterval(tickQr, 1000);
  /* يملأ كل عنصر data-qr بقيمته */
  function paintQr(root) { (root || document).querySelectorAll('[data-qr]').forEach(el => qr(el, el.getAttribute('data-qr'))); }

  /* ------------------------------------------------------- التفضيلات */
  const PK = 'idegypt:prefs', FS = [100, 112, 125]; let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(PK)) || {}; } catch (e) { }
  function applyPrefs() { const r = document.documentElement; r.dataset.theme = prefs.theme === 'dark' ? 'dark' : 'light'; r.style.fontSize = FS[prefs.fs || 0] + '%'; }
  function savePrefs() { try { localStorage.setItem(PK, JSON.stringify(prefs)); } catch (e) { } applyPrefs(); }
  const toggleTheme = () => { prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark'; savePrefs(); return prefs.theme; };
  const cycleFont = () => { prefs.fs = ((prefs.fs || 0) + 1) % FS.length; savePrefs(); };
  applyPrefs();

  /* ------------------------------------------------------- الأيقونات والخدمات */
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-6h6v6"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    book: '<path d="M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 0 2 2h14"/>', cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/>',
    pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>', bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/>',
    scale: '<path d="M12 3v18M6 21h12M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>', cart: '<path d="M3 4h2l2.5 11h10L20 7H6.5"/><path d="M9 20h.01M17 20h.01"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><path d="M16 14h2"/>',
    logout: '<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 8l5 4-5 4M21 12H9"/>', chev: '<path d="M15 6l-6 6 6 6"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
  };
  const icon = (n, cls) => '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true">' + ICONS[n] + '</svg>';
  const SERVICES = [
    { t: 'وزارة الداخلية', i: '', ic: 'shield', c: '#f43f5e', l: [['interior.html', 'المرور والأحوال المدنية'], ['passports.html', 'الجوازات والهجرة والخارجية'], ['defense.html', 'التجنيد والتعبئة']] },
    { t: 'وزارة التربية والتعليم', i: '', ic: 'book', c: '#38bdf8', l: [['edu-basic.html', 'الشهادات والخدمات التعليمية'], ['edu-basic.html#transfer', 'التحويل من مدرسة لمدرسة'], ['edu-basic.html#abroad', 'العائدون من الخارج (معادلة)'], ['edu-exams.html', 'أرقام الجلوس والنتائج']] },
    { t: 'التعليم العالي والبحث العلمي', i: '', ic: 'cap', c: '#2dd4bf', l: [['uni-bachelor.html', 'شهادة البكالوريوس / الليسانس'], ['uni-masters.html', 'دراسات الماجستير'], ['uni-phd.html', 'الدكتوراه'], ['uni-international.html', 'الطلاب الوافدون من الخارج']] },
    { t: 'وزارة الصحة', i: '', ic: 'pulse', c: '#a78bfa', l: [['health.html#records', 'الملف الطبي والروشتات الرقمية'], ['health.html#insurance', 'التأمين الصحي الشامل'], ['health.html#booking', 'حجز الكشوفات والعيادات'], ['health.html#services', 'الخدمات الطبية']] },
    { t: 'المال والاستثمار', i: '', ic: 'bank', c: '#a3e635', l: [['banks.html', 'البنوك والحسابات'], ['finance.html#tax', 'الضرائب وملفات الشركات'], ['finance.html#customs', 'الجمارك والإفراج عن الشحنات']] },
    { t: 'وزارة العدل', i: '', ic: 'scale', c: '#fb923c', l: [['justice.html', 'الشهر العقاري والتوثيق'], ['inheritance.html', 'حصر الورثة والتركات']] },
    { t: 'التموين والتجارة الداخلية', i: '🛒', ic: 'cart', c: '#22c55e', l: [['supply.html', 'بطاقة التموين والدعم']] },
    { t: 'المرافق', i: '', ic: 'bolt', c: '#facc15', l: [['utilities.html', 'الكهرباء والمياه والغاز والإنترنت']] },
    { t: 'محفظتك الرقمية', i: '', ic: 'wallet', c: '#f472b6', f: 1, l: [['wallet.html', 'البطاقة والرخصة وشهادة الميلاد'], ['wallet.html#receipts', 'الإيصالات'], ['wallet.html#appts', 'المواعيد والاستلام']] }
  ];


  /* ------------------------------------------------------- الهيكل */
  const LOGO = 'assets/img/logo-digitals.svg', MARK = LOGO;
  const tools = () => '<button class="icon-btn" id="fsBtn" type="button" title="حجم الخط" aria-label="تغيير حجم الخط">AA</button><button class="icon-btn" id="themeBtn" type="button" title="الوضع الفاتح / الداكن" aria-label="تبديل الوضع الفاتح والداكن">' + icon(prefs.theme === 'dark' ? 'moon' : 'sun') + '</button>';
  function bindTools() {
    const f = $('#fsBtn'), t = $('#themeBtn');
    if (f) f.onclick = () => { cycleFont(); toast('تم تغيير حجم الخط'); };
    if (t) t.onclick = () => { t.innerHTML = icon(toggleTheme() === 'light' ? 'sun' : 'moon'); };
  }
  function sidebar() {
    const cur = location.pathname.split('/').pop() || 'index.html', hash = location.hash, file = x => x.split('#')[0];
    let h = '<aside class="side" id="side" aria-label="القائمة الجانبية"><a class="sb-brand" href="index.html"><img src="' + LOGO + '" alt=""><span><b>Digitals EGYPT</b><small>هويتك الرقمية المتكاملة</small></span></a><nav aria-label="الوزارات والخدمات">';
    h += '<a class="sb-item' + (cur === 'index.html' ? ' active' : '') + '" href="index.html"' + (cur === 'index.html' ? ' aria-current="page"' : '') + '>' + icon('home') + '<span>الرئيسية</span></a>';
    SERVICES.forEach((s, i) => {
      if (s.l.length === 1) { h += '<a class="sb-item' + (cur === file(s.l[0][0]) ? ' active' : '') + '" href="' + s.l[0][0] + '">' + icon(s.ic) + '<span>' + s.t + '</span></a>'; return; }
      const open = s.l.some(x => file(x[0]) === cur);
      h += '<button type="button" class="sb-item' + (open ? ' active' : '') + '" aria-expanded="' + open + '" aria-controls="g' + i + '">' + icon(s.ic) + '<span>' + s.t + '</span>' + icon('chev', 'chev') + '</button><div class="sb-sub' + (open ? ' open' : '') + '" id="g' + i + '">' +
        s.l.map(x => { const hh = x[0].split('#')[1], act = file(x[0]) === cur && (!hh || '#' + hh === hash); return '<a href="' + x[0] + '"' + (act ? ' class="active" aria-current="page"' : '') + '>' + x[1] + '</a>'; }).join('') + '</div>';
    });
    return h + '</nav><button type="button" class="sb-item sb-out" id="logoutBtn">' + icon('logout') + '<span>تسجيل الخروج</span></button></aside><div class="scrim" id="scrim"></div>';
  }
  function shell(u) {
    const b = document.body; b.classList.add('shell');
    b.insertAdjacentHTML('afterbegin', '<a class="skip" href="#main">تخطي إلى المحتوى</a>' + sidebar() + '<div class="topbar"><button class="icon-btn menu" id="menuBtn" type="button" aria-controls="side" aria-expanded="false" aria-label="فتح القائمة">' + icon('menu') + '</button><span class="who">مرحباً، <b>' + esc(u.first) + '</b></span><span class="grow"></span>' + tools() + '</div>');
    const side = $('#side'), scrim = $('#scrim'), mb = $('#menuBtn');
    const setOpen = o => { side.classList.toggle('open', o); scrim.classList.toggle('open', o); mb.setAttribute('aria-expanded', String(o)); };
    mb.onclick = () => setOpen(!side.classList.contains('open')); scrim.onclick = () => setOpen(false);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
    side.addEventListener('click', e => {
      const g = e.target.closest('[aria-controls^=g]');
      if (g) { const o = g.getAttribute('aria-expanded') !== 'true'; g.setAttribute('aria-expanded', String(o)); $('#' + g.getAttribute('aria-controls')).classList.toggle('open', o); return; }
      if (e.target.closest('a')) setOpen(false);
    });
    const lo = $('#logoutBtn'); lo.onclick = () => confirmBox('تسجيل الخروج', 'هل تريد تسجيل الخروج من المنصة؟ بياناتك تبقى محفوظة على هذا الجهاز.', 'خروج').then(ok => ok && logout());
    bindTools();
  }
  function publicHeader() {
    document.body.insertAdjacentHTML('afterbegin', '<a class="skip" href="#main">تخطي إلى المحتوى</a><header class="site-header"><div class="in"><a class="brand" href="index.html"><img class="logo-mark" src="' + MARK + '" alt=""><span>Digitals EGYPT</span></a><nav class="nav" aria-label="القائمة الرئيسية">' + tools() + '<a class="button ghost sm" href="index.html">الرئيسية</a></nav></div></header>');
    bindTools();
  }
  function build(o) {
    const u = user();
    if (u) shell(u); else if (!o.custom) publicHeader();
    if (u || !o.custom) document.body.insertAdjacentHTML('beforeend', '<footer class="site-footer">&copy; ' + NOW.getFullYear() + ' Digitals EGYPT — المركز الوطني للتحكم (نموذج تجريبي)</footer>');
    if (!document.querySelector('link[rel~=icon]')) document.head.insertAdjacentHTML('beforeend', '<link rel="icon" href="assets/img/favicon.png">');
    paintQr();
  }
  function ready(fn, o) {
    o = o || {};
    const go = () => {
      if (!o.public && !user()) { location.replace('index.html'); return; }
      build(o); if (fn) fn(user(), D);
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
  }

  window.ID = { SERVICES, icon, toggleTheme, cycleFont, bindTools, tools, ready, user, state, save, log, pay, startLogin, resendOtp, verifyOtp, otpInfo, normPhone, validPhone, maskPhone, hourIdx, addUser, updateUser, academicDialog, demo, logout, wipeUser, parseNid, validName, normName, D, FX, dialog, confirm: confirmBox, toast, qr, paintQr, esc, toEn, fmt, fmtDate, addDays, addYears, refCode, hash, rng, I, pick, GOV, NOW, ANCHOR, DEMO, LOGO };
})();
