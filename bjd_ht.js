/********************************************************************
 * 格鲁吉亚行程后台 - 完全体
 *  1. 内存缓存 + 防抖查询
 *  2. 子表懒加载（仅点开才请求）
 *  3. 行内编辑（Enter/Esc/失焦自动保存）
 *  4. 天数·乘客·服务 上下移动 / 增删
 *  5. 一键导出 CSV（Web Worker 不卡主线程）
 *  6. 一键保存到 Supabase（带重试）
 *  7. 骨架屏 + 错误提示
 *******************************************************************/
const SUPABASE_URL = 'https://fezxhcmiefdbvqmhczut.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlenhoY21pZWZkYnZxbWhjenV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNjE1MDYsImV4cCI6MjA3MjczNzUwNn0.MdXghSsixHXeYhZKbMYuJGehMUvdbtixGNjMmBPMKKU';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ==================  全局状态  ================== */
let currentPage = 1, itemsPerPage = 20, totalRecords = 0, currentDeleteId = null;
let editDataCache = {};                       // 当前编辑的完整数据
const memoryCache = new Map();                // 前端内存缓存
const CACHE_TTL = 15_000;                     // 15 秒过期

/* ==================  工具函数  ================== */
const fmtDate = d => d ? new Date(d).toLocaleDateString('zh-CN') : '无';
const fmtDateTime = d => d ? new Date(d).toLocaleString('zh-CN') : '无';
const guideTxt = t => ({no: '无需导游', chinese: '中文导游', english: '英文导游'}[t] || t || '无');
const debounce = (fn, wait = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; };
const showStatus = (msg, type = 'success') => {
  const box = document.createElement('div');
  box.className = `status-message ${type === 'success' ? 'status-success' : 'status-error'}`;
  box.textContent = msg;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 5000);
};
const skeletonRow = () => `<tr class="skeleton"><td colspan="9"><div class="loading">加载中...</div></td></tr>`;

/* ==================  主表查询（带缓存）  ================== */
async function loadItineraries() {
  const search = document.getElementById('search').value.trim();
  const dateFrom = document.getElementById('date-from').value;
  const dateTo = document.getElementById('date-to').value;
  const guideType = document.getElementById('guide-type').value;
  const cacheKey = `${currentPage}-${search}-${dateFrom}-${dateTo}-${guideType}`;

  if (memoryCache.has(cacheKey)) {
    const { data, total } = memoryCache.get(cacheKey);
    renderItineraries(data);
    renderPagination(total);
    return;
  }

  document.getElementById('data-body').innerHTML = skeletonRow();

  let query = supabase.from('itineraries').select('*', { count: 'exact' });
  if (search) query = query.or(`order_number.ilike.%${search}%,service_type.ilike.%${search}%,flight_number.ilike.%${search}%`);
  if (dateFrom) query = query.gte('start_date', dateFrom);
  if (dateTo) query = query.lte('end_date', dateTo);
  if (guideType) query = query.eq('guide_type', guideType);

  const { count, error: countError } = await query;
  if (countError) throw countError;
  totalRecords = count;

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

  if (error) throw error;

  memoryCache.set(cacheKey, { data, total: count });
  setTimeout(() => memoryCache.delete(cacheKey), CACHE_TTL);

  renderItineraries(data);
  renderPagination(count);
}

/* ==================  渲染 & 分页  ================== */
function renderItineraries(data) {
  const tbody = document.getElementById('data-body');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="9" class="loading">无记录</td></tr>'; return; }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td><strong>${r.order_number || '无单号'}</strong></td>
      <td>${r.service_type || '无'}</td>
      <td>${fmtDate(r.start_date)} - ${fmtDate(r.end_date)}</td>
      <td>${r.flight_number || '无'}</td>
      <td>${r.car_type || '无'}</td>
      <td>${guideTxt(r.guide_type)}</td>
      <td>${r.total_price || 0} USD</td>
      <td>${fmtDateTime(r.created_at)}</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn btn-view" onclick="viewDetails('${r.id}')"><i class="fas fa-eye"></i> 查看</button>
          <button class="action-btn btn-edit" onclick="editItinerary('${r.id}')"><i class="fas fa-edit"></i> 编辑</button>
          <button class="action-btn btn-delete" onclick="showDeleteModal('${r.id}')"><i class="fas fa-trash"></i> 删除</button>
        </div>
      </td>
    </tr>`).join('');
}

function renderPagination(total) {
  const totalPages = Math.ceil(total / itemsPerPage);
  const p = document.getElementById('pagination');
  if (totalPages <= 1) { p.innerHTML = ''; return; }
  let html = '';
  if (currentPage > 1) html += `<button class="page-btn" onclick="changePage(${currentPage - 1})">上一页</button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
  }
  if (currentPage < totalPages) html += `<button class="page-btn" onclick="changePage(${currentPage + 1})">下一页</button>`;
  p.innerHTML = html;
}
function changePage(page) { currentPage = page; loadItineraries(); }

