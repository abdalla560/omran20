/* ==========================================================================
   Digitals EGYPT — وحدة الخدمات الحكومية المشتركة
   الإيصالات والطباعة • مواعيد الاستلام والحجز • متابعة الطلبات • مُشغّل الخدمات
   ========================================================================== */
(function () {
  'use strict';
  const e = ID.esc, fmt = ID.fmt, pad = n => String(n).padStart(2, '0');
  const $ = (s, c) => (c || document).querySelector(s);
  const dt = t => { const d = new Date(t); return ID.fmtDate(d) + ' - ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const DAYN = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const TIMES = ['09:00 ص', '10:00 ص', '11:00 ص', '12:00 م', '01:00 م', '02:00 م'];
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const fromIso = s => { const p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const dayLabel = s => { const d = fromIso(s); return DAYN[d.getDay()] + ' ' + ID.fmtDate(d); };
  const LOGO = 'assets/img/logo-digitals.svg';
  const ORGNAME = 'Digitals EGYPT — المركز الوطني للتحكم';

  /* ------------------------------------------------------------- نوافذ وطباعة */
  function modal(html, cls) {
    const prev = document.activeElement, ov = document.createElement('div');
    ov.className = 'id-overlay open'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="id-modal rc ' + (cls || '') + '">' + html + '</div>';
    document.body.appendChild(ov);
    const close = () => { document.removeEventListener('keydown', key, true); ov.remove(); if (prev && prev.focus) prev.focus(); };
    function key(ev) { if (ev.key === 'Escape') { ev.preventDefault(); close(); } }
    document.addEventListener('keydown', key, true);
    ov.addEventListener('mousedown', ev => { if (ev.target === ov) close(); });
    ID.paintQr(ov);
    return { el: ov, box: ov.firstChild, close };
  }
  function printHtml(html) {
    let r = document.getElementById('printRoot');
    if (!r) { r = document.createElement('div'); r.id = 'printRoot'; document.body.appendChild(r); }
    r.innerHTML = html; ID.paintQr(r);
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); r.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 250);
  }
  const tbl = rows => '<table class="rc-tb"><tbody>' + rows.filter(Boolean).map(r => '<tr><th>' + e(r[0]) + '</th><td>' + e(r[1]) + '</td></tr>').join('') + '</tbody></table>';
  const qrBox = txt => '<div class="qr" data-qr="' + e(txt) + '"></div>';
  const head = (title, sub) => '<div class="rc-h"><img src="' + LOGO + '" alt=""><div><b>جمهورية مصر العربية</b><small>' + ORGNAME + '</small></div><div class="rc-t">' + e(title) + (sub ? '<small>' + e(sub) + '</small>' : '') + '</div></div>';

  /* ------------------------------------------------------------- المواعيد */
  function workDays(skip, n) {
    const out = [], d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + skip);
    while (out.length < n) { const w = d.getDay(); if (w !== 5 && w !== 6) out.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return out;
  }
  function slotFree(place, date, time) {
    if (ID.hash(place + date + time) % 6 === 0) return false;
    return !ID.state().appointments.some(a => a.date === date && a.time === time);
  }
  function addAppt(a) {
    const st = ID.state(); a.id = a.id || 'A-' + ID.refCode(ID.user().nid + a.title + a.date + a.time).replace('-', ''); a.t = Date.now();
    st.appointments.push(a); ID.log(a.mode === 'visit' ? 'حجز موعد' : 'حجز موعد استلام', a.title + ' - ' + dayLabel(a.date) + ' ' + a.time); ID.save(); return a;
  }
  function apptPaper(a) {
    const u = ID.user(), visit = a.mode === 'visit';
    return '<div class="rcpt">' + head(visit ? 'تذكرة حجز موعد' : 'ورقة موعد استلام', 'رقم الحجز: ' + a.id) +
      '<div class="rc-status paid">✔ تم تأكيد الحجز</div>' +
      tbl([['اسم المواطن', u.name], ['الرقم القومي', u.nid], [visit ? 'الغرض من الموعد' : 'المطلوب استلامه', a.what || a.title], a.clinic ? ['العيادة / التخصص', a.clinic] : null, a.doctor ? ['الطبيب', a.doctor] : null, [visit ? 'مكان الحضور' : 'جهة الاستلام', a.place], ['يوم الموعد', dayLabel(a.date)], ['الساعة', a.time], a.queue ? ['رقم الدور', String(a.queue)] : null, a.ref ? ['مرتبط بإيصال رقم', a.ref] : null]) +
      '<div class="rc-note"><b>المطلوب عند الحضور:</b> ' + e(a.docs || 'أصل بطاقة الرقم القومي' + (a.ref ? ' + الإيصال المطبوع' : '')) + '. يُرجى الحضور قبل الموعد بـ 15 دقيقة. ' + (a.note ? e(a.note) : '') + '</div>' +
      '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|APPT|' + a.id) + '<p>صادر إلكترونياً من منصة Digitals EGYPT — نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>';
  }
  function apptModal(a) {
    const m = modal('<div class="rc-scroll">' + apptPaper(a) + '</div><div class="row no-print"><button class="button" data-p> طباعة الورقة</button><button class="button ghost" data-x>إغلاق</button></div>');
    $('[data-p]', m.el).onclick = () => printHtml(apptPaper(a)); $('[data-x]', m.el).onclick = m.close;
  }
  /* مربع حجز موعد مستقل: اختيار التاريخ والوقت (+ عيادة/طبيب اختيارياً) */
  function bookDialog(o) {
    return new Promise(res => {
      const days = workDays(o.skip || 1, 14), place = o.place;
      const fieldsHtml = (o.extra || []).map((f, i) => '<label for="bk-x' + i + '">' + e(f.label) + '</label><select id="bk-x' + i + '">' + f.options.map(x => '<option>' + e(x) + '</option>').join('') + '</select>').join('');
      const m = modal('<h2>' + e(o.title) + '</h2><p class="note">' + e(place) + '</p>' + fieldsHtml +
        '<label for="bk-d">اليوم</label><select id="bk-d">' + days.map(d => '<option value="' + iso(d) + '">' + DAYN[d.getDay()] + ' ' + ID.fmtDate(d) + '</option>').join('') + '</select>' +
        '<label for="bk-t">الساعة</label><select id="bk-t"></select><div class="ferr" id="bk-e"></div>' +
        '<div class="row"><button class="button" data-ok>تأكيد الحجز</button><button class="button ghost" data-no>إلغاء</button></div>', '');
      const sd = $('#bk-d', m.el), stt = $('#bk-t', m.el);
      const fill = () => { stt.innerHTML = TIMES.map(t => { const f = slotFree(place, sd.value, t); return '<option value="' + t + '"' + (f ? '' : ' disabled') + '>' + t + (f ? '' : ' (محجوز)') + '</option>'; }).join(''); const first = [...stt.options].find(x => !x.disabled); if (first) stt.value = first.value; };
      sd.onchange = fill; fill();
      let done = false; const fin = v => { if (done) return; done = true; m.close(); res(v); };
      m.el.addEventListener('mousedown', ev => { if (ev.target === m.el) fin(null); });
      $('[data-no]', m.el).onclick = () => fin(null);
      $('[data-ok]', m.el).onclick = () => {
        if (!stt.value || stt.selectedOptions[0].disabled) { $('#bk-e', m.el).textContent = 'لا توجد مواعيد متاحة في هذا اليوم، اختر يوماً آخر.'; return; }
        fin({ date: sd.value, time: stt.value, extra: (o.extra || []).map((f, i) => $('#bk-x' + i, m.el).value) });
      };
    });
  }

  /* ------------------------------------------------------------- الإيصال */
  const recById = id => ID.state().receipts.find(r => r.id === id);
  function pickInfo(rec) {
    const p = rec.pickup; if (!p) return '';
    const visit = p.mode === 'visit', a = rec.appt;
    let h = '<div class="rc-pick"><h4>' + (visit ? ' بيانات الحضور' : ' بيانات الاستلام') + '</h4>' + tbl([
      [visit ? 'الغرض' : 'المطلوب استلامه', p.what], [visit ? 'مكان الحضور' : 'جهة الاستلام', p.place],
      [visit ? 'المستندات المطلوبة' : 'المستندات المطلوبة عند الاستلام', p.docs || 'أصل بطاقة الرقم القومي + هذا الإيصال المطبوع'],
      p.days ? ['مدة التجهيز', 'خلال ' + p.days + ' أيام عمل'] : null,
      a ? ['موعدك', dayLabel(a.date) + ' - الساعة ' + a.time] : ['موعدك', 'لم يُحجز بعد - احجزه من محفظتي الرقمية']]) + '</div>';
    return h;
  }
  function rcptPaper(rec) {
    const u = ID.user(), free = !(rec.amount > 0);
    return '<div class="rcpt">' + head(free ? 'إيصال تقديم طلب' : 'إيصال سداد إلكتروني', 'رقم الإيصال: ' + rec.id) +
      '<div class="rc-status ' + (free ? 'req' : 'paid') + '">' + (free ? '✔ تم تقديم الطلب' : '✔ تم السداد') + '</div>' +
      tbl([['التاريخ والوقت', dt(rec.t)], ['اسم المواطن', u.name], ['الرقم القومي', u.nid], ['الخدمة', rec.service], rec.org ? ['الجهة', rec.org] : null,
        ['المبلغ المسدد', free ? 'بدون رسوم' : fmt(rec.amount) + ' جم'], ['طريقة الدفع', free ? '—' : rec.acct], ['حالة الدفع', free ? 'لا يوجد مبلغ مستحق' : 'مدفوع بالكامل']].concat((rec.details || []).map(d => [d[0], d[1]]))) +
      pickInfo(rec) +
      '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|RCPT|' + rec.id) + '<p>صادر إلكترونياً من منصة Digitals EGYPT — نموذج تجريبي لا يُعتد به رسمياً. احتفظ بهذه الورقة وأحضرها عند الاستلام.</p></div></div>';
  }
  function receipt(x) {
    const rec = typeof x === 'string' ? recById(x) : x; if (!rec) return;
    const m = modal(''); let more = '';
    const render = () => {
      const p = rec.pickup, need = p && !rec.appt, visit = p && p.mode === 'visit';
      m.box.innerHTML = '<div class="rc-scroll">' + rcptPaper(rec) + '</div>' +
        (need ? '<div class="rc-book no-print"><b>' + (visit ? 'احجز موعد الحضور' : 'احجز موعد الاستلام') + '</b><p class="muted">اختر اليوم والساعة المناسبين وسيُضاف الموعد إلى «محفظتي الرقمية».</p><button class="button sm" data-bk> حجز الموعد الآن</button></div>' : '') +
        '<div class="row no-print"><button class="button" data-p>🖨️ طباعة الإيصال</button>' + (rec.doc && Gov.DOCS[rec.doc.key] ? '<button class="button green" data-d> طباعة المستند</button>' : '') + '<button class="button ghost" data-x>إغلاق</button></div>';
      ID.paintQr(m.box);
      $('[data-p]', m.box).onclick = () => printHtml(rcptPaper(rec));
      const d = $('[data-d]', m.box); if (d) d.onclick = () => printHtml(Gov.DOCS[rec.doc.key](rec.doc.data || {}, ID.user(), rec));
      $('[data-x]', m.box).onclick = m.close;
      const b = $('[data-bk]', m.box); if (b) b.onclick = () => bookDialog({ title: visit ? 'حجز موعد الحضور' : 'حجز موعد الاستلام', place: p.place, skip: Math.max(1, p.days || 1) }).then(v => {
        if (!v) return;
        const a = addAppt({ kind: 'pickup', mode: p.mode || 'pickup', title: (visit ? '' : 'استلام ') + p.what, what: p.what, place: p.place, date: v.date, time: v.time, ref: rec.id, docs: p.docs });
        rec.appt = { id: a.id, date: a.date, time: a.time }; ID.save(); ID.toast('تم حجز الموعد وإضافته لمحفظتك'); render();
      });
    };
    render(); return m;
  }
  function freeRec(def, details, pickup, doc) {
    const st = ID.state(), u = ID.user();
    const rec = { id: 'Q-' + ID.refCode(u.nid + def.t + Date.now()).replace('-', ''), t: Date.now(), kind: 'free', title: def.t, service: def.t, org: def.org || '', amount: 0, acct: '', details, pickup: pickup || null, doc: doc || null };
    st.receipts.unshift(rec); st.receipts = st.receipts.slice(0, 80); ID.save(); ID.log(def.t, 'تم تقديم الطلب'); return rec;
  }

  /* ------------------------------------------------------------- الطلبات */
  const STEPS = [['تم استلام الطلب', 0], ['قيد المراجعة', 1], ['جاري التنفيذ', 3], ['مكتمل', 6]];
  function addRequest(def, rec, steps) {
    const st = ID.state(), u = ID.user();
    st.requests.unshift({ id: 'T-' + ID.refCode(u.nid + def.t + Date.now()).replace('-', ''), t: Date.now(), title: def.t, org: def.org || '', g: def.cat || '', rec: rec && rec.id, pickup: !!def.pickup, steps: steps || null });
    st.requests = st.requests.slice(0, 60); ID.save();
  }
  function reqStage(r) { const m = (Date.now() - r.t) / 60000, S = r.steps || STEPS.map(x => x[0]); let i = 0; const th = [0, 1, 3, 6, 9, 12]; for (let k = 0; k < S.length; k++) if (m >= th[k]) i = k; return i; }
  function reqLabel(r) { const S = r.steps || STEPS.map(x => x[0]), i = reqStage(r); return i === S.length - 1 ? (r.steps ? S[i] : (r.pickup ? 'جاهز للاستلام' : 'تم الإصدار')) : S[i]; }
  function requestsList(el, filter) {
    const st = ID.state(); let L = st.requests; if (filter) L = L.filter(filter);
    el.innerHTML = L.length ? L.slice(0, 12).map(r => {
      const S = r.steps || STEPS.map(x => x[0]), i = reqStage(r), lab = reqLabel(r), fin = i === S.length - 1;
      return '<div class="req"><div class="req-h"><div><b>' + e(r.title) + '</b><br><small>' + e(r.org) + ' • رقم ' + r.id + ' • ' + ID.fmtDate(new Date(r.t)) + '</small></div><span class="pill ' + (fin ? 'ok' : 'warn') + '">' + e(lab) + '</span></div>' +
        '<div class="req-p">' + S.map((s, k) => '<i class="' + (k <= i ? 'on' : '') + '" title="' + e(s) + '"></i>').join('') + '</div>' +
        (r.rec ? '<button class="button ghost sm" data-rc="' + r.rec + '">عرض / طباعة الإيصال</button>' : '') + '</div>';
    }).join('') : '<p class="muted">لا توجد طلبات بعد.</p>';
    el.onclick = ev => { const b = ev.target.closest('[data-rc]'); if (b) receipt(b.dataset.rc); };
  }

  /* ------------------------------------------------------------- مُشغّل الخدمة العام */
  async function run(def, ctx) {
    const u = ID.user(); ctx = ctx || {};
    if (def.req) { const msg = def.req(u, ID.D); if (msg) { ID.toast(msg, true); return; } }
    const F = (def.fields || []).map(f => typeof f === 'function' ? f(u) : f);
    const fee0 = def.fee || 0; let vals = {};
    if (F.length) {
      vals = await ID.dialog({ title: def.t, note: def.d + (def.calc ? '' : (fee0 ? ' • الرسوم: ' + fmt(fee0) + ' جم' : ' • الخدمة مجانية')), fields: F, ok: (fee0 || def.calc) ? 'متابعة' : 'تقديم الطلب' });
      if (!vals) return;
    }
    const amount = def.calc ? def.calc(vals, u) : fee0;
    if (!F.length || amount > 0) {
      const ok = await ID.confirm(def.t, amount > 0 ? 'سيتم خصم ' + fmt(amount) + ' جم من حسابك الجاري مقابل هذه الخدمة.' : def.d + ' — الخدمة مجانية.', amount > 0 ? 'ادفع الآن' : 'تقديم الطلب');
      if (!ok) return;
    }
    const details = F.map(f => (f.hide || f.pwd) ? null : [f.label, vals[f.id]]).filter(Boolean).concat(def.extra ? def.extra(vals, u) : []);
    let pk = null;
    if (def.pickup) { pk = Object.assign({}, def.pickup); if (typeof pk.place === 'function') pk.place = pk.place(u, vals); if (typeof pk.what === 'function') pk.what = pk.what(u, vals); }
    const doc = def.doc ? { key: def.doc, data: (def.docData ? def.docData(vals, u) : vals) } : null;
    let rec;
    if (amount > 0) {
      const r = ID.pay(amount, def.t, { service: def.t, org: def.org, details, pickup: pk, doc, manual: true });
      if (!r.ok) { ID.toast(r.err, true); return; } rec = r.rec;
    } else rec = freeRec(def, details, pk, doc);
    if (def.after) def.after(vals, rec, u);
    if (!def.noReq) addRequest(def, rec, def.steps);
    ID.save(); receipt(rec.id); if (ctx.refresh) ctx.refresh();
  }

  /* ------------------------------------------------------------- شبكة الخدمات */
  function grid(el, list, ctx) {
    ctx = ctx || {}; const groups = [];
    list.forEach(d => { let g = groups.find(x => x.n === d.g); if (!g) groups.push(g = { n: d.g, l: [] }); g.l.push(d); });
    el.innerHTML = '<input class="svc-search" type="search" placeholder="ابحث في الخدمات ..." aria-label="بحث في الخدمات">' + groups.map(g =>
      '<h3 class="section-title">' + e(g.n) + '</h3><div class="grid svc-grid" style="--min:260px">' + g.l.map(d =>
        '<article class="svc-card" data-k="' + e(d.t + ' ' + d.d) + '"><div class="top"><h4>' + e(d.t) + '</h4><span class="fee ' + ((d.fee || d.calc) ? '' : 'free') + '">' + (d.calc ? 'حسب الاختيار' : d.fee ? fmt(d.fee) + ' جم' : 'مجاني') + '</span></div><p>' + e(d.d) + '</p>' +
        '<div class="meta"><span class="tag ' + (d.pickup ? 'pk' : 'dg') + '">' + (d.pickup ? (d.pickup.mode === 'visit' ? '📅 بموعد حضور' : '📦 استلام من الجهة') : '⚡ رقمي فوري') + '</span></div>' +
        '<button class="button sm" data-s="' + d.id + '">تقديم الطلب</button></article>').join('') + '</div>').join('');
    el.onclick = ev => { const b = ev.target.closest('[data-s]'); if (!b) return; const d = list.find(x => x.id === b.dataset.s); if (d) (d.run ? d.run(d, ctx) : run(d, ctx)); };
    const s = $('.svc-search', el);
    s.oninput = () => { const q = s.value.trim(); el.querySelectorAll('.svc-card').forEach(c => { c.hidden = q && c.dataset.k.indexOf(q) < 0; }); el.querySelectorAll('.svc-grid').forEach(g => { const h = g.previousElementSibling; const any = [...g.children].some(c => !c.hidden); g.hidden = !any; if (h) h.hidden = !any; }); };
  }

  /* ------------------------------------------------------------- تبويبات */
  function tabs(root, map, def) {
    const btn = {}; Object.keys(map).forEach(k => { btn[k] = $('#t-' + k, root) || document.getElementById('t-' + k); });
    const show = k => { if (!map[k]) k = def || Object.keys(map)[0]; Object.keys(map).forEach(x => { const p = document.getElementById('p-' + x); if (p) p.hidden = x !== k; if (btn[x]) btn[x].setAttribute('aria-selected', String(x === k)); }); if (map[k] && map[k].on) map[k].on(); };
    Object.keys(map).forEach(k => { if (btn[k]) btn[k].onclick = () => { show(k); history.replaceState(null, '', '#' + k); }; });
    const h = location.hash.slice(1); show(map[h] ? h : (def || Object.keys(map)[0]));
    window.addEventListener('hashchange', () => { const h2 = location.hash.slice(1); if (map[h2]) show(h2); });
    return show;
  }

  /* ------------------------------------------------------------- الوثائق الشخصية (بطاقة / رخصة / ميلاد) */
  const docs = () => { const st = ID.state(); ['id', 'license', 'birth', 'passport', 'ins'].forEach(k => { if (!st.docs[k]) st.docs[k] = {}; }); return st.docs; };
  const idData = u => { const civ = ID.D.civil(), d = docs().id, issue = d.renewed ? new Date(d.renewed) : civ.issue; return { issue, exp: ID.addYears(issue, 7), addr: d.addr || civ.addr, job: d.job || 'غير مسجل', marital: d.marital || 'غير مسجل', pending: d.renewed && (Date.now() - d.renewed) < 5 * 864e5 }; };
  const licData = u => { const tr = ID.D.traffic(), st = ID.state(), d = docs().license, issue = st.licRenewed ? new Date(st.licRenewed) : tr.licIssue; return { has: tr.hasLicense, no: tr.licNo, issue, exp: ID.addYears(issue, 10), cls: d.cls || 'خاصة - ملاكي (B-01)', addr: d.addr || ID.D.civil().addr, blood: d.blood || ID.D.health().blood, job: d.job || 'غير مسجل', pending: st.licRenewed && (Date.now() - st.licRenewed) < 5 * 864e5 }; };
  const birthData = u => { const d = docs().birth; return { name: d.name || u.name, gov: d.gov || u.gov, issued: d.issued ? new Date(d.issued) : ID.NOW, dob: new Date(u.y, u.m - 1, u.d) }; };
  const ppData = u => { const p = ID.D.passport(), d = docs().passport, issue = d.renewed ? new Date(d.renewed) : p.issue; return { no: d.no || p.no, issue, expiry: ID.addYears(issue, 7), moves: p.moves, pending: d.renewed && (Date.now() - d.renewed) < 5 * 864e5 }; };
  const insData = u => { const h = ID.D.health(), d = docs().ins; return { no: h.ins, exp: d.renewed ? ID.addYears(new Date(d.renewed), 1) : ID.addYears(ID.ANCHOR, 1) }; };

  const sil = '<svg viewBox="0 0 70 80" aria-hidden="true" width="64" height="72"><circle cx="35" cy="28" r="15" fill="#7d8b96"/><path d="M6 80c2-26 16-32 29-32s27 6 29 32z" fill="#7d8b96"/></svg>';
  const DOCS = {
    id: (d, u) => { const x = idData(u); return '<div class="rcpt card-doc">' + head('بطاقة تحقيق الشخصية', 'الرقم القومي ' + u.nid) + '<div class="cd-body"><div class="cd-ph">' + sil + '</div><div>' + tbl([['الاسم', u.name], ['الرقم القومي', u.nid], ['تاريخ الميلاد', ID.fmtDate(new Date(u.y, u.m - 1, u.d))], ['النوع', u.gender], ['محل الميلاد', u.gov], ['العنوان', x.addr], ['الحالة الاجتماعية', x.marital], ['المهنة', x.job], ['تاريخ الإصدار', ID.fmtDate(x.issue)], ['تاريخ الانتهاء', ID.fmtDate(x.exp)]]) + '</div></div><div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|ID|' + ID.refCode(u.nid + 'idc')) + '<p>صورة مطبوعة للاستعراض فقط — نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>'; },
    license: (d, u) => { const x = licData(u); return '<div class="rcpt card-doc">' + head('رخصة قيادة', 'رقم الرخصة ' + x.no) + '<div class="cd-body"><div class="cd-ph">' + sil + '</div><div>' + tbl([['الاسم', u.name], ['رقم الرخصة', x.no], ['الفئة', x.cls], ['العنوان', x.addr], ['فصيلة الدم', x.blood], ['تاريخ الإصدار', ID.fmtDate(x.issue)], ['تاريخ الانتهاء', ID.fmtDate(x.exp)], ['الحالة', x.exp < ID.NOW ? 'منتهية' : 'سارية']]) + '</div></div><div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|LIC|' + ID.refCode(u.nid + x.no)) + '<p>صورة مطبوعة للاستعراض فقط — نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>'; },
    birth: (d, u) => { const x = birthData(u); return '<div class="rcpt">' + head('شهادة ميلاد مميكنة', 'تاريخ الاستخراج ' + ID.fmtDate(x.issued)) + tbl([['الاسم', x.name], ['الرقم القومي', u.nid], ['تاريخ الميلاد', ID.fmtDate(x.dob)], ['النوع', u.gender], ['محل الميلاد', x.gov + ' - جمهورية مصر العربية'], ['الجنسية', 'مصري']]) + '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|BIRTH|' + ID.refCode(u.nid + 'birth' + (docs().birth.issued || 0))) + '<p>نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>'; },
    criminal: (d, u, rec) => '<div class="rcpt">' + head('صحيفة الحالة الجنائية', 'الغرض: ' + (d.purpose || 'عام')) + tbl([['الاسم', u.name], ['الرقم القومي', u.nid], ['الجهة الطالبة', d.purpose || 'عام'], ['النتيجة', 'لا توجد سوابق جنائية مسجلة'], ['تاريخ الإصدار', dt(Date.now())], ['صالحة حتى', ID.fmtDate(ID.addDays(new Date(), 90))]]) + '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|CRIM|' + ID.refCode(u.nid + 'crim' + (rec ? rec.id : ''))) + '<p>نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>',
    indiv: (d, u) => '<div class="rcpt">' + head('بيان قيد فردي') + tbl([['الاسم', u.name], ['الرقم القومي', u.nid], ['تاريخ الميلاد', ID.fmtDate(new Date(u.y, u.m - 1, u.d))], ['النوع', u.gender], ['الديانة', 'مسلم'], ['محل الميلاد', u.gov], ['الحالة الاجتماعية', idData(u).marital], ['العنوان', idData(u).addr]]) + '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|INDIV|' + ID.refCode(u.nid + 'indiv')) + '<p>نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>',
    family: (d, u) => { const F = ID.D.family(); return '<div class="rcpt">' + head('بيان قيد عائلي') + tbl([['رب الأسرة', u.name], ['الرقم القومي', u.nid], ['العنوان', idData(u).addr]]) + '<h4 class="rc-sub">أفراد الأسرة</h4>' + tbl(F.heirs.map(h => [h, 'مقيد بالسجل المدني - ' + u.gov])) + '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|FAMILY|' + ID.refCode(u.nid + 'family')) + '<p>نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>'; },
    vehcert: (d, u) => { const tr = ID.D.traffic(); return '<div class="rcpt">' + head('شهادة بيانات مركبة') + tbl([['المالك', u.name], ['رقم اللوحة', tr.plate], ['نوع المركبة', 'ملاكي'], ['حالة الترخيص', 'ساري'], ['المخالفات غير المسددة', String(tr.viol.filter(v => !ID.state().paid[v.id]).length)]]) + '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|VEH|' + ID.refCode(u.nid + tr.plate)) + '<p>نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>'; },
    moves: (d, u) => { const p = ppData(u); return '<div class="rcpt">' + head('شهادة بيان تحركات') + tbl([['الاسم', u.name], ['رقم الجواز', p.no]]) + '<h4 class="rc-sub">آخر التحركات</h4>' + tbl(p.moves.map(m => [ID.fmtDate(m.date) + ' - ' + m.type, m.port])) + '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|MOVES|' + ID.refCode(u.nid + 'mv')) + '<p>نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>'; },
    permit: (d, u) => '<div class="rcpt">' + head('إذن سفر لقاصر') + tbl([['ولي الأمر', u.name], ['الرقم القومي لولي الأمر', u.nid], ['القاصر', d.child || '—'], ['الرقم القومي للقاصر', d.nid || '—'], ['جهة السفر', d.country || '—'], ['تاريخ السفر', d.date || '—']]) + '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|PERMIT|' + ID.refCode(u.nid + (d.nid || ''))) + '<p>نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>',
    milcert: (d, u) => { const m = ID.D.mil(); return '<div class="rcpt">' + head('شهادة الموقف من التجنيد') + tbl([['الاسم', u.name], ['الرقم القومي', u.nid], ['الرقم الثلاثي', m.triple || '—'], ['الموقف التجنيدي', m.label || '—'], m.release ? ['تاريخ التسريح', ID.fmtDate(m.release)] : null]) + '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|MILCERT|' + ID.refCode(u.nid + 'milc')) + '<p>نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>'; },
    enroll: (d, u) => { const S = ID.D.edu(), cur = S.find(s => !s.done); return '<div class="rcpt">' + head('شهادة قيد طالب') + tbl([['الاسم', u.name], ['الرقم القومي', u.nid], ['المرحلة', cur ? cur.cls : 'أنهى المرحلة الثانوية'], ['العام الدراسي', ID.NOW.getFullYear() + ' / ' + (ID.NOW.getFullYear() + 1)], ['المحافظة', u.gov]]) + '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|ENR|' + ID.refCode(u.nid + 'enr')) + '<p>نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>'; },
    gradproof: (d, u) => { const x = ID.D.uniInfo(); return '<div class="rcpt">' + head('إفادة تخرج') + tbl([['الاسم', u.name], ['الرقم القومي', u.nid], ['الجامعة', x.uni], ['الكلية', x.faculty], ['القسم', x.major], ['التقدير', x.grade], ['سنة التخرج', String(x.gradYear)]]) + '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|GRAD|' + ID.refCode(u.nid + 'gp')) + '<p>نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>'; },
    taxcert: (d, u) => '<div class="rcpt">' + head('شهادة براءة ذمة ضريبية') + tbl([['الاسم', u.name], ['الرقم القومي', u.nid], ['رقم التسجيل الضريبي', ID.D.finance().taxNo], ['الموقف', 'لا توجد مستحقات ضريبية متأخرة'], ['تاريخ الإصدار', dt(Date.now())]]) + '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|TAXC|' + ID.refCode(u.nid + 'taxc')) + '<p>نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>',
    generic: (d, u, rec) => '<div class="rcpt">' + head(d.title || 'مستند') + tbl([['الاسم', u.name], ['الرقم القومي', u.nid]].concat(d.rows || [])) + '<div class="rc-f">' + qrBox('DIGITALSEGYPT-DEMO|DOC|' + ID.refCode(u.nid + (d.title || '') + Date.now())) + '<p>نموذج تجريبي لا يُعتد به رسمياً.</p></div></div>'
  };

  /* تعريفات تجديد/تحديث الوثائق (تُستخدم في المحفظة وصفحة الداخلية) */
  const pl = {
    civ: u => 'مكتب السجل المدني - ' + u.gov, traffic: u => 'وحدة المرور - ' + u.gov, pass: u => 'مجمع الجوازات والهجرة - ' + u.gov
  };
  const minLen = n => v => v.length >= n;
  const DOCDEF = {
    'id.renew': { id: 'id.renew', g: 'بطاقة الرقم القومي', t: 'تجديد بطاقة الرقم القومي', org: 'مصلحة الأحوال المدنية', d: 'تجديد البطاقة لمدة 7 سنوات جديدة.', fee: 150, req: u => u.age < 16 ? 'تُصدر بطاقة الرقم القومي بعد بلوغ 16 سنة.' : null, pickup: { what: 'بطاقة الرقم القومي الجديدة', place: pl.civ, days: 5 }, after: () => { docs().id.renewed = Date.now(); } },
    'id.update': { id: 'id.update', g: 'بطاقة الرقم القومي', t: 'تحديث بيانات بطاقة الرقم القومي', org: 'مصلحة الأحوال المدنية', d: 'تحديث العنوان أو المهنة أو الحالة الاجتماعية.', fee: 50, req: u => u.age < 16 ? 'تُصدر بطاقة الرقم القومي بعد بلوغ 16 سنة.' : null,
      fields: [{ id: 'what', label: 'البيان المراد تحديثه', options: ['العنوان', 'المهنة', 'الحالة الاجتماعية'] }, { id: 'val', label: 'القيمة الجديدة (للحالة الاجتماعية اكتب: أعزب/متزوج/مطلق/أرمل)', test: minLen(3), msg: 'اكتب القيمة الجديدة (3 أحرف على الأقل).' }],
      pickup: { what: 'بطاقة الرقم القومي بالبيانات المحدثة', place: pl.civ, days: 5 }, after: v => { const k = { 'العنوان': 'addr', 'المهنة': 'job', 'الحالة الاجتماعية': 'marital' }[v.what]; docs().id[k] = v.val; } },
    'id.replace': { id: 'id.replace', g: 'بطاقة الرقم القومي', t: 'بدل فاقد / تالف لبطاقة الرقم القومي', org: 'مصلحة الأحوال المدنية', d: 'استخراج بطاقة بدل فاقد أو تالف.', fee: 150, req: u => u.age < 16 ? 'تُصدر بطاقة الرقم القومي بعد بلوغ 16 سنة.' : null, fields: [{ id: 'why', label: 'السبب', options: ['فقد', 'تلف'] }], pickup: { what: 'بطاقة الرقم القومي (بدل ' + 'فاقد/تالف)', place: pl.civ, days: 7 }, after: () => { docs().id.renewed = Date.now(); } },
    'license.renew': { id: 'license.renew', g: 'رخصة القيادة', t: 'تجديد رخصة القيادة', org: 'الإدارة العامة للمرور', d: 'تجديد الرخصة لمدة 10 سنوات.', fee: 300, req: u => u.age < 18 ? 'رخصة القيادة تتاح بعد بلوغ 18 سنة.' : null, pickup: { what: 'رخصة القيادة الجديدة', place: pl.traffic, days: 5 }, after: () => { ID.state().licRenewed = Date.now(); } },
    'license.update': { id: 'license.update', g: 'رخصة القيادة', t: 'تحديث بيانات رخصة القيادة', org: 'الإدارة العامة للمرور', d: 'تحديث العنوان أو المهنة أو فصيلة الدم.', fee: 50, req: u => u.age < 18 ? 'رخصة القيادة تتاح بعد بلوغ 18 سنة.' : null,
      fields: [{ id: 'what', label: 'البيان المراد تحديثه', options: ['العنوان', 'المهنة', 'فصيلة الدم'] }, { id: 'val', label: 'القيمة الجديدة', test: minLen(2), msg: 'اكتب القيمة الجديدة.' }],
      pickup: { what: 'رخصة القيادة بالبيانات المحدثة', place: pl.traffic, days: 5 }, after: v => { const k = { 'العنوان': 'addr', 'المهنة': 'job', 'فصيلة الدم': 'blood' }[v.what]; docs().license[k] = v.val; } },
    'birth.renew': { id: 'birth.renew', g: 'شهادة الميلاد', t: 'إصدار نسخة حديثة من شهادة الميلاد', org: 'مصلحة الأحوال المدنية', d: 'نسخة مميكنة حديثة تُطبع فوراً.', fee: 30, doc: 'birth', after: () => { docs().birth.issued = Date.now(); } },
    'birth.update': { id: 'birth.update', g: 'شهادة الميلاد', t: 'تحديث / تصحيح بيانات شهادة الميلاد', org: 'مصلحة الأحوال المدنية', d: 'طلب تصحيح بيان خاطئ في شهادة الميلاد.', fee: 100,
      fields: [{ id: 'what', label: 'البيان المراد تصحيحه', options: ['الاسم', 'محل الميلاد'] }, { id: 'val', label: 'القيمة الصحيحة', test: minLen(3), msg: 'اكتب القيمة الصحيحة.' }, { id: 'why', label: 'سبب التصحيح', options: ['خطأ إملائي', 'خطأ إدخال بيانات', 'حكم قضائي'] }],
      pickup: { what: 'شهادة الميلاد المصححة', place: pl.civ, days: 7 }, doc: 'birth', after: v => { const b = docs().birth; if (v.what === 'الاسم') b.name = v.val; else b.gov = v.val; b.issued = Date.now(); } },
  };


  /* ------------------------------------------------------------- الضرائب (ملف المواطن) */
  const BR = [[40000, 0], [15000, .10], [15000, .15], [130000, .20], [200000, .225], [800000, .25], [Infinity, .275]];
  const incomeTaxOf = x => { let t = 0, r = x; for (let i = 0; i < BR.length; i++) { const a = Math.min(r, BR[i][0]); t += a * BR[i][1]; r -= a; if (r <= 0) break; } return Math.round(t); };
  function taxProfile() {
    const u = ID.user(), st = ID.state(), b = ID.D.bank(), P = ID.D.props(), yr = ID.NOW.getFullYear() - 1, ad = u.age >= 18;
    const salary = ad ? Math.round((b.monthly || 10000) * 12 * 1.35 / 1000) * 1000 : 0;
    const accts = ad ? [{ bank: b.ahli.bank, mask: b.ahli.mask, interest: Math.round(b.ahli.base * 0.05 / 10) * 10 }, { bank: b.cib.bank, mask: b.cib.mask, interest: Math.round(b.cib.base * 0.18 / 10) * 10 }].filter(a => a.interest > 0) : [];
    const interest = accts.reduce((s, a) => s + a.interest, 0), incTax = incomeTaxOf(salary);
    const props = P.map(p => ({ name: p.name, ref: p.ref, value: p.value, tax: Math.round(p.value * 0.0035 / 10) * 10 }));
    const propTax = props.reduce((s, p) => s + p.tax, 0);
    const kInc = 'TAXINC' + yr, kProp = 'TAXPROP' + yr;
    return { yr, salary, incTax, interest, interestTax: Math.round(interest * 0.2), accts, props, propTax, kInc, kProp, paidInc: !!st.paid[kInc] || incTax === 0, paidProp: !!st.paid[kProp] || propTax === 0, no: ID.D.finance().taxNo,
      get dueInc() { return this.paidInc ? 0 : this.incTax; }, get dueProp() { return this.paidProp ? 0 : this.propTax; }, get totalDue() { return this.dueInc + this.dueProp; } };
  }
  /* ------------------------------------------------------------- الشركات */
  const ACT = [
    ['تجارة الجملة والتجزئة', ['استيراد وتوزيع السلع الاستهلاكية', 'إدارة منافذ البيع بالتجزئة', 'التجارة الإلكترونية'], 1.0],
    ['المقاولات والإنشاءات', ['تنفيذ المشروعات السكنية والتجارية', 'أعمال التشطيبات والمرافق', 'توريد مواد البناء'], 1.3],
    ['تكنولوجيا المعلومات', ['تطوير البرمجيات والتطبيقات', 'الاستضافة والحوسبة السحابية', 'خدمات الدعم الفني'], 2.2],
    ['الصناعات الغذائية', ['تصنيع وتعبئة المواد الغذائية', 'تجهيز الألبان والعصائر', 'تصدير المنتجات الزراعية'], 1.1],
    ['السياحة والضيافة', ['إدارة الفنادق والمنتجعات', 'تنظيم الرحلات السياحية', 'المطاعم والكافيهات'], 1.4],
    ['النقل واللوجستيات', ['الشحن والتخزين', 'النقل البري للبضائع', 'التخليص الجمركي'], 1.2],
    ['العقارات والتطوير', ['التطوير العقاري', 'إدارة وتأجير العقارات', 'التسويق العقاري'], 1.8],
    ['الخدمات الطبية', ['إدارة المراكز الطبية', 'توريد المستلزمات الطبية', 'المعامل ومراكز الأشعة'], 1.6],
    ['التعليم والتدريب', ['مراكز التدريب المهني', 'الحضانات والمدارس الخاصة', 'منصات التعليم الإلكتروني'], 1.3]
  ];
  const FORMS = ['شركة ذات مسؤولية محدودة', 'شركة مساهمة مصرية', 'شركة توصية بسيطة', 'منشأة فردية'];
  const normTax = v => String(v || '').replace(/\D/g, '');
  const fmtTax = n => n.slice(0, 3) + '-' + n.slice(3, 6) + '-' + n.slice(6);
  function genCompany(name, tax) {
    const r = ID.rng(tax + '|' + name), st = ID.state(), yr = ID.NOW.getFullYear() - 1;
    const a = ACT[ID.I(r, 0, ACT.length - 1)], cap = Math.round(ID.I(r, 50, 3000) * 1000 / 10000) * 10000 || 50000;
    const rev = Math.round(cap * (1.1 + r() * 2.6) * a[2] / 1000) * 1000, margin = ID.I(r, 6, 22) / 100, profit = Math.round(rev * margin / 100) * 100;
    const corp = Math.round(profit * 0.225), vat = Math.round(rev * 0.14 * 0.18), total = corp + vat, paidPct = .3 + r() * .7;
    const key = 'CMP' + tax + yr, paidNow = !!st.paid[key], paid0 = Math.round(total * paidPct), due0 = total - paid0 < total * 0.04 ? 0 : total - paid0;
    const due = paidNow ? 0 : due0, paid = total - due, gov = ID.pick(r, Object.keys(ID.GOV).map(k => ID.GOV[k]));
    return { name, tax, taxFmt: fmtTax(tax), key, sector: a[0], acts: a[1], form: ID.pick(r, FORMS), est: ID.I(r, 1996, ID.NOW.getFullYear() - 1), cr: String(ID.I(r, 10000000, 99999999)), cap, emp: ID.I(r, 3, 420), rev, profit, margin: Math.round(margin * 1000) / 10, growth: (ID.I(r, -40, 220) / 10).toFixed(1), market: Math.round((profit * (7 + r() * 8) + cap * 0.5) / 1000) * 1000, corp, vat, total, paid, due, status: due === 0 ? 'ملتزمة' : due > total * 0.4 ? 'متأخرة' : 'مستحقة السداد', addr: 'شارع ' + ID.I(r, 1, 60) + '، ' + gov, yr, lastReturn: yr + '/' + ID.NOW.getFullYear() };
  }


  /* ------------------------------------------------------------- الشحنات الجمركية */
  const SHIPS = [['هاتف محمول وملحقاته', 'الصين', 'DHL Express', 'مطار القاهرة الجوي', .30], ['أجهزة منزلية كهربائية', 'تركيا', 'Maersk Line', 'ميناء الإسكندرية', .30], ['ملابس وأحذية', 'الصين', 'FedEx', 'مطار القاهرة الجوي', .40], ['قطع غيار سيارات', 'ألمانيا', 'MSC', 'ميناء دمياط', .20], ['أجهزة حاسب وملحقاتها', 'الولايات المتحدة', 'UPS', 'مطار القاهرة الجوي', .10], ['مستحضرات تجميل', 'فرنسا', 'Aramex', 'مطار القاهرة الجوي', .30], ['أثاث منزلي', 'إيطاليا', 'CMA CGM', 'ميناء الإسكندرية', .30], ['معدات طبية', 'ألمانيا', 'DHL Global', 'مطار القاهرة الجوي', .05]];
  function shipments() {
    const u = ID.user(), st = ID.state(), f = ID.D.finance(), out = []; if (u.age < 18) return out;
    for (let i = 0; i < 3; i++) {
      const r = ID.rng(u.nid + 'ship' + i), it = i === 0 ? [f.ship, 'الصين', 'DHL Express', 'مطار القاهرة الجوي', .30] : ID.pick(r, SHIPS);
      const days = ID.I(r, 2, 20), value = ID.I(r, 3000, 60000), weight = ID.I(r, 2, 400);
      let duty = Math.round(value * it[4]), vat = Math.round((value + duty) * 0.14), fees = ID.I(r, 150, 400), storage = i === 0 ? 0 : (days > 7 ? (days - 7) * 25 : 0);
      if (i === 0) { const t = f.customsFee; duty = Math.round(t * 0.6); vat = Math.round(t * 0.3); fees = t - duty - vat; }
      const id = 'S' + i, now = Date.now();
      out.push({ id, idx: i, trk: 'EG' + String(1000000000 + ID.hash(u.nid + 'trk' + i) % 8999999999), desc: it[0], origin: it[1], carrier: it[2], port: it[3], weight, value, duty, vat, fees, storage, total: duty + vat + fees + storage, days, arrived: ID.addDays(ID.NOW, -days), inspect: i === 1,
        paid: !!st.paid['SHIP' + id] || (i === 0 && !!st.customsPaid), released: !!st.paid['REL' + id], inspected: !!st.paid['INS' + id] });
    }
    return out;
  }

  /* ------------------------------------------------------------- واجهة عامة */
  const Gov = { shipments, taxProfile, genCompany, normTax, fmtTax, incomeTaxOf, modal, printHtml, receipt, requestsList, run, grid, tabs, bookDialog, addAppt, apptModal, apptPaper, rcptPaper, tbl, head, qrBox, DOCS, DOCDEF, docs, idData, licData, birthData, ppData, insData, dt, dayLabel, iso, fromIso, workDays, freeRec, addRequest, reqLabel, reqStage, pl, minLen, TIMES, DAYN };
  window.Gov = Gov;
})();
