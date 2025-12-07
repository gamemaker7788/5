/* ===== 仅用于替换 confirm 的内置弹窗 ===== */
function toast(msg, type = 'info') {
  removeToast();
  const bg = { info: '#1cb0f6', success: '#58cc02', warning: '#ff9600', error: '#ff4b4b' }[type] || '#666';
  const div = document.createElement('div');
  div.id = 'toastWrap';
  div.innerHTML = `<div style="position:fixed;top:20px;left:50%;transform:translateX(-50%);background:${bg};color:#fff;padding:14px 24px;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,.2);z-index:9999;font-size:15px;animation:slideDown .3s ease">${msg}</div>`;
  document.body.appendChild(div);
  setTimeout(removeToast, 2500);
}
function removeToast() {
  const t = document.getElementById('toastWrap');
  if (t) t.remove();
}

function confirmDlg(msg) {
  return new Promise(resolve => {
    removeConfirm();
    const div = document.createElement('div');
    div.id = 'confirmWrap';
    div.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9998;animation:fadeIn .25s ease">
        <div style="background:#fff;border-radius:16px;padding:28px 32px;max-width:360px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,.25);animation:popIn .25s ease">
          <div style="font-size:17px;color:#333;margin-bottom:22px;line-height:1.5">${msg}</div>
          <div style="display:flex;gap:12px;justify-content:flex-end">
            <button class="btn-secondary small" id="cancelBtn">取消</button>
            <button class="btn-primary small" id="okBtn">确定</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(div);
    div.querySelector('#cancelBtn').onclick = () => { resolve(false); removeConfirm(); };
    div.querySelector('#okBtn').onclick   = () => { resolve(true);  removeConfirm(); };
  });
}
function removeConfirm() {
  const c = document.getElementById('confirmWrap');
  if (c) c.remove();
}

/* ===== 仅用于动画的极简样式 ===== */
const animStyle = document.createElement('style');
animStyle.textContent = `
@keyframes slideDown{from{transform:translate(-50%,-30px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}
`;
document.head.appendChild(animStyle);
/* ===== 确认弹窗插入结束 ===== */

/* ===== 配置 ===== */
const SUPABASE_URL = 'https://jbcrkuwnlmdmwwmiimhr.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiY3JrdXdubG1kbXd3bWlpbWhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0ODcyNjUsImV4cCI6MjA4MDA2MzI2NX0.mK7o1xaVrV39J6_wahE_1iv_cacYUVrZJurKs_s2Wf0'
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let current = {}
let currentHis = ''
let currentLib = null
let currentGroup = null
let currentHisLib = null
let renameTarget = null

/* ===== 页面切换 ===== */
function showSection(sectionId) {
  console.log('切换到区域:', sectionId)
  
  // 隐藏所有区域
  document.querySelectorAll('.section').forEach(s => {
    s.classList.add('hidden')
  })
  
  // 移除所有导航按钮激活状态
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.remove('active')
  })
  
  // 显示目标区域
  const targetSection = document.getElementById(sectionId)
  if (targetSection) {
    targetSection.classList.remove('hidden')
    console.log('已显示区域:', sectionId)
  } else {
    console.error('区域不存在:', sectionId)
  }
  
  // 激活对应的导航按钮
  const navBtn = document.querySelector(`.nav-btn[onclick*="${sectionId}"]`)
  if (navBtn) {
    navBtn.classList.add('active')
  }
  
  // 根据区域加载数据
  if (sectionId === 'pubBox') {
    loadPubUsers()
  } else if (sectionId === 'myBox') {
    if (current.serial) {
      loadMyLibs()
    } else {
      // 如果没有登录，显示登录页面
      showSection('authBox')
    }
  }
}

function backToPub() {
  showSection('pubBox')
}

function backToHisLibs() {
  document.getElementById('hisLibDetail').classList.add('hidden')
  document.getElementById('hisBox').classList.remove('hidden')
  currentHisLib = null
}

function backToMyLibs() {
  document.getElementById('currentLibView').classList.add('hidden')
  document.getElementById('myBox').classList.remove('hidden')
  currentLib = null
  currentGroup = null
}

/* ===== 认证标签页 ===== */
function showAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.add('hidden'))
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
  
  document.getElementById(tab + 'Tab').classList.remove('hidden')
  document.querySelector(`.tab-btn[onclick*="${tab}"]`).classList.add('active')
}

/* ===== 注册 / 登录 ===== */
async function register() {
  const username = document.getElementById('regUser').value.trim()
  const pwd = document.getElementById('regPwd').value.trim()
  
  if (!username || !pwd) {
    toast('用户名和密码不能为空')
    return
  }
  if (pwd.length < 6) {
    toast('密码至少6位')
    return
  }
  
  const serial = 'U' + Date.now().toString(36).toUpperCase()
  
  try {
    // 先测试表是否存在
    const { error: testError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
    
    if (testError && testError.message.includes('profiles')) {
      toast('数据库表不存在！请先执行SQL代码创建表结构。')
      return
    }
    
    const { error } = await supabase.from('profiles').insert({ 
      username, 
      pwd, 
      serial,
      libs: '[]'
    })
    
    if (error) {
      if (error.message.includes('profiles')) {
        toast('数据库表不存在！请先执行SQL代码创建表结构。')
      } else if (error.message.includes('duplicate key')) {
        toast('用户名已存在')
      } else {
        throw error
      }
      return
    }
    
    toast('注册成功！序列号：' + serial)
    
    // 注册成功后自动登录
    document.getElementById('loginUser').value = username
    document.getElementById('loginPwd').value = pwd
    await login()
    
  } catch (error) {
    toast('注册失败：' + error.message)
  }
}

async function login() {
  const username = document.getElementById('loginUser').value.trim();
  const pwd      = document.getElementById('loginPwd').value.trim();
  if (!username || !pwd) { toast('用户名和密码不能为空'); return; }

  try {
    const { data, error } = await supabase
                                .from('profiles')
                                .select('*')
                                .eq('username', username)
                                .single();
    if (error || !data) { toast('用户不存在'); return; }
    if (data.pwd !== pwd) { toast('密码错误'); return; }

    current = data;
    /* ----- 处理 libs 字段 ----- */
    if (!current.libs) current.libs = [];
    else if (typeof current.libs === 'string') {
      try { current.libs = JSON.parse(current.libs); }
      catch { current.libs = []; }
    }

    /* ----- 更新界面 ----- */
    document.getElementById('showSerial').innerText = current.serial || '';
    await loadUserAvatar();                 // 头像
    localStorage.setItem('currentUser', JSON.stringify(current));

    /* ✅ 显示登出按钮 */
    document.getElementById('logoutBtn').style.display = 'inline-flex';

    showSection('myBox');                   // 进入“我的空间”
    await loadReadme();
    await loadMyLibs();
    await migrateExistingFiles();
  } catch (e) {
    toast('登录失败：' + (e.message || '未知错误'));
  }
}

function logout() {
  if (!confirm('确定要退出登录吗？')) return;
  current = {};
  localStorage.removeItem('currentUser');
  document.getElementById('logoutBtn').style.display = 'none'; // ✅ 隐藏
  showSection('pubBox');
  /* 清空登录表单（可选） */
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPwd').value = '';
}

/* ===== 头像管理 ===== */
async function uploadAvatar() {
  const fileInput = document.getElementById('avatarFile')
  const file = fileInput.files[0]
  
  if (!file) {
    toast('请选择头像文件')
    return
  }
  
  // 检查文件类型
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    toast('请选择图片文件（JPG、PNG、GIF、WebP）')
    return
  }
  
  // 检查文件大小（限制为5MB）
  if (file.size > 5 * 1024 * 1024) {
    toast('头像文件大小不能超过5MB')
    return
  }
  
  try {
        console.log('开始上传头像...', file.name, file.size)
        
        // 确保当前用户已登录
        if (!current || !current.serial) {
            toast('请先登录')
            return
        }
        
        // 生成正确的文件路径（去掉重复的public）
        const fileExt = file.name.split('.').pop()
        const fileName = `avatar.${fileExt}`
        const filePath = `u/${current.serial}/avatar/${fileName}` // 修正：去掉重复的public
        
        console.log('头像上传路径:', filePath)
        
        // 上传文件到存储桶
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('public')
            .upload(filePath, file, { 
                upsert: true,
                cacheControl: '3600'
            })
        
        if (uploadError) {
            console.error('头像上传失败:', uploadError)
            throw new Error(`头像上传失败: ${uploadError.message}`)
        }
        
        // 获取正确的公开URL（使用修正的函数）
        const avatarUrl = getCorrectAvatarUrl(current.serial, fileName) + '?t=' + Date.now()
        
        console.log('修正后的头像URL:', avatarUrl)
        
        // 更新数据库
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: avatarUrl })
            .eq('id', current.id)
        
        if (updateError) {
            throw new Error(`更新头像信息失败: ${updateError.message}`)
        }
        
        // 更新当前用户数据
        current.avatar_url = avatarUrl
        localStorage.setItem('currentUser', JSON.stringify(current))
        
        // 更新界面显示
        updateAvatarDisplay(avatarUrl)
        updateMySpaceHeader()
        
        // 清空文件输入
        fileInput.value = ''
        
        toast('头像更新成功！')
        
    } catch (error) {
        console.error('头像上传失败:', error)
        toast('头像上传失败：' + error.message)
    }
}
// 定义获取正确头像URL的函数
function getCorrectAvatarUrl(serial, filename = 'avatar.png') {
    return `https://jbcrkuwnlmdmwwmiimhr.supabase.co/storage/v1/object/public/u/${serial}/avatar/${filename}`
}