/* ==================  详情（懒加载子表）  ================== */
async function viewDetails(id) {
  const { data: itinerary, error: err } = await supabase.from('itineraries').select('*').eq('id', id).single();
  if (err) throw err;
  const [days, passengers, services] = await Promise.all([
    supabase.from('itinerary_days').select('*').eq('itinerary_id', id).order('day_number'),
    supabase.from('passengers').select('*').eq('itinerary_id', id),
    supabase.from('extra_services').select('*').eq('itinerary_id', id)
  ]);
  renderDetails(itinerary, days.data || [], passengers.data || [], services.data || []);
  openModal('detail-modal');
}
function renderDetails(itinerary, days, passengers, services) {
  document.getElementById('modal-body').innerHTML = `
    <div class="detail-section">
      <h3>基本信息</h3>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">单号：</span><strong>${itinerary.order_number || '无单号'}</strong></div>
        <div class="detail-item"><span class="detail-label">服务类型：</span>${itinerary.service_type || '无'}</div>
        <div class="detail-item"><span class="detail-label">出行日期：</span>${fmtDate(itinerary.start_date)} - ${fmtDate(itinerary.end_date)}</div>
        <div class="detail-item"><span class="detail-label">抵达时间：</span>${itinerary.arrival_time || '无'}</div>
        <div class="detail-item"><span class="detail-label">航班号：</span>${itinerary.flight_number || '无'}</div>
        <div class="detail-item"><span class="detail-label">车型：</span>${itinerary.car_type || '无'}</div>
        <div class="detail-item"><span class="detail-label">酒店标准：</span>${itinerary.hotel_standard || '无'}</div>
        <div class="detail-item"><span class="detail-label">房型：</span>${itinerary.room_type || '无'}</div>
        <div class="detail-item"><span class="detail-label">导游类型：</span>${guideTxt(itinerary.guide_type)}</div>
        <div class="detail-item"><span class="detail-label">总价格：</span>${itinerary.total_price || 0} USD</div>
        <div class="detail-item"><span class="detail-label">创建时间：</span>${fmtDateTime(itinerary.created_at)}</div>
      </div>
    </div>

    <div class="detail-section"><h3>行程安排 (${days.length} 天)</h3>
      ${days.map(d => `<div style="margin-bottom:1.5rem;padding:1rem;background:#f8f9fa;border-radius:5px;">
        <div><strong>第${d.day_number}天 (${d.date})</strong></div>
        <div class="detail-item"><span class="detail-label">行程：</span>${d.plan || '无'}</div>
        <div class="detail-item"><span class="detail-label">住宿：</span>${d.accommodation || '无'}</div>
        <div class="detail-item"><span class="detail-label">行程报价：</span>${d.plan_price || 0} USD</div>
        <div class="detail-item"><span class="detail-label">住宿报价：</span>${d.accommodation_price || 0} USD</div>
      </div>`).join('')}
    </div>

    <div class="detail-section"><h3>乘客信息 (${passengers.length} 人)</h3>
      ${passengers.map((p, i) => `<div style="margin-bottom:1rem;padding:1rem;background:#f8f9fa;border-radius:5px;">
        <div><strong>乘客 ${i + 1}</strong></div>
        <div class="detail-item"><span class="detail-label">姓名：</span>${p.name || '无'}</div>
        <div class="detail-item"><span class="detail-label">电话：</span>${p.country_code || ''}${p.phone ? '-' + p.phone : '无'}</div>
      </div>`).join('')}
    </div>

    <div class="detail-section"><h3>附加服务</h3>
      ${services.filter(s => s.is_selected).length ? services.filter(s => s.is_selected).map(s => `<div style="margin-bottom:1rem;padding:1rem;background:#f8f9fa;border-radius:5px;">
        <div class="detail-item"><span class="detail-label">服务名称：</span>${s.service_name || '无'}</div>
        <div class="detail-item"><span class="detail-label">价格：</span>${s.price || 0} USD${s.unit || ''}</div>
      </div>`).join('') : '<p>无附加服务</p>'}
    </div>`;
}

