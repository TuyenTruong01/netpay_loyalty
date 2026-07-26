import { Save, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { rawFromUSDC, toUSDC } from '../utils/format.js';

function uniqueOptions(values = []) {
  return values
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

export default function ProductModal({
  product,
  categories,
  units = [],
  usedCategories = [],
  usedUnits = [],
  onClose,
  onSave,
}) {
  const initialDraft = product && product !== 'new' ? product : {
    name: 'New Product',
    sku: `SKU-${Date.now().toString().slice(-5)}`,
    barcode: '',
    category: categories.find(c => c !== 'All') || 'Other',
    unit: 'unit',
    price: 10000,
    costPrice: 7000,
    stock: 10,
    min: 5,
    description: '',
    active: true,
    emoji: 'Cart',
    image: '',
  };

  const [draft, setDraft] = useState(initialDraft);
  const [priceInput, setPriceInput] = useState(String(toUSDC(initialDraft.price || 0)));
  const [costInput, setCostInput] = useState(String(toUSDC(initialDraft.costPrice || 0)));
  const [categoryOptions, setCategoryOptions] = useState(() =>
    uniqueOptions([...categories.filter(c => c !== 'All'), initialDraft.category, 'Other'])
  );
  const [unitOptions, setUnitOptions] = useState(() =>
    uniqueOptions([...units, initialDraft.unit || 'unit', 'unit'])
  );

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft(current => ({ ...current, image: reader.result }));
    reader.readAsDataURL(file);
  }

  function addCategory() {
    const value = window.prompt('New category name');
    const next = String(value || '').trim();
    if (!next) return;
    setCategoryOptions(current => uniqueOptions([...current, next]));
    setDraft(current => ({ ...current, category: next }));
  }

  function deleteCategory() {
    const category = draft.category;
    if (!category || category === 'Other') return alert('The default category cannot be deleted.');
    if (usedCategories.includes(category)) return alert('This category is used by existing products. Move those products first.');
    if (!confirm(`Delete category "${category}" from this form?`)) return;
    setCategoryOptions(current => current.filter(item => item !== category));
    setDraft(current => ({ ...current, category: 'Other' }));
  }

  function addUnit() {
    const value = window.prompt('New unit name');
    const next = String(value || '').trim();
    if (!next) return;
    setUnitOptions(current => uniqueOptions([...current, next]));
    setDraft(current => ({ ...current, unit: next }));
  }

  function deleteUnit() {
    const unit = draft.unit || 'unit';
    if (unit === 'unit') return alert('The default unit cannot be deleted.');
    if (usedUnits.includes(unit)) return alert('This unit is used by existing products. Move those products first.');
    if (!confirm(`Delete unit "${unit}" from this form?`)) return;
    setUnitOptions(current => current.filter(item => item !== unit));
    setDraft(current => ({ ...current, unit: 'unit' }));
  }

  function saveDraft() {
    onSave({
      ...draft,
      price: rawFromUSDC(priceInput),
      costPrice: rawFromUSDC(costInput),
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="panel-head">
          <h2>{product === 'new' ? 'Add Product' : 'Edit Product'}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="form-grid">
          <label>Product Name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Product Code / SKU<input value={draft.sku} onChange={event => setDraft({ ...draft, sku: event.target.value })} /></label>
          <label>Barcode / QR Code<input value={draft.barcode || ''} onChange={event => setDraft({ ...draft, barcode: event.target.value })} /></label>
          <label>
            Category
            <div className="catalog-choice">
              <select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>
                {categoryOptions.map(c => <option key={c}>{c}</option>)}
              </select>
              <button type="button" onClick={addCategory}>+</button>
              <button type="button" className="danger" onClick={deleteCategory}>Delete</button>
            </div>
          </label>
          <label>
            Unit
            <div className="catalog-choice">
              <select value={draft.unit || 'unit'} onChange={event => setDraft({ ...draft, unit: event.target.value })}>
                {unitOptions.map(unit => <option key={unit}>{unit}</option>)}
              </select>
              <button type="button" onClick={addUnit}>+</button>
              <button type="button" className="danger" onClick={deleteUnit}>Delete</button>
            </div>
          </label>
          <label>Sell Price (USDC)<input type="number" min="0" step="0.0001" value={priceInput} onChange={event => setPriceInput(event.target.value)} /></label>
          <label>Cost / Import Price (USDC)<input type="number" min="0" step="0.0001" value={costInput} onChange={event => setCostInput(event.target.value)} /></label>
          <label>Stock<input type="number" value={draft.stock} onChange={event => setDraft({ ...draft, stock: Number(event.target.value) })} /></label>
          <label>Minimum Stock<input type="number" value={draft.min} onChange={event => setDraft({ ...draft, min: Number(event.target.value) })} /></label>
          <label>Status<select value={draft.active === false ? 'inactive' : 'active'} onChange={event => setDraft({ ...draft, active: event.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label>Emoji<input value={draft.emoji} onChange={event => setDraft({ ...draft, emoji: event.target.value })} /></label>
          <label>Image URL<input value={draft.image} onChange={event => setDraft({ ...draft, image: event.target.value })} /></label>
        </div>
        <label>Description<textarea value={draft.description || ''} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
        <label className="upload-label"><Upload size={16} /> Upload Image<input type="file" accept="image/*" onChange={handleFile} /></label>
        <button className="primary full" type="button" onClick={saveDraft}><Save size={16} /> Save Product</button>
      </div>
    </div>
  );
}
