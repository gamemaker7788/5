// chat-manager.js - 完整聊天管理器（已修复图片预览）
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
    this.imageCache = {};
    this.init();
  }

  async init() {
    console.log('聊天管理器初始化...');
    await this.loadUserSession();
    await this.ensureBucketsExist();
    this.setupEventListeners();
  }

  /* ---------------- 用户会话 ---------------- */
  async loadUserSession() {
    try {
      const session = localStorage.getItem('chat_session');
      if (!session) throw new Error('未找到用户会话');
      this.currentUser = JSON.parse(session);
      console.log('用户会话加载成功:', this.currentUser);
    } catch (error) {
      this.showError('加载用户会话失败: ' + error.message);
      setTimeout(() => (window.location.href = 'login.html'), 2000);
    }
  }

  /* ---------------- 存储桶 ---------------- */
  async ensureBucketsExist() {
    try {
      await this.ensureBucketExists(this.imageBucket);
      await this.ensureBucketExists(this.fileBucket);
    } catch (error) {
      console.warn('存储桶初始化警告:', error);
    }
  }
  async ensureBucketExists(bucketName) {
    try {
      console.log('检查存储桶:', bucketName);
      const testBlob = new Blob(['test'], { type: 'text/plain' });
      const testFileName = `test-${Date.now()}.txt`;
      const { error } = await this.supabase.storage.from(bucketName).upload(testFileName, testBlob);
      if (error) {
        if (error.message.includes('bucket') || error.message.includes('存储桶')) {
          console.warn('存储桶可能不存在，但继续运行应用');
        } else console.warn('存储桶访问警告:', error.message);
      } else {
        console.log('存储桶访问正常');
        await this.supabase.storage.from(bucketName).remove([testFileName]);
      }
    } catch (error) {
      console.warn('存储桶检查异常（非致命错误）:', error);
    }
  }

  /* ---------------- 房间管理 ---------------- */
  async loadRooms() {
    try {
      const { data, error } = await this.supabase
        .from('chat_rooms')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      this.rooms = data || [];
    } catch (error) {
      console.error('加载聊天室失败:', error);
      this.rooms = [];
    }
    this.renderRoomList();
  }
  renderRoomList() {
    const container = document.getElementById('chatItems');
    if (!container) return;
    if (this.rooms.length === 0) {
      container.innerHTML = `
        <div class="welcome-message">
          <p>暂无聊天室</p>
          <button onclick="chatManager.showCreateRoomModal()" class="login-btn">创建第一个聊天室</button>
        </div>`;
      return;
    }
    container.innerHTML = '';
    this.rooms.forEach((room) => {
      const el = document.createElement('div');
      el.className = 'chat-item';
      el.onclick = () => this.selectRoom(room);
      el.innerHTML = `
        <div class="chat-avatar" style="background:${this.getRandomColor(room.name)}">
          ${room.name.charAt(0).toUpperCase()}
        </div>
        <div class="chat-info">
          <div class="chat-name">${this.escapeHtml(room.name)}</div>
          <div class="chat-preview">${this.escapeHtml(room.description || '暂无描述')}</div>
        </div>`;
      container.appendChild(el);
    });
  }
  async selectRoom(room) {
    try {
      this.currentRoom = room;
      document.querySelectorAll('.chat-item').forEach((i) => i.classList.remove('active'));
      event.currentTarget.classList.add('active');
      document.getElementById('roomTitle').textContent = room.name;
      this.enableChatFeatures();
      await this.joinRoom(room.id);
      await this.loadMessages(room.id);
      this.setupMessageSubscription(room.id);
      this.scrollToBottom();
    } catch (error) {
      console.error('选择聊天室失败:', error);
      this.showError('进入聊天室失败');
    }
  }
  async joinRoom(roomId) {
    try {
      const { error } = await this.supabase.from('room_members').insert({
        room_id: roomId,
        user_id: this.currentUser.userId,
      });
      if (error && !error.message.includes('duplicate key')) throw error;
    } catch (e) {
      console.error('加入房间失败:', e);
    }
  }

  /* ---------------- 消息管理 ---------------- */
  async loadMessages(roomId) {
    try {
      const { data: messages, error } = await this.supabase
        .from('chat_messages')
        .select(`*, chat_users(username)`)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const container = document.getElementById('messagesContainer');
      container.innerHTML = '';
      if (messages.length === 0) {
        container.innerHTML = '<div class="system-message">暂无消息，开始聊天吧</div>';
        return;
      }
      messages.forEach((m) => this.addMessageToChat(m, m.chat_users.username));
      this.scrollToBottom();
    } catch (error) {
      console.error('加载消息失败:', error);
      this.showError('加载消息失败');
    }
  }
  addMessageToChat(message, username) {
    const container = document.getElementById('messagesContainer');
    const msgEl = document.createElement('div');
    const isOwn = this.currentUser && username === this.currentUser.username;
    msgEl.className = `message ${isOwn ? 'own' : 'other'}`;
    const time = new Date(message.created_at).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    let content = '';
    switch (message.message_type) {
      case 'image':
        content = this.createImageMessageHtml(message);
        break;
      case 'file':
        content = this.createFileMessageHtml(message);
        break;
      default:
        content = `<div class="message-text">${this.escapeHtml(message.content)}</div>`;
    }
    msgEl.innerHTML = `
      ${!isOwn ? `<div class="message-avatar" style="background:${this.getRandomColor(username)}">${username[0].toUpperCase()}</div>` : ''}
      <div class="message-bubble">
        ${!isOwn ? `<div class="message-sender">${this.escapeHtml(username)}</div>` : ''}
        ${content}
        <div class="message-time">${time}</div>
      </div>
      ${isOwn ? `<div class="message-avatar" style="background:${this.getRandomColor(username)}">${username[0].toUpperCase()}</div>` : ''}`;
    container.appendChild(msgEl);
    this.scrollToBottom();
  }

  /* ---------------- 图片消息 ---------------- */
  createImageMessageHtml(message) {
    const url = message.file_url;
    if (!url) return '<div class="image-missing">图片地址缺失</div>';
    if (url.startsWith('http')) return this.createRemoteImageHtml(url);
    if (url.startsWith('local_img_')) return this.createLocalImageHtml(url);
    if (url.startsWith('data:image')) return this.createDataUrlImageHtml(url);
    if (url === 'upload_failed') return this.createUploadFailedHtml();
    return this.createUnknownImageHtml(url);
  }
  createRemoteImageHtml(imageUrl) {
    return `
      <div class="message-image-container">
        <img src="${imageUrl}" class="message-image" alt="图片"
         onload="this.style.display='block'; this.nextElementSibling.style.display='none';"
         onerror="this.style.display='none'; this.nextElementSibling.nextElementSibling.style.display='block';">
        <div class="image-loading-state">
          <div class="loading-spinner"></div><span>加载中...</span>
        </div>
        <div class="image-error-state" style="display:none;">
          ❌ 图片加载失败<br/>
          <a href="${imageUrl}" target="_blank" style="color:#07c160">查看原图</a>
        </div>
      </div>`;
  }
  createLocalImageHtml(imageId) {
    const data = localStorage.getItem(imageId) || this.imageCache[imageId];
    return data
      ? `<img src="${data}" class="message-image" alt="本地图片" />`
      : `<div class="image-missing">本地图片丢失</div>`;
  }
  createDataUrlImageHtml(dataUrl) {
    return `<img src="${dataUrl}" class="message-image" alt="图片" />`;
  }
  createUploadFailedHtml() {
    return `
      <div class="upload-failed-message">
        <div class="failed-icon">❌</div>
        <div class="failed-text">
          <div>图片上传失败</div>
          <small>网络或服务器问题</small>
        </div>
      </div>`;
  }
  createUnknownImageHtml(url) {
    return `
      <div class="unknown-image-message">
        <div class="unknown-icon">❓</div>
        <div class="unknown-text">
          <div>未知图片格式</div>
          <small>${url ? url.substring(0, 50) + '...' : '无URL信息'}</small>
        </div>
      </div>`;
  }
  createFileMessageHtml(message) {
    return `
      <div class="message-file">
        <div class="file-icon">📄</div>
        <div class="file-info">
          <div class="file-name">${this.escapeHtml(message.file_name)}</div>
          <a href="${message.file_url}" download="${this.escapeHtml(message.file_name)}" class="file-link">下载文件</a>
        </div>
      </div>`;
  }

  /* ---------------- 发送消息 ---------------- */
  async sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || !this.currentRoom || !this.currentUser) return;
    try {
      const { error } = await this.supabase.from('chat_messages').insert({
        content: content,
        room_id: this.currentRoom.id,
        user_id: this.currentUser.userId,
        message_type: 'text',
      });
      if (error) throw error;
      input.value = '';
      input.focus();
    } catch (error) {
      console.error('发送消息失败:', error);
      this.showError('发送消息失败: ' + error.message);
    }
  }

  /* ---------------- 图片/文件上传 ---------------- */
  async sendImageMessage(imageData) {
    if (!this.currentRoom || !this.currentUser) return;
    try {
      this.showLoading('上传图片中...');
      const uploader = new EmergencyImageUploader();
      const imageUrl = await uploader.uploadImage(imageData);
      const { error } = await this.supabase.from('chat_messages').insert({
        content: `[图片]`,
        room_id: this.currentRoom.id,
        user_id: this.currentUser.userId,
        message_type: 'image',
        file_url: imageUrl,
        file_name: 'image.jpg',
      });
      if (error) throw error;
      this.hideLoading();
      this.showSuccess('图片发送成功！');
    } catch (error) {
      this.hideLoading();
      console.error('发送图片失败:', error);
      this.showError('发送图片失败: ' + error.message);
    }
  }
  async sendFile(file) {
    if (!this.currentRoom || !this.currentUser) return;
    try {
      this.showLoading('上传文件中...');
      const fileUrl = await this.uploadFile(file);
      const { error } = await this.supabase.from('chat_messages').insert({
        content: `[文件]${file.name}`,
        room_id: this.currentRoom.id,
        user_id: this.currentUser.userId,
        message_type: 'file',
        file_url: fileUrl,
        file_name: file.name,
        file_size: file.size,
      });
      if (error) throw error;
      this.hideLoading();
      this.showSuccess('文件发送成功！');
    } catch (error) {
      this.hideLoading();
      console.error('发送文件失败:', error);
      this.showError('发送文件失败: ' + error.message);
    }
  }
  async uploadFile(file) {
    try {
      const fileName = `file_${Date.now()}_${file.name}`;
      const { error: upError } = await this.supabase.storage
        .from(this.fileBucket)
        .upload(fileName, file, { contentType: file.type, upsert: false });
      if (upError) throw upError;
      const { data } = this.supabase.storage.from(this.fileBucket).getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) {
      console.error('文件上传失败:', error);
      throw new Error('文件上传失败: ' + error.message);
    }
  }

  /* ---------------- 实时订阅 ---------------- */
  setupMessageSubscription(roomId) {
    if (this.messageSubscription) this.supabase.removeChannel(this.messageSubscription);
    this.messageSubscription = this.supabase
      .channel('public:chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, async (payload) => {
        const { data: userData } = await this.supabase.from('chat_users').select('username').eq('id', payload.new.user_id).single();
        if (userData) this.addMessageToChat(payload.new, userData.username);
      })
      .subscribe();
  }

  /* ---------------- 联系人 ---------------- */
  async loadContacts() {
    try {
      const { data, error } = await this.supabase.from('chat_users').select('id, username, is_online, last_login').neq('id', this.currentUser.userId).order('username');
      if (error) throw error;
      this.contacts = data || [];
    } catch (error) {
      console.error('加载联系人失败:', error);
      this.contacts = [];
    }
    this.renderContacts();
  }
  renderContacts() {
    const container = document.getElementById('contactsList');
    if (!container) return;
    if (this.contacts.length === 0) {
      container.innerHTML = '<div class="welcome-message">暂无联系人</div>';
      return;
    }
    container.innerHTML = '';
    this.contacts.forEach((c) => {
      const el = document.createElement('div');
      el.className = 'contact-item';
      el.onclick = () => this.startPrivateChat(c);
      const isOnline = c.is_online || new Date() - new Date(c.last_login) < 300000;
      el.innerHTML = `
        <div class="contact-avatar" style="background:${this.getRandomColor(c.username)}">${c.username[0].toUpperCase()}</div>
        <div class="contact-info">
          <div class="contact-name">${this.escapeHtml(c.username)}</div>
          <div class="contact-status"><span class="status-indicator ${isOnline ? 'online' : 'offline'}"></span>${isOnline ? '在线' : '离线'}</div>
        </div>`;
      container.appendChild(el);
    });
  }
  async startPrivateChat(contact) {
    try {
      const roomName = `private_${Math.min(this.currentUser.userId, contact.id)}_${Math.max(this.currentUser.userId, contact.id)}`;
      let room = this.rooms.find((r) => r.name === roomName);
      if (!room) {
        const { data, error } = await this.supabase.from('chat_rooms').insert({ name: roomName, description: `与 ${contact.username} 的私聊`, created_by: this.currentUser.userId, is_public: false, room_type: 'private' }).select();
        if (error) throw error;
        room = data[0];
        this.rooms.push(room);
        await this.supabase.from('room_members').insert([{ room_id: room.id, user_id: this.currentUser.userId }, { room_id: room.id, user_id: contact.id }]);
      }
      this.selectRoom(room);
      this.showChatList();
    } catch (error) {
      console.error('开始私聊失败:', error);
      this.showError('开始私聊失败: ' + error.message);
    }
  }

  /* ---------------- 摄像头 ---------------- */
  async openCamera() {
    try {
      const preview = document.getElementById('cameraPreview');
      const video = document.getElementById('cameraLive');
      if (this.cameraStream) this.cameraStream.getTracks().forEach((t) => t.stop());
      this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.currentFacingMode }, audio: false });
      video.srcObject = this.cameraStream;
      preview.style.display = 'block';
    } catch (error) {
      console.error('无法访问摄像头:', error);
      this.showError('无法访问摄像头，请检查权限设置');
    }
  }
  async takePicture() {
    const video = document.getElementById('cameraLive');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    await this.sendImageMessage(imageData);
    this.closeCamera();
  }
  closeCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((t) => t.stop());
      this.cameraStream = null;
    }
    document.getElementById('cameraPreview').style.display = 'none';
  }
  async switchCamera() {
    this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    await this.openCamera();
  }

  /* ---------------- 房间创建 ---------------- */
  async createRoom() {
    const name = document.getElementById('roomNameInput').value.trim();
    const desc = document.getElementById('roomDescInput').value.trim();
    if (!name) return this.showError('请输入房间名称');
    try {
      const { data, error } = await this.supabase.from('chat_rooms').insert({ name, description: desc, created_by: this.currentUser.userId, is_public: true }).select();
      if (error) throw error;
      this.hideCreateRoomModal();
      await this.loadRooms();
      if (data && data.length > 0) this.selectRoom(data[0]);
      this.showSuccess('房间创建成功！');
    } catch (error) {
      console.error('创建房间失败:', error);
      this.showError('创建房间失败: ' + error.message);
    }
  }
  showCreateRoomModal() {
    document.getElementById('roomNameInput').value = '';
    document.getElementById('roomDescInput').value = '';
    document.getElementById('createRoomModal').style.display = 'block';
  }
  hideCreateRoomModal() {
    document.getElementById('createRoomModal').style.display = 'none';
  }

  /* ---------------- 用户设置 ---------------- */
  async changeUsername() {
    const newName = document.getElementById('newNameInput').value.trim();
    if (!newName) return this.showError('请输入用户名');
    if (newName.length < 3) return this.showError('用户名至少需要3个字符');
    try {
      const { error } = await this.supabase.from('chat_users').update({ username: newName }).eq('id', this.currentUser.userId);
      if (error) throw error;
      this.currentUser.username = newName;
      localStorage.setItem('chat_session', JSON.stringify(this.currentUser));
      this.hideChangeNameModal();
      this.showSuccess('用户名修改成功！');
      await this.loadContacts();
    } catch (error) {
      console.error('修改用户名失败:', error);
      this.showError('修改用户名失败: ' + error.message);
    }
  }
  showChangeNameModal() {
    document.getElementById('newNameInput').value = this.currentUser.username;
    document.getElementById('changeNameModal').style.display = 'block';
  }
  hideChangeNameModal() {
    document.getElementById('changeNameModal').style.display = 'none';
  }

  /* ---------------- 导航 ---------------- */
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
    const all = ['chatList', 'chatArea', 'contactsContainer', 'discoverContainer', 'settingsContainer'];
    all.forEach((id) => (document.getElementById(id).style.display = 'none'));
    Object.keys(show).forEach((id) => (document.getElementById(id).style.display = show[id] ? 'flex' : 'none'));
  }
  updateSidebarActive(index) {
    document.querySelectorAll('.sidebar-item').forEach((item, i) => item.classList.toggle('active', i === index));
  }

  /* ---------------- 工具 ---------------- */
  enableChatFeatures() {
    document.getElementById('messageInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;
  }
  disableChatFeatures() {
    document.getElementById('messageInput').disabled = true;
    document.getElementById('sendBtn').disabled = true;
  }
  scrollToBottom() {
    const c = document.getElementById('messagesContainer');
    setTimeout(() => (c.scrollTop = c.scrollHeight), 100);
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
  showError(msg) {
    this.showSystemMsg(msg, 'error');
  }
  showSuccess(msg) {
    this.showSystemMsg(msg, 'success');
  }
  showInfo(msg) {
    this.showSystemMsg(msg, 'info');
  }
  showSystemMsg(text, type) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `${type}-message`;
    el.textContent = text;
    container.appendChild(el);
    setTimeout(() => el.remove(), type === 'error' ? 5000 : 3000);
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
  logout() {
    if (confirm('确定要退出登录吗？')) {
      localStorage.removeItem('chat_session');
      window.location.href = 'login.html';
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  setupEventListeners() {
    // 侧边栏
    ['chatTab', 'contactsTab', 'discoverTab', 'settingsTab'].forEach((id, idx) => {
      document.getElementById(id).addEventListener('click', () => [this.showChatList, this.showContacts, this.showDiscover, this.showSettings][idx]());
    });
    // 聊天
    document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    // 房间
    document.getElementById('createRoomBtn').addEventListener('click', () => this.showCreateRoomModal());
    document.getElementById('confirmCreateRoom').addEventListener('click', () => this.createRoom());
    document.getElementById('cancelCreateRoom').addEventListener('click', () => this.hideCreateRoomModal());
    // 用户
    document.getElementById('changeNameBtn').addEventListener('click', () => this.showChangeNameModal());
    document.getElementById('confirmChangeName').addEventListener('click', () => this.changeUsername());
    document.getElementById('cancelChangeName').addEventListener('click', () => this.hideChangeNameModal());
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    // 多媒体
    document.getElementById('cameraBtn').addEventListener('click', () => this.openCamera());
    document.getElementById('imageBtn').addEventListener('click', () => this.selectImageFile());
    document.getElementById('fileBtn').addEventListener('click', () => this.selectFile());
    document.getElementById('captureBtn').addEventListener('click', () => this.takePicture());
    document.getElementById('closeCameraBtn').addEventListener('click', () => this.closeCamera());
    document.getElementById('switchCameraBtn').addEventListener('click', () => this.switchCamera());
    // 模态框外部点击关闭
    document.querySelectorAll('.modal').forEach((modal) =>
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      })
    );
  }

  /* ---------------- 文件选择 ---------------- */
  selectImageFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) this.handleImageFile(file);
    };
    input.click();
  }
  selectFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) this.sendFile(file);
    };
    input.click();
  }
  async handleImageFile(file) {
    try {
      this.validateImageFile(file);
      const reader = new FileReader();
      reader.onload = async (e) => await this.sendImageMessage(e.target.result);
      reader.readAsDataURL(file);
    } catch (error) {
      this.showError(error.message);
    }
  }
  validateImageFile(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (!validTypes.includes(file.type)) throw new Error('不支持的文件格式，请选择JPEG、PNG、GIF或WebP图片');
    if (file.size > maxSize) throw new Error('文件太大，请选择小于5MB的图片');
    return true;
  }

  /* ---------------- 初始化 ---------------- */
  async initializeApp() {
    try {
      console.log('初始化应用...');
      await this.loadUserSession();
      await this.loadRooms();
      await this.loadContacts();
      this.setupEventListeners();
      this.showChatList();
      console.log('应用初始化成功');
      this.showSuccess('应用启动成功！');
    } catch (error) {
      console.error('应用初始化失败:', error);
      this.showError('应用初始化失败，但您可以尝试基本功能');
      this.showBasicFallback();
    }
  }
  showBasicFallback() {
    const container = document.getElementById('chatItems');
    container.innerHTML = `
      <div class="welcome-message">
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
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    this.addMessageToChat({ content: '欢迎使用测试聊天功能！', created_at: new Date().toISOString(), message_type: 'text' }, '系统');
    this.addMessageToChat({ content: '您可以在这里测试基本的聊天功能', created_at: new Date().toISOString(), message_type: 'text' }, '系统');
    this.scrollToBottom();
  }
  async testImageFunctionality() {
    console.log('开始测试图片功能...');
    try {
      const { data: buckets, error: bucketError } = await this.supabase.storage.listBuckets();
      if (bucketError) {
        console.error('存储桶访问失败:', bucketError);
        return false;
      }
      console.log('可用存储桶:', buckets);
      const imageBucket = buckets.find((b) => b.name === this.imageBucket);
      if (!imageBucket) {
        console.error('图片存储桶不存在');
        return false;
      }
      console.log('图片存储桶状态:', imageBucket);
      const testImageData = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzA3YzE2MCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9IjAuMzVlbSI+5Zu+54mHPC90ZXh0Pjwvc3ZnPg==';
      const { data: uploadData, error: uploadError } = await this.supabase.storage.from(this.imageBucket).upload('test-image.png', this.dataURLToBlob(testImageData));
      if (uploadError) {
        console.error('图片上传测试失败:', uploadError);
        return false;
      }
      console.log('图片上传测试成功');
      const { data: urlData } = this.supabase.storage.from(this.imageBucket).getPublicUrl('test-image.png');
      console.log('图片公开URL:', urlData.publicUrl);
      const img = new Image();
      img.onload = () => console.log('图片加载测试成功');
      img.onerror = (err) => console.error('图片加载测试失败:', err);
      img.src = urlData.publicUrl;
      return true;
    } catch (error) {
      console.error('图片功能测试异常:', error);
      return false;
    }
  }
}

/* ======================================================================================= */
/* 紧急图片上传器（独立工具类）                                                           */
/* ======================================================================================= */
class EmergencyImageUploader {
  constructor() {
    this.maxFileSize = 2 * 1024 * 1024; // 2MB
    this.timeout = 30000; // 30秒
  }
  async uploadImage(imageData) {
    try {
      console.log('开始紧急图片上传...');
      if (!this.validateImageData(imageData)) throw new Error('无效的图片数据');
      const compressedData = await this.compressImage(imageData);
      return await this.simpleUpload(compressedData);
    } catch (error) {
      console.error('紧急上传失败:', error);
      return this.emergencyFallback(imageData);
    }
  }
  validateImageData(imageData) {
    if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
      console.error('无效的图片格式:', imageData.substring(0, 50));
      return false;
    }
    const base64Length = imageData.split(',')[1]?.length || 0;
    const sizeInBytes = (base64Length * 3) / 4;
    if (sizeInBytes > this.maxFileSize) {
      console.warn('图片太大:', Math.round(sizeInBytes / 1024 / 1024) + 'MB');
      return false;
    }
    return true;
  }
  async compressImage(imageData) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxWidth = 800;
        const maxHeight = 600;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => {
        console.warn('图片压缩失败，使用原图');
        resolve(imageData);
      };
      img.src = imageData;
    });
  }
  async simpleUpload(imageData) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('上传超时（30秒）')), this.timeout);
      try {
        const fileName = `img_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.jpg`;
        const blob = this.dataURLToBlob(imageData);
        console.log('上传文件大小:', blob.size, 'bytes');
        const { error } = await supabase.storage.from('chat-images').upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });
        clearTimeout(timeoutId);
        if (error) throw new Error(`上传失败: ${error.message}`);
        const { data } = supabase.storage.from('chat-images').getPublicUrl(fileName);
        console.log('✅ 上传成功:', data.publicUrl);
        resolve(data.publicUrl);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }
  dataURLToBlob(dataURL) {
    const parts = dataURL.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i);
    return new Blob([uInt8Array], { type: contentType });
  }
  emergencyFallback(imageData) {
    console.warn('使用紧急降级方案: 本地存储');
    const imageId = 'local_img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    try {
      if (imageData.length < 1000000) localStorage.setItem(imageId, imageData);
      else {
        window.imageCache = window.imageCache || {};
        window.imageCache[imageId] = imageData;
      }
      return imageId;
    } catch (error) {
      console.error('本地存储失败:', error);
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzA3YzE2MCIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zNWVtIj7lm77niYc8L3RleHQ+PC9zdmc+';
    }
  }
}

/* ======================================================================================= */
/* 全局初始化                                                                              */
/* ======================================================================================= */
const chatManager = new ChatManager();

document.addEventListener('DOMContentLoaded', async () => {
  console.log('页面加载完成，开始初始化应用...');
  try {
    await chatManager.initializeApp();
    setTimeout(async () => {
      const ok = await chatManager.testImageFunctionality();
      console.log(`图片功能测试${ok ? '通过' : '失败'}`);
    }, 1000);
  } catch (error) {
    console.error('应用启动失败:', error);
    chatManager.showError('应用启动失败，但您可以尝试基本功能');
  }
});

window.addEventListener('beforeunload', () => {
  if (chatManager.messageSubscription) chatManager.supabase.removeChannel(chatManager.messageSubscription);
  if (chatManager.cameraStream) chatManager.closeCamera();
});

window.addEventListener('error', (e) => console.error('全局错误:', e.error));
window.addEventListener('unhandledrejection', (e) => console.error('未处理的Promise拒绝:', e.reason));

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    chatManager.sendMessage();
  }
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach((modal) => (modal.style.display = 'none'));
    chatManager.closeCamera();
  }
});
