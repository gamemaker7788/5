/* lang.js  –  全站统一语言包
   用法：LANG[lang].key   或   LANG.get(lang,key) */
const LANG = {
  en:{  // English
    send:"Send", inputPlaceholder:"Type a message…", searchChat:"Search chat",
    noRooms:"No chat rooms", newRoom:"New room", members:"Members", settings:"Settings",
    logout:"Log out", redirecting:"Redirecting…", login:"Login", register:"Register",
    username:"Username", password:"Password", confirmPwd:"Confirm password",
    loggingIn:"Logging in…", loginSuccess:"Login successful!",
    regSuccess:"Registration successful! Auto-login…", userExist:"Username already exists",
    pwdMismatch:"Passwords do not match", pwdTooShort:"Password ≥6 chars",
    userTooShort:"Username ≥3 chars", enterUserPwd:"Enter username & password",
    creatingRoom:"Creating room…", roomCreated:"Room created!", createFirst:"Create the first room",
    loading:"Loading…", uploading:"Uploading…", uploadTimeout:"Upload timed out",
    uploadFail:"Upload failed", imgTooLarge:"Image ≤5 MB", fileTooLarge:"File ≤10 MB",
    badFileType:"Unsupported file type", autoTrans:"Auto-translate",
    transFail:"Translation failed", transLoading:"Translating…",
    about:"About", privacy:"Privacy", notif:"Notifications", changeName:"Change username",
    newName:"New username", nameTooShort:"Username ≥3 chars", nameChanged:"Username changed!"
  },

  zh:{  // 中文
    send:"发送", inputPlaceholder:"输入消息…", searchChat:"搜索聊天",
    noRooms:"暂无聊天室", newRoom:"新建房间", members:"成员", settings:"设置",
    logout:"退出登录", redirecting:"正在跳转…", login:"登录", register:"注册",
    username:"用户名", password:"密码", confirmPwd:"确认密码",
    loggingIn:"登录中…", loginSuccess:"登录成功！",
    regSuccess:"注册成功！正在自动登录…", userExist:"用户名已存在",
    pwdMismatch:"两次密码不一致", pwdTooShort:"密码至少6位",
    userTooShort:"用户名至少3位", enterUserPwd:"请输入用户名和密码",
    creatingRoom:"创建房间中…", roomCreated:"房间创建成功！", createFirst:"创建第一个房间",
    loading:"加载中…", uploading:"上传中…", uploadTimeout:"上传超时",
    uploadFail:"上传失败", imgTooLarge:"图片不能大于5 MB", fileTooLarge:"文件不能大于10 MB",
    badFileType:"不支持的文件类型", autoTrans:"自动翻译",
    transFail:"翻译失败", transLoading:"翻译中…",
    about:"关于我们", privacy:"隐私设置", notif:"通知设置", changeName:"修改用户名",
    newName:"新用户名", nameTooShort:"用户名至少3位", nameChanged:"用户名已修改！"
  },

  ru:{  // Русский
    send:"Отправить", inputPlaceholder:"Введите сообщение…", searchChat:"Поиск чата",
    noRooms:"Нет чат-комнат", newRoom:"Новая комната", members:"Участники", settings:"Настройки",
    logout:"Выйти", redirecting:"Переадресация…", login:"Вход", register:"Регистрация",
    username:"Имя пользователя", password:"Пароль", confirmPwd:"Подтвердите пароль",
    loggingIn:"Вход…", loginSuccess:"Вход выполнен!",
    regSuccess:"Регистрация успешна! Авто-вход…", userExist:"Имя уже существует",
    pwdMismatch:"Пароли не совпадают", pwdTooShort:"Пароль ≥6 символов",
    userTooShort:"Имя ≥3 символов", enterUserPwd:"Введите имя и пароль",
    creatingRoom:"Создание комнаты…", roomCreated:"Комната создана!", createFirst:"Создайте первую комнату",
    loading:"Загрузка…", uploading:"Загрузка…", uploadTimeout:"Тайм-аут загрузки",
    uploadFail:"Ошибка загрузки", imgTooLarge:"Изображение ≤5 МБ", fileTooLarge:"Файл ≤10 МБ",
    badFileType:"Неподдерживаемый тип", autoTrans:"Авто-перевод",
    transFail:"Ошибка перевода", transLoading:"Перевод…",
    about:"О нас", privacy:"Конфиденциальность", notif:"Уведомления", changeName:"Сменить имя",
    newName:"Новое имя", nameTooShort:"Имя ≥3 символов", nameChanged:"Имя изменено!"
  },

  de:{  // Deutsch
    send:"Senden", inputPlaceholder:"Nachricht eingeben…", searchChat:"Chat suchen",
    noRooms:"Keine Chaträume", newRoom:"Neuer Raum", members:"Mitglieder", settings:"Einstellungen",
    logout:"Abmelden", redirecting:"Weiterleitung…", login:"Anmelden", register:"Registrieren",
    username:"Benutzername", password:"Passwort", confirmPwd:"Passwort bestätigen",
    loggingIn:"Anmelden…", loginSuccess:"Anmeldung erfolgreich!",
    regSuccess:"Registrierung erfolgreich! Auto-Login…", userExist:"Benutzername existiert",
    pwdMismatch:"Passwörter stimmen nicht überein", pwdTooShort:"Passwort ≥6 Zeichen",
    userTooShort:"Benutzername ≥3 Zeichen", enterUserPwd:"Benutzername & Passwort eingeben",
    creatingRoom:"Raum wird erstellt…", roomCreated:"Raum erstellt!", createFirst:"Ersten Raum erstellen",
    loading:"Laden…", uploading:"Hochladen…", uploadTimeout:"Upload-Timeout",
    uploadFail:"Upload fehlgeschlagen", imgTooLarge:"Bild ≤5 MB", fileTooLarge:"Datei ≤10 MB",
    badFileType:"Dateityp nicht unterstützt", autoTrans:"Auto-Übersetzung",
    transFail:"Übersetzung fehlgeschlagen", transLoading:"Übersetzen…",
    about:"Über uns", privacy:"Datenschutz", notif:"Benachrichtigungen", changeName:"Benutzername ändern",
    newName:"Neuer Benutzername", nameTooShort:"≥3 Zeichen", nameChanged:"Benutzername geändert!"
  },

  fr:{  // Français
    send:"Envoyer", inputPlaceholder:"Tapez un message…", searchChat:"Rechercher",
    noRooms:"Aucun salon", newRoom:"Nouveau salon", members:"Membres", settings:"Paramètres",
    logout:"Déconnexion", redirecting:"Redirection…", login:"Connexion", register:"Inscription",
    username:"Nom d’utilisateur", password:"Mot de passe", confirmPwd:"Confirmer",
    loggingIn:"Connexion…", loginSuccess:"Connecté !",
    regSuccess:"Inscription réussie ! Connexion auto…", userExist:"Nom déjà utilisé",
    pwdMismatch:"Mots de passe différents", pwdTooShort:"Mot de passe ≥6 caractères",
    userTooShort:"Nom ≥3 caractères", enterUserPwd:"Entrez nom et mot de passe",
    creatingRoom:"Création du salon…", roomCreated:"Salon créé !", createFirst:"Créer le premier salon",
    loading:"Chargement…", uploading:"Téléversement…", uploadTimeout:"Délai dépassé",
    uploadFail:"Échec du téléversement", imgTooLarge:"Image ≤5 Mo", fileTooLarge:"Fichier ≤10 Mo",
    badFileType:"Type non supporté", autoTrans:"Traduction auto",
    transFail:"Échec de la traduction", transLoading:"Traduction…",
    about:"À propos", privacy:"Confidentialité", notif:"Notifications", changeName:"Changer le nom",
    newName:"Nouveau nom", nameTooShort:"≥3 caractères", nameChanged:"Nom modifié !"
  },

  es:{  // Español
    send:"Enviar", inputPlaceholder:"Escribe un mensaje…", searchChat:"Buscar chat",
    noRooms:"Sin salas", newRoom:"Nueva sala", members:"Miembros", settings:"Ajustes",
    logout:"Cerrar sesión", redirecting:"Redirigiendo…", login:"Entrar", register:"Registrarse",
    username:"Usuario", password:"Contraseña", confirmPwd:"Confirmar contraseña",
    loggingIn:"Entrando…", loginSuccess:"¡Sesión iniciada!",
    regSuccess:"¡Registro exitoso! Auto-login…", userExist:"El usuario ya existe",
    pwdMismatch:"Las contraseñas no coinciden", pwdTooShort:"Contraseña ≥6 caracteres",
    userTooShort:"Usuario ≥3 caracteres", enterUserPwd:"Introduce usuario y contraseña",
    creatingRoom:"Creando sala…", roomCreated:"¡Sala creada!", createFirst:"Crea la primera sala",
    loading:"Cargando…", uploading:"Subiendo…", uploadTimeout:"Tiempo agotado",
    uploadFail:"Error al subir", imgTooLarge:"Imagen ≤5 MB", fileTooLarge:"Archivo ≤10 MB",
    badFileType:"Tipo no soportado", autoTrans:"Traducción automática",
    transFail:"Error de traducción", transLoading:"Traduciendo…",
    about:"Acerca de", privacy:"Privacidad", notif:"Notificaciones", changeName:"Cambiar usuario",
    newName:"Nuevo usuario", nameTooShort:"≥3 caracteres", nameChanged:"¡Usuario cambiado!"
  },

  ja:{  // 日本語
    send:"送信", inputPlaceholder:"メッセージを入力…", searchChat:"チャット検索",
    noRooms:"チャットルームなし", newRoom:"新規ルーム", members:"メンバー", settings:"設定",
    logout:"ログアウト", redirecting:"リダイレクト中…", login:"ログイン", register:"登録",
    username:"ユーザー名", password:"パスワード", confirmPwd:"パスワード確認",
    loggingIn:"ログイン中…", loginSuccess:"ログイン成功！",
    regSuccess:"登録成功！自動ログイン…", userExist:"ユーザー名が存在します",
    pwdMismatch:"パスワード不一致", pwdTooShort:"パスワード ≥6文字",
    userTooShort:"ユーザー名 ≥3文字", enterUserPwd:"ユーザー名とパスワードを入力",
    creatingRoom:"ルーム作成中…", roomCreated:"ルーム作成完了！", createFirst:"最初のルームを作成",
    loading:"読込中…", uploading:"アップロード中…", uploadTimeout:"アップロードタイムアウト",
    uploadFail:"アップロード失敗", imgTooLarge:"画像 ≤5 MB", fileTooLarge:"ファイル ≤10 MB",
    badFileType:"未対応ファイル形式", autoTrans:"自動翻訳",
    transFail:"翻訳失敗", transLoading:"翻訳中…",
    about:"アプリについて", privacy:"プライバシー", notif:"通知", changeName:"ユーザー名変更",
    newName:"新しいユーザー名", nameTooShort:"≥3文字", nameChanged:"ユーザー名変更完了！"
  },

  ko:{  // 한국어
    send:"보내기", inputPlaceholder:"메시지 입력…", searchChat:"채팅 찾기",
    noRooms:"채팅방 없음", newRoom:"새 방", members:"멤버", settings:"설정",
    logout:"로그아웃", redirecting:"리디렉션 중…", login:"로그인", register:"가입",
    username:"사용자 이름", password:"비밀번호", confirmPwd:"비밀번호 확인",
    loggingIn:"로그인 중…", loginSuccess:"로그인 성공!",
    regSuccess:"가입 성공! 자동 로그인…", userExist:"이미 존재하는 이름",
    pwdMismatch:"비밀번호 불일치", pwdTooShort:"비밀번호 ≥6자",
    userTooShort:"이름 ≥3자", enterUserPwd:"이름과 비밀번호 입력",
    creatingRoom:"방 만들기 중…", roomCreated:"방 생성 완료!", createFirst:"첫 번째 방 만들기",
    loading:"불러오는 중…", uploading:"업로드 중…", uploadTimeout:"업로드 시간 초과",
    uploadFail:"업로드 실패", imgTooLarge:"이미지 ≤5 MB", fileTooLarge:"파일 ≤10 MB",
    badFileType:"지원하지 않는 형식", autoTrans:"자동 번역",
    transFail:"번역 실패", transLoading:"번역 중…",
    about:"앱 정보", privacy:"개인정보", notif:"알림", changeName:"이름 변경",
    newName:"새 이름", nameTooShort:"≥3자", nameChanged:"이름 변경 완료!"
  },

  ka:{  // ქართული
    send:"გაგზავნა", inputPlaceholder:"შეიყვანეთ შეტყობინება…", searchChat:"ჩეთის ძებნა",
    noRooms:"ჩეთ-ოთახები არ არის", newRoom:"ახალი ოთახი", members:"წევრები", settings:"პარამეტრები",
    logout:"გამოსვლა", redirecting:"გადამისამართება…", login:"შესვლა", register:"რეგისტრაცია",
    username:"მომხმარებელი", password:"პაროლი", confirmPwd:"დაადასტურეთ პაროლი",
    loggingIn:"შესვლა…", loginSuccess:"შესვლა წარმატებულია!",
    regSuccess:"რეგისტრაცია წარმატებულია! ავტო-შესვლა…", userExist:"მომხმარებელი უკვე არსებობს",
    pwdMismatch:"პაროლები არ ემთხვევა", pwdTooShort:"პაროლი ≥6 სიმბოლო",
    userTooShort:"მომხმარებელი ≥3 სიმბოლო", enterUserPwd:"შეიყვანეთ მომხმარებელი და პაროლი",
    creatingRoom:"ოთახის შექმნა…", roomCreated:"ოთახი შეიქმნა!", createFirst:"შექმენით პირველი ოთახი",
    loading:"იტვირთება…", uploading:"ატვირთვა…", uploadTimeout:"ატვირთვის ტაიმ-აუტი",
    uploadFail:"ატვირთვა ვერ მოხერხდა", imgTooLarge:"სურათი ≤5 MB", fileTooLarge:"ფაილი ≤10 MB",
    badFileType:"ფაილის ტიპი არ მხარდაჭერილია", autoTrans:"ავტომატური თარგმანი",
    transFail:"თარგმანი ვერ მოხერხდა", transLoading:"თარგმნა…",
    about:"ჩვენს შესახებ", privacy:"კონფიდენციალურობა", notif:"შეტყობინებები", changeName:"მომხმარებლის შეცვლა",
    newName:"ახალი მომხმარებელი", nameTooShort:"≥3 სიმბოლო", nameChanged:"მომხმარებელი შეიცვალა!"
  }
};

/* 快捷读取函数 */
LANG.get = (l, k) => LANG[l]?.[k] ?? LANG.en[k] ?? `[${k}]`;
LANG.list = () => Object.keys(LANG);   // 返回可用语言数组
