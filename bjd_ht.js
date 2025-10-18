/********************************************************************
 * 格鲁吉亚行程后台 - 主表+附表全编辑版
 *  1. 主表弹窗编辑
 *  2. 子表弹窗行内编辑
 *  3. Enter 失焦保存 / Esc 撤销
 *******************************************************************/
const SUPABASE_URL = 'https://fezxhcmiefdbvqmhczut.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlenhoY21pZWZkYnZxbWhjenV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNjE1MDYsImV4cCI6MjA3MjczNzUwNn0.MdXghSsixHXeYhZKbMYuJGehMUvdbtixGNjMmBPMKKU';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- 工具函数 ---------- */
const fmtDate = d => d ? new Date(d).toLocaleDateString('zh-CN') : '无';
const fmtDateTime = d => d ? new Date(d).toLocaleString('zh-CN') : '无';
const guideTxt = t => ({ no: '无需导游', chinese: '中文导游', english: '英文导游' }[t] || t || '无');
const debounce = (fn, wait = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; };
const showStatus = (msg, type = 'success') => {
  const box = Object.assign(document.createElement('div'), { className: `status-message ${type}`, textContent: msg });
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3000);
};
/* 国际区号列表 */
const countryCodes = [
  { code: '+86',  country: '中国' },
  { code: '+995', country: '格鲁吉亚' },
  { code: '+1',   country: '美国/加拿大' },
  { code: '+7',   country: '俄罗斯' },
  { code: '+81',  country: '日本' },
  { code: '+82',  country: '韩国' },
  { code: '+33',  country: '法国' },
  { code: '+49',  country: '德国' },
  { code: '+44',  country: '英国' }
];

/* ---------- 主表加载 ---------- */
let currentPage = 1, itemsPerPage = 20, totalRecords = 0;
async function loadItineraries() {
  document.getElementById('data-body').innerHTML = '<tr><td colspan="9" class="loading">加载中...</td></tr>';
  const { data, error, count } = await supabase
    .from('itineraries')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);
  if (error) { showStatus('加载失败：' + error.message, 'error'); return; }
  totalRecords = count;
  renderItineraries(data || []);
  renderPagination(count);
}
function renderItineraries(data) {
  const tbody = document.getElementById('data-body');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="9">无记录</td></tr>'; return; }
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
  for (let i = 1; i <= totalPages; i++) html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
  if (currentPage < totalPages) html += `<button class="page-btn" onclick="changePage(${currentPage + 1})">下一页</button>`;
  p.innerHTML = html;
}
function changePage(page) { currentPage = page; loadItineraries(); }

/* ---------- 详情弹窗 ---------- */
async function viewDetails(id) {
  const [{ data: itinerary }, { data: days }, { data: passengers }, { data: services }] = await Promise.all([
    supabase.from('itineraries').select('*').eq('id', id).single(),
    supabase.from('itinerary_days').select('*').eq('itinerary_id', id).order('day_number'),
    supabase.from('passengers').select('*').eq('itinerary_id', id),
    supabase.from('extra_services').select('*').eq('itinerary_id', id)
  ]);
  document.getElementById('modal-body').innerHTML = `
    <div class="detail-section"><h3>基本信息</h3><div class="detail-grid">
      <div><span class="detail-label">单号：</span><strong>${itinerary.order_number || '无单号'}</strong></div>
      <div><span class="detail-label">服务类型：</span>${itinerary.service_type}</div>
      <div><span class="detail-label">出行日期：</span>${fmtDate(itinerary.start_date)} - ${fmtDate(itinerary.end_date)}</div>
      <div><span class="detail-label">航班号：</span>${itinerary.flight_number || '无'}</div>
      <div><span class="detail-label">车型：</span>${itinerary.car_type || '无'}</div>
      <div><span class="detail-label">导游类型：</span>${guideTxt(itinerary.guide_type)}</div>
      <div><span class="detail-label">总价格：</span>${itinerary.total_price || 0} USD</div>
    </div></div>
    <div class="detail-section"><h3>行程安排 (${days?.length || 0} 天)</h3>
      ${days?.map(d => `<div style="margin-bottom:1rem;padding:1rem;background:#f8f9fa;border-radius:5px;">
        <div><strong>第${d.day_number}天 (${d.date})</strong></div>
        <div>行程：${d.plan}</div><div>住宿：${d.accommodation}</div>
        <div>行程报价：${d.plan_price} USD</div><div>住宿报价：${d.accommodation_price} USD</div>
      </div>`).join('') || '<p>无行程</p>'}</div>
    <div class="detail-section"><h3>乘客 (${passengers?.length || 0} 人)</h3>
      ${passengers?.map((p, i) => `<div style="margin-bottom:1rem;padding:1rem;background:#f8f9fa;border-radius:5px;">
        <div><strong>乘客 ${i + 1}</strong></div><div>姓名：${p.name}</div><div>电话：${p.country_code}${p.phone}</div>
      </div>`).join('') || '<p>无乘客</p>'}</div>
    <div class="detail-section"><h3>附加服务</h3>
      ${services?.filter(s => s.is_selected).map(s => `<div style="margin-bottom:1rem;padding:1rem;background:#f8f9fa;border-radius:5px;">
        <div>服务：${s.service_name}</div><div>价格：${s.price} USD${s.unit}</div>
      </div>`).join('') || '<p>无附加服务</p>'}</div>`;
  openModal('modal');
}

