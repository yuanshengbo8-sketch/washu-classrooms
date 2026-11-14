# WashU 教室地图

[English](README.md) | **简体中文**

把 WashU Danforth 校区做成一张 3D 地图，用来找地方自习和上课：图书馆自习室和它们的实时预约情况，以及所有能查到公开记录的教室——在哪栋楼哪一层、能坐多少人、有什么设备、长什么样，坐在某个位置大概能看到什么。

**[打开网站](https://yuanshengbo8-sketch.github.io/washu-classrooms/)** · **[Olin Library 自习室](https://yuanshengbo8-sketch.github.io/washu-classrooms/?b=olin-library)** · **[Simon Hall](https://yuanshengbo8-sketch.github.io/washu-classrooms/?b=simon-hall)** · **[Brown 100](https://yuanshengbo8-sketch.github.io/washu-classrooms/?r=brown-100)**

这是非官方的学生项目，与 Washington University in St. Louis 没有隶属关系，也未获其背书。

## 功能

- **自习室与实时预约：** WashU 图书馆列出的 34 处自习空间，分布在 Olin Library 以及商科、艺术、东亚图书馆。可预约的房间会显示现在是否空着、空到几点，今天和明天的预约时间条，以及直达该房间 LibCal 预约页的按钮；其余的标明先到先得、仅研究生等。Olin Library 的房间会标在图书馆公开的五层平面图上。只有自习室、没有教室的楼是绿色屋顶。
- **3D 校园地图：** 整个 Danforth 校区由 OpenStreetMap 生成：带屋顶和窗格的建筑、校内 1600 棵已测绘的树、草坪、广场、球场、停车场和带路名的道路。有教室的楼是红色屋顶，标签上写着教室数量。拖动平移，滚轮缩放，右键拖动旋转。
- **楼层分解：** 选中一栋楼后会按楼层拆开。有教室的楼层是红色并显示数量，点楼层可以筛选列表。楼层由房间号推断，不会把教室放到虚构的位置。
- **CTL 目录之外的教室：** Olin、Law、Sam Fox、McKelvey 等学院的教室由学院自己排课，所以 CTL 目录里没有（Simon Hall 一楼、Bauer、Anheuser-Busch、Urbauer、Bixby 等）。这些教室从 WashU 旧版公开课表在 Internet Archive 的存档里补齐：目前共约 350 间、51 栋楼。它们没有照片；页面会写明来源，以及最近一次有课是哪一年。
- **标签按学院分色：** 每栋楼的标签用所属学院的颜色（文理学院、McKelvey、Olin、Sam Fox、Brown School、法学院、图书馆、校园生活），地图左下角有图例。归属写在 `src/lib/schools.ts` 里。
- **教室详情：** 容量、座位形式、黑板、投影幕、麦克风、遮光效果、无障碍、设备清单、照片、座位图；CTL 提供 360° 全景的教室会有入口。
- **座位视角：** 在教室示意图里点任意座位，从那个位置看黑板，同时显示距离、偏离正中的角度，以及一张不同字号的幻灯片。示意图根据座位数和座位形式生成，不是真实教室；真实环境请看照片和 360° 全景。
- **找教室：** 按最少座位数、座位形式、无障碍、360° 全景和设备筛选。地图会把没有匹配教室的楼变淡，其余的楼显示匹配数量。
- **搜索：** 教学楼、教室（`seigle 301`、`eads204`），以及 Fall 2026 和 Spring 2027 的课程与老师。
- **收藏、分享链接、步行导航：** 收藏只保存在你的浏览器里。每栋楼、每间教室都有独立链接。
- **中文 / English：** 楼名、课程名、老师姓名保持 WashU 原文。

## 目前做不到的

这个项目参考的 UCSD 版本可以显示「现在哪间教室空着」。WashU 版本目前只对图书馆自习室做得到，因为 WashU 已不再公开每节课的上课教室：

- 教务处公开的 [Class Schedule Search](https://registrar.washu.edu/classes-registration/class-schedule-search/) 只有星期、时间、老师和选课人数，没有地点。
- 上课教室在 Workday 和 reserve.wustl.edu 里，两者都需要 WashU Key 登录。

- 旧版公开课表有上课教室，这里补充的教室就来自它；但它在 2025 年停用，存档也只覆盖每学期的一部分课程。这足以确认某间教室存在，不足以判断它现在空不空。

所以这里的课程搜索只显示时间和老师。如果 WashU 以后公开地点，或者有同学导出自己的 Workday 数据并愿意分享，就可以在现有数据上加教室课表和「现在空闲」。

Olin 商学院的小组自习室在 reserve.wustl.edu 预约，需要 WashU Key 登录，所以本站只给出入口，不显示预约情况。

## 本地运行

需要 Node.js 20 或更高版本。

```sh
git clone https://github.com/yuanshengbo8-sketch/washu-classrooms.git
cd washu-classrooms
npm ci
npm run dev
```

然后打开 http://localhost:5183/。

```sh
npm run build       # 类型检查并构建到 dist/
npm run preview     # 预览构建结果
```

## 更新数据

网站从 `public/data/` 读取三类 JSON。每类都有脚本把公开数据下载到 `data/raw/`（不提交到仓库），再由构建步骤生成。

```sh
npm run data:classrooms          # CTL 教室目录，按 robots.txt 要求每 10 秒一页（约 22 分钟）
npm run data:osm                 # OpenStreetMap 建筑、道路、树木、绿地
npm run data:archive             # Internet Archive 上的旧版课表存档（一小时以上），并生成 data/listing-rooms.json
npm run data:study               # 图书馆自习室及其 LibCal 预约页
npm run data:build               # 生成 classrooms.json 和 campus.json

npm run data:courses -- "2026 Fall"     # 生成 courses-2026F.json
npm run data:courses -- "2027 Spring"   # 生成 courses-2027S.json
```

新增学期：对该学期运行 `data:courses`，再把它加进 `src/App.tsx` 的 `TERMS`。

### 自习室实时预约

`.github/workflows/study-availability.yml` 白天每 20 分钟运行一次：读取 LibCal 公开的预约表（3 个请求，间隔 10 秒，无需登录），把一个 JSON 文件推送到 `live-data` 分支，网站从那里读取。在 Actions 里停用这个 workflow 即可关闭；关闭后网站会提示暂无实时数据，但仍保留 LibCal 链接。`npm run data:availability` 可以在本地生成同样的文件。

### 补充学院自管的教室

学院自己管理的教室手工维护在 [`data/extra-rooms.json`](data/extra-rooms.json)。添加一条记录：楼在 OpenStreetMap 里的名字、房间号、所属学院，以及一个提到该房间的公开页面，然后运行 `npm run data:build`。来源没给座位数和座位形式就不要填。欢迎提 Pull Request。

## 项目结构

| 路径 | 用途 |
| --- | --- |
| `src/three/campus.ts` | Three.js 校园场景：建筑拉伸、标签、点选、楼层分解 |
| `src/three/seatview.ts` | 座位视角：教室生成与第一人称镜头 |
| `src/components/` | React 界面：搜索、找教室、教学楼与教室面板、弹窗 |
| `src/lib/` | 类型、筛选、搜索、中英文、收藏、链接状态 |
| `scripts/` | 数据下载与构建脚本 |
| `public/data/` | 网站加载的 JSON |

使用 React 19、TypeScript、Three.js 和 Vite。3D 代码按需加载。没有服务器，也不需要 API 密钥：构建产物是静态文件，由 `.github/workflows/deploy.yml` 部署到 GitHub Pages。

## 数据与准确性

- **教室：** [CTL Classroom Directory](https://ctl.wustl.edu/classrooms/)，31 栋楼共 129 间教室，是教务处统一排课的公共教室。照片、座位图、360° 全景都链接自 ctl.wustl.edu，版权归 WashU。
- **其他教室：** WashU 旧版公开课表（courses.wustl.edu 与 acadinfo.wustl.edu/CourseListings，2025 年停用），取自 [Internet Archive](https://web.archive.org/) 的存档。存档里至少有两个班次在某房间上课，才会收录这间房。这些房间显示的座位数是在那里排过的最大班级名额，是下限而不是实际容量。`data/listing-rooms.json` 是汇总后的清单；`data/extra-rooms.json` 是少量手工补充的房间。
- **自习室：** [WashU 图书馆自习室目录](https://library.washu.edu/study-rooms/) 和图书馆公开的 [LibCal](https://wustl.libcal.com/allspaces) 预约页。预约情况是最多滞后 20 分钟的副本，以 LibCal 为准，预约也在 LibCal 完成。Olin Library 的平面图是图书馆自己的图片，从 library.washu.edu 加载（太慢时改用 Internet Archive 的副本）；`data/study-room-spots.json` 记录每间房的标签在图上的位置，是人工对照图读出来的。
- **课程：** 教务处公开的 Class Schedule Search。官方说明每 48 小时刷新一次，不保证实时准确；这里是各文件所标日期的快照。
- **建筑照片：** 15 栋楼的外观照片来自 [Wikimedia Commons](https://commons.wikimedia.org/)，按各自标注的许可使用，从 Commons 直接加载、不做拷贝。清单在 `data/building-photos.json`，每张都人工核对过。每栋楼另有 Google 街景链接。
- **地图：** © [OpenStreetMap](https://www.openstreetmap.org/copyright) 贡献者，ODbL。校内的树是 OpenStreetMap 上已测绘的；周边街区的树、屋顶形状和窗户是为了好看而生成的。
- **楼层和高度：** 楼层由房间号推断（`L006`、`G052` 和小于 100 的号码算底层，`301` 算 3 楼；工学院几栋楼的四位房间号以楼层开头，`2101` 算 2 楼）。建筑高度优先用 OpenStreetMap 的标注，没有则估算。楼层分解只用于展示，不是实测。

## 致谢与许可

灵感来自 [@zhenzhenfufu](https://github.com/zhenzhenfufu) 维护的 [UCSD Classroom Explorer](https://github.com/zhenzhenfufu/ucsd-classrooms)，它建立在 [@wenhaoquestion](https://github.com/wenhaoquestion) 和 [SheepTester](https://github.com/SheepTester/ucsd-classrooms) 的工作之上。WashU 版本围绕 WashU 的数据从头编写。

代码采用 [MIT 许可证](LICENSE)。地图、照片和课程数据归各自来源所有。