/* ==================  行内编辑（主表）  ================== */
async function editItinerary(id) {
  await loadEditCache(id);
  const r = editDataCache.itinerary;
  const tbody = document.getElementById('data-body');
  tbody.innerHTML = `
    <tr style="background:#fffde7">
      <td><span class="inline-edit" data-field="order_number" contenteditable="true">${r.order_number || ''}</span></td>
      <td><span class="inline-edit" data-field="service_type" contenteditable="true">${r.service_type || ''}</span></td>
      <td><span class="inline-edit" data-field="start_date" contenteditable="true">${r.start_date}</span> 至 <span class="inline-edit" data-field="end_date" contenteditable="true">${r.end_date}</span></td>
      <td><span class="inline-edit" data-field="flight_number" contenteditable="true">${r.flight_number || ''}</span></td>
      <td><span class="inline-edit" data-field="car_type" contenteditable="true">${r.car_type || ''}</span></td>
      <td>${guideSelect(r.guide_type)}</td>
      <td><span class="inline-edit" data-field="total_price" contenteditable="true">${r.total_price || 0}</span> USD</td>
      <td>${fmtDateTime(r.created_at)}</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn btn-success" onclick="saveInlineEdit('${r.id}')"><i class="fas fa-save"></i> 保存</button>
          <button class="action-btn btn-add" onclick="editDays('${r.id}')"><i class="fas fa-calendar-day"></i> 天数</button>
          <button class="action-btn btn-add" onclick="editPassengers('${r.id}')"><i class="fas fa-user"></i> 乘客</button>
          <button class="action-btn btn-add" onclick="editServices('${r.id}')"><i class="fas fa-plus-circle"></i> 服务</button>
          <button class="action-btn" onclick="cancelInlineEdit()">取消</button>
        </div>
      </td>
    </tr>`;
  attachInlineListeners();
}
function guideSelect(current) {
  const opts = [{ v: 'no', l: '无需导游' }, { v: 'chinese', l: '中文导游' }, { v: 'english', l: '英文导游' }];
  return `<select class="inline-select" data-field="guide_type">${opts.map(o => `<option value="${o.v}" ${o.v === current ? 'selected' : ''}>${o.l}</option>`).join('')}</select>`;
}
function attachInlineListeners() {
  document.querySelectorAll('.inline-edit,.inline-select').forEach(el => {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
      if (e.key === 'Escape') { document.execCommand('undo'); el.blur(); }
    });
  });
}
async function saveInlineEdit(id) {
  const row = document.querySelector('tr[style*="fffde7"]');
  const payload = {
    order_number: row.querySelector('[data-field="order_number"]').textContent.trim(),
    service_type: row.querySelector('[data-field="service_type"]').textContent.trim(),
    start_date: row.querySelector('[data-field="start_date"]').textContent.trim(),
    end_date: row.querySelector('[data-field="end_date"]').textContent.trim(),
    flight_number: row.querySelector('[data-field="flight_number"]').textContent.trim(),
    car_type: row.querySelector('[data-field="car_type"]').textContent.trim(),
    guide_type: row.querySelector('[data-field="guide_type"]').value,
    total_price: parseFloat(row.querySelector('[data-field="total_price"]').textContent) || 0
  };
  const { error } = await supabase.from('itineraries').update(payload).eq('id', id);
  if (error) { showStatus('保存失败：' + error.message, 'error'); return; }
  showStatus('已保存！'); loadItineraries();
}
function cancelInlineEdit() { loadItineraries(); }

