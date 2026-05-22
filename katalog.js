/**
 * katalog.js - Interactive e-Katalog Procurement Center
 * e-ProcureFlow Web Application
 */

let catalogItems = [];
let currentSelectedItem = null;

document.addEventListener('DOMContentLoaded', () => {
  // Guard page (FR-02)
  requireAuth(['PA/KPA', 'Pejabat Pengadaan', 'Pokja']);

  loadCatalog();
  setupFilterListeners();
});

function loadCatalog() {
  catalogItems = JSON.parse(localStorage.getItem('eproc_catalog') || '[]');
  renderProducts(catalogItems);
}

function renderProducts(items) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = `<div class="glass-card" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Tidak ada produk e-Katalog yang cocok dengan pencarian Anda.</div>`;
    return;
  }

  grid.innerHTML = items.map(item => {
    // Select dynamic iconic avatar based on category name
    let icon = '📦';
    if (item.category.includes('Teknologi')) icon = '💻';
    else if (item.category.includes('Infrastruktur')) icon = '⚙️';
    else if (item.category.includes('Peralatan')) icon = '❄️';
    else if (item.category.includes('Furnitur')) icon = '🪑';

    // SKP quality badge styling
    let skpBadge = `<span class="badge badge-approved">⭐️ SKP ${item.skp}</span>`;
    if (item.skp < 2.5) {
      skpBadge = `<span class="badge badge-rejected" title="Aturan pengadaan: Supplier dengan SKP < 2.5 membutuhkan verifikasi khusus.">⚠️ SKP ${item.skp}</span>`;
    }

    return `
      <div class="glass-card product-card" id="card-${item.id}">
        <div class="product-header">
          <span class="product-category-badge">${item.category}</span>
          <div class="product-skp-badge">${skpBadge}</div>
          <div class="product-icon">${icon}</div>
        </div>
        
        <h3 class="product-title" title="${item.name}">${item.name}</h3>
        <p class="product-provider">${item.provider}</p>
        
        <div class="product-price-row">
          <div>
            <span class="price-label">Harga Satuan</span>
            <div class="price-val">${formatRupiah(item.price)}</div>
          </div>
        </div>

        <div class="card-actions">
          <button class="btn btn-secondary" onclick="openProductModal('${item.id}')">Spesifikasi</button>
          <button class="btn btn-primary" onclick="addToCartDirect('${item.id}')">Beli</button>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// FILTER & SEARCH LOGIC (FR-09, FR-11)
// ==========================================
function setupFilterListeners() {
  const searchInput = document.getElementById('search-input');
  const catFilter = document.getElementById('filter-category');
  const priceSort = document.getElementById('sort-price');
  const skpFilter = document.getElementById('filter-skp');
  const syncBtn = document.getElementById('btn-sync-katalog');

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (catFilter) catFilter.addEventListener('change', applyFilters);
  if (priceSort) priceSort.addEventListener('change', applyFilters);
  if (skpFilter) skpFilter.addEventListener('change', applyFilters);

  if (syncBtn) {
    syncBtn.addEventListener('click', simulateEKatalogSync);
  }
}

function applyFilters() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  const category = document.getElementById('filter-category').value;
  const sort = document.getElementById('sort-price').value;
  const skp = document.getElementById('filter-skp').value;

  let filtered = [...catalogItems];

  // 1. Search Query (name, specs, provider)
  if (query) {
    filtered = filtered.filter(item => 
      item.name.toLowerCase().includes(query) ||
      item.specs.toLowerCase().includes(query) ||
      item.provider.toLowerCase().includes(query)
    );
  }

  // 2. Category Filter
  if (category) {
    filtered = filtered.filter(item => item.category === category);
  }

  // 3. SKP Score Quality check
  if (skp) {
    if (skp === 'good') {
      filtered = filtered.filter(item => item.skp >= 2.5);
    } else if (skp === 'bad') {
      filtered = filtered.filter(item => item.skp < 2.5);
    }
  }

  // 4. Sorting by Price
  if (sort) {
    if (sort === 'low-high') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sort === 'high-low') {
      filtered.sort((a, b) => b.price - a.price);
    }
  }

  renderProducts(filtered);
}

// ==========================================
// SIMULATE E-KATALOG SYNC INTEGRATION (FR-08)
// ==========================================
function simulateEKatalogSync() {
  const spinner = document.getElementById('sync-spinner');
  const text = document.getElementById('sync-text');
  const syncBtn = document.getElementById('btn-sync-katalog');

  if (!syncBtn) return;

  syncBtn.disabled = true;
  spinner.style.display = 'inline-block';
  text.innerText = 'Menghubungkan LKPP...';

  // Simulating external integration delay
  setTimeout(() => {
    let currentCatalog = JSON.parse(localStorage.getItem('eproc_catalog') || '[]');
    
    // Check if new product already synced to avoid duplicate addition
    const checkProduct = currentCatalog.find(p => p.id === 'PROD-008');
    
    if (!checkProduct) {
      const syncProduct = {
        id: 'PROD-008',
        name: 'Projektor Laser Panasonic PT-VMZ51 High-End',
        category: 'Peralatan Kantor',
        price: 32500000,
        provider: 'PT Panasonic Gobel IT Solutions',
        specs: '5200 Lumens, WUXGA Resolution, 1.6x Zoom Lens, Laser Light Source 20.000 Hours',
        availability: 'Ready Stock',
        skp: 4.7
      };
      currentCatalog.push(syncProduct);
      window.saveToKV('eproc_catalog', currentCatalog);
      
      // Reload catalog items array
      loadCatalog();
      showToast('Sinkronisasi Berhasil: Ditemukan 1 produk baru di LKPP Nasional!', 'success');
    } else {
      showToast('Sinkronisasi Berhasil: Katalog sudah terbarui dengan versi LKPP terbaru.', 'success');
    }

    spinner.style.display = 'none';
    text.innerText = 'Sinkronisasi e-Katalog';
    syncBtn.disabled = false;
  }, 1500);
}

// ==========================================
// DETAIL SPECIFICATIONS MODAL DIALOG (FR-10)
// ==========================================
window.openProductModal = function(id) {
  const item = catalogItems.find(p => p.id === id);
  if (!item) return;

  currentSelectedItem = item;

  document.getElementById('modal-product-name').innerText = item.name;
  
  let skpText = `<span class="badge badge-approved">⭐️ SKP Layak (${item.skp}/5.0)</span>`;
  if (item.skp < 2.5) {
    skpText = `<span class="badge badge-rejected">⚠️ Kinerja Rendah (${item.skp}/5.0)</span>`;
  }

  const modalBody = document.getElementById('modal-product-body');
  modalBody.innerHTML = `
    <div class="modal-price-tag">${formatRupiah(item.price)}</div>
    
    <div class="spec-table">
      <div class="spec-row">
        <span class="spec-name">ID Produk</span>
        <span class="spec-value">${item.id}</span>
      </div>
      <div class="spec-row">
        <span class="spec-name">Kategori</span>
        <span class="spec-value">${item.category}</span>
      </div>
      <div class="spec-row">
        <span class="spec-name">Nama Penyedia</span>
        <span class="spec-value">${item.provider}</span>
      </div>
      <div class="spec-row">
        <span class="spec-name">Skor Kinerja (SKP)</span>
        <span class="spec-value">${skpText}</span>
      </div>
      <div class="spec-row">
        <span class="spec-name">Ketersediaan</span>
        <span class="spec-value">${item.availability}</span>
      </div>
      <div class="spec-row" style="flex-direction: column; align-items: flex-start; gap: 8px; border-bottom: none;">
        <span class="spec-name">Spesifikasi Teknis</span>
        <p style="font-size: 0.85rem; color: var(--text-main); line-height: 1.5; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 6px; width: 100%; border: 1px solid var(--glass-border);">${item.specs}</p>
      </div>
    </div>
  `;

  // Attach dynamic click event to modal add button
  const addBtn = document.getElementById('modal-btn-add-cart');
  addBtn.onclick = () => {
    addToCart(item);
    closeProductModal();
  };

  const overlay = document.getElementById('product-modal');
  overlay.classList.add('open');
};

window.closeProductModal = function() {
  const overlay = document.getElementById('product-modal');
  overlay.classList.remove('open');
};

// ==========================================
// SHOPPING CART CONTROLLER (FR-12)
// ==========================================
window.addToCartDirect = function(id) {
  const item = catalogItems.find(p => p.id === id);
  if (item) addToCart(item);
};

function addToCart(item) {
  // Retrieve existing cart
  let cart = JSON.parse(localStorage.getItem('eproc_cart') || '[]');
  
  // Check if item already exists in cart
  const foundIndex = cart.findIndex(c => c.id === item.id);
  
  if (foundIndex > -1) {
    cart[foundIndex].qty += 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      qty: 1,
      provider: item.provider,
      skp: item.skp
    });
  }

  localStorage.setItem('eproc_cart', JSON.stringify(cart));
  showToast(`Berhasil menambahkan "${item.name}" ke keranjang!`, 'success');
}
