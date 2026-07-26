import { Edit3, Plus, Trash2 } from 'lucide-react';
import { money, shortAddress } from '../utils/format.js';

const productStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'discontinued', label: 'No longer produced' },
];

function statusBadge(status = 'active') {
  if (status === 'active') return 'ok';
  if (status === 'inactive') return 'warn';
  return 'bad';
}

export default function ProductsPage({
  products,
  setEditingProduct,
  canManage = false,
  onUpdateProductStatus,
  onDeleteProduct,
}) {
  return (
    <section className="panel full-page-panel">
      <div className="panel-head">
        <div><p className="eyebrow">Catalog</p><h2>Products</h2></div>
        {canManage && <button type="button" onClick={() => setEditingProduct('new')}><Plus size={16} /> Add Product</button>}
      </div>
      <table className="data-table product-catalog-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Image</th>
            <th>Product</th>
            <th>Code</th>
            <th>Barcode / QR</th>
            <th>Category</th>
            <th>Unit</th>
            <th>Sell Price</th>
            <th>Description</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => {
            const status = product.status || (product.active === false ? 'inactive' : 'active');
            return (
              <tr key={product.id}>
                <td>{index + 1}</td>
                <td>
                  <div className="table-image">
                    {product.image ? <img src={product.image} alt="" /> : <span>{product.emoji}</span>}
                  </div>
                </td>
                <td><strong>{product.name}</strong></td>
                <td>{product.sku}</td>
                <td><code>{product.barcode ? shortAddress(product.barcode) : '-'}</code></td>
                <td>{product.category}</td>
                <td>{product.unit || 'unit'}</td>
                <td>{money(product.price)}</td>
                <td className="muted-cell">{product.description || '-'}</td>
                <td>
                  {canManage ? (
                    <select
                      className={`status-select ${statusBadge(status)}`}
                      value={status}
                      onChange={event => onUpdateProductStatus?.(product.id, event.target.value)}
                    >
                      {productStatuses.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
                    </select>
                  ) : (
                    <span className={`badge ${statusBadge(status)}`}>{productStatuses.find(item => item.value === status)?.label || status}</span>
                  )}
                </td>
                <td>
                  {canManage ? (
                    <div className="action-cell">
                      <button type="button" className="small-action" onClick={() => setEditingProduct(product)}><Edit3 size={14} /> Edit</button>
                      <button type="button" className="small-action danger" onClick={() => onDeleteProduct?.(product.id)}><Trash2 size={14} /> Delete</button>
                    </div>
                  ) : (
                    <span className="muted-cell">View only</span>
                  )}
                </td>
              </tr>
            );
          })}
          {!products.length && <tr><td colSpan="11" className="empty-row">No products found.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
