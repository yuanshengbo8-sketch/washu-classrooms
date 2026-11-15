import type { CampusConfig } from './lib/config'

/**
 * Washington University in St. Louis, Danforth Campus. This file, lib/schools.ts,
 * index.html, the data and the data scripts are the campus-specific parts of
 * the site; everything else in src/ is shared with the other campus sites.
 */
export const CAMPUS: CampusConfig = {
  id: 'washu-classrooms',
  brand: 'W',
  timeZone: 'America/Chicago',
  repoUrl: 'https://github.com/yuanshengbo8-sketch/washu-classrooms',
  liveAvailabilityUrl: 'https://raw.githubusercontent.com/yuanshengbo8-sketch/washu-classrooms/live-data/study-availability.json',
  classSchedule: true,
  labelNames: {
    'Lucy and Stanley Lopata House': 'Lopata House',
    'Scott Rudolph Hall': 'Rudolph'
  },
  finderEquipment: ['Document Camera', 'Wireless Bodypack Microphone', 'Data Projector: Dual', 'Two Cameras', 'Interactive Board', 'Laptop USB-C'],
  terms: [
    { id: '2026F', label: 'Fall 2026' },
    { id: '2027S', label: 'Spring 2027' }
  ],
  colors: {
    primary: '#ba0c2f',
    primaryDark: '#8f0a25',
    primarySoft: '#fbeaee',
    accent: '#2c5234',
    accentSoft: '#e3ede4',
    roof: 0xa63a3c,
    roofHover: 0xc8273f,
    roofDim: 0xd9bcb9,
    wall: 0xdcc3b4,
    wallDim: 0xebe3d8,
    floor: 0xc8324f,
    floorEdge: 0x6d0519,
    match: 0xba0c2f,
    study: 0x2c5234,
    studyRoof: 0x4a7f57,
    managedRoof: 0xc99a8c,
    managedRoofHover: 0xb9806f
  },
  sources: {
    classrooms: { label: 'ctl.wustl.edu/classrooms', url: 'https://ctl.wustl.edu/classrooms/' },
    courses: { label: 'registrar.washu.edu', url: 'https://registrar.washu.edu/classes-registration/class-schedule-search/' },
    study: { label: 'library.washu.edu/study-rooms', url: 'https://library.washu.edu/study-rooms/' }
  },
  studyElsewhere: [
    {
      title: { en: 'Olin Business School group study rooms', zh: 'Olin 商学院小组自习室' },
      body: { en: 'Open to Olin students, faculty and staff around the clock, bookable up to 14 days ahead. Sign in at reserve.wustl.edu with your WashU Key and choose “Olin Spaces – Group Study Rooms”. Their bookings are behind that login, so they are not shown here.', zh: '面向 Olin 的学生和教职员，全天开放，最多提前 14 天预约。用 WashU Key 登录 reserve.wustl.edu，选择「Olin Spaces – Group Study Rooms」。预约情况在登录之后才能看到，所以这里不显示。' },
      links: [
        { label: { en: 'reserve.wustl.edu', zh: 'reserve.wustl.edu' }, url: 'https://reserve.wustl.edu/' },
        { label: { en: 'Olin’s booking guide', zh: 'Olin 的预约说明' }, url: 'https://sites.wustl.edu/olings/reserving-group-rooms/' }
      ]
    },
    {
      title: { en: 'Classrooms and event spaces', zh: '教室和活动场地' },
      body: { en: 'Room requests also go through reserve.wustl.edu. Olin’s guide says student requests open on the 15th day of each semester, when the university releases its pooled classrooms, and count only once a confirmation email arrives.', zh: '申请教室同样在 reserve.wustl.edu。Olin 的说明里写：学生申请在每学期第 15 天开放（学校释放公共教室的时间），收到确认邮件才算订上。' },
      links: [
        { label: { en: 'Olin’s guide to requesting a room', zh: 'Olin 的教室申请说明' }, url: 'https://sites.wustl.edu/olings/reserving-a-classroom/' }
      ]
    }
  ],
  strings: {
    appName: { en: 'WashU Classroom Explorer', zh: 'WashU 教室地图' },
    searchPlaceholder: { en: 'Search rooms, buildings, courses, instructors', zh: '搜索教室、教学楼、课程、老师' },
    directoryPage: { en: 'CTL page', zh: 'CTL 页面' },
    roomNotPublic: { en: 'WashU does not publish room assignments, so sections are not linked to classrooms here. Check Workday for the room.', zh: 'WashU 未公开每节课的上课教室，所以这里无法把课程对应到教室；具体教室请在 Workday 查看。' },
    schoolManaged: { en: '{school} schedules most classrooms in this building itself, so they are not in the CTL classroom directory.', zh: '这栋楼的大部分教室由 {school} 自己排课，不在 CTL 教室目录里。' },
    notPooled: { en: 'This building has no classrooms in the Registrar’s pooled classroom directory.', zh: '这栋楼没有教室在教务处的公共教室目录里。' },
    partialList: { en: 'Rooms without photos come from WashU’s archived public course listings (through 2025). A room that never held a listed class is missing.', zh: '没有照片的房间来自 WashU 旧版公开课表的存档（截至 2025 年）；从没排过课的房间不会出现在这里。' },
    schoolRoom: { en: 'Scheduled by {school}. It is not in the CTL directory, so there are no photos, seat count or equipment list.', zh: '由 {school} 排课，不在 CTL 目录里，所以没有照片、座位数和设备清单。' },
    listedNotice: { en: 'Not in the CTL directory. WashU’s archived public course listings show {n} class sections meeting here, most recently in {year}. There are no photos or equipment details.', zh: '不在 CTL 目录里。WashU 旧版公开课表的存档显示，有 {n} 个班次在这里上过课，最近一次在 {year} 年。没有照片和设备信息。' },
    studyCard: { en: 'WashU ID card access', zh: '需刷 WashU ID' },
    studyBook: { en: 'Book on LibCal', zh: '去 LibCal 预约' },
    studyLive: { en: '{n} bookable rooms are free right now. Bookings from the Libraries’ LibCal page, read at {time}; St. Louis time.', zh: '现在有 {n} 间可预约的自习室空着。预约情况来自图书馆 LibCal 页面，读取于 {time}；时间均为圣路易斯当地时间。' },
    studyNotLive: { en: 'Live booking data is not available right now. Open a room’s LibCal page to see its bookings.', zh: '暂时拿不到实时预约数据，请打开各房间的 LibCal 页面查看。' },
    planCredit: { en: 'Floor plan: WashU Libraries', zh: '平面图来自 WashU 图书馆' },
    aboutBody1: { en: 'An unofficial student project that puts WashU’s classrooms and library study rooms on a 3D map of the Danforth Campus. It is not affiliated with or endorsed by Washington University in St. Louis.', zh: '非官方学生项目：把 WashU 的教室和图书馆自习室放到 Danforth 校区的 3D 地图上。本站与 Washington University in St. Louis 无隶属关系，也未获其背书。' },
    aboutClassrooms: { en: 'Classroom details, photos, seating charts and 360° tours: WashU Center for Teaching and Learning Classroom Directory. Photos stay on ctl.wustl.edu and belong to WashU.', zh: '教室信息、照片、座位图、360° 全景：WashU Center for Teaching and Learning 教室目录。照片仍托管在 ctl.wustl.edu，版权归 WashU。' },
    aboutCourses: { en: 'Courses: the Registrar’s public Class Schedule Search, which lists times and instructors but not rooms. Rooms outside the CTL directory come from WashU’s old public Course Listings (retired in 2025), as archived by the Internet Archive.', zh: '课程：教务处公开的 Class Schedule Search，只有时间和老师，没有上课教室。CTL 目录之外的教室来自 WashU 旧版公开课表（2025 年停用）在 Internet Archive 的存档。' },
    aboutStudy: { en: 'Study rooms: WashU Libraries’ study room directory. Bookings are read from the Libraries’ public LibCal pages about every 20 minutes; LibCal is the authority.', zh: '自习室：WashU 图书馆的自习室目录。预约情况约每 20 分钟从图书馆公开的 LibCal 页面读取一次，以 LibCal 为准。' },
    aboutFloors: { en: 'Floors are inferred from room numbers. Building heights and the floor stack are for display, not survey data.', zh: '楼层由房间号推断；建筑高度和楼层分解仅用于展示，并非实测。' },
    aboutSchedule: { en: 'Class meetings by room: read from Workday’s Find Course Sections by a signed-in student. Classes only — no exams, events or one-off bookings.', zh: '各教室的上课时间：由登录的学生从 Workday 的 Find Course Sections 读取。只有课程，不含考试、活动和临时借用。' },
    aboutCredit: { en: 'Inspired by the UCSD Classroom Explorer by zhenzhenfufu, wenhaoquestion and SheepTester.', zh: '灵感来自 zhenzhenfufu、wenhaoquestion 与 SheepTester 的 UCSD Classroom Explorer。' },
    studySource: { en: 'Study room details:', zh: '自习室信息来自：' }
  }
}