// 获取默认头像
function getDefaultAvatar(username) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=667eea&color=fff&size=100`
}

// 更新我的空间标题区域（包含头像）
function updateMySpaceHeader() {
    const myBoxHeader = document.querySelector('#myBox .section-header')
    if (!myBoxHeader || !current) return
    
    // 获取头像URL
    const avatarUrl = current.avatar_url || getDefaultAvatar(current.username)
    
    // 更新标题区域，在标题旁显示头像
    myBoxHeader.innerHTML = `
        <div class="my-space-header">
            <div class="header-avatar">
                
                <div class="header-info">
                    <h2>👤 我的空间</h2>
                    <p>序列号: <span id="showSerial">${current.serial || ''}</span></p>
                </div>
            </div>
            <div class="header-actions">
                <button onclick="showAvatarUploadDialog()" class="btn-secondary" title="更换头像">
                    <span class="btn-icon">🖼️</span>
                    <span>更换头像</span>
                </button>
            </div>
        </div>
    `
}

// 更新头像显示
function updateAvatarDisplay(avatarUrl) {
    const avatarImg = document.getElementById('avatarImg')
    if (avatarImg) {
        // 添加时间戳避免缓存
        avatarImg.src = avatarUrl + '?t=' + Date.now()
        avatarImg.onerror = function() {
            // 如果头像加载失败，使用默认头像
            console.warn('头像加载失败，使用默认头像')
            avatarImg.src = getDefaultAvatar(current.username)
        }
    }
}

// 显示头像上传对话框
function showAvatarUploadDialog() {
    document.getElementById('avatarFile').value = ''
    document.getElementById('avatarUploadDlg').showModal()
}
// 创建头像目录结构
async function createAvatarDirectory() {
  try {
    // 创建一个测试文件来确保目录存在
    const testBlob = new Blob(['test'], { type: 'text/plain' })
    const { error } = await supabase.storage
      .from('public')
      .upload(`u/${current.serial}/.keep`, testBlob, { upsert: true })
    
    if (error) {
      throw error
    }
    console.log('目录结构创建成功')
  } catch (error) {
    console.error('创建目录失败:', error)
    throw error
  }
}

// 更新头像显示
function updateAvatarDisplay(avatarUrl) {
  const avatarImg = document.getElementById('avatarImg')
  if (avatarImg) {
    avatarImg.src = avatarUrl
    avatarImg.onerror = function() {
      // 如果头像加载失败，使用默认头像
      console.warn('头像加载失败，使用默认头像')
      avatarImg.src = getDefaultAvatar(current.username)
    }
  }
  
  // 更新其他可能显示头像的地方
  document.querySelectorAll('.user-avatar').forEach(img => {
    if (img.src && img.src.includes('avatar')) {
      img.src = avatarUrl
    }
  })
}

// 获取默认头像
function getDefaultAvatar(username) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=667eea&color=fff&size=100`
}

// 加载用户头像
async function loadUserAvatar() {
  if (!current || !current.serial) return
  
  try {
    let avatarUrl = current.avatar_url
    
    // 如果数据库中没有头像URL，尝试从存储桶加载
    if (!avatarUrl) {
      avatarUrl = await getAvatarFromStorage()
      if (avatarUrl) {
        // 更新数据库
        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', current.id)
        
        if (!error) {
          current.avatar_url = avatarUrl
          localStorage.setItem('currentUser', JSON.stringify(current))
        }
      }
    }
    
    // 显示头像
    updateAvatarDisplay(avatarUrl || getDefaultAvatar(current.username))
    
  } catch (error) {
    console.error('加载头像失败:', error)
    // 使用默认头像
    updateAvatarDisplay(getDefaultAvatar(current.username))
  }
}


// 从存储桶获取头像
async function getAvatarFromStorage() {
  try {
    const path = `u/${current.serial}/avatar/`
    const { data: files, error } = await supabase.storage.from('public').list(path)
    
    if (error) {
      console.log('头像目录不存在或访问失败:', error.message)
      return null
    }
    
    // 查找头像文件
    const avatarFile = files?.find(f => 
      f.name && 
      !f.name.endsWith('/') && 
      (f.name.startsWith('avatar.') || f.name.includes('avatar'))
    )
    
    if (avatarFile) {
      const { data } = supabase.storage.from('public').getPublicUrl(path + avatarFile.name)
      return data.publicUrl + '?t=' + Date.now()
    }
    
    return null
    
  } catch (error) {
    console.error('从存储桶获取头像失败:', error)
    return null
  }
}

/* ===== 读取我的库 ===== */
async function loadMyLibs() {
  console.log('开始加载我的库...')
  
  try {
    // 重新从数据库获取最新数据
    const { data: userData, error } = await supabase
      .from('profiles')
      .select('libs')
      .eq('id', current.id)
      .single()

    if (error) {
      console.error('获取用户数据失败:', error)
      throw error
    }

    // 处理libs字段
    if (userData && userData.libs) {
      try {
        current.libs = typeof userData.libs === 'string' ? JSON.parse(userData.libs) : userData.libs
      } catch (parseError) {
        console.error('解析libs失败:', parseError)
        current.libs = []
      }
    } else {
      current.libs = []
    }

    console.log('获取到的库数据:', current.libs)

    // 渲染库列表
    renderMyLibs()

  } catch (error) {
    console.error('加载我的库失败:', error)
    // 显示错误状态
    document.getElementById('pubLibs').innerHTML = `
      <div class="empty-state">
        <p>❌ 加载库失败</p>
        <p style="font-size: 0.9rem; color: #666;">${error.message}</p>
        <button onclick="loadMyLibs()" class="btn-secondary" style="margin-top: 10px;">重试</button>
      </div>
    `
    document.getElementById('priLibs').innerHTML = ''
  }
}

function renderMyLibs() {
  if (!current.libs || !Array.isArray(current.libs)) {
    current.libs = []
  }

  const pubLibs = current.libs.filter(lib => lib.type === 'pub')
  const priLibs = current.libs.filter(lib => lib.type === 'pri')

  console.log('公开库:', pubLibs)
  console.log('私有库:', priLibs)

  // 渲染公开库
  const pubContainer = document.getElementById('pubLibs')
  if (pubLibs.length === 0) {
    pubContainer.innerHTML = `
      <div class="empty-state">
        <p>🌐 暂无公开库</p>
        <p style="font-size: 0.9rem; color: #666;">点击"新建库"开始创建</p>
      </div>
    `
  } else {
    pubContainer.innerHTML = pubLibs.map(lib => `
      <div class="lib-card" onclick="loadLibContent('${lib.id}')">
        <div class="lib-info">
          <div class="lib-icon">🌐</div>
          <div>
            <div class="lib-name">${lib.name}</div>
            <div class="lib-stats">${lib.groups?.length || 0} 个组 · ${getLibFileCount(lib)} 个文件</div>
          </div>
        </div>
        <div class="lib-actions">
          <button class="btn-icon" onclick="event.stopPropagation(); showRenameDialog('lib', '${lib.id}', '${lib.name}')" title="重命名">✏️</button>
          <button class="btn-icon delete" onclick="event.stopPropagation(); deleteLib('${lib.id}')" title="删除">🗑️</button>
        </div>
      </div>
    `).join('')
  }

  // 渲染私有库
  const priContainer = document.getElementById('priLibs')
  if (priLibs.length === 0) {
    priContainer.innerHTML = `
      <div class="empty-state">
        <p>🔒 暂无私有库</p>
        <p style="font-size: 0.9rem; color: #666;">点击"新建库"开始创建</p>
      </div>
    `
  } else {
    priContainer.innerHTML = priLibs.map(lib => `
      <div class="lib-card" onclick="loadLibContent('${lib.id}')">
        <div class="lib-info">
          <div class="lib-icon">🔒</div>
          <div>
            <div class="lib-name">${lib.name}</div>
            <div class="lib-stats">${lib.groups?.length || 0} 个组 · ${getLibFileCount(lib)} 个文件</div>
          </div>
        </div>
        <div class="lib-actions">
          <button class="btn-icon" onclick="event.stopPropagation(); showRenameDialog('lib', '${lib.id}', '${lib.name}')" title="重命名">✏️</button>
          <button class="btn-icon delete" onclick="event.stopPropagation(); deleteLib('${lib.id}')" title="删除">🗑️</button>
        </div>
      </div>
    `).join('')
  }

  // 更新统计信息
  updateLibStats()
}

function updateLibStats() {
  let totalFiles = 0
  let totalGroups = 0
  
  current.libs.forEach(lib => {
    lib.groups?.forEach(group => {
      totalFiles += (group.files?.length || 0)
      totalGroups++
    })
  })
  
  const pubCount = current.libs.filter(l => l.type === 'pub').length
  const priCount = current.libs.filter(l => l.type === 'pri').length
  
  document.getElementById('pubCount').textContent = pubCount
  document.getElementById('priCount').textContent = priCount
  document.getElementById('totalFiles').textContent = totalFiles
  
  console.log('统计信息更新:', { pubCount, priCount, totalFiles, totalGroups })
}

/* ===== 库管理 ===== */
function showNewLibDialog() {
  document.getElementById('newLibName').value = ''
  document.getElementById('newLibType').value = 'pub'
  document.getElementById('newLibDlg').showModal()
}

async function createNewLib() {
  const name = document.getElementById('newLibName').value.trim()
  const type = document.getElementById('newLibType').value
  
  if (!name) {
    toast('请输入库名称')
    return
  }
  
  try {
    const newLib = {
      id: 'lib_' + Date.now(),
      name: name,
      type: type,
      groups: [],
      created_at: new Date().toISOString()
    }
    
    if (!Array.isArray(current.libs)) {
      current.libs = []
    }
    
    // 检查是否已存在同名库
    if (current.libs.some(lib => lib.name === name)) {
      toast('库名称已存在')
      return
    }
    
    current.libs.push(newLib)
    
    await saveUserData()
    
    document.getElementById('newLibDlg').close()
    toast('库创建成功！')
    
    // 重新加载库列表
    await loadMyLibs()
    
  } catch (error) {
    toast('创建库失败：' + error.message)
  }
}

