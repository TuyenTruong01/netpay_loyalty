const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const root = path.resolve(__dirname, '..');
const docsDir = path.join(root, 'docs');
const outPath = path.join(docsDir, 'Paynet_Loyalty_Checkpoint_2.pptx');
const logoPath = path.join(root, 'public', 'png', 'logo', 'paynet-logo.png');

fs.mkdirSync(docsDir, { recursive: true });

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Paynet Loyalty';
pptx.company = 'Paynet Loyalty';
pptx.subject = 'Arc Hackathon Checkpoint 2 Submission';
pptx.title = 'Paynet Loyalty - Agent-ready USDC merchant network on Arc';
pptx.lang = 'en-US';
pptx.theme = {
  headFontFace: 'Aptos Display',
  bodyFontFace: 'Aptos',
  lang: 'en-US',
};
pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
pptx.layout = 'WIDE';

const C = {
  ink: '0F172A',
  muted: '52617A',
  faint: 'EEF4FF',
  line: 'D9E3F5',
  blue: '2563EB',
  purple: '5B35F5',
  green: '16A34A',
  orange: 'F97316',
  red: 'DC2626',
  white: 'FFFFFF',
  panel: 'F8FAFC',
};

function addHeader(slide, eyebrow = 'PAYNET LOYALTY') {
  slide.addText(eyebrow, {
    x: 0.55,
    y: 0.32,
    w: 4.2,
    h: 0.22,
    fontFace: 'Aptos',
    fontSize: 8.5,
    bold: true,
    color: C.purple,
    breakLine: false,
    charSpace: 1.4,
    margin: 0,
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.55,
    y: 0.67,
    w: 12.25,
    h: 0,
    line: { color: C.line, width: 1 },
  });
}

function addFooter(slide, n) {
  slide.addText(`Arc Hackathon Checkpoint 2  /  ${String(n).padStart(2, '0')}`, {
    x: 10.25,
    y: 7.08,
    w: 2.55,
    h: 0.18,
    fontSize: 7.5,
    color: '94A3B8',
    align: 'right',
    margin: 0,
  });
}

function title(slide, text, subtitle) {
  slide.addText(text, {
    x: 0.62,
    y: 0.95,
    w: 7.5,
    h: 0.88,
    fontFace: 'Aptos Display',
    fontSize: 31,
    bold: true,
    color: C.ink,
    margin: 0,
    fit: 'shrink',
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.64,
      y: 1.88,
      w: 8.15,
      h: 0.38,
      fontSize: 13.5,
      color: C.muted,
      margin: 0,
      fit: 'shrink',
    });
  }
}

function pill(slide, text, x, y, color = C.purple, w = 1.5) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.36,
    rectRadius: 0.08,
    fill: { color, transparency: 6 },
    line: { color, transparency: 100 },
  });
  slide.addText(text, {
    x: x + 0.12,
    y: y + 0.09,
    w: w - 0.24,
    h: 0.14,
    fontSize: 8.5,
    bold: true,
    color: C.white,
    align: 'center',
    margin: 0,
  });
}

function card(slide, x, y, w, h, heading, body, accent = C.blue) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.12,
    fill: { color: C.white },
    line: { color: C.line, width: 1 },
    shadow: { type: 'outer', color: 'CBD5E1', opacity: 0.12, blur: 1, angle: 45, distance: 1 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w: 0.08,
    h,
    fill: { color: accent },
    line: { color: accent },
  });
  slide.addText(heading, {
    x: x + 0.22,
    y: y + 0.18,
    w: w - 0.42,
    h: 0.28,
    fontSize: 13,
    bold: true,
    color: C.ink,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText(body, {
    x: x + 0.22,
    y: y + 0.58,
    w: w - 0.42,
    h: h - 0.75,
    fontSize: 10,
    color: C.muted,
    breakLine: false,
    valign: 'mid',
    fit: 'shrink',
    margin: 0,
  });
}

function bullets(slide, items, x, y, w, h, options = {}) {
  slide.addText(items.map(t => ({ text: t, options: { bullet: { type: 'ul' }, hanging: 2 } })), {
    x,
    y,
    w,
    h,
    fontSize: options.size || 12,
    color: options.color || C.ink,
    breakLine: true,
    fit: 'shrink',
    paraSpaceAfterPt: 8,
    margin: 0,
  });
}

function metric(slide, x, y, w, label, value, color = C.purple) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.86,
    rectRadius: 0.12,
    fill: { color: C.panel },
    line: { color: C.line },
  });
  slide.addText(label, { x: x + 0.16, y: y + 0.15, w: w - 0.32, h: 0.14, fontSize: 8.5, color: C.muted, margin: 0 });
  slide.addText(value, { x: x + 0.16, y: y + 0.42, w: w - 0.32, h: 0.22, fontSize: 14, bold: true, color, margin: 0, fit: 'shrink' });
}

