const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRYTofrqiijrsYg2A-hIBflqWr6Lpkg-v9ejn0RpuzxNztDGyowtHiinOZMD1flxoC/exec';
const CSV_URL = 'YOUR_CSV_URL';

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
      productList.innerHTML += `
        <div class="card">
          <span class="card-tag tag-${p.mood}">${p.mood}</span>
          <img src="${p.image}" alt="${p.name}">
          <h3>${p.name}</h3>
          <p>${p.description}</p>
          <div class="price">฿${p.price}</div>
          <a href="order.html?item=${encodeURIComponent(p.name)}&price=${p.price}" class="btn" style="text-align:center;">สั่งซื้อสินค้า</a>
        </div>
      `;
    });
  }

  // ==========================================
  // ส่วนหน้าสั่งซื้อ (แก้ใหม่ ชัวร์ 100%)
  // ==========================================
  const orderForm = document.getElementById('orderForm');
  if (orderForm) {
    const itemInput = document.getElementById('items');
    const totalInput = document.getElementById('total');
    if (urlParams.has('item')) itemInput.value = urlParams.get('item');
    if (urlParams.has('price')) totalInput.value = urlParams.get('price');

    orderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // ใช้ URLSearchParams แทน FormData เพื่อให้ Google Sheet อ่านออกแน่นอน
      const payload = new URLSearchParams();
      payload.append('ชื่อ-นามสกุล ผู้รับ', document.getElementById('customerName').value);
      payload.append('เบอร์โทรศัพท์ / LINE ID', document.getElementById('contact').value);
      payload.append('ที่อยู่', document.getElementById('contact').value);
      payload.append('รายการสินค้า', itemInput.value);
      payload.append('ยอดรวมทั้งสิ้น (บาท)', totalInput.value);
      payload.append('ไซส์ที่ต้องการ / หมายเหตุเพิ่มเติม', document.getElementById('note').value);

      const submitBtn = orderForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerText;
      submitBtn.innerText = 'กำลังส่งคำสั่งซื้อ...';
      submitBtn.disabled = true;

      // ส่งข้อมูลไป Google Sheet
      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: payload.toString()
      }).then(() => {
        window.location.href = 'thankyou.html'; 
      }).catch(err => {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง');
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
      });
    });
  }

  // ==========================================
  // ส่วน Admin
  // ==========================================
  const ordersTableBody = document.querySelector('#ordersTable tbody');
  if (ordersTableBody) {
    fetch(CSV_URL).then(res => res.text()).then(csv => {
      const rows = csv.split('\n').slice(1);
      rows.reverse().forEach(row => {
        if (!row.trim()) return;
        const cols = row.split(',');
        ordersTableBody.innerHTML += `<tr>${cols.map(c => `<td>${c}</td>`).join('')}</tr>`;
      });
    });
  }
});