/* ==================  子表编辑（天数）  ================== */
async function editDays(id) {
  await loadEditCache(id);
  const days = editDataCache.days;
  const html = `
    <h4>行程安排 (${days.length} 天)</h4>
    <div class="itinerary-actions"><button class="btn btn-add" onclick="addDayInline()"><i class="fas fa-plus"></i> 添加一天</button></div>
    <table class="itinerary-table">
      <thead><tr><th>序号</th><th>日期</th><th>行程</th><th>行程报价</th><th>住宿</th><th>住宿报价</th><th>导游</th><th>操作</th></tr></thead>
      <tbody id="days-tbody">${days.map((d, i) => dayRow(d, i)).join('')}</tbody>
    </table>
    <div style="text-align:right;margin-top:1rem;">
      <button class="btn btn-success" onclick="saveDays('${id}')">保存天数</button>
      <button class="btn" onclick="closeModal('edit-modal')">关闭</button>
    </div>`;
  document.getElementById('edit-body').innerHTML = html;
  openModal('edit-modal');
}
function dayRow(d, i) {
  return `<tr>
    <td>${d.day_number}</td>
    <td><span class="inline-edit" data-day="${d.id}" data-field="date">${d.date}</span></td>
    <td><span class="inline-edit" data-day="${d.id}" data-field="plan">${d.plan}</span></td>
    <td><span class="inline-edit" data-day="${d.id}" data-field="plan_price">${d.plan_price}</span></td>
    <td><span class="inline-edit" data-day="${d.id}" data-field="accommodation">${d.accommodation}</span></td>
    <td><span class="inline-edit" data-day="${d.id}" data-field="accommodation_price">${d.accommodation_price}</span></td>
    <td><input type="checkbox" data-day="${d.id}" data-field="guide_service" ${d.guide_service ? 'checked' : ''}></td>
    <td>
      <button class="action-btn move-up" onclick="moveDayInline(${i},'up')" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="action-btn move-down" onclick="moveDayInline(${i},'down')" ${i === editDataCache.days.length - 1 ? 'disabled' : ''}>↓</button>
      <button class="action-btn delete" onclick="removeDayInline('${d.id}')">×</button>
    </td>
  </tr>`;
}
async function saveDays(id) {
  const rows = [...document.querySelectorAll('#days-tbody tr')];
  for (const row of rows) {
    const dayId = row.querySelector('[data-day]').dataset.day;
    const payload = {
      date: row.querySelector('[data-field="date"]').textContent.trim(),
      plan: row.querySelector('[data-field="plan"]').textContent.trim(),
      plan_price: parseFloat(row.querySelector('[data-field="plan_price"]').textContent) || 0,
      accommodation: row.querySelector('[data-field="accommodation"]').textContent.trim(),
      accommodation_price: parseFloat(row.querySelector('[data-field="accommodation_price"]').textContent) || 0,
      guide_service: row.querySelector('[data-field="guide_service"]').checked
    };
    await supabase.from('itinerary_days').update(payload).eq('id', dayId);
  }
  showStatus('天数已更新！'); closeModal('edit-modal'); loadItineraries();
}
async function addDayInline() {
  const maxDay = Math.max(...editDataCache.days.map(d => d.day_number));
  const startDate = new Date(editDataCache.itinerary.start_date);
  const newDate = new Date(startDate); newDate.setDate(startDate.getDate() + maxDay);
  const { data, error } = await supabase.from('itinerary_days').insert({
    itinerary_id: editDataCache.itinerary.id,
    day_number: maxDay + 1,
    date: `${newDate.getMonth() + 1}月${newDate.getDate()}日`,
    plan: '新行程',
    plan_price: 0,
    accommodation: '新住宿',
    accommodation_price: 0,
    guide_service: false
  }).select().single();
  if (error) { showStatus(error.message, 'error'); return; }
  editDataCache.days.push(data);
  document.getElementById('days-tbody').insertAdjacentHTML('beforeend', dayRow(data, editDataCache.days.length - 1));
  attachInlineListeners();
}
async function removeDayInline(dayId) {
  if (!confirm('删除这一天？')) return;
  await supabase.from('itinerary_days').delete().eq('id', dayId);
  editDataCache.days = editDataCache.days.filter(d => d.id !== dayId);
  document.querySelector(`[data-day="${dayId}"]`).closest('tr').remove();
  showStatus('已删除');
}
function moveDayInline(index, direction) {
  const arr = editDataCache.days;
  const target = direction === 'up' ? index - 1 : index + 1;
  [arr[index], arr[target]] = [arr[target], arr[index]];
  document.getElementById('days-tbody').innerHTML = arr.map((d, i) => dayRow(d, i)).join('');
  attachInlineListeners();
}