function flowBox(slide, x, y, w, label, text, color) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.92,
    rectRadius: 0.11,
    fill: { color: C.white },
    line: { color, width: 1.2 },
  });
  slide.addText(label, { x: x + 0.14, y: y + 0.13, w: w - 0.28, h: 0.15, fontSize: 8.5, bold: true, color, margin: 0 });
  slide.addText(text, { x: x + 0.14, y: y + 0.36, w: w - 0.28, h: 0.32, fontSize: 9.5, bold: true, color: C.ink, fit: 'shrink', margin: 0 });
}

function arrow(slide, x, y, w) {
  slide.addShape(pptx.ShapeType.line, {
    x,
    y,
    w,
    h: 0,
    line: { color: '94A3B8', width: 1.5, beginArrowType: 'none', endArrowType: 'triangle' },
  });
}

let slideNo = 1;

{
  const slide = pptx.addSlide();
  slide.background = { color: 'F7FAFF' };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: 'F7FAFF' }, line: { transparency: 100 } });
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.65, y: 0.7, w: 12, h: 6.1, rectRadius: 0.18, fill: { color: C.white }, line: { color: C.line } });
  if (fs.existsSync(logoPath)) slide.addImage({ path: logoPath, x: 0.98, y: 1.05, w: 0.55, h: 0.55 });
  slide.addText('PAYNET LOYALTY', { x: 1.65, y: 1.08, w: 2.5, h: 0.18, fontSize: 8.5, bold: true, color: C.purple, charSpace: 1.4, margin: 0 });
  slide.addText('Agent-ready USDC merchant network on Arc', {
    x: 0.95,
    y: 1.75,
    w: 8.7,
    h: 1.2,
    fontFace: 'Aptos Display',
    fontSize: 34,
    bold: true,
    color: C.ink,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText('Wallet-native storefronts, real Arc USDC checkout, payment confirmation, and universal APoint loyalty for local merchants.', {
    x: 0.98,
    y: 3.12,
    w: 8.25,
    h: 0.45,
    fontSize: 14,
    color: C.muted,
    margin: 0,
    fit: 'shrink',
  });
  pill(slide, 'DeFi Track', 0.98, 4.02, C.blue, 1.4);
  pill(slide, 'Agentic Economy Track', 2.55, 4.02, C.purple, 2.1);
  metric(slide, 0.98, 4.85, 2.15, 'Settlement asset', 'USDC on Arc', C.blue);
  metric(slide, 3.35, 4.85, 2.15, 'Merchant entry', 'QR storefront', C.purple);
  metric(slide, 5.72, 4.85, 2.15, 'Loyalty', 'APoint', C.green);
  metric(slide, 8.09, 4.85, 2.15, 'Status', 'Working MVP', C.orange);
  addFooter(slide, slideNo++);
}

{
  const slide = pptx.addSlide();
  addHeader(slide);
  title(slide, 'Problem', 'Small merchants are not ready for wallet-native commerce.');
  card(slide, 0.75, 2.65, 3.7, 2.2, 'Fragmented tools', 'Sales, inventory, payment receipts, customer identity, and loyalty balances often live in separate systems.', C.red);
  card(slide, 4.85, 2.65, 3.7, 2.2, 'QR codes are too shallow', 'Most QR payment flows only encode recipient information. They do not expose products, cart, payment options, or rewards.', C.orange);
  card(slide, 8.95, 2.65, 3.7, 2.2, 'Stablecoin commerce needs trust', 'Merchants and customers need clear order state, payment proof, wallet identity, and duplicate-safe rewards.', C.blue);
  addFooter(slide, slideNo++);
}

{
  const slide = pptx.addSlide();
  addHeader(slide);
  title(slide, 'Solution', 'A complete commerce flow behind every merchant wallet and QR.');
  bullets(slide, [
    'Each merchant wallet maps to a digital storefront with products, local prices, inventory, payment methods, and order history.',
    'Customers scan a Paynet Loyalty QR, build a cart, and choose cash, bank transfer, or USDC on Arc.',
    'USDC orders store a local-currency to USDC exchange-rate snapshot before payment.',
    'Paid orders trigger APoint reward accounting with duplicate-safe award logic and audit logs.',
  ], 0.9, 2.65, 6.2, 2.8, { size: 12 });
  flowBox(slide, 7.55, 2.25, 1.55, '1', 'Scan QR', C.purple);
  arrow(slide, 9.15, 2.71, 0.45);
  flowBox(slide, 9.72, 2.25, 1.55, '2', 'Build cart', C.blue);
  arrow(slide, 11.32, 2.71, 0.45);
  flowBox(slide, 7.55, 3.55, 1.55, '3', 'Pay USDC', C.green);
  arrow(slide, 9.15, 4.01, 0.45);
  flowBox(slide, 9.72, 3.55, 1.55, '4', 'Confirm tx', C.orange);
  arrow(slide, 11.32, 4.01, 0.45);
  flowBox(slide, 7.55, 4.85, 1.55, '5', 'Award APoint', C.green);
  addFooter(slide, slideNo++);
}

{
  const slide = pptx.addSlide();
  addHeader(slide);
  title(slide, 'What We Built', 'A working MVP with mobile merchant and customer flows.');
  card(slide, 0.72, 2.28, 2.82, 2.06, 'Store Mobile', 'Owner/staff wallet access, product publishing, QR storefront links, orders awaiting confirmation, settlement settings, and store agent panel.', C.purple);
  card(slide, 3.82, 2.28, 2.82, 2.06, 'Customer Mobile', 'Storefront browsing, local-currency cart, payment method selection, wallet connection, APoint balance, and checkout handoff.', C.blue);
  card(slide, 6.92, 2.28, 2.82, 2.06, 'Arc Checkout', 'Real wallet transaction flow for Arc Testnet USDC, receipt waiting, explorer links, and Paynet Loyalty V1 registry proof.', C.green);
  card(slide, 10.02, 2.28, 2.82, 2.06, 'Supabase Backend', 'Orders, payments, exchange-rate snapshots, audit logs, store payment methods, APoint ledger, and idempotent awarding.', C.orange);
  metric(slide, 1.1, 5.18, 2.35, 'Manual methods', 'cash + bank', C.orange);
  metric(slide, 3.82, 5.18, 2.35, 'Stablecoin method', 'usdc_arc', C.green);
  metric(slide, 6.54, 5.18, 2.35, 'Customer entry', '/s/:storeSlug', C.purple);
  metric(slide, 9.26, 5.18, 2.35, 'Checkout entry', '/checkout?token', C.blue);
  addFooter(slide, slideNo++);
}

{
  const slide = pptx.addSlide();
  addHeader(slide);
  title(slide, 'Architecture', 'Operational data off-chain, payment proof and loyalty logic on Arc.');
  flowBox(slide, 0.86, 2.45, 2.0, 'Merchant', 'Store wallet + mobile UI', C.purple);
  arrow(slide, 2.98, 2.91, 0.75);
  flowBox(slide, 3.88, 2.45, 2.0, 'Storefront', 'Catalog + cart + QR', C.blue);
  arrow(slide, 6.0, 2.91, 0.75);
  flowBox(slide, 6.9, 2.45, 2.0, 'Checkout', 'USDC amount snapshot', C.green);
  arrow(slide, 9.02, 2.91, 0.75);
  flowBox(slide, 9.92, 2.45, 2.0, 'Arc', 'USDC tx + registry proof', C.orange);
  slide.addShape(pptx.ShapeType.line, { x: 4.88, y: 3.4, w: 0, h: 1.18, line: { color: '94A3B8', width: 1.5, endArrowType: 'triangle' } });
  slide.addShape(pptx.ShapeType.line, { x: 7.9, y: 3.4, w: 0, h: 1.18, line: { color: '94A3B8', width: 1.5, endArrowType: 'triangle' } });
  card(slide, 3.45, 4.72, 2.86, 1.3, 'Supabase', 'Orders, products, payments, audit logs, exchange-rate cache, APoint display cache.', C.blue);
  card(slide, 6.5, 4.72, 2.86, 1.3, 'Contracts', 'Store registry, payment registry, APoint ledger, and legacy proof fallback.', C.orange);
  addFooter(slide, slideNo++);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, 'DEFI TRACK');
  title(slide, 'Why It Fits DeFi', 'Stablecoin-native merchant payments, not another dashboard mockup.');
  bullets(slide, [
    'Meaningful Arc + USDC use: customers send USDC directly to merchant wallets on Arc Testnet.',
    'Programmable payment flow: local-currency snapshot, USDC payable amount, on-chain transaction proof, and payment registry recording.',
    'Real settlement surface: cash and bank transfer stay awaiting confirmation; USDC only becomes paid after transaction validation.',
    'APoint connects rewards to verified payment amounts and prevents duplicate earning for the same order.',
  ], 0.82, 2.36, 6.55, 3.4, { size: 12 });
  metric(slide, 8.0, 2.45, 3.25, 'Arc Testnet chain id', '5042002', C.blue);
  metric(slide, 8.0, 3.55, 3.25, 'USDC token interface', '0x3600...0000', C.green);
  metric(slide, 8.0, 4.65, 3.25, 'Reward rule', '1 USDC = 1 APoint', C.purple);
  addFooter(slide, slideNo++);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, 'AGENTIC ECONOMY TRACK');
  title(slide, 'Why It Fits Agentic Economy', 'Agents coordinate commerce, but wallets remain in user control.');
  card(slide, 0.78, 2.35, 3.55, 2.6, 'Merchant Agent', 'Reads store data and helps owners manage products, prices, inventory, settlement settings, and low-stock questions with confirmation gates.', C.purple);
  card(slide, 4.9, 2.35, 3.55, 2.6, 'Checkout Agent', 'Validates merchant, cart, inventory, totals, payment methods, rate snapshot, duplicate requests, and checkout readiness.', C.blue);
  card(slide, 9.02, 2.35, 3.55, 2.6, 'Loyalty Agent', 'Checks paid order eligibility, computes APoint, prevents double awards, records reward history, and updates customer balances.', C.green);
  slide.addText('Important boundary: agents do not sign customer transactions or move merchant funds. Users approve wallet actions.', {
    x: 1.0,
    y: 5.62,
    w: 10.8,
    h: 0.32,
    fontSize: 12,
    bold: true,
    color: C.ink,
    align: 'center',
    margin: 0,
  });
  addFooter(slide, slideNo++);
}

