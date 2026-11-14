import { CAMPUS } from '../campus'
import type { CampusStringKey, Text } from './config'

export type Lang = 'en' | 'zh'

const GENERIC = {
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
  noRoomsListed: { en: 'No classrooms listed', zh: '暂无教室数据' },
  sourcePage: { en: 'Source page', zh: '来源页面' },
  listedRoom: { en: 'From course listings', zh: '来自旧课表' },
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
  studyScreen: { en: 'Presentation screen', zh: '演示屏幕' },
  studyAv: { en: 'A/V equipment', zh: '影音设备' },
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
  studyLibraryPage: { en: 'Library page', zh: '图书馆页面' },
  studyShowBuilding: { en: 'Show building', zh: '在地图上看' },
  studyNone: { en: 'No study room matches.', zh: '没有符合条件的自习室。' },
  studyElsewhere: { en: 'Other rooms you can book', zh: '其他可以预约的房间' },
  streetView: { en: 'Street View', zh: '看街景' },
  photoCredit: { en: 'Photo: {by}, {license}, Wikimedia Commons', zh: '照片：{by}，{license}，Wikimedia Commons' },
  floorPlan: { en: 'Floor plan', zh: '楼层平面图' },
  planFailed: { en: 'The floor plan image did not load.', zh: '平面图没有加载出来。' },
  planPage: { en: 'Open the Libraries’ floor plan page', zh: '打开图书馆的平面图页面' },
  planOpen: { en: 'Open the plan full size', zh: '查看大图' },
  planBooked: { en: 'Booked', zh: '已约' },
  planOther: { en: 'Walk-in or no live data', zh: '先到先得或无实时数据' },
  planArea: { en: 'The plan marks the {area}, which this room is part of, not the room itself.', zh: '平面图上标的是 {area}，这间房在它里面，图上没有单独标出。' },
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
  aboutData: { en: 'Data', zh: '数据来源' },
  aboutMap: { en: 'Buildings and paths: © OpenStreetMap contributors (ODbL).', zh: '建筑与道路：© OpenStreetMap 贡献者（ODbL）。' },
  sourceCode: { en: 'Source code on GitHub', zh: 'GitHub 源代码' },
  dataAsOf: { en: 'Classroom data fetched {d}', zh: '教室数据抓取于 {d}' },
  photoOf: { en: 'Photo {a} of {b}', zh: '照片 {a} / {b}' },
  days: { en: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', zh: '周一,周二,周三,周四,周五,周六,周日' }
} as const

export type StringKey = keyof typeof GENERIC | CampusStringKey

/** Shared wording plus the campus's own: names of its systems, sources and notices. */
const STRINGS: Record<StringKey, Text> = { ...GENERIC, ...CAMPUS.strings }

export function translate (lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  let text: string = STRINGS[key][lang]
  if (vars) {
    for (const [name, value] of Object.entries(vars)) text = text.replace(`{${name}}`, String(value))
  }
  return text
}

export function initialLang (): Lang {
  const saved = safeGet(`${CAMPUS.id}.lang`)
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

/** Display names for values that come straight from the campus classroom directories. */
const TERMS_ZH: Record<string, string> = {
  Movable: '活动座椅',
  'Movable seating': '活动座椅',
  Fixed: '固定座椅',
  'Fixed seating': '固定座椅',
  'Tiered, fixed': '阶梯固定座椅',
  'Tiered, fixed seating': '阶梯固定座椅',
  'Tiered, movable seating': '阶梯活动座椅',
  'Fixed chalkboard': '固定黑板',
  'Movable chalkboard': '推拉黑板',
  'Fixed whiteboard': '固定白板',
  'Movable whiteboard': '移动白板',
  'Full AV package': '全套影音设备',
  Interactive: '互动式',
  'Interactive classroom': '互动教室',
  'Combination of whiteboard(s) and chalkboard(s)': '白板 + 黑板',
  'Audio & content lecture capture': '课堂录制（音频 + 屏幕）',
  'Video lecture capture': '课堂录像',
  Carpeted: '有地毯',
  'No carpet': '无地毯',
  'Covered windows': '窗户可遮光',
  'No windows': '无窗',
  'Uncovered windows': '窗户无遮挡',
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