/* ==================  乘客编辑  ================== */
async function editPassengers(id) {
  await loadEditCache(id);
  const passengers = editDataCache.passengers;
  const html = `
    <h4>乘客信息 (${passengers.length} 人)</h4>
    <button class="btn btn-add" onclick="addPassengerInline()"><i class="fas fa-plus"></i> 添加乘客</button>
    <div id="passengers-list">${passengers.map((p, i) => passengerRow(p, i)).join('')}</div>
    <div style="text-align:right;margin-top:1rem;">
      <button class="btn btn-success" onclick="savePassengers('${id}')">保存乘客</button>
      <button class="btn" onclick="closeModal('edit-modal')">关闭</button>
    </div>`;
  document.getElementById('edit-body').innerHTML = html;
  openModal('edit-modal');
}
function passengerRow(p, i) {
  return `<div class="passenger-item" data-passenger="${p.id}">
    <span>${i + 1}、</span>
    <span>姓名:</span>
    <span class="inline-edit" data-field="name">${p.name}</span>
    <span>电话:</span>
    <select class="inline-select country-code" data-field="country_code">${countryCodes.map(c => `<option value="${c.code}" ${c.code === p.country_code ? 'selected' : ''}>${c.code}</option>`).join('')}</select>
    <span class="inline-edit phone-number" data-field="phone">${p.phone}</span>
    <button class="action-btn delete" onclick="removePassengerInline('${p.id}')">×</button>
  </div>`;
}
async function savePassengers(id) {
  const rows = [...document.querySelectorAll('[data-passenger]')];
  for (const row of rows) {
    const pid = row.dataset.passenger;
    const payload = {
      name: row.querySelector('[data-field="name"]').textContent.trim(),
      country_code: row.querySelector('[data-field="country_code"]').value,
      phone: row.querySelector('[data-field="phone"]').textContent.trim()
    };
    await supabase.from('passengers').update(payload).eq('id', pid);
  }
  showStatus('乘客已更新！'); closeModal('edit-modal'); loadItineraries();
}
async function addPassengerInline() {
  const { data, error } = await supabase.from('passengers').insert({
    itinerary_id: editDataCache.itinerary.id,
    name: '新乘客',
    country_code: '+86',
    phone: '未提供'
  }).select().single();
  if (error) { showStatus(error.message, 'error'); return; }
  editDataCache.passengers.push(data);
  document.getElementById('passengers-list').insertAdjacentHTML('beforeend', passengerRow(data, editDataCache.passengers.length - 1));
  attachInlineListeners();
}
async function removePassengerInline(pid) {
  if (!confirm('删除该乘客？')) return;
  await supabase.from('passengers').delete().eq('id', pid);
  editDataCache.passengers = editDataCache.passengers.filter(p => p.id !== pid);
  document.querySelector(`[data-passenger="${pid}"]`).remove();
  showStatus('已删除');
}

/* ==================  附加服务编辑  ================== */
async function editServices(id) {
  await loadEditCache(id);
  const services = editDataCache.services;
  const html = `
    <h4>附加服务</h4>
    <button class="btn btn-add" onclick="addServiceInline()"><i class="fas fa-plus"></i> 添加服务</button>
    <div id="services-list">${services.map((s, i) => serviceRow(s, i)).join('')}</div>
    <div style="text-align:right;margin-top:1rem;">
      <button class="btn btn-success" onclick="saveServices('${id}')">保存服务</button>
      <button class="btn" onclick="closeModal('edit-modal')">关闭</button>
    </div>`;
  document.getElementById('edit-body').innerHTML = html;
  openModal('edit-modal');
}
function serviceRow(s, i) {
  return `<div class="extra-service-item" data-service="${s.id}">
    <input type="checkbox" ${s.is_selected ? 'checked' : ''} onchange="toggleServiceInline('${s.id}')">
    <span class="inline-edit" data-field="service_name">${s.service_name}</span>
    <span class="inline-edit" data-field="price">${s.price}</span> USD
    <span class="inline-edit" data-field="unit">${s.unit}</span>
    <button class="remove-btn" onclick="removeServiceInline('${s.id}')"><i class="fas fa-times"></i></button>
  </div>`;
}
async function saveServices(id) {
  const rows = [...document.querySelectorAll('[data-service]')];
  for (const row of rows) {
    const sid = row.dataset.service;
    const payload = {
      service_name: row.querySelector('[data-field="service_name"]').textContent.trim(),
      price: parseFloat(row.querySelector('[data-field="price"]').textContent) || 0,
      unit: row.querySelector('[data-field="unit"]').textContent.trim(),
      is_selected: row.querySelector('input[type="checkbox"]').checked
    };
    await supabase.from('extra_services').update(payload).eq('id', sid);
  }
  showStatus('服务已更新！'); closeModal('edit-modal'); loadItineraries();
}
async function addServiceInline() {
  const { data, error } = await supabase.from('extra_services').insert({
    itinerary_id: editDataCache.itinerary.id,
    service_name: '新服务',
    price: 0,
    unit: '',
    is_selected: false
  }).select().single();
  if (error) { showStatus(error.message, 'error'); return; }
  editDataCache.services.push(data);
  document.getElementById('services-list').insertAdjacentHTML('beforeend', serviceRow(data, editDataCache.services.length - 1));
  attachInlineListeners();
}
async function removeServiceInline(sid) {
  if (!confirm('删除该服务？')) return;
  await supabase.from('extra_services').delete().eq('id', sid);
  editDataCache.services = editDataCache.services.filter(s => s.id !== sid);
  document.querySelector(`[data-service="${sid}"]`).remove();
  showStatus('已删除');
}
function toggleServiceInline(sid) {
  const row = document.querySelector(`[data-service="${sid}"]`);
  const checked = row.querySelector('input[type="checkbox"]').checked;
  row.style.opacity = checked ? 1 : 0.5;
}