{
  const slide = pptx.addSlide();
  addHeader(slide);
  title(slide, 'Live Demo Flow', 'What judges can see in the current build.');
  const steps = [
    ['1', 'Open store mobile', 'Connect owner/staff wallet and publish products.'],
    ['2', 'Share QR storefront', 'Customer lands on the exact merchant catalog.'],
    ['3', 'Create cart', 'Local prices convert into a USDC snapshot.'],
    ['4', 'Pay on Arc', 'Wallet sends USDC and shows explorer transaction.'],
    ['5', 'Confirm paid', 'Payment row and order become confirmed.'],
    ['6', 'Award APoint', 'Ledger records reward once with audit history.'],
  ];
  steps.forEach((s, i) => {
    const x = 0.75 + (i % 3) * 4.08;
    const y = 2.2 + Math.floor(i / 3) * 1.72;
    flowBox(slide, x, y, 3.35, s[0], `${s[1]}\n${s[2]}`, [C.purple, C.blue, C.green, C.orange, C.blue, C.green][i]);
  });
  addFooter(slide, slideNo++);
}

{
  const slide = pptx.addSlide();
  addHeader(slide);
  title(slide, 'Technical Proof', 'The MVP records a verifiable trail from cart to reward.');
  card(slide, 0.82, 2.2, 3.8, 2.15, 'Supabase records', 'orders, order_items, payments, store_payment_methods, exchange_rates, customers, apoint_ledger, audit_logs', C.blue);
  card(slide, 4.78, 2.2, 3.8, 2.15, 'Arc transactions', 'USDC transfer transaction link and Paynet Loyalty V1 registry/proof transaction link are displayed in checkout.', C.green);
  card(slide, 8.74, 2.2, 3.8, 2.15, 'Safety rules', 'Manual payments need owner/staff confirmation. USDC orders are confirmed after chain validation. APoint awarding is idempotent.', C.orange);
  bullets(slide, [
    'Build check: npm run build passes.',
    'Deployed Edge Function: exchange-rate for USDC/local-currency snapshots.',
    'Current network: Arc Testnet with USDC gas/payment flow.',
  ], 1.0, 5.05, 10.7, 1.0, { size: 11.5 });
  addFooter(slide, slideNo++);
}

