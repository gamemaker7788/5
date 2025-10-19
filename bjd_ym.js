/* ========== 工具：防抖 ========== */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/* ========== 配置 ========== */
const SUPABASE_URL  = 'https://fezxhcmiefdbvqmhczut.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlenhoY21pZWZkYnZxbWhjenV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNjE1MDYsImV4cCI6MjA3MjczNzUwNn0.MdXghSsixHXeYhZKbMYuJGehMUvdbtixGNjMmBPMKKU';

let supabase = null, itinerariesData = [], currentPage = 1, itemsPerPage = 6;

/* ========== 初始化 ========== */
async function initSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
        await supabase.from('itineraries').select('id').limit(1);
        console.log('Supabase 连接成功');
        return true;
    } catch (e) {
        console.error('Supabase 连接失败', e);
        showError('Supabase 连接失败: ' + e.message);
        return false;
    }
}

/* ========== 右上角时间状态（以查询日期为基准） ========== */
function getTimeStatus(start, end) {
    const query = document.getElementById('query-date').value;  // 获取查询日期
    const today = query ? new Date(query) : new Date();   // 有查询日期就用它，否则用今天
    const s = new Date(start);
    const e = new Date(end);
    if (today < s) return { text: '未开始', color: '#f39c12' };
    if (today > e) return { text: '已结束', color: '#e74c3c' };
    return { text: '进行中', color: '#27ae60' };
}

/* ========== 状态权重：越小越靠前 ========== */
function statusWeight(start, end) {
    const today = new Date();
    const s = new Date(start);
    const e = new Date(end);
    if (today > e) return 3; // 已结束
    if (today < s) return 2; // 未开始
    return 1;                // 进行中
}

/* ========== 加载数据（单号升序 + 日期预处理 + 状态排序） ========== */
async function loadItineraries() {
    if (!supabase && !await initSupabase()) return;
    showLoading('正在加载数据...');

    const search    = document.getElementById('search').value.trim();
    const dateFrom  = document.getElementById('date-from').value;
    const dateTo    = document.getElementById('date-to').value;
    const guideType = document.getElementById('guide-type').value;

    let q = supabase
        .from('itineraries')
        .select(`*,itinerary_days(*),passengers(*),extra_services(*)`)
        .order('order_number', { ascending: true });

   if (/^\d+$/.test(search)) {
  q = q.eq('order_number', parseInt(search, 10));
} else {
  q = q.or(`service_type.ilike.%${search}%`);
}

    if (dateFrom)  q = q.gte('start_date', dateFrom);
    if (dateTo)    q = q.lte('end_date', dateTo);
    if (guideType) q = q.eq('guide_type', guideType);

    const { data, error } = await q;
    if (error) {
        if (error.code === 'PGRST301') { useMockData(); return; }
        showError('加载失败: ' + error.message); return;
    }

    const safeDate = d => d || '';
    itinerariesData = (data || []).map(it => ({
        ...it,
        start_date: safeDate(it.start_date),
        end_date:   safeDate(it.end_date),
        itinerary_days: (it.itinerary_days || [])
          .sort((a, b) => a.day_number - b.day_number)   // ⬅️ 修复天数乱序
          .map(d => ({ ...d, date: safeDate(d.date) }))
    }));

    /* ✅ 按状态排序：进行中→未开始→已结束 */
    itinerariesData.sort((a, b) => statusWeight(a.start_date, a.end_date) - statusWeight(b.start_date, b.end_date));

    updateRecordCount();
    currentPage = 1;
    renderItineraryCards();
    updateNavigation();
}

