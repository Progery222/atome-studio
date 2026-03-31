import { useLangStore, Lang } from '../stores/lang'

const T = {
  ru: {
    // Nav
    nav_phones:   '▣ Телефоны',
    nav_accounts: '◎ Аккаунты',
    nav_generate: '▶ Генерация',
    nav_queue:    '≡ Очередь',
    nav_videos:   '▤ Видео',
    nav_clients:  '◈ Клиенты',
    logo:         '⬡ Atome Studio',

    // Phones
    phones_title:    'Телефоны',
    phones_refresh:  'обновить',
    phones_empty:    '— нет телефонов · orchestrator недоступен',
    phones_online:   'онлайн',
    phones_warmup:   'прогрев',
    phones_paused:   'пауза',
    phones_offline:  'офлайн',
    phones_banned:   'бан',
    phones_error:    'ошибка',
    phones_health:   'health',
    phones_posts:    'Посты',
    phones_accounts: 'Аккаунты',
    phones_day:      'День',
    phones_pause:    '⏸ Пауза',
    phones_resume:   '▶ Возобновить',

    // Accounts
    accounts_title:  'Аккаунты',
    accounts_create: '+ Создать',
    accounts_search: 'поиск...',

    // Generate
    generate_title:   'Генерация',
    generate_run:     'Запустить генерацию →',
    generate_cancel:  'Отмена',
    generate_queue:   'Перейти в очередь →',
    generate_topic:   'Тема',

    // Queue
    queue_title:      'Очередь',
    queue_scheduled:  'Запланировано',
    queue_published:  'Опубликовано',
    queue_errors:     'Ошибок',
    queue_all:        'Все',
    queue_active:     'В работе',
    queue_failed:     'Ошибки',

    // Videos
    videos_title:     'Видеотека',
    videos_download:  '↓ Скачать',
    videos_view:      '👁 Просмотр',

    // Login
    login_email:      'email',
    login_password:   'пароль',
    login_submit:     'Войти',
    login_error:      'Неверные учётные данные',

    // Clients
    clients_title:    'Клиенты',
    clients_create:   '+ Создать клиента',

    // Settings
    nav_settings:         '⚙ Настройки',
    settings_title:       'Настройки',
    settings_profile:     'Профиль',
    settings_display_name:'Имя',
    settings_email:       'Email',
    settings_save:        'Сохранить',
    settings_saved:       'Сохранено',
    settings_security:    'Безопасность',
    settings_logout:      'Выйти',
  },

  en: {
    nav_phones:   '▣ Phones',
    nav_accounts: '◎ Accounts',
    nav_generate: '▶ Generate',
    nav_queue:    '≡ Queue',
    nav_videos:   '▤ Videos',
    nav_clients:  '◈ Clients',
    logo:         '⬡ Atome Studio',

    phones_title:    'Phones',
    phones_refresh:  'refresh',
    phones_empty:    '— no phones · orchestrator offline',
    phones_online:   'online',
    phones_warmup:   'warmup',
    phones_paused:   'paused',
    phones_offline:  'offline',
    phones_banned:   'banned',
    phones_error:    'error',
    phones_health:   'health',
    phones_posts:    'Posts',
    phones_accounts: 'Accounts',
    phones_day:      'Day',
    phones_pause:    '⏸ Pause',
    phones_resume:   '▶ Resume',

    accounts_title:  'Accounts',
    accounts_create: '+ Create',
    accounts_search: 'search...',

    generate_title:   'Generate',
    generate_run:     'Start generation →',
    generate_cancel:  'Cancel',
    generate_queue:   'Go to queue →',
    generate_topic:   'Topic',

    queue_title:      'Queue',
    queue_scheduled:  'Scheduled',
    queue_published:  'Published',
    queue_errors:     'Errors',
    queue_all:        'All',
    queue_active:     'Active',
    queue_failed:     'Failed',

    videos_title:     'Videos',
    videos_download:  '↓ Download',
    videos_view:      '👁 View',

    login_email:      'email',
    login_password:   'password',
    login_submit:     'Sign in',
    login_error:      'Invalid credentials',

    clients_title:    'Clients',
    clients_create:   '+ Create client',

    nav_settings:         '⚙ Settings',
    settings_title:       'Settings',
    settings_profile:     'Profile',
    settings_display_name:'Name',
    settings_email:       'Email',
    settings_save:        'Save',
    settings_saved:       'Saved',
    settings_security:    'Security',
    settings_logout:      'Sign out',
  },

  zh: {
    nav_phones:   '▣ 手机',
    nav_accounts: '◎ 账户',
    nav_generate: '▶ 生成',
    nav_queue:    '≡ 队列',
    nav_videos:   '▤ 视频',
    nav_clients:  '◈ 客户',
    logo:         '⬡ Atome Studio',

    phones_title:    '手机农场',
    phones_refresh:  '刷新',
    phones_empty:    '— 无手机 · 调度器离线',
    phones_online:   '在线',
    phones_warmup:   '预热',
    phones_paused:   '已暂停',
    phones_offline:  '离线',
    phones_banned:   '已封禁',
    phones_error:    '错误',
    phones_health:   '健康',
    phones_posts:    '发布',
    phones_accounts: '账户',
    phones_day:      '天',
    phones_pause:    '⏸ 暂停',
    phones_resume:   '▶ 恢复',

    accounts_title:  '账户',
    accounts_create: '+ 创建',
    accounts_search: '搜索...',

    generate_title:   '生成内容',
    generate_run:     '开始生成 →',
    generate_cancel:  '取消',
    generate_queue:   '前往队列 →',
    generate_topic:   '主题',

    queue_title:      '发布队列',
    queue_scheduled:  '已计划',
    queue_published:  '已发布',
    queue_errors:     '错误',
    queue_all:        '全部',
    queue_active:     '进行中',
    queue_failed:     '失败',

    videos_title:     '视频库',
    videos_download:  '↓ 下载',
    videos_view:      '👁 预览',

    login_email:      '邮箱',
    login_password:   '密码',
    login_submit:     '登录',
    login_error:      '账号或密码错误',

    clients_title:    '客户',
    clients_create:   '+ 创建客户',

    nav_settings:         '⚙ 设置',
    settings_title:       '设置',
    settings_profile:     '个人资料',
    settings_display_name:'姓名',
    settings_email:       '邮箱',
    settings_save:        '保存',
    settings_saved:       '已保存',
    settings_security:    '安全',
    settings_logout:      '退出',
  },

  es: {
    nav_phones:   '▣ Teléfonos',
    nav_accounts: '◎ Cuentas',
    nav_generate: '▶ Generar',
    nav_queue:    '≡ Cola',
    nav_videos:   '▤ Videos',
    nav_clients:  '◈ Clientes',
    logo:         '⬡ Atome Studio',

    phones_title:    'Teléfonos',
    phones_refresh:  'actualizar',
    phones_empty:    '— sin teléfonos · orquestador inaccesible',
    phones_online:   'en línea',
    phones_warmup:   'calentando',
    phones_paused:   'pausado',
    phones_offline:  'desconectado',
    phones_banned:   'baneado',
    phones_error:    'error',
    phones_health:   'salud',
    phones_posts:    'Posts',
    phones_accounts: 'Cuentas',
    phones_day:      'Día',
    phones_pause:    '⏸ Pausar',
    phones_resume:   '▶ Reanudar',

    accounts_title:  'Cuentas',
    accounts_create: '+ Crear',
    accounts_search: 'buscar...',

    generate_title:   'Generar',
    generate_run:     'Iniciar generación →',
    generate_cancel:  'Cancelar',
    generate_queue:   'Ir a la cola →',
    generate_topic:   'Tema',

    queue_title:      'Cola',
    queue_scheduled:  'Programado',
    queue_published:  'Publicado',
    queue_errors:     'Errores',
    queue_all:        'Todo',
    queue_active:     'Activo',
    queue_failed:     'Fallido',

    videos_title:     'Videoteca',
    videos_download:  '↓ Descargar',
    videos_view:      '👁 Ver',

    login_email:      'correo',
    login_password:   'contraseña',
    login_submit:     'Entrar',
    login_error:      'Credenciales incorrectas',

    clients_title:    'Clientes',
    clients_create:   '+ Crear cliente',

    nav_settings:         '⚙ Ajustes',
    settings_title:       'Ajustes',
    settings_profile:     'Perfil',
    settings_display_name:'Nombre',
    settings_email:       'Email',
    settings_save:        'Guardar',
    settings_saved:       'Guardado',
    settings_security:    'Seguridad',
    settings_logout:      'Cerrar sesión',
  },
} satisfies Record<Lang, Record<string, string>>

export type TKey = keyof typeof T.ru

export function useT() {
  const lang = useLangStore((s) => s.lang)
  return (key: TKey): string =>
    (T[lang] as Record<string, string>)[key] ?? T.ru[key]
}
