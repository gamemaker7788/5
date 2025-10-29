/****************************************************************************************
 * ChatManager Fusion v5.1  ← 主要变动：大图片（>5 MB）自动转文件桶上传
 * 发送 = 1（Sender）  接收 = 0（Receiver）
 * 新增：实时翻译聊天内容（不破坏原文）
 ****************************************************************************************/
class ChatManager {
  constructor() {
    this.supabase = window.supabase.createClient(
      'https://yzbvlywkfuuercapousf.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6YnZseXdrZnV1ZXJjYXBvdXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODk0NjIsImV4cCI6MjA3Njk2NTQ2Mn0.kkDysp4mk4he6uPKG8jifx2EbA-W3Y0-WOr2Z3nzsPs'
    );
    this.currentUser = null;
    this.currentRoom = null;
    this.rooms = [];
    this.contacts = [];
    this.messageSubscription = null;
    this.cameraStream = null;
    this.currentFacingMode = 'user';
    this.imageBucket = 'chat-images';
    this.fileBucket = 'chat-files';
    this.init();
  }

  /* -------------------- 生命周期 -------------------- */
  async init() {
    await this.loadUserSession();
    await this.ensureBucketsExist();
    this.setupEventListeners();
  }
  async initializeApp() {
    try {
      await this.init();
      await this.loadRooms();
      await this.loadContacts();
      this.showChatList();
      this.showSuccess('应用启动成功！');
    } catch (e) {
      console.error(e);
      this.showError('初始化失败，已启用基础模式');
      this.showBasicFallback();
    }
  }

  /* -------------------- 用户会话 -------------------- */
  async loadUserSession() {
    try {
      const s = localStorage.getItem('chat_session');
      if (!s) throw new Error('未登录');
      this.currentUser = JSON.parse(s);
    } catch (e) {
      this.showError('加载会话失败: ' + e.message);
      setTimeout(() => (window.location.href = 'login.html'), 1500);
    }
  }

  /* -------------------- 存储桶 -------------------- */
  async ensureBucketsExist() {
    await this.ensureBucketExists(this.imageBucket);
    await this.ensureBucketExists(this.fileBucket);
  }
  async ensureBucketExists(name) {
    try {
      const test = new Blob(['test']);
      const fn = `test-${Date.now()}.txt`;
      const { error } = await this.supabase.storage.from(name).upload(fn, test);
      if (!error || !error.message.includes('bucket')) await this.supabase.storage.from(name).remove([fn]);
    } catch (e) { console.warn('存储桶检查非致命错误:', e.message); }
  }

  /* -------------------- 房间 -------------------- */
  async loadRooms() {
    try {
      const { data, error } = await this.supabase.from('chat_rooms').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      this.rooms = data || [];
    } catch (e) { this.rooms = []; }
    this.renderRoomList();
  }
  renderRoomList() {
    const c = document.getElementById('chatItems');
    if (!c) return;
    if (!this.rooms.length) {
      c.innerHTML = `<div class="welcome-message"><p>暂无聊天室</p><button onclick="chatManager.showCreateRoomModal()" class="login-btn">创建第一个聊天室</button></div>`;
      return;
    }
    c.innerHTML = '';
    this.rooms.forEach(r => {
      const div = document.createElement('div');
      div.className = 'chat-item';
      div.onclick = () => this.selectRoom(r);
      div.innerHTML = `
        <div class="chat-avatar" style="background:${this.getRandomColor(r.name)}">${r.name[0].toUpperCase()}</div>
        <div class="chat-info">
          <div class="chat-name">${this.escapeHtml(r.name)}</div>
          <div class="chat-preview">${this.escapeHtml(r.description || '暂无描述')}</div>
        </div>`;
      c.appendChild(div);
    });
  }
  async selectRoom(room) {
    try {
      this.currentRoom = room;
      document.querySelectorAll('.chat-item').forEach(n => n.classList.remove('active'));
      event.currentTarget.classList.add('active');
      document.getElementById('roomTitle').textContent = room.name;
      this.enableChatFeatures();
      await this.joinRoom(room.id);
      await this.loadMessages(room.id);
      this.setupMessageSubscription(room.id);
      this.scrollToBottom();
    } catch (e) { this.showError('进入房间失败'); }
  }
  async joinRoom(roomId) {
    try {
      await this.supabase.from('room_members').insert({ room_id: roomId, user_id: this.currentUser.userId });
    } catch (e) {
      if (!e.message.includes('duplicate')) console.error(e);
    }
  }

