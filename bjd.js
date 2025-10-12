/*  ==========  完整版 bjd.js（兼容旧表，不新增列）  ==========  */

/********************  价格配置  ********************/
const PRICE = {
  CAR_5_SEAT: 0, CAR_7_SEAT: 50, CAR_MULTI_SEAT: 80,
  GUIDE_CHINESE: 150, GUIDE_ENGLISH: 100,
  WINE_TASTING: 40, TICKETS: 80,
  DEFAULT_PLAN_PRICE: 0, DEFAULT_HOTEL_PRICE: 0,
  DEFAULT_CAR_RENT_PRICE: 120,
  DEFAULT_CAR_CHANGE_PRICE: 50
};

/********************  全局变量  ********************/
const countryCodes = [
  {code:"+86",name:"中国"},{code:"+1",name:"美国/加拿大"},{code:"+44",name:"英国"},
  {code:"+81",name:"日本"},{code:"+82",name:"韩国"},{code:"+852",name:"香港"},
  {code:"+853",name:"澳门"},{code:"+886",name:"台湾"},{code:"+995",name:"格鲁吉亚"},
  {code:"+7",name:"俄罗斯"},{code:"+90",name:"土耳其"},{code:"+971",name:"阿联酋"},
  {code:"+61",name:"澳大利亚"},{code:"+64",name:"新西兰"}
];

let selectedGuide='no', passengers=[], selectedGuideDays=[];
let itineraryData=[], extraServices=[
  {id:'wine-tasting', name:'酒庄品酒', price:PRICE.WINE_TASTING, unit:'/人', checked:false},
  {id:'tickets',      name:'景点门票', price:PRICE.TICKETS,    unit:'/张', checked:false}
];
let serviceCounter=2, supabase=null;

/********************  Supabase 配置  ********************/
const SUPABASE_URL='https://fezxhcmiefdbvqmhczut.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlenhoY21pZWZkYnZxbWhjenV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNjE1MDYsImV4cCI6MjA3MjczNzUwNn0.MdXghSsixHXeYhZKbMYuJGehMUvdbtixGNjMmBPMKKU';

function initSupabase(){
  try{ supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); return true;}
  catch(e){ console.error(e); alert('Supabase 初始化失败: '+e.message); return false;}
}