{
  const slide = pptx.addSlide();
  addHeader(slide);
  title(slide, 'Roadmap', 'What comes after the checkpoint.');
  card(slide, 0.82, 2.25, 2.75, 2.62, 'Short term', 'Polish agent action tools: find product, create order draft, check payment status, explain APoint, and summarize pending orders.', C.purple);
  card(slide, 3.88, 2.25, 2.75, 2.62, 'Protocol', 'Tighten contract indexing, reconcile APoint display cache with on-chain ledger, and add admin monitoring for registry events.', C.blue);
  card(slide, 6.94, 2.25, 2.75, 2.62, 'Security', 'Harden Supabase RLS, owner/staff permissions, duplicate transaction handling, and audit views.', C.orange);
  card(slide, 10.0, 2.25, 2.75, 2.62, 'Growth', 'Merchant onboarding, QR poster flow, map discovery, and APoint redemption across multiple stores.', C.green);
  addFooter(slide, slideNo++);
}

{
  const slide = pptx.addSlide();
  slide.background = { color: 'F7FAFF' };
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.76, y: 0.74, w: 11.82, h: 5.95, rectRadius: 0.18, fill: { color: C.white }, line: { color: C.line } });
  title(slide, 'Checkpoint 2 Summary', 'Paynet Loyalty is ready to submit for both tracks.');
  bullets(slide, [
    'DeFi: Arc USDC checkout, payment proof, FX snapshot, and stablecoin merchant settlement.',
    'Agentic Economy: merchant, checkout, and loyalty agents coordinate commerce workflows with human wallet approvals.',
    'MVP: mobile storefront, store mobile operations, real Arc checkout, payment confirmation, APoint ledger, and audit records.',
  ], 1.05, 2.7, 9.4, 1.75, { size: 13 });
  slide.addText('One-liner', { x: 1.05, y: 5.05, w: 1.6, h: 0.2, fontSize: 9, bold: true, color: C.purple, charSpace: 1.1, margin: 0 });
  slide.addText('Agent-ready USDC checkout and universal loyalty network for real-world merchants on Arc.', {
    x: 1.05,
    y: 5.38,
    w: 9.8,
    h: 0.34,
    fontSize: 15,
    bold: true,
    color: C.ink,
    margin: 0,
    fit: 'shrink',
  });
  addFooter(slide, slideNo++);
}

pptx.writeFile({ fileName: outPath });
console.log(outPath);
