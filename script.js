const escapeHtml = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// สร้าง Supabase client เฉพาะหน้าที่โหลดไลบรารีไว้ (order.html, admin.html)
const db = (window.supabase && typeof SUPABASE_URL !== 'undefined')
  ? window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY)
  : null;

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);

  // ==========================================
  // ส่วนหน้าแสดงสินค้า
  // ==========================================
  const productList = document.getElementById('product-list');
  if (productList) {
    fetch('products.json').then(res => res.json()).then(products => {
      const moodFilter = urlParams.get('mood') || 'all';
      renderProducts(products, moodFilter);

      const filterBar = document.getElementById('filter-bar');
      if (filterBar) {
        const activeBtn = filterBar.querySelector(`[data-mood="${moodFilter}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        filterBar.addEventListener('click', (e) => {
          if (e.target.tagName === 'BUTTON') {
            filterBar.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderProducts(products, e.target.dataset.mood);
          }
        });
      }
    });
  }

  function renderProducts(products, filter) {
    productList.innerHTML = '';
    const filtered = filter === 'all' ? products : products.filter(p => p.mood === filter);
    filtered.forEach(p => {
      const name = p.name.trim();
      productList.innerHTML += `
        <div class="card">
          <span class="card-tag tag-${p.mood}">${p.mood}</span>
          <img src="${p.image}" alt="${name}">
          <h3>${name}</h3>
          <p>${p.description}</p>
          <div class="price">฿${p.price}</div>
          <a href="order.html?item=${encodeURIComponent(name)}&price=${p.price}&size=${encodeURIComponent(p.size)}" class="btn" style="text-align:center;">สั่งซื้อสินค้า</a>
        </div>
      `;
    });
  }

  // ==========================================
  // ส่วนหน้าสั่งซื้อ -> บันทึกลง Supabase
  // (Database Webhook จะเรียก Edge Function ส่ง Telegram ให้เอง)
  // ==========================================
  const orderForm = document.getElementById('orderForm');
  if (orderForm && db) {
    const itemInput = document.getElementById('items');
    const totalInput = document.getElementById('total');
    const sizeSelect = document.getElementById('size');

    const qtyInput = document.getElementById('qty');
    const unitPrice = Number(urlParams.get('price')) || 0;
    if (urlParams.has('item')) itemInput.value = urlParams.get('item');
    document.getElementById('unitPriceText').textContent = `ราคาต่อชิ้น ฿${unitPrice.toLocaleString('th-TH')}`;

    const getQty = () => Math.min(99, Math.max(1, parseInt(qtyInput.value, 10) || 1));
    const updateTotal = () => {
      qtyInput.value = getQty();
      totalInput.value = unitPrice * getQty();
    };
    document.getElementById('qtyMinus').addEventListener('click', () => { qtyInput.value = getQty() - 1; updateTotal(); });
    document.getElementById('qtyPlus').addEventListener('click', () => { qtyInput.value = getQty() + 1; updateTotal(); });
    qtyInput.addEventListener('input', updateTotal);
    updateTotal();

    // สร้างตัวเลือกไซส์จากข้อมูลสินค้า เช่น "M / L / XL"
    const sizes = (urlParams.get('size') || 'M / L / XL').split('/').map(s => s.trim()).filter(Boolean);
    sizeSelect.innerHTML = sizes.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = orderForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerText;
      submitBtn.innerText = 'กำลังส่งคำสั่งซื้อ...';
      submitBtn.disabled = true;

      const order = {
        customer_name: document.getElementById('customerName').value.trim(),
        contact: document.getElementById('contact').value.trim(),
        address: document.getElementById('address').value.trim(),
        items: itemInput.value,
        size: sizeSelect.value,
        quantity: getQty(),
        unit_price: unitPrice,
        total: unitPrice * getQty(),
        note: document.getElementById('note').value.trim() || null,
      };

      try {
        const { error } = await db.from('orders').insert(order);
        if (error) throw error;
        window.location.href = 'thankyou.html';
      } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง');
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // ส่วน Admin (ล็อกอินด้วย Supabase Auth)
  // ==========================================
  const ordersTableBody = document.querySelector('#ordersTable tbody');
  if (ordersTableBody && db) {
    const loginBox = document.getElementById('loginBox');
    const dashboard = document.getElementById('dashboard');
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');

    async function loadOrders() {
      const { data, error } = await db
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        ordersTableBody.innerHTML = `<tr><td colspan="8">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
        return;
      }
      if (!data.length) {
        ordersTableBody.innerHTML = '<tr><td colspan="8">ยังไม่มีออเดอร์</td></tr>';
        return;
      }
      ordersTableBody.innerHTML = data.map(o => `
        <tr>
          <td>${escapeHtml(new Date(o.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' }))}</td>
          <td>${escapeHtml(o.customer_name)}</td>
          <td>${escapeHtml(o.contact)}</td>
          <td>${escapeHtml(o.address)}</td>
          <td>${escapeHtml(o.items)}</td>
          <td>${escapeHtml(o.quantity)}</td>
          <td>฿${Number(o.total).toLocaleString('th-TH')}</td>
          <td>${escapeHtml(o.size)}${o.note ? ' / ' + escapeHtml(o.note) : ''}</td>
        </tr>
      `).join('');
    }

    function showDashboard(show) {
      loginBox.style.display = show ? 'none' : 'block';
      dashboard.style.display = show ? 'block' : 'none';
      if (show) loadOrders();
    }

    db.auth.getSession().then(({ data }) => showDashboard(!!data.session));

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await db.auth.signInWithPassword({
        email: document.getElementById('adminEmail').value,
        password: document.getElementById('adminPassword').value,
      });
      if (error) return alert('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      showDashboard(true);
    });

    logoutBtn.addEventListener('click', async () => {
      await db.auth.signOut();
      showDashboard(false);
    });
  }
});