async function deleteLib(libId) {
  if (!confirm('确定删除这个库？库内的所有文件和组都会被删除！')) return
  
  try {
    const libIndex = current.libs.findIndex(l => l.id === libId)
    if (libIndex === -1) return
    
    const lib = current.libs[libIndex]
    
    // 删除存储桶中的文件
    for (const group of lib.groups || []) {
      for (const file of group.files || []) {
        const path = `u/${current.serial}/${libId}/${group.id}/${file.name}`
        await supabase.storage.from('public').remove([path])
      }
    }
    
    current.libs.splice(libIndex, 1)
    await saveUserData()
    
    loadMyLibs()
    toast('库已删除')
    
  } catch (error) {
    toast('删除库失败：' + error.message)
  }
}

/* ===== 弹窗式库内容 ===== */
async function loadLibContent(libId) {
  console.log('加载库内容:', libId)
  
  // 重新获取最新数据
  await loadMyLibs()
  
  const lib = current.libs.find(l => l.id === libId)
  if (!lib) {
    toast('库不存在')
    return
  }
  
  currentLib = lib
  console.log('当前库:', currentLib)
  
  // 创建库内容弹窗
  createLibModal(lib)
}

function createLibModal(lib) {
  // 创建弹窗HTML
  const modalHtml = `
    <div id="libModal" class="modal-overlay">
      <div class="modal-content large-modal">
        <div class="modal-header">
          <h3>📚 ${lib.name}</h3>
          <button class="close-btn" onclick="closeLibModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="lib-modal-tabs">
            <button class="tab-btn active" onclick="switchLibTab('groups')">📁 组管理</button>
            <button class="tab-btn" onclick="switchLibTab('upload')">📤 上传文件</button>
            <button class="tab-btn" onclick="switchLibTab('info')">ℹ️ 库信息</button>
          </div>
          
          <!-- 组管理标签页 -->
          <div id="groupsTab" class="tab-content active">
            <div class="tab-header">
              <h4>📁 组列表</h4>
              <button class="btn-primary" onclick="showNewGroupDialog()">+ 新建组</button>
            </div>
            <div id="modalGroupsList" class="groups-grid"></div>
          </div>
          
          <!-- 上传文件标签页 -->
          <div id="uploadTab" class="tab-content">
            <div class="upload-section">
              <h4>📤 上传文件</h4>
              <div class="upload-area">
                <input type="file" id="modalFileInput" multiple class="file-input">
                <div class="upload-info">
                  <p>选择文件后，请先选择一个组进行上传</p>
                  <div id="groupSelector" class="group-selector"></div>
                </div>
                <button onclick="uploadToSelectedGroup()" class="btn-primary">上传到选定组</button>
              </div>
            </div>
          </div>
          
          <!-- 库信息标签页 -->
          <div id="infoTab" class="tab-content">
            <div class="lib-info-section">
              <h4>ℹ️ 库信息</h4>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">库名称:</span>
                  <span class="info-value">${lib.name}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">库类型:</span>
                  <span class="info-value">${lib.type === 'pub' ? '🌐 公开' : '🔒 私有'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">组数量:</span>
                  <span class="info-value">${lib.groups?.length || 0} 个</span>
                </div>
                <div class="info-item">
                  <span class="info-label">文件总数:</span>
                  <span class="info-value">${getLibFileCount(lib)} 个</span>
                </div>
                <div class="info-item">
                  <span class="info-label">创建时间:</span>
                  <span class="info-value">${lib.created_at ? new Date(lib.created_at).toLocaleString() : '未知'}</span>
                </div>
              </div>
              <div class="action-buttons">
                <button class="btn-secondary" onclick="showRenameDialog('lib', '${lib.id}', '${lib.name}')">✏️ 重命名</button>
                <button class="btn-danger" onclick="deleteLib('${lib.id}')">🗑️ 删除库</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
  
  // 添加到页面
  document.body.insertAdjacentHTML('beforeend', modalHtml)
  
  // 渲染组列表
  renderModalGroupsList(lib)
  
  // 渲染组选择器
  renderGroupSelector(lib)
}

function closeLibModal() {
  const modal = document.getElementById('libModal')
  if (modal) {
    modal.remove()
  }
  currentLib = null
  currentGroup = null
}

function switchLibTab(tabName) {
  // 移除所有标签页激活状态
  document.querySelectorAll('.lib-modal-tabs .tab-btn').forEach(btn => {
    btn.classList.remove('active')
  })
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active')
  })
  
  // 激活当前标签页
  const activeBtn = document.querySelector(`.tab-btn[onclick*="${tabName}"]`)
  const activeContent = document.getElementById(tabName + 'Tab')
  
  if (activeBtn) activeBtn.classList.add('active')
  if (activeContent) activeContent.classList.add('active')
}

function renderModalGroupsList(lib) {
  const container = document.getElementById('modalGroupsList')
  
  if (!lib.groups || lib.groups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📁 暂无组</p>
        <p style="font-size: 0.9rem; color: #666;">点击"新建组"开始添加文件</p>
      </div>
    `
    return
  }
  
  container.innerHTML = lib.groups.map(group => `
    <div class="group-card ${currentGroup?.id === group.id ? 'active' : ''}" 
         onclick="selectGroup('${lib.id}', '${group.id}')">
      <div class="group-icon">📁</div>
      <div class="group-info">
        <div class="group-name">${group.name}</div>
        <div class="group-stats">${group.files?.length || 0} 个文件</div>
        <div class="group-date">${group.created_at ? new Date(group.created_at).toLocaleDateString() : ''}</div>
      </div>
      <div class="group-actions">
        <button class="btn-icon" onclick="event.stopPropagation(); loadGroupFilesModal('${lib.id}', '${group.id}')" title="查看文件">👁️</button>
        <button class="btn-icon" onclick="event.stopPropagation(); showRenameDialog('group', '${group.id}', '${group.name}')" title="重命名">✏️</button>
        <button class="btn-icon delete" onclick="event.stopPropagation(); deleteGroup('${lib.id}', '${group.id}')" title="删除">🗑️</button>
      </div>
    </div>
  `).join('')
}

function renderGroupSelector(lib) {
  const container = document.getElementById('groupSelector')
  
  if (!lib.groups || lib.groups.length === 0) {
    container.innerHTML = `
      <div class="empty-state small">
        <p>请先创建组</p>
      </div>
    `
    return
  }
  
  container.innerHTML = `
    <select id="selectedGroup" class="group-select">
      <option value="">请选择组</option>
      ${lib.groups.map(group => `
        <option value="${group.id}">${group.name} (${group.files?.length || 0} 个文件)</option>
      `).join('')}
    </select>
  `
}

function selectGroup(libId, groupId) {
  const lib = current.libs.find(l => l.id === libId)
  const group = lib?.groups.find(g => g.id === groupId)
  
  if (!lib || !group) return
  
  currentGroup = group
  
  // 更新组激活状态
  document.querySelectorAll('.group-card').forEach(card => {
    card.classList.remove('active')
  })
  const targetCard = document.querySelector(`.group-card[onclick*="'${groupId}'"]`)
  if (targetCard) {
    targetCard.classList.add('active')
  }
  
  // 自动切换到文件查看
  loadGroupFilesModal(libId, groupId)
}

async function loadGroupFilesModal(libId, groupId) {
  console.log('加载组文件:', libId, groupId)
  
  const lib = current.libs.find(l => l.id === libId)
  const group = lib?.groups.find(g => g.id === groupId)
  
  if (!lib || !group) {
    toast('组不存在')
    return
  }
  
  currentGroup = group
  
  // 创建文件查看弹窗
  createFilesModal(lib, group)
}

function createFilesModal(lib, group) {
  // 创建文件弹窗
  const modalHtml = `
    <div id="filesModal" class="modal-overlay">
      <div class="modal-content large-modal">
        <div class="modal-header">
          <h3>📁 ${group.name} - ${lib.name}</h3>
          <button class="close-btn" onclick="closeFilesModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="files-header">
            <div class="files-info">
              <span>共 ${group.files?.length || 0} 个文件</span>
              <span>${formatFileSize(getGroupTotalSize(group))}</span>
            </div>
            <div class="files-actions">
              <input type="file" id="filesModalInput" multiple class="file-input">
              <button onclick="uploadToCurrentGroup()" class="btn-primary">上传文件</button>
            </div>
          </div>
          <div id="filesModalContent" class="files-grid-modal"></div>
        </div>
      </div>
    </div>
  `
  
  // 添加到页面
  document.body.insertAdjacentHTML('beforeend', modalHtml)
  
  // 加载文件列表
  loadFilesModalContent(lib.id, group.id)
}

function closeFilesModal() {
  const modal = document.getElementById('filesModal')
  if (modal) {
    modal.remove()
  }
}