/* ---------- 编辑缓存 ---------- */
let editCache = {};
async function loadEditCache(id) {
  if (editCache.itinerary?.id === id) return;
  const [it, d, p, s] = await Promise.all([
    supabase.from('itineraries').select('*').eq('id', id).single(),
    supabase.from('itinerary_days').select('*').eq('itinerary_id', id).order('day_number'),
    supabase.from('passengers').select('*').eq('itinerary_id', id),
    supabase.from('extra_services').select('*').eq('itinerary_id', id)
  ]);
  editCache = { itinerary: it.data, days: d.data || [], passengers: p.data || [], services: s.data || [] };
}

/* ---------- 主表编辑 ---------- */
async function editItinerary(id) {
  await loadEditCache(id);
  const it = editCache.itinerary;
  const html = `
    <h4>编辑行程基本信息</h4>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
      <div class="filter-item">
        <label>单号</label>
        <input type="text" id="edit-order-number" value="${it.order_number || ''}" />
      </div>
      <div class="filter-item">
        <label>服务类型</label>
        <input type="text" id="edit-service-type" value="${it.service_type || ''}" />
      </div>
      <div class="filter-item">
        <label>开始日期</label>
        <input type="date" id="edit-start-date" value="${it.start_date || ''}" />
      </div>
      <div class="filter-item">
        <label>结束日期</label>
        <input type="date" id="edit-end-date" value="${it.end_date || ''}" />
      </div>
      <div class="filter-item">
        <label>航班号</label>
        <input type="text" id="edit-flight-number" value="${it.flight_number || ''}" />
      </div>
      <div class="filter-item">
        <label>车型</label>
        <input type="text" id="edit-car-type" value="${it.car_type || ''}" />
      </div>
      <div class="filter-item">
        <label>导游类型</label>
        <select id="edit-guide-type">
          <option value="no" ${it.guide_type === 'no' ? 'selected' : ''}>无需导游</option>
          <option value="chinese" ${it.guide_type === 'chinese' ? 'selected' : ''}>中文导游</option>
          <option value="english" ${it.guide_type === 'english' ? 'selected' : ''}>英文导游</option>
        </select>
      </div>
      <div class="filter-item">
        <label>总价格 (USD)</label>
        <input type="number" id="edit-total-price" value="${it.total_price || 0}" />
      </div>
    </div>
    <div style="margin-top:2rem;">
      <button class="btn btn-success" onclick="saveMainItinerary('${id}')">保存主表</button>
      <button class="btn" onclick="closeModal()">关闭</button>
    </div>
    <div style="margin-top:2rem;">
      <button class="btn btn-add" onclick="editDays('${id}')">编辑天数</button>
      <button class="btn btn-add" onclick="editPassengers('${id}')">编辑乘客</button>
      <button class="btn btn-add" onclick="editServices('${id}')">编辑附加服务</button>
    </div>
  `;
  document.getElementById('modal-body').innerHTML = html;
  openModal('modal');
}
async function saveMainItinerary(id) {
  const payload = {
    order_number: document.getElementById('edit-order-number').value.trim(),
    service_type: document.getElementById('edit-service-type').value.trim(),
    start_date: document.getElementById('edit-start-date').value,
    end_date: document.getElementById('edit-end-date').value,
    flight_number: document.getElementById('edit-flight-number').value.trim(),
    car_type: document.getElementById('edit-car-type').value.trim(),
    guide_type: document.getElementById('edit-guide-type').value,
    total_price: parseFloat(document.getElementById('edit-total-price').value) || 0
  };
  const { error } = await supabase
    .from('itineraries')
    .update(payload)
    .eq('id', id);
  if (error) { showStatus('主表保存失败：' + error.message, 'error'); return; }
  showStatus('主表已保存');
  closeModal();
  loadItineraries();   // 刷新列表
}

