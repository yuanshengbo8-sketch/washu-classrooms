export type Lang = 'en' | 'zh'

const STRINGS = {
  appName: { en: 'WashU Classroom Explorer', zh: 'WashU 教室地图' },
  searchPlaceholder: { en: 'Search rooms, buildings, courses, instructors', zh: '搜索教室、教学楼、课程、老师' },
  findRoom: { en: 'Find a room', zh: '找教室' },
  favorites: { en: 'Saved', zh: '收藏' },
  about: { en: 'About', zh: '关于' },
  resetView: { en: 'Reset view', zh: '重置视角' },
  zoomIn: { en: 'Zoom in', zh: '放大' },
  zoomOut: { en: 'Zoom out', zh: '缩小' },
  close: { en: 'Close', zh: '关闭' },
  back: { en: 'Back', zh: '返回' },
  rooms: { en: 'rooms', zh: '间教室' },
  room: { en: 'room', zh: '间教室' },
  seats: { en: 'seats', zh: '座' },
  seatsTotal: { en: 'seats in total', zh: '个座位' },
  allFloors: { en: 'All floors', zh: '全部楼层' },
  lowerLevel: { en: 'Lower level', zh: '底层 / 地下层' },
  floorN: { en: 'Floor {n}', zh: '{n} 楼' },
  directions: { en: 'Walking directions', zh: '步行导航' },
  capacity: { en: 'Capacity', zh: '容量' },
  anyCapacity: { en: 'Any size', zh: '不限人数' },
  seatingStyle: { en: 'Seating', zh: '座位形式' },
  anyStyle: { en: 'Any seating', zh: '不限形式' },
  features: { en: 'Must have', zh: '必须具备' },
  accessible: { en: 'Wheelchair accessible', zh: '无障碍' },
  hasTour: { en: '360° tour', zh: '360° 全景' },
  clearFilters: { en: 'Clear filters', zh: '清除筛选' },
  noMatches: { en: 'No classroom matches these filters.', zh: '没有符合条件的教室。' },
  matching: { en: '{n} classrooms match', zh: '{n} 间教室符合条件' },
  allClassrooms: { en: '{n} classrooms', zh: '共 {n} 间教室' },
  sortBy: { en: 'Sort', zh: '排序' },
  sortSmall: { en: 'Smallest first', zh: '从小到大' },
  sortLarge: { en: 'Largest first', zh: '从大到小' },
  sortBuilding: { en: 'By building', zh: '按教学楼' },
  boards: { en: 'Boards', zh: '黑板 / 白板' },
  screens: { en: 'Projection screens', zh: '投影幕' },
  wirelessMics: { en: 'Wireless microphones', zh: '无线麦克风' },
  micFor: { en: 'Microphones feed', zh: '麦克风用途' },
  darkening: { en: 'Room darkening', zh: '遮光效果' },
  equipment: { en: 'Equipment', zh: '设备' },
  details: { en: 'Details', zh: '详情' },
  seatMap: { en: 'Seating chart', zh: '座位图' },
  openPdf: { en: 'Open full size', zh: '查看大图' },
  virtualTour: { en: '360° room tour', zh: '360° 实景全景' },
  seatView: { en: 'Seat view', zh: '座位视角' },
  ctlPage: { en: 'CTL page', zh: 'CTL 页面' },
  save: { en: 'Save', zh: '收藏' },
  saved: { en: 'Saved', zh: '已收藏' },
  share: { en: 'Copy link', zh: '复制链接' },
  copied: { en: 'Link copied', zh: '链接已复制' },
  noSaved: { en: 'Star a classroom to keep it here.', zh: '在教室页点「收藏」，会显示在这里。' },
  buildings: { en: 'Buildings', zh: '教学楼' },
  classrooms: { en: 'Classrooms', zh: '教室' },
  courses: { en: 'Courses', zh: '课程' },
  loadingCourses: { en: 'Loading courses…', zh: '正在加载课程…' },
  noResults: { en: 'No results', zh: '没有结果' },
  section: { en: 'Section', zh: '班号' },
  instructor: { en: 'Instructor', zh: '老师' },
  when: { en: 'Meets', zh: '上课时间' },
  enrolled: { en: 'Enrolled', zh: '已选 / 名额' },
  units: { en: 'units', zh: '学分' },
  tba: { en: 'TBA', zh: '待定' },
  term: { en: 'Term', zh: '学期' },
  roomNotPublic: {
    en: 'WashU does not publish room assignments, so sections are not linked to classrooms here. Check Workday for the room.',
    zh: 'WashU 未公开每节课的上课教室，所以这里无法把课程对应到教室；具体教室请在 Workday 查看。'
  },
  noRoomsListed: { en: 'No classrooms listed', zh: '暂无教室数据' },
  schoolManaged: {
    en: '{school} schedules most classrooms in this building itself, so they are not in the CTL classroom directory.',
    zh: '这栋楼的大部分教室由 {school} 自己排课，不在 CTL 教室目录里。'
  },
  notPooled: {
    en: 'This building has no classrooms in the Registrar’s pooled classroom directory.',
    zh: '这栋楼没有教室在教务处的公共教室目录里。'
  },
  partialList: {
    en: 'Rooms without photos come from WashU’s archived public course listings (through 2025). A room that never held a listed class is missing.',
    zh: '没有照片的房间来自 WashU 旧版公开课表的存档（截至 2025 年）；从没排过课的房间不会出现在这里。'
  },
  schoolRoom: {
    en: 'Scheduled by {school}. It is not in the CTL directory, so there are no photos, seat count or equipment list.',
    zh: '由 {school} 排课，不在 CTL 目录里，所以没有照片、座位数和设备清单。'
  },
  sourcePage: { en: 'Source page', zh: '来源页面' },
  listedRoom: { en: 'From course listings', zh: '来自旧课表' },
  listedNotice: {
    en: 'Not in the CTL directory. WashU’s archived public course listings show {n} class sections meeting here, most recently in {year}. There are no photos or equipment details.',
    zh: '不在 CTL 目录里。WashU 旧版公开课表的存档显示，有 {n} 个班次在这里上过课，最近一次在 {year} 年。没有照片和设备信息。'
  },
  atLeastSeats: {
    en: 'The largest class listed here had {n} places, so the room holds at least that many.',
    zh: '这里排过的最大班级名额是 {n} 人，所以至少能坐这么多。'
  },
  knowRoom: { en: 'Know a room here? Add it on GitHub', zh: '知道这里的教室？到 GitHub 补充' },
  studyRooms: { en: 'Study rooms', zh: '自习室' },
  studyRoomsCount: { en: '{n} study rooms', zh: '{n} 间自习室' },
  studyHere: { en: 'Study rooms in this building', zh: '这栋楼里的自习室' },
  studyGroup: { en: 'Group study', zh: '小组讨论' },
  studyQuiet: { en: 'Quiet', zh: '安静自习' },
  studySilent: { en: 'Silent', zh: '静音区' },
  studyGrad: { en: 'Graduate students', zh: '仅研究生' },
  studyFaculty: { en: 'Faculty', zh: '仅教师' },
  studyWhiteboard: { en: 'Whiteboard', zh: '白板' },
  studyComputer: { en: 'Computers', zh: '电脑' },
  studyAv: { en: 'A/V equipment', zh: '影音设备' },
  studyCard: { en: 'WashU ID card access', zh: '需刷 WashU ID' },
  studyFreeNow: { en: 'Free now', zh: '现在空闲' },
  studyReservable: { en: 'Bookable', zh: '可预约' },
  studyFreeUntil: { en: 'Free until {time}', zh: '空闲至 {time}' },
  studyBusyUntil: { en: 'Booked until {time}', zh: '已约至 {time}' },
  studyClosed: { en: 'Closed now', zh: '现在不开放' },
  studyOpensAt: { en: 'Opens {time}', zh: '{time} 开放' },
  studyWalkIn: { en: 'Walk in', zh: '先到先得' },
  studyCheckLibcal: { en: 'Check booking page', zh: '去预约页查看' },
  studyLevel: { en: 'Level {level}', zh: '{level} 层' },
  today: { en: 'Today', zh: '今天' },
  tomorrow: { en: 'Tomorrow', zh: '明天' },
  studyBook: { en: 'Book on LibCal', zh: '去 LibCal 预约' },
  studyLibraryPage: { en: 'Library page', zh: '图书馆页面' },
  studyShowBuilding: { en: 'Show building', zh: '在地图上看' },
  studyLive: {
    en: '{n} bookable rooms are free right now. Bookings from the Libraries’ LibCal page, read at {time}; St. Louis time.',
    zh: '现在有 {n} 间可预约的自习室空着。预约情况来自图书馆 LibCal 页面，读取于 {time}；时间均为圣路易斯当地时间。'
  },
  studyNotLive: {
    en: 'Live booking data is not available right now. Open a room’s LibCal page to see its bookings.',
    zh: '暂时拿不到实时预约数据，请打开各房间的 LibCal 页面查看。'
  },
  studyNone: { en: 'No study room matches.', zh: '没有符合条件的自习室。' },
  studyElsewhere: { en: 'Other rooms you can book', zh: '其他可以预约的房间' },
  studyOlinTitle: { en: 'Olin Business School group study rooms', zh: 'Olin 商学院小组自习室' },
  studyOlinBody: {
    en: 'Open to Olin students, faculty and staff around the clock, bookable up to 14 days ahead. Sign in at reserve.wustl.edu with your WashU Key and choose “Olin Spaces – Group Study Rooms”. Their bookings are behind that login, so they are not shown here.',
    zh: '面向 Olin 的学生和教职员，全天开放，最多提前 14 天预约。用 WashU Key 登录 reserve.wustl.edu，选择「Olin Spaces – Group Study Rooms」。预约情况在登录之后才能看到，所以这里不显示。'
  },
  studyOlinGuide: { en: 'Olin’s booking guide', zh: 'Olin 的预约说明' },
  studyClassroomsTitle: { en: 'Classrooms and event spaces', zh: '教室和活动场地' },
  studyClassroomsBody: {
    en: 'Room requests also go through reserve.wustl.edu. Olin’s guide says student requests open on the 15th day of each semester, when the university releases its pooled classrooms, and count only once a confirmation email arrives.',
    zh: '申请教室同样在 reserve.wustl.edu。Olin 的说明里写：学生申请在每学期第 15 天开放（学校释放公共教室的时间），收到确认邮件才算订上。'
  },
  studyClassroomsLink: { en: 'Olin’s guide to requesting a room', zh: 'Olin 的教室申请说明' },
  streetView: { en: 'Street View', zh: '看街景' },
  photoCredit: { en: 'Photo: {by}, {license}, Wikimedia Commons', zh: '照片：{by}，{license}，Wikimedia Commons' },
  floorPlan: { en: 'Floor plan', zh: '楼层平面图' },
  planCredit: { en: 'Floor plan: WashU Libraries', zh: '平面图来自 WashU 图书馆' },
  planFailed: { en: 'The floor plan image did not load.', zh: '平面图没有加载出来。' },
  planPage: { en: 'Open the Libraries’ floor plan page', zh: '打开图书馆的平面图页面' },
  planOpen: { en: 'Open the plan full size', zh: '查看大图' },
  planBooked: { en: 'Booked', zh: '已约' },
  planOther: { en: 'Walk-in or no live data', zh: '先到先得或无实时数据' },
  planArea: { en: 'The plan marks the {area}, which this room is part of, not the room itself.', zh: '平面图上标的是 {area}，这间房在它里面，图上没有单独标出。' },
  studySource: { en: 'Study room details:', zh: '自习室信息来自：' },
  loading: { en: 'Loading campus…', zh: '正在加载校园…' },
  loadError: { en: 'Could not load the campus data.', zh: '校园数据加载失败。' },
  noWebgl: { en: '3D map is unavailable in this browser. Use the room list instead.', zh: '此浏览器无法显示 3D 地图，请使用教室列表。' },
  hintMap: { en: 'Drag to move · scroll to zoom · right-drag to rotate', zh: '拖动平移 · 滚轮缩放 · 右键拖动旋转' },
  hintMapTouch: { en: 'Drag to move · pinch to zoom · two fingers to rotate', zh: '单指平移 · 双指缩放与旋转' },
  seatViewTitle: { en: 'Seat view', zh: '座位视角' },
  seatViewPick: { en: 'Pick a seat to sit in it.', zh: '点一个座位，坐上去看看。' },
  seatViewNote: {
    en: 'Schematic generated from the seat count and seating style. It is not the real room; use the photos and 360° tour for that.',
    zh: '示意图：根据座位数和座位形式生成，并非真实尺寸；真实环境请看照片和 360° 全景。'
  },
  overview: { en: 'Overview', zh: '俯视全场' },
  frontRow: { en: 'Front', zh: '前排' },
  middleRow: { en: 'Middle', zh: '中间' },
  backRow: { en: 'Back', zh: '后排' },
  corner: { en: 'Corner', zh: '角落' },
  toBoard: { en: '{n} m to the board', zh: '距黑板约 {n} 米' },
  offAxis: { en: '{n}° off centre', zh: '偏离正中 {n}°' },
  rowOf: { en: 'Row {a} of {b}', zh: '第 {a} / {b} 排' },
  dragLook: { en: 'Drag to look around', zh: '拖动可环顾四周' },
  aboutBody1: {
    en: 'An unofficial student project that puts WashU’s classrooms and library study rooms on a 3D map of the Danforth Campus. It is not affiliated with or endorsed by Washington University in St. Louis.',
    zh: '非官方学生项目：把 WashU 的教室和图书馆自习室放到 Danforth 校区的 3D 地图上。本站与 Washington University in St. Louis 无隶属关系，也未获其背书。'
  },
  aboutData: { en: 'Data', zh: '数据来源' },
  aboutClassrooms: {
    en: 'Classroom details, photos, seating charts and 360° tours: WashU Center for Teaching and Learning Classroom Directory. Photos stay on ctl.wustl.edu and belong to WashU.',
    zh: '教室信息、照片、座位图、360° 全景：WashU Center for Teaching and Learning 教室目录。照片仍托管在 ctl.wustl.edu，版权归 WashU。'
  },
  aboutCourses: {
    en: 'Courses: the Registrar’s public Class Schedule Search, which lists times and instructors but not rooms. Rooms outside the CTL directory come from WashU’s old public Course Listings (retired in 2025), as archived by the Internet Archive.',
    zh: '课程：教务处公开的 Class Schedule Search，只有时间和老师，没有上课教室。CTL 目录之外的教室来自 WashU 旧版公开课表（2025 年停用）在 Internet Archive 的存档。'
  },
  aboutStudy: {
    en: 'Study rooms: WashU Libraries’ study room directory. Bookings are read from the Libraries’ public LibCal pages about every 20 minutes; LibCal is the authority.',
    zh: '自习室：WashU 图书馆的自习室目录。预约情况约每 20 分钟从图书馆公开的 LibCal 页面读取一次，以 LibCal 为准。'
  },
  aboutMap: { en: 'Buildings and paths: © OpenStreetMap contributors (ODbL).', zh: '建筑与道路：© OpenStreetMap 贡献者（ODbL）。' },
  aboutFloors: {
    en: 'Floors are inferred from room numbers. Building heights and the floor stack are for display, not survey data.',
    zh: '楼层由房间号推断；建筑高度和楼层分解仅用于展示，并非实测。'
  },
  aboutCredit: {
    en: 'Inspired by the UCSD Classroom Explorer by zhenzhenfufu, wenhaoquestion and SheepTester.',
    zh: '灵感来自 zhenzhenfufu、wenhaoquestion 与 SheepTester 的 UCSD Classroom Explorer。'
  },
  sourceCode: { en: 'Source code on GitHub', zh: 'GitHub 源代码' },
  dataAsOf: { en: 'Classroom data fetched {d}', zh: '教室数据抓取于 {d}' },
  photoOf: { en: 'Photo {a} of {b}', zh: '照片 {a} / {b}' },
  days: { en: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', zh: '周一,周二,周三,周四,周五,周六,周日' }
} as const

export type StringKey = keyof typeof STRINGS

export function translate (lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  let text: string = STRINGS[key][lang]
  if (vars) {
    for (const [name, value] of Object.entries(vars)) text = text.replace(`{${name}}`, String(value))
  }
  return text
}

export function initialLang (): Lang {
  const saved = safeGet('washu-classrooms.lang')
  if (saved === 'en' || saved === 'zh') return saved
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function safeGet (key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSet (key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be blocked; the preference just won't persist.
  }
}

/** Display names for values that come straight from the CTL directory. */
const TERMS_ZH: Record<string, string> = {
  'Tablet Armchairs': '带写字板座椅',
  Seminar: '研讨桌',
  'Movable Tables (Rows)': '活动桌（成排）',
  'Movable Tables (Pods)': '活动桌（分组）',
  Auditorium: '阶梯教室',
  'ALC: Roundtable': '主动学习：圆桌',
  'ALC: Pods': '主动学习：分组',
  'ALC: Flexspace': '主动学习：灵活空间',
  'ALC: Duo Flex': '主动学习：双人灵活桌',
  'ALC: TechPod': '主动学习：科技小组桌',
  'Portable SMART Board': '移动 SMART 白板',
  'LCD Monitor': '液晶显示屏',
  'Interactive Board': '交互屏',
  'Touch Screen Monitor': '触摸屏',
  'Wacom Touch Monitor': 'Wacom 手写屏',
  'Tiered Tables': '阶梯式课桌',
  'Movable, Vertical Chalkboards': '上下推拉黑板',
  'Movable, Horizontal Chalkboards': '左右推拉黑板',
  'Fixed Chalkboards': '固定黑板',
  'Portable Chalkboard': '移动黑板',
  Whiteboards: '白板',
  'Chalkboards & Whiteboards Mix': '黑板 + 白板',
  'Fixed Tables': '固定桌',
  'Case Study': '案例教室',
  'Computer Lab': '机房',
  'Computer (PC)': '电脑（PC）',
  'Computer (Mac)': '电脑（Mac）',
  'Laptop HDMI': '笔记本 HDMI',
  'Laptop USB-C': '笔记本 USB-C',
  'Laptop VGA': '笔记本 VGA',
  'Laptop Connectivity': '笔记本接入',
  'Single Camera': '单摄像头',
  'Two Cameras': '双摄像头',
  'Ceiling Microphone': '吊顶麦克风',
  'Data Projector: Single': '单投影',
  'Data Projector: Dual': '双投影',
  'Data Projector: Triple': '三投影',
  'DVD Player': 'DVD 播放器',
  'Document Camera': '实物投影仪',
  'Wireless Bodypack Microphone': '无线领夹麦',
  'Wireless Handheld Microphone': '无线手持麦',
  'Catch Box': '抛掷麦克风',
  'Interactive White Board': '交互白板',
  'SMART Podium Monitor': 'SMART 讲台屏',
  'Flat Panel Display': '平板显示屏',
  'Wireless Presentation': '无线投屏',
  Excellent: '极好',
  Good: '好',
  Fair: '一般',
  Poor: '较差',
  'Room Broadcasting': '教室扩音',
  'Room Recording': '课堂录制'
}

export function term (lang: Lang, value: string): string {
  if (lang === 'en') return value
  if (TERMS_ZH[value]) return TERMS_ZH[value]
  const separator = value.includes(' & ') ? ' & ' : ', '
  return value
    .split(separator)
    .map(part => TERMS_ZH[part] ?? part)
    .join('、')
}
