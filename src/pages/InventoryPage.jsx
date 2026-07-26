import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { money } from '../utils/format.js';

export default function InventoryPage({
  inventory,
  products,
  warehouses = [],
  canManage = false,
  onAddInventoryProduct,
  onUpdateInventoryWarehouse,
  onDeleteInventoryItem,
}) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ productId: '', warehouseId: '', quantity: 0, min: 0 });

  const activeWarehouses = warehouses.filter(warehouse => (warehouse.status || (warehouse.active === false ? 'inactive' : 'active')) === 'active');
  const rows = (inventory?.length ? inventory : products.map(product => ({
    id: product.id,
    productId: product.id,
    name: product.name,
    sku: product.sku,
    costPrice: product.costPrice || 0,
    sellPrice: product.price,
    quantity: product.stock,
    min: product.min,
    warehouse: product.warehouse || activeWarehouses[0]?.name || 'Main Store',
    warehouseId: product.warehouseId || activeWarehouses[0]?.id || '',
    active: product.active,
    status: product.status || (product.active === false ? 'inactive' : 'active'),
    emoji: product.emoji,
    inventoryHidden: product.inventoryHidden,
  }))).filter(item => item.inventoryHidden !== true);

  const addableProducts = useMemo(
    () => products.filter(product => !rows.some(row => row.productId === product.id && row.warehouseId === draft.warehouseId)),
    [products, rows, draft.warehouseId]
  );

  function submit(event) {
    event.preventDefault();
    if (!draft.productId) return alert('Choose a product from Products first.');
    if (!draft.warehouseId) return alert('Choose a warehouse.');
    onAddInventoryProduct?.(draft);
    setDraft({ productId: '', warehouseId: '', quantity: 0, min: 0 });
    setShowForm(false);
  }

  return (
    <section className="panel full-page-panel">
      <div className="panel-head">
        <div><p className="eyebrow">Stock Control</p><h2>Inventory</h2></div>
        {canManage && <button type="button" onClick={() => setShowForm(current => !current)}><Plus size={16} /> Add Inventory Item</button>}
      </div>

      {showForm && (
        <form className="inline-edit-form" onSubmit={submit}>
          <label>
            Product
            <select value={draft.productId} onChange={event => setDraft({ ...draft, productId: event.target.value })}>
              <option value="">Choose product</option>
              {addableProducts.map(product => <option value={product.id} key={product.id}>{product.name}</option>)}
            </select>
          </label>
          <label>
            Warehouse
            <select value={draft.warehouseId} onChange={event => setDraft({ ...draft, warehouseId: event.target.value })}>
              <option value="">Choose warehouse</option>
              {activeWarehouses.map(warehouse => <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>)}
            </select>
          </label>
          <label>Current Stock<input type="number" value={draft.quantity} onChange={event => setDraft({ ...draft, quantity: Number(event.target.value) })} /></label>
          <label>Minimum Stock<input type="number" value={draft.min} onChange={event => setDraft({ ...draft, min: Number(event.target.value) })} /></label>
          <button className="primary" type="submit">Save Inventory</button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Product</th>
            <th>Product Code</th>
            <th>Cost Price</th>
            <th>Sell Price</th>
            <th>Current Stock</th>
            <th>Minimum Stock</th>
            <th>Warehouse</th>
            <th>Alert</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={item.id || item.productId}>
              <td>{index + 1}</td>
              <td>{item.emoji} {item.name}</td>
              <td>{item.sku}</td>
              <td>{money(item.costPrice)}</td>
              <td>{money(item.sellPrice)}</td>
              <td>{item.quantity}</td>
              <td>{item.min}</td>
              <td>
                {canManage ? (
                  <select
                    className="table-select"
                    value={item.warehouseId || ''}
                    onChange={event => onUpdateInventoryWarehouse?.(item.productId, event.target.value)}
                  >
                    {activeWarehouses.map(warehouse => <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>)}
                  </select>
                ) : item.warehouse}
              </td>
              <td><span className={`badge ${Number(item.quantity) <= Number(item.min) ? 'warn' : 'ok'}`}>{Number(item.quantity) <= Number(item.min) ? 'Reorder' : 'OK'}</span></td>
              <td>
                {canManage ? (
                  <button
                    type="button"
                    className="small-action danger"
                    onClick={() => onDeleteInventoryItem?.(item.productId, item.warehouseId)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                ) : (
                  <span className="muted-cell">View only</span>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="10" className="empty-row">No stock records found.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