/* ---------- 天数编辑 ---------- */
async function editDays(id) {
  await loadEditCache(id);
  const html = `
    <h4>行程安排 (${editCache.days.length} 天)</h4>
    <button class="btn btn-add" onclick="addDay()"><i class="fas fa-plus"></i> 添加一天</button>
    <table class="itinerary-table">
      <thead><tr><th>序号</th><th>日期</th><th>行程</th><th>行程报价</th><th>住宿</th><th>住宿报价</th><th>导游</th><th>操作</th></tr></thead>
      <tbody id="days-tbody">${editCache.days.map((d, i) => dayRow(d, i)).join('')}</tbody>
    </table>
    <div style="text-align:right;margin-top:1rem;">
      <button class="btn btn-success" onclick="saveDays('${id}')">保存天数</button>
      <button class="btn" onclick="closeModal()">关闭</button>
    </div>
  `;
  document.getElementById('modal-body').innerHTML = html;
  openModal('modal');
  setTimeout(() => attachInputs(true), 0);   // 强制刷新缓存
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
      <button class="action-btn move-up" ${i === 0 ? 'disabled' : ''} onclick="moveDay(${i},'up')">↑</button>
      <button class="action-btn move-down" ${i === editCache.days.length - 1 ? 'disabled' : ''} onclick="moveDay(${i},'down')">↓</button>
      <button class="action-btn btn-delete" type="button" onclick="removeDay('${d.id}')">×</button>
    </td>
  </tr>`;
}
async function addDay() {
  const maxDay = Math.max(...editCache.days.map(d => d.day_number), 0);
  const startDate = new Date(editCache.itinerary.start_date);
  const newDate = new Date(startDate);
  newDate.setDate(startDate.getDate() + maxDay);
  const { data, error } = await supabase.from('itinerary_days').insert({
    itinerary_id: editCache.itinerary.id,
    day_number: maxDay + 1,
    date: `${newDate.getMonth() + 1}月${newDate.getDate()}日`,
    plan: '新行程',
    plan_price: 0,
    accommodation: '新住宿',
    accommodation_price: 0,
    guide_service: false
  }).select().single();
  if (error) { showStatus(error.message, 'error'); return; }
  editCache.days.push(data);
  document.getElementById('days-tbody').insertAdjacentHTML('beforeend', dayRow(data, editCache.days.length - 1));
  setTimeout(() => attachInputs(true), 0);   // 强制刷新缓存
}
async function removeDay(dayId) {
  if (!confirm('删除这一天？')) return;
  await supabase.from('itinerary_days').delete().eq('id', dayId);
  editCache.days = editCache.days.filter(d => d.id !== dayId);
  document.querySelector(`[data-day="${dayId}"]`).closest('tr').remove();
  showStatus('已删除');
}
function moveDay(index, direction) {
  const arr = editCache.days;
  const target = direction === 'up' ? index - 1 : index + 1;
  [arr[index], arr[target]] = [arr[target], arr[index]];
  document.getElementById('days-tbody').innerHTML = arr.map((d, i) => dayRow(d, i)).join('');
  setTimeout(() => attachInputs(true), 0);   // 强制刷新缓存
}
async function saveDays(id) {
  for (const row of document.querySelectorAll('#days-tbody tr')) {
    const dayId = row.querySelector('[data-day]').dataset.day;
    const payload = {
      date: row.querySelector('[data-field="date"]').textContent.trim(),
      plan: row.querySelector('[data-field="plan"]').textContent.trim(),
      plan_price: parseFloat(row.querySelector('[data-field="plan_price"]').textContent) || 0,
      accommodation: row.querySelector('[data-field="accommodation"]').textContent.trim(),
      accommodation_price: parseFloat(row.querySelector('[data-field="accommodation_price"]').textContent) || 0,
      guide_service: row.querySelector('input[type="checkbox"]').checked
    };
    await supabase.from('itinerary_days').update(payload).eq('id', dayId);
  }
  showStatus('天数已保存');
  closeModal();
  loadItineraries();
}

/* ---------- 乘客编辑 ---------- */
async function editPassengers(id) {
  await loadEditCache(id);
  const html = `
    <h4>乘客信息 (${editCache.passengers.length} 人)</h4>
    <button class="btn btn-add" onclick="addPassenger()"><i class="fas fa-plus"></i> 添加乘客</button>
    <div id="passengers-list">${editCache.passengers.map((p, i) => passengerRow(p, i)).join('')}</div>
    <div style="text-align:right;margin-top:1rem;">
      <button class="btn btn-success" onclick="savePassengers('${id}')">保存乘客</button>
      <button class="btn" onclick="closeModal()">关闭</button>
    </div>
  `;
  document.getElementById('modal-body').innerHTML = html;
  openModal('modal');
  setTimeout(() => attachInputs(true), 0);   // 强制刷新缓存
}
function passengerRow(p, i) {
  return `<div class="passenger-item" data-passenger="${p.id}">
    <span>${i + 1}、</span>
    <span>姓名:</span>
    <span class="inline-edit" data-field="name">${p.name}</span>
    <span>电话:</span>
    <select class="inline-select country-code" data-field="country_code">
      ${countryCodes.map(c => `<option value="${c.code}" ${c.code === p.country_code ? 'selected' : ''}>${c.code}</option>`).join('')}
    </select>
    <span class="inline-edit phone-number" data-field="phone">${p.phone}</span>
    <button class="action-btn btn-delete" type="button" onclick="removePassenger('${p.id}')">×</button>
  </div>`;
}
async function addPassenger() {
  const { data, error } = await supabase.from('passengers').insert({
    itinerary_id: editCache.itinerary.id,
    name: '新乘客',
    country_code: '+86',
    phone: '未提供'
  }).select().single();
  if (error) { showStatus(error.message, 'error'); return; }
  editCache.passengers.push(data);
  document.getElementById('passengers-list').insertAdjacentHTML('beforeend', passengerRow(data, editCache.passengers.length - 1));
  setTimeout(() => attachInputs(true), 0);   // 强制刷新缓存
}
async function removePassenger(pid) {
  if (!confirm('删除该乘客？')) return;
  await supabase.from('passengers').delete().eq('id', pid);
  editCache.passengers = editCache.passengers.filter(p => p.id !== pid);
  document.querySelector(`[data-passenger="${pid}"]`).remove();
  showStatus('已删除');
}
async function savePassengers(id) {
  for (const row of document.querySelectorAll('[data-passenger]')) {
    const pid = row.dataset.passenger;
    const payload = {
      name: row.querySelector('[data-field="name"]').textContent.trim(),
      country_code: row.querySelector('[data-field="country_code"]').value,
      phone: row.querySelector('[data-field="phone"]').textContent.trim()
    };
    await supabase.from('passengers').update(payload).eq('id', pid);
  }
  showStatus('乘客已保存');
  closeModal();
  loadItineraries();
}

/* ---------- 附加服务编辑 ---------- */
async function editServices(id) {
  await loadEditCache(id);
  const html = `
    <h4>附加服务</h4>
    <button class="btn btn-add" onclick="addService()"><i class="fas fa-plus"></i> 添加服务</button>
    <div id="services-list">${editCache.services.map((s, i) => serviceRow(s, i)).join('')}</div>
    <div style="text-align:right;margin-top:1rem;">
      <button class="btn btn-success" onclick="saveServices('${id}')">保存服务</button>
      <button class="btn" onclick="closeModal()">关闭</button>
    </div>
  `;
  document.getElementById('modal-body').innerHTML = html;
  openModal('modal');
  setTimeout(() => attachInputs(true), 0);   // 强制刷新缓存
}
function serviceRow(s, i) {
  return `<div class="extra-service-item" data-service="${s.id}">
    <input type="checkbox" ${s.is_selected ? 'checked' : ''} onchange="toggleService('${s.id}')">
    <span class="inline-edit" data-field="service_name">${s.service_name}</span>
    <span class="inline-edit" data-field="price">${s.price}</span> USD
    <span class="inline-edit" data-field="unit">${s.unit}</span>
    <button class="remove-btn" type="button" onclick="removeService('${s.id}')">×</button>
  </div>`;
}
async function addService() {
  const { data, error } = await supabase.from('extra_services').insert({
    itinerary_id: editCache.itinerary.id,
    service_name: '新服务',
    price: 0,
    unit: '',
    is_selected: false
  }).select().single();
  if (error) { showStatus(error.message, 'error'); return; }
  editCache.services.push(data);
  document.getElementById('services-list').insertAdjacentHTML('beforeend', serviceRow(data, editCache.services.length - 1));
  setTimeout(() => attachInputs(true), 0);   // 强制刷新缓存
}
async function removeService(sid) {
  if (!confirm('删除该服务？')) return;
  await supabase.from('extra_services').delete().eq('id', sid);
  editCache.services = editCache.services.filter(s => s.id !== sid);
  document.querySelector(`[data-service="${sid}"]`).remove();
  showStatus('已删除');
}
function toggleService(sid) {
  const row = document.querySelector(`[data-service="${sid}"]`);
  row.style.opacity = row.querySelector('input[type="checkbox"]').checked ? 1 : 0.5;
}
async function saveServices(id) {
  for (const row of document.querySelectorAll('[data-service]')) {
    const sid = row.dataset.service;
    const payload = {
      service_name: row.querySelector('[data-field="service_name"]').textContent.trim(),
      price: parseFloat(row.querySelector('[data-field="price"]').textContent) || 0,
      unit: row.querySelector('[data-field="unit"]').textContent.trim(),
      is_selected: row.querySelector('input[type="checkbox"]').checked
    };
    await supabase.from('extra_services').update(payload).eq('id', sid);
  }
  showStatus('服务已保存');
  closeModal();
  loadItineraries();
}

/* ---------- 输入绑定：可打字 + Enter 保存 + Esc 撤销 ---------- */
function attachInputs(force = false) {
  document.querySelectorAll('.inline-edit').forEach(el => {
    if (force || !el.dataset.ready) {
      el.contentEditable = true;
      el.style.pointerEvents = 'auto';
      el.dataset.ready = '1';
      el.dataset.originalValue = el.textContent.trim();
      el.onkeydown = e => {
        if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        if (e.key === 'Escape') { el.textContent = el.dataset.originalValue; el.blur(); }
      };
      el.onblur = () => el.dataset.originalValue = el.textContent.trim();
    }
  });
}

/* ---------- 模态框操作 ---------- */
function openModal(id) { document.getElementById(id).style.display = 'block'; }
function closeModal() { document.getElementById('modal').style.display = 'none'; }

/* 初始化 */
document.addEventListener('DOMContentLoaded', () => {
  loadItineraries();
  ['search', 'date-from', 'date-to', 'guide-type'].forEach(id => {
    document.getElementById(id).addEventListener('input', debounce(loadItineraries, 300));
  });
});
/* ---------- 统一删除确认 ---------- */
let currentDeleteId = null;
function showDeleteModal(id) {
  currentDeleteId = id;
  if (!confirm('确定删除整个行程？')) return;
  supabase.from('itineraries').delete().eq('id', id).then(({ error }) => {
    if (error) { showStatus('删除失败：' + error.message, 'error'); return; }
    showStatus('已删除');
    loadItineraries();
  });
}