/* ========== 小工具 ========== */
function clearFilters() {
    ['search', 'date-from', 'date-to', 'guide-type'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('query-date').value = '';   // 清空查询日期
    loadItineraries();
}
function updateRecordCount() {
    document.getElementById('record-count').textContent = `${itinerariesData.length} 条记录`;
}
function updateNavigation() {
    const total = Math.ceil(itinerariesData.length / itemsPerPage);
    document.getElementById('current-page').textContent = currentPage;
    document.getElementById('total-pages').textContent  = total;
    document.getElementById('prev-btn').disabled = currentPage <= 1;
    document.getElementById('next-btn').disabled = currentPage >= total;
}
function prevPage() {
    if (currentPage > 1) { currentPage--; renderItineraryCards(); updateNavigation(); }
}
function nextPage() {
    const total = Math.ceil(itinerariesData.length / itemsPerPage);
    if (currentPage < total) { currentPage++; renderItineraryCards(); updateNavigation(); }
}

/* ========== 渲染卡片（含右上角时间状态） ========== */
function renderItineraryCards() {
    const start = (currentPage - 1) * itemsPerPage;
    const arr   = itinerariesData.slice(start, start + itemsPerPage);
    const guideMap = { no: '无需导游', chinese: '中文导游', english: '英文导游' };

    const html = arr.map(it => {
        const status = getTimeStatus(it.start_date, it.end_date);
        const guideText = guideMap[it.guide_type] || it.guide_type || '无';
        return `
        <div class="itinerary-card" style="position:relative">
            <!-- 右上角时间状态 -->
            <div class="time-status" style="background:${status.color}">
                ${status.text}
            </div>

            <div class="order-number-section">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div><span class="order-number-label">单号:</span><span class="order-number-value">${it.order_number || '未分配'}</span></div>
                    <button class="copy-order-btn" onclick="copyToClipboard('${it.order_number || ''}')"><i class="fas fa-copy"></i> 复制</button>
                </div>
            </div>
            <div class="card-header"><h2 class="service-type">${it.service_type || '无服务类型'}</h2><span class="card-id">ID: ${it.id?.slice(0, 8) || 'N/A'}</span></div>
            <div class="card-section">
                <h3><i class="fas fa-info-circle"></i> 基本信息</h3>
                <div class="info-item"><span class="info-label">出行日期:</span><span>${it.start_date} - ${it.end_date}</span></div>
                <div class="info-item"><span class="info-label">航班号:</span><span>${it.flight_number || '无'}</span></div>
                <div class="info-item"><span class="info-label">抵达时间:</span><span>${it.arrival_time || '无'}</span></div>
                <div class="info-item"><span class="info-label">导游类型:</span><span>${guideText}</span></div>
                <div class="info-item"><span class="info-label">酒店标准:</span><span>${it.hotel_standard || '无'} - ${it.room_type || '无'}</span></div>
                <div class="info-item"><span class="info-label">总价格:</span><span class="price-tag">${it.total_price || '0'} USD</span></div>
            </div>
            <div class="card-section"><h3><i class="fas fa-calendar-alt"></i> 行程安排 (${it.itinerary_days?.length || 0} 天)</h3>
                ${it.itinerary_days?.length ? it.itinerary_days.map(d => `
                    <div class="day-item">
                        <div style="font-weight:600;color:#2c3e50">第${d.day_number}天 (${d.date})</div>
                        <div>${d.plan || '无行程安排'}</div>
                        <div>住宿: ${d.accommodation || '无'} (${d.accommodation_price || '0'} USD)</div>
                    </div>`).join('') : '<p>无行程安排</p>'}
            </div>
            <div class="card-section"><h3><i class="fas fa-users"></i> 乘客信息 (${it.passengers?.length || 0} 人)</h3>
                ${it.passengers?.length ? it.passengers.map(p => `
                    <div class="passenger-item"><span>${p.name || '无名'}</span><span>${p.country_code || ''} ${p.phone || '无电话'}</span></div>`).join('') : '<p>无乘客信息</p>'}
            </div>
            <div class="card-section"><h3><i class="fas fa-plus-circle"></i> 附加服务</h3>
                ${it.extra_services?.filter(s => s.is_selected).length ? it.extra_services.filter(s => s.is_selected).map(s => `
                    <div class="service-item"><span>${s.service_name || '无名称'}</span><span>${s.price || '0'} USD${s.unit || ''}</span></div>`).join('') : '<p>无附加服务</p>'}
            </div>
        </div>`;
    }).join('');

    document.getElementById('cards-container').innerHTML = html || '<div class="loading">当前页面无数据</div>';
}

/* ========== 其余小功能 ========== */
function copyToClipboard(text) {
    if (!text || text === '未分配') return;
    navigator.clipboard.writeText(text).then(() => showStatus('单号已复制'));
}
function showStatus(msg) {
    const s = document.createElement('div');
    s.style.cssText = 'position:fixed;top:20px;right:20px;background:#27ae60;color:#fff;padding:10px 20px;border-radius:5px;z-index:1000';
    s.textContent = msg;
    document.body.appendChild(s);
    setTimeout(() => document.body.removeChild(s), 2000);
}
function showLoading(msg) {
    document.getElementById('cards-container').innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> ${msg}</div>`;
}
function showError(msg) {
    document.getElementById('cards-container').innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i> ${msg}</div>`;
}

/* ========== 兜底模拟数据 ========== */
function useMockData() {
    itinerariesData = [
        { id: 'demo-001', order_number: 'ORD20240115001', service_type: '格鲁吉亚7日经典游', start_date: '2024-01-15', end_date: '2024-01-21', flight_number: 'CZ6039', guide_type: 'chinese', total_price: '1250', arrival_time: '14:30', hotel_standard: '四星级', room_type: '双人间', itinerary_days: [{ day_number: 1, date: '2024-01-15', plan: '抵达第比利斯，接机后入住酒店', accommodation: '第比利斯四星酒店', accommodation_price: '0' }, { day_number: 2, date: '2024-01-16', plan: '第比利斯城市观光', accommodation: '第比利斯四星酒店', accommodation_price: '0' }], passengers: [{ name: '张先生', country_code: '+86', phone: '13800138000' }, { name: '李女士', country_code: '+86', phone: '13900139000' }], extra_services: [{ service_name: '机场接送', price: '40', is_selected: true }, { service_name: '酒庄品酒', price: '30', is_selected: true }] },
        { id: 'demo-002', order_number: 'ORD20240120002', service_type: '格鲁吉亚5日精华游', start_date: '2024-01-20', end_date: '2024-01-24', flight_number: 'TK1234', guide_type: 'english', total_price: '980', arrival_time: '16:45', hotel_standard: '五星级', room_type: '大床房', itinerary_days: [{ day_number: 1, date: '2024-01-20', plan: '抵达第比利斯，自由活动', accommodation: '第比利斯五星酒店', accommodation_price: '0' }], passengers: [{ name: 'John Smith', country_code: '+1', phone: '5551234567' }], extra_services: [{ service_name: '景点门票', price: '80', is_selected: true }] }
    ].map(it => ({ ...it, start_date: it.start_date || '', end_date: it.end_date || '', itinerary_days: it.itinerary_days.map(d => ({ ...d, date: d.date || '' })) }));
    updateRecordCount();
    currentPage = 1;
    renderItineraryCards();
    updateNavigation();
}

/* ========== 事件绑定 ========== */
document.addEventListener('DOMContentLoaded', () => {
    ['date-from', 'date-to', 'guide-type'].forEach(id => document.getElementById(id).addEventListener('change', loadItineraries));
    document.getElementById('search').addEventListener('input', debounce(loadItineraries, 500));
    document.getElementById('query-date').addEventListener('change', renderItineraryCards);  // 监听查询日期变化
    loadItineraries();
});
const toggleBtn = document.getElementById('theme-toggle');
const icon = toggleBtn.querySelector('i');

function setIcon(th) {
  icon.className = th === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

toggleBtn.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  setIcon(next);
});

// 初始化图标
setIcon(localStorage.getItem('theme') || 'light');
