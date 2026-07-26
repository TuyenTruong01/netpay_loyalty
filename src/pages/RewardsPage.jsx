import { money } from '../utils/format.js';

export default function RewardsPage({ settings }) {
  const earnRate = settings?.earnRate || '1 USDC paid = 1 point';
  const redeemRate = settings?.redeemRate || '1 point = 0.01 USDC discount';
  const maxRedeem = settings?.maxRedeem || 'Max 20% of invoice total';

  return (
    <section className="panel full-page-panel">
      <div className="panel-head">
        <div><p className="eyebrow">Loyalty Rules</p><h2>Rewards</h2></div>
      </div>
      <div className="settings-grid">
        <article className="setting-card"><span>Earn Rate</span><strong>{earnRate}</strong><small>New points are calculated from the actual paid amount after redemption.</small></article>
        <article className="setting-card"><span>Redeem Rate</span><strong>{redeemRate}</strong><small>Customer chooses redemption on the checkout page before wallet signing.</small></article>
        <article className="setting-card"><span>Redemption Limit</span><strong>{maxRedeem}</strong><small>Keeps every checkout safe for the merchant.</small></article>
        <article className="setting-card"><span>Example</span><strong>{money(1000000)} paid = 1 pt</strong><small>Redeem 5 pts to discount 1.00 USDC, capped at 20% of the invoice total.</small></article>
      </div>
    </section>
  );
}