async function loadFilesModalContent(libId, groupId) {
  const container = document.getElementById('filesModalContent')
  
  try {
    container.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载文件中...</span>
      </div>
    `
    
    // 从数据库加载文件元数据
    const lib = current.libs.find(l => l.id === libId)
    const group = lib?.groups.find(g => g.id === groupId)
    
    if (!group || !Array.isArray(group.files)) {
      renderFilesModalGrid([], libId, groupId)
      return
    }
    
    // 验证文件是否实际存在
    const validatedFiles = []
    
    for (const fileMeta of group.files) {
      const path = `u/${current.serial}/${libId}/${groupId}/${fileMeta.storageName}`
      const { data } = supabase.storage.from('public').getPublicUrl(path)
      
      try {
        // 检查文件是否存在
        const response = await fetch(data.publicUrl, { method: 'HEAD' })
        if (response.ok) {
          validatedFiles.push(fileMeta)
        } else {
          console.warn(`文件不存在: ${fileMeta.storageName}`)
          // 从元数据中移除不存在的文件
          group.files = group.files.filter(f => f.storageName !== fileMeta.storageName)
        }
      } catch (error) {
        console.warn(`文件检查失败: ${fileMeta.storageName}`, error)
        // 保留文件记录，但标记为需要验证
        validatedFiles.push({ ...fileMeta, needsVerification: true })
      }
    }
    
    // 保存更新后的元数据
    await saveUserData()
    
    console.log('验证后的文件列表:', validatedFiles)
    renderFilesModalGrid(validatedFiles, libId, groupId)
    
  } catch (error) {
    console.error('加载文件错误:', error)
    renderFilesModalGrid([], libId, groupId)
  }
}

function renderFilesModalGrid(files, libId, groupId) {
  const container = document.getElementById('filesModalContent')
  
  if (!files || files.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📄 暂无文件</p>
        <p style="font-size: 0.9rem; color: #666;">点击"上传文件"添加文件</p>
      </div>
    `
    return
  }
  
  container.innerHTML = files.map(file => `
    <div class="file-card-modal">
      <div class="file-icon-modal">${getFileIcon(file.originalName)}</div>
      <div class="file-info-modal">
        <div class="file-name-modal" title="${file.originalName}">
          ${file.originalName}
          ${file.needsVerification ? ' <span style="color: orange;" title="文件需要验证">⚠️</span>' : ''}
        </div>
        <div class="file-meta-modal">
          <span>${formatFileSize(file.size)}</span>
          <span>${file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : ''}</span>
          <span>下载: ${file.downloadCount || 0} 次</span>
        </div>
        <div class="file-storage-name" style="font-size: 0.7rem; color: #888; margin-top: 0.25rem;">
          存储名: ${file.storageName}
        </div>
      </div>
      <div class="file-actions-modal">
        <button class="btn-icon" onclick="previewFile('${libId}', '${groupId}', '${file.storageName}', '${file.originalName}')" title="预览">👁👁️</button>
        <button class="btn-icon" onclick="downloadFile('${libId}', '${groupId}', '${file.storageName}', '${file.originalName}')" title="下载">📥📥</button>
        <button class="btn-icon" onclick="copyFileLink('${libId}', '${groupId}', '${file.storageName}', '${file.originalName}')" title="复制链接">🔗🔗</button>
        <button class="btn-icon delete" onclick="deleteFile('${libId}', '${groupId}', '${file.storageName}')" title="删除">🗑🗑️</button>
      </div>
    </div>
  `).join('')
}
async function downloadFile(libId, groupId, storageFileName, originalFileName) {
  const path = `u/${current.serial}/${libId}/${groupId}/${storageFileName}`
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  
  try {
    const response = await fetch(data.publicUrl)
    if (!response.ok) {
      throw new Error(`文件下载失败: ${response.status} ${response.statusText}`)
    }
    
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = originalFileName || storageFileName // 使用原始文件名作为下载文件名
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    // 更新下载计数
    await updateDownloadCount(libId, groupId, storageFileName)
    
    toast(`文件 "${originalFileName}" 下载开始`)
    
  } catch (error) {
    toast('下载失败：' + error.message)
  }
}
async function updateDownloadCount(libId, groupId, storageFileName) {
  try {
    const lib = current.libs.find(l => l.id === libId)
    const group = lib?.groups.find(g => g.id === groupId)
    const file = group?.files.find(f => f.storageName === storageFileName)
    
    if (file) {
      file.downloadCount = (file.downloadCount || 0) + 1
      file.lastDownloaded = new Date().toISOString()
      await saveUserData()
    }
  } catch (error) {
    console.error('更新下载计数失败:', error)
  }
}
async function previewFile(libId, groupId, storageFileName, originalFileName) {
  const path = `u/${current.serial}/${libId}/${groupId}/${storageFileName}`
  const ext = originalFileName.split('.').pop().toLowerCase()
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  
  // 创建预览弹窗
  const previewHtml = `
    <div id="previewModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>${originalFileName}</h3>
          <button class="close-btn" onclick="closePreview()">✕✕</button>
        </div>
        <div class="modal-body">
          <div id="previewContent">
            <div class="file-preview-info">
              <p><strong>原始文件名:</strong> ${originalFileName}</p>
              <p><strong>存储文件名:</strong> ${storageFileName}</p>
              <p><strong>文件类型:</strong> ${ext}</p>
              <p><strong>大小:</strong> ${await getFileSize(path)}</p>
            </div>
            ${['jpg','jpeg','png','gif','webp'].includes(ext) ? 
              `<div class="image-preview">
                
               </div>` :
              `<div class="text-preview">
                <p>不支持在线预览，请下载查看</p>
               </div>`
            }
          </div>
          <div class="modal-actions">
            <button onclick="downloadFile('${libId}', '${groupId}', '${storageFileName}', '${originalFileName}')" class="btn-primary">下载文件</button>
            <button onclick="copyFileLink('${libId}', '${groupId}', '${storageFileName}', '${originalFileName}')" class="btn-secondary">复制链接</button>
          </div>
        </div>
      </div>
    </div>
  `
  
  document.body.insertAdjacentHTML('beforeend', previewHtml)
}
async function copyFileLink(libId, groupId, storageFileName, originalFileName) {
  const path = `u/${current.serial}/${libId}/${groupId}/${storageFileName}`
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  
  const linkInfo = `文件名: ${originalFileName}\n下载链接: ${data.publicUrl}`
  
  try {
    await navigator.clipboard.writeText(linkInfo)
    toast('文件信息已复制到剪贴板\n包含文件名和下载链接')
  } catch (error) {
    // 降级方案
    const textArea = document.createElement('textarea')
    textArea.value = linkInfo
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    toast('文件信息已复制到剪贴板')
  }
}
async function deleteFile(libId, groupId, storageFileName) {
  if (!confirm(`确定删除这个文件？此操作不可撤销！`)) return
  
  try {
    const path = `u/${current.serial}/${libId}/${groupId}/${storageFileName}`
    const { error } = await supabase.storage.from('public').remove([path])
    
    if (error) {
      toast('删除失败: ' + error.message)
      return
    }
    
    // 从元数据中移除文件记录
    const lib = current.libs.find(l => l.id === libId)
    const group = lib?.groups.find(g => g.id === groupId)
    if (group && group.files) {
      group.files = group.files.filter(f => f.storageName !== storageFileName)
      await saveUserData()
    }
    
    toast('文件删除成功')
    
    // 刷新文件列表
    if (document.getElementById('filesModalContent')) {
      await loadFilesModalContent(libId, groupId)
    }
    
  } catch (error) {
    toast('删除失败：' + error.message)
  }
}
async function downloadHisFile(libId, groupId, storageFileName) {
  // 首先需要获取原始文件名
  const userData = await getUserData(currentHis)
  const libs = typeof userData.libs === 'string' ? JSON.parse(userData.libs) : userData.libs
  const lib = libs.find(l => l.id === libId)
  const group = lib?.groups.find(g => g.id === groupId)
  const file = group?.files.find(f => f.storageName === storageFileName)
  
  const originalFileName = file?.originalName || storageFileName
  const path = `u/${currentHis}/${libId}/${groupId}/${storageFileName}`
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  
  try {
    const response = await fetch(data.publicUrl)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = originalFileName // 使用原始文件名
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast(`文件 "${originalFileName}" 下载开始`)
  } catch (error) {
    toast('下载失败：' + error.message)
  }
}

async function copyHisFileLink(libId, groupId, storageFileName) {
  // 获取原始文件名
  const userData = await getUserData(currentHis)
  const libs = typeof userData.libs === 'string' ? JSON.parse(userData.libs) : userData.libs
  const lib = libs.find(l => l.id === libId)
  const group = lib?.groups.find(g => g.id === groupId)
  const file = group?.files.find(f => f.storageName === storageFileName)
  
  const originalFileName = file?.originalName || storageFileName
  const path = `u/${currentHis}/${libId}/${groupId}/${storageFileName}`
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  
  const linkInfo = `文件名: ${originalFileName}\n下载链接: ${data.publicUrl}`
  
  try {
    await navigator.clipboard.writeText(linkInfo)
    toast('文件信息已复制到剪贴板')
  } catch (error) {
    const textArea = document.createElement('textarea')
    textArea.value = linkInfo
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    toast('文件信息已复制到剪贴板')
  }
}

/* ===== 辅助函数 ===== */
async function getUserData(serial) {
  const { data, error } = await supabase.from('profiles')
    .select('*')
    .eq('serial', serial)
    .single()
  
  if (error) throw error
  return data
}

/* ===== 初始化时迁移现有文件数据 ===== */
async function migrateExistingFiles() {
  if (!current.libs || !Array.isArray(current.libs)) return
  
  let needsMigration = false
  
  for (const lib of current.libs) {
    for (const group of lib.groups || []) {
      if (group.files && Array.isArray(group.files)) {
        for (const file of group.files) {
          // 如果文件记录没有storageName字段，需要迁移
          if (!file.storageName) {
            file.storageName = file.name || `legacy_${Date.now()}`
            file.originalName = file.name || '未知文件'
            needsMigration = true
          }
        }
      }
    }
  }
  
  if (needsMigration) {
    await saveUserData()
    console.log('文件数据迁移完成')
  }
}
async function uploadToSelectedGroup() {
  const selectedGroupId = document.getElementById('selectedGroup').value
  if (!selectedGroupId) {
    toast('请先选择组')
    return
  }
  
  const files = document.getElementById('modalFileInput').files
  if (files.length === 0) {
    toast('请选择文件')
    return
  }
  
  await uploadFilesToGroup(currentLib.id, selectedGroupId, files)
}