  /* -------------------- 消息 -------------------- */
  async loadMessages(roomId) {
    try {
      const { data, error } = await this.supabase
        .from('chat_messages')
        .select(`*, chat_users(username)`)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const c = document.getElementById('messagesContainer');
      c.innerHTML = '';
      if (!data.length) { c.innerHTML = '<div class="system-message">暂无消息，开始聊天吧</div>'; return; }
      data.forEach(m => this.addMessageToChat(m, m.chat_users.username));
      this.scrollToBottom();
    } catch (e) { this.showError('加载消息失败'); }
  }
  addMessageToChat(msg, username) {
    const c = document.getElementById('messagesContainer');
    if (!c) return;
    const isOwn = username === this.currentUser.username;
    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'own' : 'other'}`;
    const t = new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    let content = '';
    switch (msg.message_type) {
      case 'image': content = this.createImageMessageHtml(msg); break;
      case 'file':  content = this.createFileMessageHtml(msg);  break;
      default:      content = `<div class="message-text">${this.escapeHtml(msg.content)}</div>`;
    }
    div.innerHTML = `
      ${!isOwn ? `<div class="message-avatar" style="background:${this.getRandomColor(username)}">${username[0].toUpperCase()}</div>` : ''}
      <div class="message-bubble">
        ${!isOwn ? `<div class="message-sender">${this.escapeHtml(username)}</div>` : ''}
        ${content}
        <div class="message-time">${t}</div>
      </div>
      ${isOwn ? `<div class="message-avatar" style="background:${this.getRandomColor(username)}">${username[0].toUpperCase()}</div>` : ''}`;
    c.appendChild(div);
    this.scrollToBottom();

    // === TRANSLATION === 自动翻译文本消息
    if (msg.message_type === 'text' && document.getElementById('autoTransToggle')?.checked) {
      setTimeout(() => window.translateMessage(div), 0);
    }
  }

  /* -------------------- 图片/文件 -------------------- */
  createImageMessageHtml(msg) {
    const url = msg.file_url;
    if (!url || !url.startsWith('http')) return '<div class="image-missing">图片地址无效</div>';
    return `
      <div class="message-image-container">
        <img src="${url}" class="message-image" alt="图片"
          onload="this.style.display='block'; this.nextElementSibling.style.display='none';"
          onerror="this.style.display='none'; this.nextElementSibling.nextElementSibling.style.display='block';">
        <div class="image-loading-state"><div class="loading-spinner"></div><span>加载中...</span></div>
        <div class="image-error-state" style="display:none;">❌ 图片加载失败<br><a href="${url}" target="_blank" style="color:#07c160">查看原图</a></div>
      </div>`;
  }
  createFileMessageHtml(msg) {
    return `
      <div class="message-file">
        <div class="file-icon">📄</div>
        <div class="file-info">
          <div class="file-name">${this.escapeHtml(msg.file_name)}</div>
          <a href="${msg.file_url}" download="${this.escapeHtml(msg.file_name)}" class="file-link">下载文件</a>
        </div>
      </div>`;
  }

  /* -------------------- 发送 -------------------- */
  async sendMessage() {
    const input = document.getElementById('messageInput');
    const txt = input.value.trim();
    if (!txt || !this.currentRoom) return;
    try {
      await this.supabase.from('chat_messages').insert({
        content: txt,
        room_id: this.currentRoom.id,
        user_id: this.currentUser.userId,
        message_type: 'text',
        direction: 1
      });
      input.value = '';
      input.focus();
    } catch (e) { this.showError('发送失败: ' + e.message); }
  }
  async sendImageMessage(imageData) {
    if (!this.currentRoom) return;
    this.showLoading('上传图片中...');
    try {
      const url = await this.uploadImage(imageData);
      await this.supabase.from('chat_messages').insert({
        content: `[图片]`,
        room_id: this.currentRoom.id,
        user_id: this.currentUser.userId,
        message_type: 'image',
        file_url: url,
        file_name: 'image.jpg',
        direction: 1
      });
      this.hideLoading();
      this.showSuccess('图片发送成功！');
    } catch (e) {
      this.hideLoading();
      this.showError('图片发送失败: ' + e.message);
    }
  }
  async sendFile(file) {
    if (!this.currentRoom) return;
    this.showLoading('上传文件中...');
    try {
      const url = await this.uploadFile(file);
      await this.supabase.from('chat_messages').insert({
        content: `[文件]${file.name}`,
        room_id: this.currentRoom.id,
        user_id: this.currentUser.userId,
        message_type: 'file',
        file_url: url,
        file_name: file.name,
        file_size: file.size,
        direction: 1
      });
      this.hideLoading();
      this.showSuccess('文件发送成功！');
      return url;
    } catch (e) {
      this.hideLoading();
      this.showError('文件发送失败: ' + e.message);
    }
  }

  /* -------------------- 上传核心 -------------------- */
  async uploadImage(imageData) {
    const uploader = new OnlineImageUploader(this.supabase);
    return await uploader.uploadImage(imageData, this);
  }
  async uploadFile(file) {
    const fn = `file_${Date.now()}_${file.name}`;
    const { error } = await this.supabase.storage.from(this.fileBucket).upload(fn, file);
    if (error) throw error;
    const { data } = this.supabase.storage.from(this.fileBucket).getPublicUrl(fn);
    return data.publicUrl;
  }

  /* -------------------- 实时订阅（接收） -------------------- */
  setupMessageSubscription(roomId) {
    if (this.messageSubscription) this.supabase.removeChannel(this.messageSubscription);
    this.messageSubscription = this.supabase
      .channel('public:chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const { data } = await this.supabase.from('chat_users').select('username').eq('id', payload.new.user_id).single();
          if (data) {
            const msg = { ...payload.new, direction: payload.new.direction ?? 0 };
            this.addMessageToChat(msg, data.username);
          }
        })
      .subscribe();
  }

  /* -------------------- 联系人 / 私聊 -------------------- */
  async loadContacts() {
    try {
      const { data, error } = await this.supabase.from('chat_users').select('id, username, is_online, last_login').neq('id', this.currentUser.userId).order('username');
      if (error) throw error;
      this.contacts = data || [];
    } catch (e) { this.contacts = []; }
    this.renderContacts();
  }
  renderContacts() {
    const c = document.getElementById('contactsList');
    if (!c) return;
    if (!this.contacts.length) { c.innerHTML = '<div class="welcome-message">暂无联系人</div>'; return; }
    c.innerHTML = '';
    this.contacts.forEach(u => {
      const isOnline = u.is_online || (Date.now() - new Date(u.last_login).getTime() < 300000);
      const div = document.createElement('div');
      div.className = 'contact-item';
      div.onclick = () => this.startPrivateChat(u);
      div.innerHTML = `
        <div class="contact-avatar" style="background:${this.getRandomColor(u.username)}">${u.username[0].toUpperCase()}</div>
        <div class="contact-info">
          <div class="contact-name">${this.escapeHtml(u.username)}</div>
          <div class="contact-status"><span class="status-indicator ${isOnline ? 'online' : 'offline'}"></span>${isOnline ? '在线' : '离线'}</div>
        </div>`;
      c.appendChild(div);
    });
  }
  async startPrivateChat(contact) {
    try {
      const name = `private_${Math.min(this.currentUser.userId, contact.id)}_${Math.max(this.currentUser.userId, contact.id)}`;
      let room = this.rooms.find(r => r.name === name);
      if (!room) {
        const { data, error } = await this.supabase.from('chat_rooms').insert({
          name, description: `与 ${contact.username} 的私聊`, created_by: this.currentUser.userId, is_public: false, room_type: 'private'
        }).select();
        if (error) throw error;
        room = data[0];
        this.rooms.push(room);
        await this.supabase.from('room_members').insert([{ room_id: room.id, user_id: this.currentUser.userId }, { room_id: room.id, user_id: contact.id }]);
      }
      this.selectRoom(room);
      this.showChatList();
    } catch (e) { this.showError('私聊失败: ' + e.message); }
  }

  /* -------------------- 摄像头 -------------------- */
  async openCamera() {
    try {
      if (this.cameraStream) this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.currentFacingMode }, audio: false });
      const video = document.getElementById('cameraLive');
      video.srcObject = this.cameraStream;
      document.getElementById('cameraPreview').style.display = 'block';
    } catch (e) { this.showError('无法访问摄像头'); }
  }
  closeCamera() {
    if (this.cameraStream) { this.cameraStream.getTracks().forEach(t => t.stop()); this.cameraStream = null; }
    document.getElementById('cameraPreview').style.display = 'none';
  }
  async switchCamera() {
    this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    await this.openCamera();
  }
  async takePicture() {
    const video = document.getElementById('cameraLive');
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    await this.sendImageMessage(imageData);
    this.closeCamera();
  }

  /* -------------------- 房间创建 -------------------- */
  showCreateRoomModal() {
    document.getElementById('roomNameInput').value = '';
    document.getElementById('roomDescInput').value = '';
    document.getElementById('createRoomModal').style.display = 'block';
  }
  hideCreateRoomModal() { document.getElementById('createRoomModal').style.display = 'none'; }
  async createRoom() {
    const name = document.getElementById('roomNameInput').value.trim();
    const desc = document.getElementById('roomDescInput').value.trim();
    if (!name) return this.showError('请输入房间名称');
    try {
      const { data, error } = await this.supabase.from('chat_rooms').insert({ name, description: desc, created_by: this.currentUser.userId, is_public: true }).select();
      if (error) throw error;
      this.hideCreateRoomModal();
      await this.loadRooms();
      if (data && data.length) this.selectRoom(data[0]);
      this.showSuccess('房间创建成功！');
    } catch (e) { this.showError('创建房间失败: ' + e.message); }
  }

  /* -------------------- 用户设置 -------------------- */
  showChangeNameModal() {
    document.getElementById('newNameInput').value = this.currentUser.username;
    document.getElementById('changeNameModal').style.display = 'block';
  }
  hideChangeNameModal() { document.getElementById('changeNameModal').style.display = 'none'; }
  async changeUsername() {
    const name = document.getElementById('newNameInput').value.trim();
    if (!name || name.length < 3) return this.showError('用户名至少3个字符');
    try {
      const { error } = await this.supabase.from('chat_users').update({ username: name }).eq('id', this.currentUser.userId);
      if (error) throw error;
      this.currentUser.username = name;
      localStorage.setItem('chat_session', JSON.stringify(this.currentUser));
      this.hideChangeNameModal();
      this.showSuccess('用户名修改成功！');
      await this.loadContacts();
    } catch (e) { this.showError('修改用户名失败: ' + e.message); }
  }
  logout() {
    if (confirm('确定要退出登录吗？')) {
      localStorage.removeItem('chat_session');
      window.location.href = 'login.html';
    }
  }

  /* -------------------- 导航 -------------------- */
  showChatList() {
    this.setContainerVisibility({ chatList: true, chatArea: true });
    this.updateSidebarActive(0);
  }
  showContacts() {
    this.setContainerVisibility({ contactsContainer: true });
    this.updateSidebarActive(1);
  }
  showDiscover() {
    this.setContainerVisibility({ discoverContainer: true });
    this.updateSidebarActive(2);
  }
  showSettings() {
    this.setContainerVisibility({ settingsContainer: true });
    this.updateSidebarActive(3);
  }
  setContainerVisibility(show) {
    ['chatList', 'chatArea', 'contactsContainer', 'discoverContainer', 'settingsContainer']
      .forEach(id => (document.getElementById(id).style.display = 'none'));
    Object.keys(show).forEach(id => (document.getElementById(id).style.display = show[id] ? 'flex' : 'none'));
  }
  updateSidebarActive(idx) {
    document.querySelectorAll('.sidebar-item').forEach((n, i) => n.classList.toggle('active', i === idx));
  }

  /* -------------------- 工具 -------------------- */
  enableChatFeatures() {
    const i = document.getElementById('messageInput');
    const b = document.getElementById('sendBtn');
    if (i) i.disabled = false;
    if (b) b.disabled = false;
  }
  escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }
  getRandomColor(str = 'default') {
    const colors = ['#07c160', '#1a2a6c', '#b21f1f', '#fdbb2d', '#6b8cff', '#9b59b6', '#e74c3c', '#3498db'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }
  scrollToBottom() {
    const box = document.getElementById('messagesContainer');
    setTimeout(() => (box.scrollTop = box.scrollHeight), 100);
  }
  showError(msg) { this.showSystemMsg(msg, 'error'); }
  showSuccess(msg) { this.showSystemMsg(msg, 'success'); }
  showSystemMsg(text, type) {
    const c = document.getElementById('messagesContainer');
    if (!c) return;
    const div = document.createElement('div');
    div.className = `${type}-message`;
    div.textContent = text;
    c.appendChild(div);
    setTimeout(() => div.remove(), type === 'error' ? 5000 : 3000);
    this.scrollToBottom();
  }
  showLoading(msg = '加载中...') {
    const div = document.createElement('div');
    div.id = 'loading-overlay';
    div.innerHTML = `<div class="loading-spinner"></div><div class="loading-text">${msg}</div>`;
    document.body.appendChild(div);
  }
  hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.remove();
  }
  dataURLToBlob(dataURL) {
    const [head, base] = dataURL.split(',');
    const mime = head.split(':')[1].split(';')[0];
    const raw = window.atob(base);
    const u = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) u[i] = raw.charCodeAt(i);
    return new Blob([u], { type: mime });
  }

  /* -------------------- 事件绑定 -------------------- */
  setupEventListeners() {
    // 导航
    ['chatTab', 'contactsTab', 'discoverTab', 'settingsTab'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => [this.showChatList, this.showContacts, this.showDiscover, this.showSettings][i]());
    });
    // 聊天
    const sendBtn = document.getElementById('sendBtn');
    const input = document.getElementById('messageInput');
    if (sendBtn) sendBtn.addEventListener('click', () => this.sendMessage());
    if (input) input.addEventListener('keypress', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
    // 房间
    document.getElementById('createRoomBtn')?.addEventListener('click', () => this.showCreateRoomModal());
    document.getElementById('confirmCreateRoom')?.addEventListener('click', () => this.createRoom());
    document.getElementById('cancelCreateRoom')?.addEventListener('click', () => this.hideCreateRoomModal());
    // 用户
    document.getElementById('changeNameBtn')?.addEventListener('click', () => this.showChangeNameModal());
    document.getElementById('confirmChangeName')?.addEventListener('click', () => this.changeUsername());
    document.getElementById('cancelChangeName')?.addEventListener('click', () => this.hideChangeNameModal());
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
    // 多媒体
    document.getElementById('cameraBtn')?.addEventListener('click', () => this.openCamera());
    document.getElementById('imageBtn')?.addEventListener('click', () => this.selectImageFile());
    document.getElementById('fileBtn')?.addEventListener('click', () => this.selectFile());
    document.getElementById('captureBtn')?.addEventListener('click', () => this.takePicture());
    document.getElementById('closeCameraBtn')?.addEventListener('click', () => this.closeCamera());
    document.getElementById('switchCameraBtn')?.addEventListener('click', () => this.switchCamera());
    // 模态框
    document.querySelectorAll('.modal').forEach(modal =>
      modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; })
    );
    // 快捷键
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); this.sendMessage(); }
      if (e.key === 'Escape') { document.querySelectorAll('.modal').forEach(m => (m.style.display = 'none')); this.closeCamera(); }
    });

    // === TRANSLATION === 自动翻译开关监听
    const toggle = document.getElementById('autoTransToggle');
    if (toggle) {
      toggle.addEventListener('change', () => {
        document.querySelectorAll('.message-bubble').forEach(b => {
          const bar = b.querySelector('.trans-bar');
          if (toggle.checked) {
            const txt = b.querySelector('.message-text')?.textContent?.trim();
            if (txt && !bar) window.appendTranslation(b, txt);
            if (bar) bar.classList.add('show');
          } else {
            if (bar) bar.classList.remove('show');
          }
        });
      });
    }
  }

  /* -------------------- 文件选择 -------------------- */
  selectImageFile() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = e => { const f = e.target.files[0]; if (f) this.handleImageFile(f); };
    inp.click();
  }
  selectFile() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '*/*';
    inp.onchange = e => { const f = e.target.files[0]; if (f) this.sendFile(f); };
    inp.click();
  }
  async handleImageFile(file) {
    try {
      this.validateImageFile(file);
      const reader = new FileReader();
      reader.onload = async ev => await this.sendImageMessage(ev.target.result);
      reader.readAsDataURL(file);
    } catch (e) { this.showError(e.message); }
  }
  validateImageFile(file) {
    const valid = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const max = 5 * 1024 * 1024;
    if (!valid.includes(file.type)) throw new Error('仅支持 JPEG PNG GIF WebP');
    if (file.size > max) throw new Error('图片不能超过 5MB');
  }

  /* -------------------- 用户名至少3个字符');
    try {
      const { error } = await this.supabase.from('chat_users').update({ username: name }).eq('id', this.currentUser.userId);
      if (error) throw error;
      this.currentUser.username = name;
      localStorage.setItem('chat_session', JSON.stringify(this.currentUser));
      this.hideChangeNameModal();
      this.showSuccess('用户名修改成功！');
      await this.loadContacts();
    } catch (e) { this.showError('修改用户名失败: ' + e.message); }
  }
  logout() {
    if (confirm('确定要退出登录吗？')) {
      localStorage.removeItem('chat_session');
      window.location.href = 'login.html';
    }
  }

  /* -------------------- 导航 -------------------- */
  showChatList() {
    this.setContainerVisibility({ chatList: true, chatArea: true });
    this.updateSidebarActive(0);
  }
  showContacts() {
    this.setContainerVisibility({ contactsContainer: true });
    this.updateSidebarActive(1);
  }
  showDiscover() {
    this.setContainerVisibility({ discoverContainer: true });
    this.updateSidebarActive(2);
  }
  showSettings() {
    this.setContainerVisibility({ settingsContainer: true });
    this.updateSidebarActive(3);
  }
  setContainerVisibility(show) {
    ['chatList', 'chatArea', 'contactsContainer', 'discoverContainer', 'settingsContainer']
      .forEach(id => (document.getElementById(id).style.display = 'none'));
    Object.keys(show).forEach(id => (document.getElementById(id).style.display = show[id] ? 'flex' : 'none'));
  }
  updateSidebarActive(idx) {
    document.querySelectorAll('.sidebar-item').forEach((n, i) => n.classList.toggle('active', i === idx));
  }

  /* -------------------- 工具 -------------------- */
  enableChatFeatures() {
    const i = document.getElementById('messageInput');
    const b = document.getElementById('sendBtn');
    if (i) i.disabled = false;
    if (b) b.disabled = false;
  }
  escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }
  getRandomColor(str = 'default') {
    const colors = ['#07c160', '#1a2a6c', '#b21f1f', '#fdbb2d', '#6b8cff', '#9b59b6', '#e74c3c', '#3498db'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }
  scrollToBottom() {
    const box = document.getElementById('messagesContainer');
    setTimeout(() => (box.scrollTop = box.scrollHeight), 100);
  }
  showError(msg) { this.showSystemMsg(msg, 'error'); }
  showSuccess(msg) { this.showSystemMsg(msg, 'success'); }
  showSystemMsg(text, type) {
    const c = document.getElementById('messagesContainer');
    if (!c) return;
    const div = document.createElement('div');
    div.className = `${type}-message`;
    div.textContent = text;
    c.appendChild(div);
    setTimeout(() => div.remove(), type === 'error' ? 5000 : 3000);
    this.scrollToBottom();
  }
  showLoading(msg = '加载中...') {
    const div = document.createElement('div');
    div.id = 'loading-overlay';
    div.innerHTML = `<div class="loading-spinner"></div><div class="loading-text">${msg}</div>`;
    document.body.appendChild(div);
  }
  hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.remove();
  }
  dataURLToBlob(dataURL) {
    const [head, base] = dataURL.split(',');
    const mime = head.split(':')[1].split(';')[0];
    const raw = window.atob(base);
    const u = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) u[i] = raw.charCodeAt(i);
    return new Blob([u], { type: mime });
  }

  /* -------------------- 事件绑定 -------------------- */
  setupEventListeners() {
    // 导航
    ['chatTab', 'contactsTab', 'discoverTab', 'settingsTab'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => [this.showChatList, this.showContacts, this.showDiscover, this.showSettings][i]());
    });
    // 聊天
    const sendBtn = document.getElementById('sendBtn');
    const input = document.getElementById('messageInput');
    if (sendBtn) sendBtn.addEventListener('click', () => this.sendMessage());
    if (input) input.addEventListener('keypress', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
    // 房间
    document.getElementById('createRoomBtn')?.addEventListener('click', () => this.showCreateRoomModal());
    document.getElementById('confirmCreateRoom')?.addEventListener('click', () => this.createRoom());
    document.getElementById('cancelCreateRoom')?.addEventListener('click', () => this.hideCreateRoomModal());
    // 用户
    document.getElementById('changeNameBtn')?.addEventListener('click', () => this.showChangeNameModal());
    document.getElementById('confirmChangeName')?.addEventListener('click', () => this.changeUsername());
    document.getElementById('cancelChangeName')?.addEventListener('click', () => this.hideChangeNameModal());
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
    // 多媒体
    document.getElementById('cameraBtn')?.addEventListener('click', () => this.openCamera());
    document.getElementById('imageBtn')?.addEventListener('click', () => this.selectImageFile());
    document.getElementById('fileBtn')?.addEventListener('click', () => this.selectFile());
    document.getElementById('captureBtn')?.addEventListener('click', () => this.takePicture());
    document.getElementById('closeCameraBtn')?.addEventListener('click', () => this.closeCamera());
    document.getElementById('switchCameraBtn')?.addEventListener('click', () => this.switchCamera());
    // 模态框
    document.querySelectorAll('.modal').forEach(modal =>
      modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; })
    );
    // 快捷键
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); this.sendMessage(); }
      if (e.key === 'Escape') { document.querySelectorAll('.modal').forEach(m => (m.style.display = 'none')); this.closeCamera(); }
    });
  }

  /* -------------------- 文件选择 -------------------- */
  selectImageFile() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = e => { const f = e.target.files[0]; if (f) this.handleImageFile(f); };
    inp.click();
  }
  selectFile() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '*/*';
    inp.onchange = e => { const f = e.target.files[0]; if (f) this.sendFile(f); };
    inp.click();
  }
  async handleImageFile(file) {
    try {
      this.validateImageFile(file);
      const reader = new FileReader();
      reader.onload = async ev => await this.sendImageMessage(ev.target.result);
      reader.readAsDataURL(file);
    } catch (e) { this.showError(e.message); }
  }
  validateImageFile(file) {
    const valid = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const max = 5 * 1024 * 1024;
    if (!valid.includes(file.type)) throw new Error('仅支持 JPEG PNG GIF WebP');
    if (file.size > max) throw new Error('图片不能超过 5MB');
  }

  /* -------------------- 测试 / 降级 -------------------- */
  async testImageFunctionality() {
    try {
      const { data: buckets, error: e1 } = await this.supabase.storage.listBuckets();
      if (e1) return false;
      const b = buckets.find(x => x.name === this.imageBucket);
      if (!b) return false;
      const testSvg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzA3YzE2MCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9IjAuMzVlbSI+5Zu+54mHPC90ZXh0Pjwvc3ZnPg==';
      const fn = 'test-' + Date.now() + '.png';
      const { error: e2 } = await this.supabase.storage.from(this.imageBucket).upload(fn, this.dataURLToBlob(testSvg));
      if (e2) return false;
      const { data } = this.supabase.storage.from(this.imageBucket).getPublicUrl(fn);
      await this.supabase.storage.from(this.imageBucket).remove([fn]);
      return !!data.publicUrl;
    } catch (e) { console.warn('图片功能测试失败', e); return false; }
  }
  showBasicFallback() {
    const c = document.getElementById('chatItems');
    if (!c) return;
    c.innerHTML = `<div class="welcome-message">
      <p>部分功能加载失败，但您可以：</p>
      <button onclick="chatManager.showCreateRoomModal()" class="login-btn" style="margin:10px;">创建新房间</button>
      <button onclick="chatManager.testBasicChat()" class="login-btn">测试基本聊天</button>
    </div>`;
    this.enableChatFeatures();
  }
  async testBasicChat() {
    this.showSuccess('测试功能已激活');
    const testRoom = { id: 'test-room', name: '测试房间', description: '用于功能测试的临时房间', created_at: new Date().toISOString() };
    this.currentRoom = testRoom;
    document.getElementById('roomTitle').textContent = testRoom.name;
    this.enableChatFeatures();
    const c = document.getElementById('messagesContainer');
    c.innerHTML = '';
    this.addMessageToChat({ content: '欢迎使用测试聊天功能！', created_at: new Date().toISOString(), message_type: 'text' }, '系统');
    this.addMessageToChat({ content: '您可以在这里测试基本的聊天功能', created_at: new Date().toISOString(), message_type: 'text' }, '系统');
    this.scrollToBottom();
  }
}

/* ****************************************************************************************
 * 在线图片上传器（无离线缓存）>5MB 自动转文件桶
 ****************************************************************************************/
class OnlineImageUploader {
  constructor(supabase) {
    this.supabase = supabase;
    this.maxSize = 5 * 1024 * 1024;
    this.timeout = 30000;
  }

  async uploadImage(imageData, chatManager) {
    if (!this.validate(imageData)) throw new Error('无效图片或超出大小');
    const size = (imageData.split(',')[1].length * 3) / 4;
    if (size > this.maxSize) {
      const blob = this.dataURLToBlob(imageData);
      const file = new File([blob], `large_image_${Date.now()}.jpg`, { type: 'image/jpeg' });
      return await chatManager.sendFile(file);
    }
    const compressed = await this.compress(imageData);
    return await this.upload(compressed);
  }
  validate(d) {
    if (!d || !d.startsWith('data:image/')) return false;
    return true;
  }
  async compress(data) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let { width, height } = img;
        const max = 800;
        if (width > max) { height = (height * max) / width; width = max; }
        if (height > max) { width = (width * max) / height; height = max; }
        canvas.width = width; canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(data);
      img.src = data;
    });
  }
  async upload(data) {
    return new Promise(async (resolve, reject) => {
      const t = setTimeout(() => reject(new Error('上传超时')), this.timeout);
      try {
        const fn = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const blob = this.dataURLToBlob(data);
        const { error } = await this.supabase.storage.from('chat-images').upload(fn, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });
        clearTimeout(t);
        if (error) throw error;
        const { data: { publicUrl } } = this.supabase.storage.from('chat-images').getPublicUrl(fn);
        resolve(publicUrl);
      } catch (e) {
        clearTimeout(t);
        reject(e);
      }
    });
  }

  dataURLToBlob(dataURL) {
    const [head, base] = dataURL.split(',');
    const mime = head.split(':')[1].split(';')[0];
    const raw = window.atob(base);
    const u = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) u[i] = raw.charCodeAt(i);
    return new Blob([u], { type: mime });
  }
}

/* -------------------- 全局初始化 -------------------- */
const chatManager = new ChatManager();
document.addEventListener('DOMContentLoaded', () => chatManager.initializeApp());
window.addEventListener('beforeunload', () => {
  if (chatManager.messageSubscription) chatManager.supabase.removeChannel(chatManager.messageSubscription);
  if (chatManager.cameraStream) chatManager.closeCamera();
});