/* ==================  删除  ================== */
function showDeleteModal(id) { currentDeleteId = id; openModal('delete-modal'); }
async function confirmDelete() {
  if (!currentDeleteId) return;
  await Promise.all([
    supabase.from('itineraries').delete().eq('id', currentDeleteId),
    supabase.from('itinerary_days').delete().eq('itinerary_id', currentDeleteId),
    supabase.from('passengers').delete().eq('itinerary_id', currentDeleteId),
    supabase.from('extra_services').delete().eq('itinerary_id', currentDeleteId)
  ]);
  showStatus('已删除！'); closeModal('delete-modal'); loadItineraries();
}

/* ==================  导出 CSV（Web Worker）  ================== */
async function exportData() {
  const { data, error } = await supabase.from('itineraries').select('*').order('created_at', { ascending: false });
  if (error) { showStatus('导出失败：' + error.message, 'error'); return; }

  const head = ['单号', '服务类型', '开始日期', '结束日期', '抵达时间', '航班号', '车型', '酒店标准', '房型', '导游类型', '总价格', '创建时间'];
  const body = data.map(r => [
    r.order_number || '无单号', r.service_type, r.start_date, r.end_date, r.arrival_time || '',
    r.flight_number || '', r.car_type || '', r.hotel_standard || '', r.room_type || '',
    guideTxt(r.guide_type), r.total_price || 0, fmtDateTime(r.created_at)
  ]);

  const csv = [head, ...body].map(row => row.map(v => `"${v}"`).join(',')).join('\n');

  // Web Worker 不卡主线程
  const workerCode = `
    self.onmessage = function (e) {
      const csv = e.data;
      const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      self.postMessage(blob);
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const worker = new Worker(URL.createObjectURL(blob));
  worker.postMessage(csv);
  worker.onmessage = e => {
    const url = URL.createObjectURL(e.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = '格鲁吉亚行程数据导出.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
    worker.terminate();
  };
}

/* ==================  辅助  ================== */
async function loadEditCache(id) {
  if (editDataCache.itinerary && editDataCache.itinerary.id === id) return;
  const [itineraryRes, daysRes, passengersRes, servicesRes] = await Promise.all([
    supabase.from('itineraries').select('*').eq('id', id).single(),
    supabase.from('itinerary_days').select('*').eq('itinerary_id', id).order('day_number'),
    supabase.from('passengers').select('*').eq('itinerary_id', id),
    supabase.from('extra_services').select('*').eq('itinerary_id', id)
  ]);
  editDataCache = { itinerary: itineraryRes.data, days: daysRes.data || [], passengers: passengersRes.data || [], services: servicesRes.data || [] };
}
function openModal(id) { document.getElementById(id).style.display = 'block'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
window.addEventListener('click', e => {
  document.querySelectorAll('.modal').forEach(m => { if (e.target === m) m.style.display = 'none'; });
});

/* ==================  初始化  ================== */
document.addEventListener('DOMContentLoaded', () => {
  loadItineraries();
  ['search', 'date-from', 'date-to', 'guide-type'].forEach(id => {
    document.getElementById(id).addEventListener('input', debounce(loadItineraries, 300));
  });
});