async function uploadToCurrentGroup() {
  if (!currentGroup) {
    toast('请先选择组')
    return
  }
  
  const files = document.getElementById('filesModalInput').files
  if (files.length === 0) {
    toast('请选择文件')
    return
  }
  
  await uploadFilesToGroup(currentLib.id, currentGroup.id, files)
}

async function uploadFilesToGroup(libId, groupId, files) {
  console.log('上传文件到组:', { libId, groupId, fileCount: files.length })
  
  let successCount = 0
  let errorCount = 0
  
  for (const file of files) {
    try {
      // 生成唯一文件名（使用时间戳+随机数）
      const fileExt = file.name.split('.').pop()
      const uniqueFileName = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`
      
      const filePath = `u/${current.serial}/${libId}/${groupId}/${uniqueFileName}`
      
      const { error } = await supabase.storage
        .from('public')
        .upload(filePath, file, { upsert: true })
      
      if (error) {
        console.error('上传错误:', error)
        errorCount++
        toast(`文件 ${file.name} 上传失败: ${error.message}`)
      } else {
        // 成功上传后，更新文件元数据
        await updateFileMetadata(libId, groupId, uniqueFileName, file.name, file.size)
        successCount++
      }
      
    } catch (error) {
      console.error('上传异常:', error)
      errorCount++
      toast(`文件 ${file.name} 上传异常: ${error.message}`)
    }
  }
  
  if (successCount > 0) {
    toast(`成功上传 ${successCount} 个文件${errorCount > 0 ? `，${errorCount} 个文件失败` : ''}`)
    
    // 刷新文件列表
    if (document.getElementById('filesModalContent')) {
      await loadFilesModalContent(libId, groupId)
    }
    
    // 刷新组列表
    if (document.getElementById('modalGroupsList')) {
      renderModalGroupsList(currentLib)
    }
    
    // 刷新组选择器
    if (document.getElementById('groupSelector')) {
      renderGroupSelector(currentLib)
    }
  }
  
  // 清空文件输入
  document.getElementById('modalFileInput').value = ''
  document.getElementById('filesModalInput').value = ''
}

async function updateFileMetadata(libId, groupId, storageFileName, originalFileName, fileSize) {
  try {
    const lib = current.libs.find(l => l.id === libId)
    if (!lib) return
    
    let group = lib.groups.find(g => g.id === groupId)
    if (!group) {
      // 如果组不存在，创建新组
      group = {
        id: groupId,
        name: groupId, // 使用ID作为默认名称
        files: [],
        created_at: new Date().toISOString()
      }
      lib.groups.push(group)
    }
    
    if (!Array.isArray(group.files)) {
      group.files = []
    }
    
    // 检查是否已存在相同存储文件名的记录
    const existingFileIndex = group.files.findIndex(f => f.storageName === storageFileName)
    
    const fileMetadata = {
      storageName: storageFileName, // 存储中的唯一文件名
      originalName: originalFileName, // 原始文件名
      size: fileSize,
      uploadedAt: new Date().toISOString(),
      downloadCount: 0
    }
    
    if (existingFileIndex !== -1) {
      // 更新现有文件记录
      group.files[existingFileIndex] = fileMetadata
    } else {
      // 添加新文件记录
      group.files.push(fileMetadata)
    }
    
    await saveUserData()
    console.log('文件元数据更新成功:', fileMetadata)
    
  } catch (error) {
    console.error('更新文件元数据失败:', error)
  }
}
function getGroupTotalSize(group) {
  if (!group.files || !Array.isArray(group.files)) return 0
  return group.files.reduce((total, file) => total + (file.size || 0), 0)
}

/* ===== 组管理 ===== */
function showNewGroupDialog() {
  if (!currentLib) {
    toast('请先选择库')
    return
  }
  
  document.getElementById('newGroupName').value = ''
  document.getElementById('newGroupDlg').showModal()
}

async function createNewGroup() {
  const name = document.getElementById('newGroupName').value.trim()
  
  if (!name) {
    toast('请输入组名称')
    return
  }
  
  if (!currentLib) {
    toast('请先选择库')
    return
  }
  
  try {
    const newGroup = {
      id: 'group_' + Date.now(),
      name: name,
      files: [],
      created_at: new Date().toISOString()
    }
    
    if (!Array.isArray(currentLib.groups)) {
      currentLib.groups = []
    }
    
    // 检查是否已存在同名组
    if (currentLib.groups.some(g => g.name === name)) {
      toast('组名称已存在')
      return
    }
    
    currentLib.groups.push(newGroup)
    await saveUserData()
    
    document.getElementById('newGroupDlg').close()
    toast('组创建成功！')
    
    // 刷新组列表
    if (document.getElementById('modalGroupsList')) {
      renderModalGroupsList(currentLib)
    }
    if (document.getElementById('groupSelector')) {
      renderGroupSelector(currentLib)
    }
    
  } catch (error) {
    toast('创建组失败：' + error.message)
  }
}

async function deleteGroup(libId, groupId) {
  if (!confirm('确定删除这个组？组内的所有文件都会被删除！')) return
  
  try {
    const lib = current.libs.find(l => l.id === libId)
    if (!lib) return
    
    const groupIndex = lib.groups.findIndex(g => g.id === groupId)
    if (groupIndex === -1) return
    
    const group = lib.groups[groupIndex]
    
    // 删除存储桶中的文件
    for (const file of group.files || []) {
      const path = `u/${current.serial}/${libId}/${groupId}/${file.name}`
      await supabase.storage.from('public').remove([path])
    }
    
    lib.groups.splice(groupIndex, 1)
    await saveUserData()
    
    // 刷新界面
    if (document.getElementById('filesModal')) {
      closeFilesModal()
    }
    if (document.getElementById('modalGroupsList')) {
      renderModalGroupsList(lib)
    }
    if (document.getElementById('groupSelector')) {
      renderGroupSelector(lib)
    }
    
    toast('组已删除')
    
  } catch (error) {
    toast('删除组失败：' + error.message)
  }
}

/* ===== 文件操作 ===== */
async function previewFile(libId, groupId, fileName) {
  const path = `u/${current.serial}/${libId}/${groupId}/${fileName}`
  const ext = fileName.split('.').pop().toLowerCase()
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  
  // 创建预览弹窗
  const previewHtml = `
    <div id="previewModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>${fileName}</h3>
          <button class="close-btn" onclick="closePreview()">✕</button>
        </div>
        <div class="modal-body">
          <div id="previewContent">
            ${['jpg','jpeg','png','gif','webp'].includes(ext) ? 
              `` :
              `<p>文件类型: ${ext}</p><p>大小: ${await getFileSize(path)}</p><p>不支持在线预览，请下载查看</p>`
            }
          </div>
          <div class="modal-actions">
            <button onclick="downloadFile('${libId}', '${groupId}', '${fileName}')" class="btn-primary">下载文件</button>
            <button onclick="copyFileLink('${libId}', '${groupId}', '${fileName}')" class="btn-secondary">复制链接</button>
          </div>
        </div>
      </div>
    </div>
  `
  
  document.body.insertAdjacentHTML('beforeend', previewHtml)
}

function closePreview() {
  const modal = document.getElementById('previewModal')
  if (modal) modal.remove()
}

async function downloadFile(libId, groupId, fileName) {
  const path = `u/${current.serial}/${libId}/${groupId}/${fileName}`
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  
  try {
    const response = await fetch(data.publicUrl)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast('文件下载开始')
  } catch (error) {
    toast('下载失败：' + error.message)
  }
}

async function copyFileLink(libId, groupId, fileName) {
  const path = `u/${current.serial}/${libId}/${groupId}/${fileName}`
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  
  try {
    await navigator.clipboard.writeText(data.publicUrl)
    toast('文件链接已复制到剪贴板')
  } catch (error) {
    // 降级方案
    const textArea = document.createElement('textarea')
    textArea.value = data.publicUrl
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    toast('文件链接已复制到剪贴板')
  }
}

async function deleteFile(libId, groupId, fileName) {
  if (!confirm(`确定删除文件 ${fileName}？`)) return
  
  try {
    const path = `u/${current.serial}/${libId}/${groupId}/${fileName}`
    const { error } = await supabase.storage.from('public').remove([path])
    
    if (error) {
      toast('删除失败: ' + error.message)
      return
    }
    
    // 更新文件列表
    const lib = current.libs.find(l => l.id === libId)
    const group = lib?.groups.find(g => g.id === groupId)
    if (group && group.files) {
      group.files = group.files.filter(f => f.name !== fileName)
      await saveUserData()
    }
    
    toast('文件删除成功')
    
    // 刷新文件列表
    if (document.getElementById('filesModalContent')) {
      await loadFilesModalContent(libId, groupId)
    }
    
  } catch (error) {
    toast('删除失败：' + error.message)
  }
}

async function getFileSize(path) {
  try {
    const { data: files, error } = await supabase.storage.from('public').list(path)
    if (error || !files || files.length === 0) return '未知大小'
    
    const file = files.find(f => !f.name.endsWith('/'))
    return formatFileSize(file?.metadata?.size)
  } catch {
    return '未知大小'
  }
}

/* ===== 重命名功能 ===== */
function showRenameDialog(type, targetId, currentName) {
  renameTarget = { type, targetId, currentName }
  document.getElementById('renameTitle').textContent = `重命名${type === 'lib' ? '库' : '组'}`
  document.getElementById('renameInput').value = currentName
  document.getElementById('renameDlg').showModal()
}

async function confirmRename() {
  if (!renameTarget) return
  
  const newName = document.getElementById('renameInput').value.trim()
  if (!newName) {
    toast('请输入新名称')
    return
  }
  
  const { type, targetId } = renameTarget
  
  try {
    if (type === 'lib') {
      const lib = current.libs.find(l => l.id === targetId)
      if (lib) lib.name = newName
    } else if (type === 'group' && currentLib) {
      const group = currentLib.groups.find(g => g.id === targetId)
      if (group) group.name = newName
    }
    
    await saveUserData()
    document.getElementById('renameDlg').close()
    renameTarget = null
    
    // 刷新界面
    if (type === 'lib') {
      loadMyLibs()
    } else if (type === 'group' && currentLib) {
      if (document.getElementById('modalGroupsList')) {
        renderModalGroupsList(currentLib)
      }
    }
    
    toast('重命名成功！')
    
  } catch (error) {
    toast('重命名失败：' + error.message)
  }
}

/* ===== 公共空间功能 ===== */
async function loadPubUsers() {
  try {
    console.log('开始加载公共用户列表...')
    
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, serial, libs')
    
    if (error) {
      throw error
    }
    
    if (!users || users.length === 0) {
      document.getElementById('userList').innerHTML = `
        <div class="empty-state">
          <p>👥 暂无用户</p>
          <p style="font-size: 0.9rem; color: #666;">还没有用户注册</p>
        </div>
      `
      return
    }
    
    // 过滤出有公开库的用户
    const pubUsers = users.filter(user => {
      try {
        if (!user || !user.libs) return false
        
        let libs
        if (typeof user.libs === 'string') {
          libs = JSON.parse(user.libs)
        } else {
          libs = user.libs
        }
        
        return Array.isArray(libs) && 
               libs.some(lib => lib && lib.type === 'pub' && 
               lib.groups && 
               Array.isArray(lib.groups) && 
               lib.groups.length > 0)
      } catch (error) {
        console.error('解析用户libs失败:', user?.username, error)
        return false
      }
    })
    
    if (pubUsers.length === 0) {
      document.getElementById('userList').innerHTML = `
        <div class="empty-state">
          <p>🌐 暂无公开用户</p>
          <p style="font-size: 0.9rem; color: #666;">其他用户还没有创建公开库</p>
        </div>
      `
      return
    }
    
    // 渲染用户列表（包含头像）
    document.getElementById('userList').innerHTML = pubUsers.map(user => {
      if (!user) return ''
      
      let libs = []
      try {
        libs = typeof user.libs === 'string' ? JSON.parse(user.libs) : (user.libs || [])
      } catch {
        libs = []
      }
      
      const pubLibs = libs.filter(lib => lib && lib.type === 'pub')
      const totalFiles = pubLibs.reduce((total, lib) => total + getLibFileCount(lib), 0)
      const totalGroups = pubLibs.reduce((total, lib) => total + ((lib.groups && Array.isArray(lib.groups)) ? lib.groups.length : 0), 0)
      
      // 获取用户头像URL
      const avatarUrl = user.avatar_url || getDefaultAvatar(user.username || 'User')
      
      return `
        <div class="user-card" onclick="enterHis('${user.serial}', '${user.username}')">
          <div class="user-avatar">
            <img src="https://jbcrkuwnlmdmwwmiimhr.supabase.co/storage/v1/object/public/public/u/${user.serial}/avatar/avatar.png">
          </div>
          <div class="user-info">
            <div class="user-name">${user.username || '未知用户'}</div>
            <div class="user-stats">${pubLibs.length} 个公开库 · ${totalGroups} 个组 · ${totalFiles} 个文件</div>
            <div class="user-serial" style="font-size: 0.8rem; color: #888;">序列号: ${user.serial || '未知'}</div>
          </div>
          <div class="user-arrow">→</div>
        </div>
      `
    }).join('')
    
  } catch (error) {
    console.error('加载公共用户错误:', error)
    document.getElementById('userList').innerHTML = `
      <div class="empty-state">
        <p>❌ 加载用户列表失败</p>
        <p style="font-size: 0.9rem; color: #666;">${error.message || '未知错误'}</p>
        <button onclick="loadPubUsers()" class="btn-secondary" style="margin-top: 10px;">重试</button>
      </div>
    `
  }
}

async function enterHis(serial, username) {
  currentHis = serial
  const { data: userData, error } = await supabase.from('profiles')
    .select('username, avatar_url, libs')
    .eq('serial', serial)
    .single()

  if (error || !userData) {
    toast('加载用户信息失败: ' + (error?.message || '用户不存在'))
    return
  }

  document.getElementById('hisName').textContent = username

  let libs = []
  try {
    libs = typeof userData.libs === 'string' ? JSON.parse(userData.libs) : userData.libs
  } catch {
    libs = []
  }
  
  const pubLibs = libs.filter(lib => lib.type === 'pub' && lib.groups && lib.groups.length > 0)

  if (pubLibs.length === 0) {
    document.getElementById('hisLibs').innerHTML = `
      <div class="empty-state">
        <p>📚 该用户暂无公开库</p>
        <p style="font-size: 0.9rem; color: #666;">或者公开库中没有内容</p>
      </div>
    `
  } else {
    document.getElementById('hisLibs').innerHTML = pubLibs.map(lib => `
      <div class="lib-card" onclick="enterHisLib('${lib.id}', '${lib.name}', '${username}')">
        <div class="lib-info">
          <div class="lib-icon">🌐</div>
          <div>
            <div class="lib-name">${lib.name}</div>
            <div class="lib-stats">${lib.groups?.length || 0} 个组 · ${getLibFileCount(lib)} 个文件</div>
          </div>
        </div>
        <div class="lib-arrow">→</div>
      </div>
    `).join('')
  }

  showSection('hisBox')
}
async function viewHisGroupFiles(libId, groupId) {
  console.log('查看公共库文件:', { libId, groupId, currentHis, currentHisLib })
  
  const lib = currentHisLib
  const group = lib.groups.find(g => g.id === groupId)
  
  if (!group) {
    toast('组不存在')
    return
  }
  
  const container = document.getElementById('hisGroupFilesView')
  
  // 显示加载状态
  container.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载文件中...</span>
    </div>
  `
  
  try {
    // 验证文件是否存在并获取最新信息
    const validatedFiles = await validateHisFiles(libId, groupId, group.files || [])
    
    if (validatedFiles.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📄该组暂无有效文件</p>
          <p style="font-size: 0.9rem; color: #666;">组 "${group.name}" 中的文件可能已被删除或无法访问</p>
        </div>
      `
      return
    }
    
    // 使用私人库的文件显示方式
    container.innerHTML = `
      <div class="group-section">
        <h4>📁📁 ${group.name} - 文件列表 (${validatedFiles.length} 个文件)</h4>
        <div class="files-grid-modal" style="max-height: 500px; overflow-y: auto;">
          ${validatedFiles.map(file => `
            <div class="file-card-modal">
              <div class="file-icon-modal">${getFileIcon(file.originalName || file.name)}</div>
              <div class="file-info-modal">
                <div class="file-name-modal" title="${file.originalName || file.name}">
                  ${file.originalName || file.name}
                  ${file.needsVerification ? ' <span style="color: orange;" title="文件需要验证">⚠️</span>' : ''}
                </div>
                <div class="file-meta-modal">
                  <span>${formatFileSize(file.size)}</span>
                  <span>${file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : ''}</span>
                  <span>下载: ${file.downloadCount || 0} 次</span>
                </div>
                ${file.storageName ? `
                  <div class="file-storage-name" style="font-size: 0.7rem; color: #888; margin-top: 0.25rem;">
                    存储名: ${file.storageName}
                  </div>
                ` : ''}
              </div>
              <div class="file-actions-modal">
                <button class="btn-icon" onclick="previewHisFile('${libId}', '${groupId}', '${file.storageName || file.name}', '${file.originalName || file.name}')" title="预览">👁👁️</button>
                <button class="btn-icon" onclick="downloadHisFile('${libId}', '${groupId}', '${file.storageName || file.name}', '${file.originalName || file.name}')" title="下载">📥📥</button>
                <button class="btn-icon" onclick="copyHisFileLink('${libId}', '${groupId}', '${file.storageName || file.name}', '${file.originalName || file.name}')" title="复制链接">🔗🔗</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
    
  } catch (error) {
    console.error('加载公共库文件错误:', error)
    container.innerHTML = `
      <div class="error-state">
        <p>❌❌ 加载文件失败</p>
        <p style="font-size: 0.9rem; color: #666;">${error.message}</p>
        <button onclick="viewHisGroupFiles('${libId}', '${groupId}')" class="btn-secondary" style="margin-top: 10px;">重试</button>
      </div>
    `
  }
}
async function validateHisFiles(libId, groupId, files) {
  if (!files || !Array.isArray(files) || files.length === 0) {
    return []
  }
  
  const validatedFiles = []
  
  for (const fileMeta of files) {
    try {
      // 构建正确的文件路径
      const storageFileName = fileMeta.storageName || fileMeta.name
      const path = `u/${currentHis}/${libId}/${groupId}/${storageFileName}`
      
      console.log('验证文件路径:', path)
      
      // 检查文件是否存在
      const { data } = supabase.storage.from('public').getPublicUrl(path)
      
      // 使用 HEAD 请求验证文件可访问性
      const response = await fetch(data.publicUrl, { method: 'HEAD' })
      
      if (response.ok) {
        // 文件存在，添加到有效文件列表
        validatedFiles.push({
          ...fileMeta,
          storageName: storageFileName,
          originalName: fileMeta.originalName || fileMeta.name,
          size: fileMeta.size || 0,
          uploadedAt: fileMeta.uploadedAt || fileMeta.created_at,
          downloadCount: fileMeta.downloadCount || 0
        })
      } else {
        console.warn(`文件不存在或无法访问: ${storageFileName}`)
      }
      
    } catch (error) {
      console.warn(`文件验证失败:`, fileMeta, error)
      // 仍然显示文件，但标记为需要验证
      validatedFiles.push({
        ...fileMeta,
        storageName: fileMeta.storageName || fileMeta.name,
        originalName: fileMeta.originalName || fileMeta.name,
        needsVerification: true
      })
    }
  }
  
  return validatedFiles
}

async function enterHisLib(libId, libName, username) {
  try {
    const { data: userData, error } = await supabase.from('profiles')
      .select('libs')
      .eq('serial', currentHis)
      .single()

    if (error || !userData) {
      toast('加载库信息失败')
      return
    }

    let libs = []
    try {
      libs = typeof userData.libs === 'string' ? JSON.parse(userData.libs) : userData.libs
    } catch {
      libs = []
    }
    
    const lib = libs.find(l => l.id === libId)
    
    if (!lib) {
      toast('库不存在')
      return
    }

    currentHisLib = lib
    document.getElementById('hisLibTitle').textContent = `${username} - ${libName}`
    
    // 使用私人库的加载方式
    await loadHisLibFilesWithPrivateLogic(libId, libName, lib)
    
    document.getElementById('hisBox').classList.add('hidden')
    document.getElementById('hisLibDetail').classList.remove('hidden')
    
  } catch (error) {
    console.error('进入库详情错误:', error)
    toast('加载库详情失败: ' + error.message)
  }
}
async function loadHisLibFilesWithPrivateLogic(libId, libName, lib) {
  const container = document.getElementById('hisFiles')
  
  if (!lib.groups || lib.groups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📁📁 该库暂无文件</p>
        <p style="font-size: 0.9rem; color: #666;">库 "${libName}" 中还没有添加任何文件</p>
      </div>
    `
    return
  }
  
  // 使用私人库的弹窗式界面
  container.innerHTML = `
    <div class="lib-content">
      <div class="lib-header">
        <h3>${libName} - ${document.getElementById('hisName').textContent}</h3>
        <p>公开库浏览模式</p>
      </div>
      
      <!-- 组列表 -->
      <div class="groups-grid" style="margin-bottom: 2rem;">
        ${lib.groups.map(group => `
          <div class="group-card" onclick="viewHisGroupFiles('${libId}', '${group.id}')">
            <div class="group-icon">📁📁</div>
            <div class="group-info">
              <div class="group-name">${group.name || '未命名组'}</div>
              <div class="group-stats">${group.files?.length || 0} 个文件</div>
              <div class="group-date">${group.created_at ? new Date(group.created_at).toLocaleDateString() : ''}</div>
            </div>
            <div class="group-actions">
              <button class="btn-icon" onclick="event.stopPropagation(); viewHisGroupFiles('${libId}', '${group.id}')" title="查看文件">👁👁️</button>
            </div>
          </div>
        `).join('')}
      </div>
      
      <!-- 文件查看区域 -->
      <div id="hisGroupFilesView"></div>
    </div>
  `
}
async function downloadHisFile(libId, groupId, storageFileName, originalFileName) {
  console.log('下载公共库文件:', { libId, groupId, storageFileName, originalFileName, currentHis })
  
  const safeStorageName = storageFileName || originalFileName
  const safeOriginalName = originalFileName || storageFileName
  
  // 构建正确的文件路径
  const path = `u/${currentHis}/${libId}/${groupId}/${safeStorageName}`
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  
  console.log('下载文件路径:', path)
  console.log('公开URL:', data.publicUrl)
  
  try {
    // 显示下载中状态
    toast(`开始下载: ${safeOriginalName}`)
    
    const response = await fetch(data.publicUrl)
    if (!response.ok) {
      throw new Error(`文件下载失败: ${response.status} ${response.statusText}`)
    }
    
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = safeOriginalName // 使用原始中文文件名
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast(`文件 "${safeOriginalName}" 下载完成`)
    
  } catch (error) {
    console.error('下载失败:', error)
    toast('下载失败：' + error.message)
  }
}
async function previewHisFile(libId, groupId, storageFileName, originalFileName) {
  const safeStorageName = storageFileName || originalFileName
  const safeOriginalName = originalFileName || storageFileName
  
  const path = `u/${currentHis}/${libId}/${groupId}/${safeStorageName}`
  const ext = safeOriginalName.split('.').pop().toLowerCase()
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  
  // 创建预览弹窗
  const previewHtml = `
    <div id="previewModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>${safeOriginalName}</h3>
          <button class="close-btn" onclick="closePreview()">✕✕</button>
        </div>
        <div class="modal-body">
          <div id="previewContent">
            <div class="file-preview-info">
              <p><strong>文件名:</strong> ${safeOriginalName}</p>
              <p><strong>文件类型:</strong> ${ext}</p>
              <p><strong>来源:</strong> ${document.getElementById('hisName').textContent} 的公开库</p>
            </div>
            ${['jpg','jpeg','png','gif','webp'].includes(ext) ? 
              `<div class="image-preview">
                
               </div>` :
              `<div class="text-preview">
                <p>不支持在线预览，请下载查看</p>
               </div>`
            }
          </div>
          <div class="modal-actions">
            <button onclick="downloadHisFile('${libId}', '${groupId}', '${safeStorageName}', '${safeOriginalName}')" class="btn-primary">下载文件</button>
            <button onclick="copyHisFileLink('${libId}', '${groupId}', '${safeStorageName}', '${safeOriginalName}')" class="btn-secondary">复制链接</button>
          </div>
        </div>
      </div>
    </div>
  `
  
  document.body.insertAdjacentHTML('beforeend', previewHtml)
}

function closePreview() {
  const modal = document.getElementById('previewModal')
  if (modal) modal.remove()
}

async function copyHisFileLink(libId, groupId, storageFileName, originalFileName) {
  const safeStorageName = storageFileName || originalFileName
  const safeOriginalName = originalFileName || storageFileName
  
  const path = `u/${currentHis}/${libId}/${groupId}/${safeStorageName}`
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  
  const linkInfo = `文件名: ${safeOriginalName}\n下载链接: ${data.publicUrl}`
  
  try {
    await navigator.clipboard.writeText(linkInfo)
    toast('文件信息已复制到剪贴板\n包含文件名和下载链接')
  } catch (error) {
    // 降级方案
    const textArea = document.createElement('textarea')
    textArea.value = linkInfo
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    toast('文件信息已复制到剪贴板')
  }
}

async function loadHisLibFiles(libId, libName) {
  const container = document.getElementById('hisFiles')
  
  if (!currentHisLib.groups || currentHisLib.groups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📁 该库暂无文件</p>
        <p style="font-size: 0.9rem; color: #666;">库 "${libName}" 中还没有添加任何文件</p>
      </div>
    `
    return
  }
  
  container.innerHTML = currentHisLib.groups.map(group => `
    <div class="group-section">
      <h4>📁 ${group.name}</h4>
      <div class="files-grid">
        ${(group.files || []).map(file => `
          <div class="file-item">
            <div class="file-icon">${getFileIcon(file.name)}</div>
            <div class="file-info">
              <div class="file-name">${file.name}</div>
              <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <div class="file-actions">
              <button class="btn-icon" onclick="downloadHisFile('${libId}', '${group.id}', '${file.name}')" title="下载">📥</button>
              <button class="btn-icon" onclick="copyHisFileLink('${libId}', '${group.id}', '${file.name}')" title="复制链接">🔗</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')
}

async function downloadHisFile(libId, groupId, fileName) {
  const path = `u/${currentHis}/${libId}/${groupId}/${fileName}`
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  
  try {
    const response = await fetch(data.publicUrl)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast('文件下载开始')
  } catch (error) {
    toast('下载失败：' + error.message)
  }
}

async function copyHisFileLink(libId, groupId, fileName) {
  const path = `u/${currentHis}/${libId}/${groupId}/${fileName}`
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  
  try {
    await navigator.clipboard.writeText(data.publicUrl)
    toast('公开链接已复制')
  } catch (error) {
    const textArea = document.createElement('textarea')
    textArea.value = data.publicUrl
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    toast('公开链接已复制')
  }
}

/* ===== README管理 ===== */
async function saveReadme() {
  const text = document.getElementById('readme').value
  const blob = new Blob([text], { type: 'text/plain' })
  
  try {
    const { error } = await supabase.storage
      .from('public')
      .upload(`u/${current.serial}/README.md`, blob, { upsert: true })
    
    if (error) {
      toast('保存失败：' + error.message)
    } else {
      toast('已保存')
    }
  } catch (error) {
    toast('保存异常：' + error.message)
  }
}

async function loadReadme() {
  try {
    const { data, error } = await supabase.storage
      .from('public')
      .download(`u/${current.serial}/README.md`)
    
    if (error) {
      document.getElementById('readme').value = '# 个人说明\n\n在这里写下你的个人介绍...'
    } else {
      document.getElementById('readme').value = await data.text()
    }
  } catch (error) {
    document.getElementById('readme').value = '# 个人说明\n\n在这里写下你的个人介绍...'
  }
}

/* ===== 测试连接 ===== */
async function testConnection() {
  const debugInfo = document.getElementById('debugInfo')
  const debugContent = document.getElementById('debugContent')
  
  debugInfo.style.display = 'block'
  debugContent.innerHTML = '<p>🔍 开始测试连接...</p>'
  
  try {
    // 1. 测试数据库连接
    debugContent.innerHTML += '<p>测试数据库连接...</p>'
    const { data: users, error: dbError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
    
    if (dbError) {
      if (dbError.message.includes('profiles')) {
        debugContent.innerHTML += `
          <p style="color: orange;">⚠️ 表不存在: profiles</p>
          <p>错误详情: ${dbError.message}</p>
          <div style="background: #fff3cd; padding: 1rem; margin: 1rem 0; border-radius: 5px;">
            <p><strong>解决方案:</strong></p>
            <ol style="text-align: left; margin: 10px;">
              <li>打开 Supabase 控制台</li>
              <li>进入 SQL 编辑器</li>
              <li>执行提供的 SQL 代码创建表结构</li>
              <li>刷新页面重试</li>
            </ol>
            <button onclick="showSQLInstructions()" class="btn-primary">查看SQL代码</button>
          </div>
        `
      } else {
        throw new Error(`数据库连接失败: ${dbError.message}`)
      }
    } else {
      debugContent.innerHTML += '<p>✅ 数据库连接成功</p>'
    }
    
    // 2. 测试存储桶连接
    debugContent.innerHTML += '<p>测试存储桶连接...</p>'
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
    if (bucketError) {
      debugContent.innerHTML += `<p>⚠️ 存储桶连接: ${bucketError.message}</p>`
    } else {
      debugContent.innerHTML += '<p>✅ 存储桶连接成功</p>'
    }
    
    // 3. 显示当前用户信息
    if (current.serial) {
      debugContent.innerHTML += `
        <p>当前登录用户: ${current.username} (${current.serial})</p>
        <p>库数量: ${current.libs ? current.libs.length : 0}</p>
      `
    }
    
    debugContent.innerHTML += '<p style="color: green; font-weight: bold;">🎉 基本连接测试通过！</p>'
    
    // 自动重新加载用户列表
    setTimeout(() => {
      loadPubUsers()
    }, 1000)
    
  } catch (error) {
    debugContent.innerHTML += `
      <p style="color: red;">❌ 连接测试失败: ${error.message}</p>
      <div style="background: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 5px;">
        <p><strong>故障排除建议:</strong></p>
        <ul style="text-align: left; margin: 10px;">
          <li>检查Supabase项目配置是否正确</li>
          <li>确认数据库表是否存在</li>
          <li>检查网络连接</li>
          <li>尝试重新加载页面</li>
        </ul>
      </div>
      <button onclick="location.reload()" class="btn-primary">重新加载页面</button>
    `
    console.error('连接测试失败:', error)
  }
}

function showSQLInstructions() {
  const sqlCode = `-- 复制以下代码到Supabase SQL编辑器中执行：
DROP TABLE IF EXISTS profiles CASCADE;

CREATE TABLE profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    pwd VARCHAR(100) NOT NULL,
    serial VARCHAR(20) UNIQUE NOT NULL,
    avatar_url TEXT,
    libs JSONB DEFAULT '[]'::jsonb,
    readme_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO profiles (username, pwd, serial, avatar_url) VALUES 
    ('demo_user', 'demo123', 'UDEMO123', 'https://ui-avatars.com/api/?name=Demo+User'),
    ('test_user', 'test123', 'UTEST456', 'https://ui-avatars.com/api/?name=Test+User');

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "所有人可以管理所有数据" ON profiles FOR ALL USING (true);`
  
  toast('请将以下SQL代码复制到Supabase SQL编辑器中执行：\n\n' + sqlCode)
}

/* ===== 工具函数 ===== */
function getLibFileCount(lib) {
  if (!lib.groups || !Array.isArray(lib.groups)) return 0
  return lib.groups.reduce((total, group) => total + (group.files?.length || 0), 0)
}

function getFileIcon(fileName) {
  const ext = fileName.split('.').pop().toLowerCase()
  const icons = {
    'pdf': '📕', 'doc': '📄', 'docx': '📄', 'txt': '📝', 'md': '📝',
    'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️',
    'mp4': '🎬', 'avi': '🎬', 'mov': '🎬', 'mkv': '🎬',
    'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'm4a': '🎵',
    'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦',
    'xls': '📊', 'xlsx': '📊', 'csv': '📊',
    'ppt': '📽️', 'pptx': '📽️'
  }
  return icons[ext] || '📄'
}

function formatFileSize(bytes) {
  if (!bytes) return '未知大小'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

async function saveUserData() {
  if (!current.id) return
  
  try {
    const { error } = await supabase.from('profiles')
      .update({ 
        libs: JSON.stringify(current.libs),
        updated_at: new Date().toISOString()
      })
      .eq('id', current.id)
    
    if (error) {
      console.error('保存用户数据失败:', error)
      throw error
    }
    console.log('用户数据保存成功')
  } catch (error) {
    console.error('保存用户数据异常:', error)
    throw error
  }
}

/* ===== 初始化应用 ===== */
function initApp() {
  const saved = localStorage.getItem('currentUser');
  if (saved) {
    try {
      current = JSON.parse(saved);
      if (current.serial) {
        document.getElementById('showSerial').innerText = current.serial;
        document.getElementById('logoutBtn').style.display = 'inline-flex'; // ✅
        showSection('myBox');
        setTimeout(() => { loadMyLibs(); loadReadme(); }, 100);
        return;
      }
    } catch { localStorage.removeItem('currentUser'); }
  }
  showSection('pubBox');
  setTimeout(loadPubUsers, 100);
}
// 页面加载时初始化
window.addEventListener('load', initApp)

/* ===== 添加弹窗样式 ===== */
const modalStyles = `
<style>
  /* 弹窗样式 */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal-content {
    background: white;
    border-radius: 15px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    max-width: 90vw;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .large-modal {
    width: 800px;
    max-width: 95vw;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .modal-header h3 {
    margin: 0;
    color: #2d3748;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #718096;
    padding: 0.5rem;
    border-radius: 5px;
  }

  .close-btn:hover {
    background: #e2e8f0;
    color: #4a5568;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  /* 标签页样式 */
  .lib-modal-tabs {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    margin-bottom: 1.5rem;
  }

  .lib-modal-tabs .tab-btn {
    background: none;
    border: none;
    padding: 1rem 1.5rem;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    color: #718096;
    transition: all 0.3s ease;
  }

  .lib-modal-tabs .tab-btn.active {
    color: #667eea;
    border-bottom-color: #667eea;
  }

  .tab-content {
    display: none;
  }

  .tab-content.active {
    display: block;
  }

  .tab-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  /* 组网格样式 */
  .groups-grid {
    display: grid;
    gap: 1rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .group-card {
    background: white;
    padding: 1rem;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid transparent;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .group-card:hover, .group-card.active {
    border-color: #667eea;
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  }

  .group-card.active {
    background: #f0f4ff;
  }

  .group-icon {
    font-size: 2rem;
  }

  .group-info {
    flex: 1;
  }

  .group-name {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .group-stats {
    color: #718096;
    font-size: 0.9rem;
  }

  .group-date {
    color: #a0aec0;
    font-size: 0.8rem;
  }

  .group-actions {
    display: flex;
    gap: 0.5rem;
  }

  /* 上传区域样式 */
  .upload-section {
    margin-top: 1rem;
  }

  .upload-area {
    background: #f8fafc;
    padding: 2rem;
    border-radius: 10px;
    text-align: center;
    border: 2px dashed #cbd5e0;
  }

  .upload-area:hover {
    border-color: #667eea;
  }

  .upload-info {
    margin: 1rem 0;
  }

  .group-selector {
    margin: 1rem 0;
  }

  .group-select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #cbd5e0;
    border-radius: 8px;
    font-size: 1rem;
  }

  /* 文件网格样式 */
  .files-grid-modal {
    display: grid;
    gap: 1rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .file-card-modal {
    display: flex;
    align-items: center;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    transition: all 0.3s ease;
  }

  .file-card-modal:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }

  .file-icon-modal {
    font-size: 2rem;
    margin-right: 1rem;
  }

  .file-info-modal {
    flex: 1;
  }

  .file-name-modal {
    font-weight: 600;
    margin-bottom: 0.25rem;
    word-break: break-all;
  }

  .file-meta-modal {
    color: #718096;
    font-size: 0.8rem;
    display: flex;
    gap: 1rem;
  }

  .file-actions-modal {
    display: flex;
    gap: 0.5rem;
  }

  /* 库信息样式 */
  .lib-info-section {
    padding: 1rem;
  }

  .info-grid {
    display: grid;
    gap: 1rem;
    margin: 1.5rem 0;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #e2e8f0;
  }

  .info-label {
    font-weight: 600;
    color: #4a5568;
  }

  .info-value {
    color: #718096;
  }

  .action-buttons {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
  }

  .btn-danger {
    background: #e53e3e;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .btn-danger:hover {
    background: #c53030;
    transform: translateY(-1px);
  }

  /* 文件头部样式 */
  .files-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }

  .files-info {
    color: #718096;
    font-size: 0.9rem;
  }

  .files-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  /* 空状态样式 */
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #718096;
    background: white;
    border-radius: 10px;
    border: 2px dashed #cbd5e0;
  }

  .empty-state.small {
    padding: 1.5rem;
    font-size: 0.9rem;
  }

  .empty-state p {
    margin-bottom: 1rem;
  }

  /* 加载状态 */
  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: #718096;
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top: 2px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 用户头像样式 */
  .user-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #e2e8f0;
  }

  .user-avatar.small {
    width: 40px;
    height: 40px;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .modal-content {
      margin: 10px;
      max-width: calc(100vw - 20px);
    }
    
    .lib-modal-tabs {
      flex-direction: column;
    }
    
    .tab-header {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }
    
    .files-header {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }
    
    .file-card-modal {
      flex-direction: column;
      text-align: center;
    }
    
    .file-actions-modal {
      justify-content: center;
      margin-top: 0.5rem;
    }
    
    .action-buttons {
      flex-direction: column;
    }
  }
</style>
`

// 添加样式到页面
document.head.insertAdjacentHTML('beforeend', modalStyles)