/********************  工具函数  ********************/
function formatDate(d){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

/********************  初始化  ********************/
function initializeItinerary(){
  const today=new Date(), end=new Date(); end.setDate(today.getDate()+6);
  document.getElementById('start-date').value=formatDate(today);
  document.getElementById('end-date').value=formatDate(end);
  addDay();
}
function initializePassengers(){
  passengers=[{id:1,name:'新乘客',countryCode:'+86',phone:'未提供'}];
  renderPassengers();
}

/********************  行程  ********************/
function addDay(){
  const start=new Date(document.getElementById('start-date').value);
  if(isNaN(start)){ alert('请先选择有效的开始日期'); return;}
  const dayNum=itineraryData.length+1;
  const d=new Date(start); d.setDate(start.getDate()+dayNum-1);
  itineraryData.push({
    day:dayNum, date:`${d.getMonth()+1}月${d.getDate()}日`,
    plan:'自定义行程', planPrice:PRICE.DEFAULT_PLAN_PRICE,
    accommodation:'自定义住宿', accommodationPrice:PRICE.DEFAULT_HOTEL_PRICE,
    guideService:false,
    carRent:true, changeCar:false,
    carType:'5-seat',
    carRentPrice:PRICE.DEFAULT_CAR_RENT_PRICE,
    carChangePrice:PRICE.DEFAULT_CAR_CHANGE_PRICE
  });
  renderItinerary();
}
function renderItinerary(){
  const tbody=document.getElementById('itinerary-body');
  tbody.innerHTML='';
  itineraryData.forEach((day,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${day.day}</td>
      <td>
        <span class="editable" contenteditable onblur="updateDayData(${i},'date',this.textContent)">${day.date}</span>
        <div class="day-actions">
          <button class="action-btn move-up"  ${i===0?'disabled':''}>↑</button>
          <button class="action-btn move-down" ${i===itineraryData.length-1?'disabled':''}>↓</button>
          <button class="action-btn delete">×</button>
        </div>
      </td>
      <td><span class="editable" contenteditable onblur="updateDayData(${i},'plan',this.textContent)">${day.plan}</span></td>
      <td><input type="number" class="price-input" value="${day.planPrice}" min="0" onchange="updateDayData(${i},'planPrice',this.value)"> USD</td>
      <td><span class="editable" contenteditable onblur="updateDayData(${i},'accommodation',this.textContent)">${day.accommodation}</span></td>
      <td><input type="number" class="price-input" value="${day.accommodationPrice}" min="0" onchange="updateDayData(${i},'accommodationPrice',this.value)"> USD</td>
      <td><input type="checkbox" class="guide-checkbox" ${day.guideService?'checked':''}></td>

      <!-- 车型下拉 -->
      <td>
        <select class="car-type-select">
          <option value="5-seat"  ${day.carType==='5-seat'?'selected':''}>5座车</option>
          <option value="7-seat"  ${day.carType==='7-seat'?'selected':''}>7座车</option>
          <option value="multi-seat" ${day.carType==='multi-seat'?'selected':''}>多座车</option>
        </select>
      </td>

      <!-- 包车勾选+价格 -->
      <td>
        <input type="checkbox" class="car-rent-checkbox" ${day.carRent?'checked':''}>
        <input type="number" class="price-input car-rent-price" value="${day.carRentPrice}" min="0" step="10">
      </td>

      <!-- 换车勾选+价格 -->
      <td>
        <input type="checkbox" class="change-car-checkbox" ${day.changeCar?'checked':''}>
        <input type="number" class="price-input car-change-price" value="${day.carChangePrice}" min="0" step="10">
      </td>`;
    tbody.appendChild(tr);
    attachItineraryRowEvents(tr,i);
  });
  calculateTotal(); updateOutput();
}
function attachItineraryRowEvents(tr,i){
  tr.querySelector('.move-up')?.addEventListener('click',()=>moveDayUp(i));
  tr.querySelector('.move-down')?.addEventListener('click',()=>moveDayDown(i));
  tr.querySelector('.delete')?.addEventListener('click',()=>removeDay(i));
  const gChk=tr.querySelector('.guide-checkbox');
  if(gChk) gChk.addEventListener('change',e=>updateDayGuideService(i,e.target.checked));

  // 车型变化 → 自动改包车价
  tr.querySelector('.car-type-select').addEventListener('change',e=>{
    const base=PRICE.DEFAULT_CAR_RENT_PRICE;
    let add=0;
    switch(e.target.value){
      case '5-seat':      add=PRICE.CAR_5_SEAT; break;
      case '7-seat':      add=PRICE.CAR_7_SEAT; break;
      case 'multi-seat':  add=PRICE.CAR_MULTI_SEAT; break;
    }
    itineraryData[i].carType=e.target.value;
    itineraryData[i].carRentPrice=base+add;
    renderItinerary();
  });

  // 包车/换车勾选
  tr.querySelector('.car-rent-checkbox').addEventListener('change',e=>{
    itineraryData[i].carRent=e.target.checked; calculateTotal(); updateOutput();
  });
  tr.querySelector('.change-car-checkbox').addEventListener('change',e=>{
    itineraryData[i].changeCar=e.target.checked; calculateTotal(); updateOutput();
  });

  // 价格手动微调
  tr.querySelector('.car-rent-price').addEventListener('input',e=>{
    itineraryData[i].carRentPrice=parseFloat(e.target.value)||0; calculateTotal(); updateOutput();
  });
  tr.querySelector('.car-change-price').addEventListener('input',e=>{
    itineraryData[i].carChangePrice=parseFloat(e.target.value)||0; calculateTotal(); updateOutput();
  });
}
function updateDayData(i,f,v){ itineraryData[i][f]=v; calculateTotal(); updateOutput();}
function updateDayGuideService(i,v){ itineraryData[i].guideService=v; updateSelectedGuideDays(); calculateTotal(); updateOutput();}
function moveDayUp(i){ if(i>0){ [itineraryData[i],itineraryData[i-1]]=[itineraryData[i-1],itineraryData[i]]; updateDayNumbers(); renderItinerary();}}
function moveDayDown(i){ if(i<itineraryData.length-1){ [itineraryData[i],itineraryData[i+1]]=[itineraryData[i+1],itineraryData[i]]; updateDayNumbers(); renderItinerary();}}
function updateDayNumbers(){
  const start=new Date(document.getElementById('start-date').value);
  itineraryData.forEach((day,i)=>{
    day.day=i+1;
    const d=new Date(start); d.setDate(start.getDate()+i);
    day.date=`${d.getMonth()+1}月${d.getDate()}日`;
  });
}
function removeDay(i){ if(itineraryData.length>1){ itineraryData.splice(i,1); updateDayNumbers(); renderItinerary();} else alert('至少需要保留一天的行程');}

/********************  导游  ********************/
function selectGuide(type){
  selectedGuide=type;
  document.querySelectorAll('.guide-option').forEach(o=>o.classList.remove('selected'));
  document.getElementById(`${type}-guide`)?.classList.add('selected');
  updateSelectedGuideDays(); calculateTotal(); updateOutput();
}
function updateSelectedGuideDays(){
  selectedGuideDays=[];
  itineraryData.forEach(d=>{ if(d.guideService) selectedGuideDays.push(d.day);});
}

/********************  附加服务  ********************/
function updateExtraService(id){
  const s=extraServices.find(x=>x.id===id);
  if(s){ s.checked=document.getElementById(id).checked; calculateTotal(); updateOutput();}
}
function updateCost(id){
  const s=extraServices.find(x=>x.id===id);
  if(s){
    s.price=parseFloat(document.getElementById(`${id}-price`).value)||0;
    const u=document.getElementById(`${id}-unit`);
    if(u) s.unit=u.value;
    calculateTotal(); updateOutput();
  }
}
function addNewService(){
  serviceCounter++;
  const id=`service-${serviceCounter}`;
  extraServices.push({id,name:'新附加服务',price:0,unit:'',checked:false});
  const div=document.createElement('div'); div.className='extra-service-item'; div.id=`${id}-service`;
  div.innerHTML=`
    <div class="extra-service-name">
      <input type="checkbox" id="${id}" class="extra-service-checkbox">
      <input type="text" class="editable" value="新附加服务" data-id="${id}">
    </div>
    <div class="extra-service-price">
      <input type="number" class="price-input" value="0" min="0" id="${id}-price"> USD
      <input type="text" class="unit-input" placeholder="/单位" id="${id}-unit">
      <button class="remove-btn" data-remove="${id}"><i class="fas fa-times"></i></button>
    </div>`;
  document.getElementById('extra-services').appendChild(div);
  div.querySelector('.extra-service-checkbox').addEventListener('change',()=>updateExtraService(id));
  div.querySelector('.editable').addEventListener('blur',e=>{ const s=extraServices.find(x=>x.id===id); if(s){ s.name=e.target.value; calculateTotal(); updateOutput();}});
  div.querySelector('.price-input').addEventListener('input',()=>updateCost(id));
  div.querySelector('.unit-input').addEventListener('input',()=>updateCost(id));
  div.querySelector('.remove-btn').addEventListener('click',()=>removeService(id));
}
function removeService(id){
  extraServices=extraServices.filter(s=>s.id!==id);
  document.getElementById(`${id}-service`)?.remove();
  calculateTotal(); updateOutput();
}

/********************  乘客  ********************/
function addPassenger(){
  const id=passengers.length?Math.max(...passengers.map(p=>p.id))+1:1;
  passengers.push({id,name:'新乘客',countryCode:'+86',phone:'未提供'});
  renderPassengers();
}
function removePassenger(i){
  if(passengers.length>1){ passengers.splice(i,1); renderPassengers();} else alert('至少需要保留一位乘客');}
function updatePassenger(i,f,v){
  if(f==='phone'){
    if(!/^\d*$/.test(v)){ alert('电话号码只能包含数字'); return;}
    if(v.trim()==='') v='未提供';
  }
  passengers[i][f]=v; updateOutput();
}
function renderPassengers(){
  const list=document.getElementById('passenger-list');
  list.innerHTML='';
  passengers.forEach((p,i)=>{
    const div=document.createElement('div'); div.className='passenger-item';
    div.innerHTML=`
      <span class="passenger-number">${i+1}、</span>
      <span>姓名:</span><input type="text" class="editable" value="${p.name}" data-i="${i}" data-f="name">
      <span>电话:</span>
      <div class="phone-input">
        <select class="country-code" data-i="${i}" data-f="countryCode">${countryCodes.map(c=>`<option value="${c.code}" ${p.countryCode===c.code?'selected':''}>${c.code}</option>`).join('')}</select>
        <input type="text" class="phone-number" value="${p.phone}" data-i="${i}" data-f="phone">
      </div>
      <div class="passenger-actions"><button class="action-btn delete" data-i="${i}">×</button></div>`;
    list.appendChild(div);
  });
  document.getElementById('passenger-count').textContent=passengers.length;
  list.querySelectorAll('.editable,.phone-number').forEach(inp=>{
    inp.addEventListener('blur',e=>{ const i=+e.target.dataset.i, f=e.target.dataset.f; updatePassenger(i,f,e.target.value);});
  });
  list.querySelectorAll('.country-code').forEach(sel=>{
    sel.addEventListener('change',e=>{ const i=+e.target.dataset.i; updatePassenger(i,'countryCode',e.target.value);});
  });
  list.querySelectorAll('.delete').forEach(btn=>{
    btn.addEventListener('click',e=>{ const i=+e.target.dataset.i; removePassenger(i);});
  });
  updateOutput();
}

/********************  计算 / 输出  ********************/
function calculateTotal(){
  let travel=0, hotel=0;
  itineraryData.forEach(d=>{ travel+=parseFloat(d.planPrice)||0; hotel+=parseFloat(d.accommodationPrice)||0;});

  // 车型差价
  let carTypeCost=0;
  itineraryData.forEach(d=>{
    switch(d.carType){
      case '5-seat':      carTypeCost+=PRICE.CAR_5_SEAT; break;
      case '7-seat':      carTypeCost+=PRICE.CAR_7_SEAT; break;
      case 'multi-seat':  carTypeCost+=PRICE.CAR_MULTI_SEAT; break;
    }
  });
  travel+=carTypeCost;

  // 包车：未勾选=0
  const carRentCost = itineraryData
    .filter(d => d.carRent)
    .reduce((sum,d) => sum + (parseFloat(d.carRentPrice)||0), 0);
  // 换车：未勾选=0
  const carChangeCost = itineraryData
    .filter(d => d.changeCar)
    .reduce((sum,d) => sum + (parseFloat(d.carChangePrice)||0), 0);
  travel+=carRentCost+carChangeCost;

  document.getElementById('travel-total').textContent=travel;
  document.getElementById('hotel-total').textContent=hotel;

  let guide=0;
  if(selectedGuide==='chinese') guide=PRICE.GUIDE_CHINESE*selectedGuideDays.length;
  if(selectedGuide==='english') guide=PRICE.GUIDE_ENGLISH*selectedGuideDays.length;
  document.getElementById('guide-total').textContent=guide;

  let extra=0;
  extraServices.forEach(s=>{ if(s.checked) extra+=s.price;});
  document.getElementById('extra-total').textContent=extra;
  document.getElementById('total-price').textContent=travel+hotel+guide+extra;
}
function updateOutput(){
  const order=document.getElementById('order-number').value;
  const service=document.getElementById('service-type').value;
  const sDate=new Date(document.getElementById('start-date').value);
  const eDate=new Date(document.getElementById('end-date').value);
  if(isNaN(sDate)||isNaN(eDate)){ document.getElementById('output-content').textContent='请先选择有效的开始和结束日期'; return;}
  const travelDate=`${sDate.getMonth()+1}月${sDate.getDate()}日-${eDate.getMonth()+1}月${eDate.getDate()}日`;
  const arrival=document.getElementById('arrival-time').value;
  const flight=document.getElementById('flight-number').value||'无';

  let iti='';
  itineraryData.forEach(d=>{
    const carTag=`${d.carRent?'包车':''}${d.carRent&&d.changeCar?'/':''}${d.changeCar?'换车':''}`;
    iti+=`第${d.day}天（${d.date}）：${d.plan}${carTag?`（${carTag}）`:''} [报价:${d.planPrice}USD]\n`;
    iti+=`住宿：${d.accommodation} [报价:${d.accommodationPrice}USD]\n`;
    iti+=`车型：${d.carType==='5-seat'?'5座':d.carType==='7-seat'?'7座':'多座'}　`;
    iti+=`导游服务：${d.guideService?'是':'否'}　`;
    iti+=`包车：${d.carRent?'是':'否'}（${d.carRentPrice}USD）　`;
    iti+=`换车：${d.changeCar?'是':'否'}（${d.carChangePrice}USD）\n\n`;
  });
  if(!iti) iti='暂无行程安排\n\n';

  let guide='无需导游', gPrice=0;
  if(selectedGuide!=='no'){
    const pp=selectedGuide==='chinese'?PRICE.GUIDE_CHINESE:PRICE.GUIDE_ENGLISH;
    gPrice=pp*selectedGuideDays.length;
    guide=(selectedGuide==='chinese'?'中文导游':'英文导游')+` (${selectedGuideDays.length}天, ${pp}USD/天)`;
  }

  let extra='';
  extraServices.forEach(s=>{ if(s.checked) extra+=`${s.name}: ${s.price}USD${s.unit}\n`;});
  if(!extra) extra='无\n';

  let psg='';
  passengers.forEach((p,i)=>{ psg+=`${i+1}、姓名:${p.name} 电话:${p.countryCode}-${p.phone}\n`;});
  if(!psg) psg='暂无乘客信息\n';

  const travel=document.getElementById('travel-total').textContent;
  const hotelTot=document.getElementById('hotel-total').textContent;
  const guideTot=document.getElementById('guide-total').textContent;
  const extraTot=document.getElementById('extra-total').textContent;
  const tot=document.getElementById('total-price').textContent;

  document.getElementById('output-content').textContent=
`单号：${order}
服务类型：${service}
预计出行日期（当地时间）：${travelDate}
抵达时间：${arrival}
航班号：${flight}

行程安排：
${iti}
酒店标准：${document.getElementById('hotel-standard').value}
房型：${document.getElementById('room-type').value}
乘客人数：${passengers.length}

导游服务：
${guide}: ${gPrice}USD

附加服务：
${extra}
费用汇总：
交通费用: ${travel}USD
住宿费用: ${hotelTot}USD
导游服务: ${guideTot}USD
附加服务: ${extraTot}USD
总计: ${tot}USD

乘客信息：
${psg}`;
}

/********************  复制 / 下载  ********************/
function copyToClipboard(){
  const txt=document.getElementById('output-content').textContent;
  if(!txt.trim()){ alert('请先生成内容'); return;}
  navigator.clipboard.writeText(txt).then(()=>alert('内容已复制到剪贴板！'))
  .catch(()=>{
    const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    alert('内容已复制到剪贴板！');
  });
}
function downloadAsFile(){
  const txt=document.getElementById('output-content').textContent;
  if(!txt.trim()){ alert('请先生成内容'); return;}
  const blob=new Blob([txt],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='格鲁吉亚行程报价单.txt'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),100);
  alert('文件下载成功！');
}

/********************  Supabase 保存（只写旧表已有字段）  ********************/
async function saveToSupabase(){
  if(!supabase&&!initSupabase()){ alert('Supabase 初始化失败'); return;}
  try{
    let order=document.getElementById('order-number').value.trim();
    const body={
      order_number:order,
      service_type:document.getElementById('service-type').value,
      start_date:document.getElementById('start-date').value,
      end_date  :document.getElementById('end-date').value,
      arrival_time:document.getElementById('arrival-time').value,
      flight_number:document.getElementById('flight-number').value||'无',
      hotel_standard:document.getElementById('hotel-standard').value,
      room_type:document.getElementById('room-type').value,
      guide_type:selectedGuide,
      total_price:document.getElementById('total-price').textContent,
      created_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    };
    const {data:it,error:itErr}=await supabase.from('itineraries').insert([body]).select().single();
    if(itErr) throw itErr;
    const itineraryId=it.id;

    // 只写旧表存在的列，去掉 car_type / car_rent_price / car_change_price
    for(const d of itineraryData){
      // 在 plan 字段末尾追加（包车/换车）标记
      const carTag=`${d.carRent?'包车':''}${d.carRent&&d.changeCar?'/':''}${d.changeCar?'换车':''}`;
      const planText=`${d.plan}${carTag?`（${carTag}）`:''}`;
      const {error:dayErr}=await supabase.from('itinerary_days').insert({
        itinerary_id:itineraryId,
        day_number:d.day,
        date:d.date,
        plan:planText, plan_price:d.planPrice,
        accommodation:d.accommodation, accommodation_price:d.accommodationPrice,
        guide_service:d.guideService
      });
      if(dayErr) throw dayErr;
    }
    for(const p of passengers){
      const {error:psgErr}=await supabase.from('passengers').insert({
        itinerary_id:itineraryId, name:p.name, country_code:p.countryCode, phone:p.phone.trim()===''?'未提供':p.phone
      });
      if(psgErr) throw psgErr;
    }
    for(const s of extraServices){
      if(!s.checked) continue;
      const {error:svcErr}=await supabase.from('extra_services').insert({
        itinerary_id:itineraryId, service_name:s.name, price:s.price, unit:s.unit, is_selected:s.checked
      });
      if(svcErr) throw svcErr;
    }
    alert(`数据保存成功！单号:${order}, 保存ID:${itineraryId}`);
  }catch(e){ console.error(e); alert('保存失败: '+e.message);}
}

/********************  页面入口 & 事件绑定  ********************/
document.addEventListener('DOMContentLoaded',()=>{
  try{
    initializeItinerary(); initializePassengers(); selectGuide('no'); initSupabase(); calculateTotal(); updateOutput();
  }catch(e){ console.error(e); alert('页面初始化失败: '+e.message);}
});

/* 导游按钮点击切换 */
document.querySelectorAll('.guide-option').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const type=btn.dataset.type;
    selectGuide(type);
  });
});

/* 顶部批量改车型按钮栏（HTML 里自己放） */
['5-seat','7-seat','multi-seat'].forEach(type=>{
  const btnId=type==='multi-seat'?'batch-car-m':`batch-car-${type.charAt(0)}`;
  document.getElementById(btnId)?.addEventListener('click',()=>{
    itineraryData.forEach(d=>{ d.carType=type; });
    renderItinerary();
  });
});

/* 常规按钮 */
document.getElementById('add-day-btn')?.addEventListener('click',addDay);
document.getElementById('add-passenger-btn')?.addEventListener('click',addPassenger);
document.getElementById('add-service-btn')?.addEventListener('click',addNewService);
document.getElementById('update-output-btn')?.addEventListener('click',updateOutput);
document.getElementById('copy-btn')?.addEventListener('click',copyToClipboard);
document.getElementById('download-btn')?.addEventListener('click',downloadAsFile);
document.getElementById('save-supabase-btn')?.addEventListener('click',saveToSupabase);

/* 附加服务初始绑定 */
document.getElementById('wine-tasting')?.addEventListener('change',()=>updateExtraService('wine-tasting'));
document.getElementById('tickets')?.addEventListener('change',()=>updateExtraService('tickets'));
document.getElementById('wine-price')?.addEventListener('input',()=>updateCost('wine-tasting'));
document.getElementById('tickets-price')?.addEventListener('input',()=>updateCost('tickets'));
document.getElementById('wine-unit')?.addEventListener('input',()=>updateCost('wine-tasting'));
document.getElementById('tickets-unit')?.addEventListener('input',()=>updateCost('tickets'));
document.querySelectorAll('[data-remove]').forEach(btn=>{
  btn.addEventListener('click',e=>removeService(e.target.closest('button').dataset.remove));
});
/******************************************************************
 *  导游选择修复：事件委托，确保随时可切换
 ******************************************************************/
document.addEventListener('DOMContentLoaded', () => {
  // 初始化导游按钮样式
  selectGuide('no');

  // 用事件委托，保证动态生成的导游按钮也能响应
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.guide-option');
    if (!btn) return;          // 点的不是导游按钮，直接忽略
    const type = btn.dataset.type;
    if (!type) return;
    selectGuide(type);         // 切换导游类型+刷新总价+输出
  });
});
