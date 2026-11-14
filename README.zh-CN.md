# WashU 教室地图

[English](README.md) | **简体中文**

把 WashU Danforth 校区做成一张 3D 地图，显示 CTL 教室目录里的每一间教室：在哪栋楼哪一层、能坐多少人、有什么设备、长什么样，以及坐在某个位置大概能看到什么。

**[打开网站](https://yuanshengbo8-sketch.github.io/washu-classrooms/)** · **[Seigle Hall](https://yuanshengbo8-sketch.github.io/washu-classrooms/?b=seigle-hall)** · **[Brown 100](https://yuanshengbo8-sketch.github.io/washu-classrooms/?r=brown-100)**

这是非官方的学生项目，与 Washington University in St. Louis 没有隶属关系，也未获其背书。

## 功能

- **3D 校园地图：** 整个 Danforth 校区由 OpenStreetMap 建筑轮廓生成。有教室的楼是 WashU 红色，标签上写着教室数量。拖动平移，滚轮缩放，右键拖动旋转。
- **楼层分解：** 选中一栋楼后会按楼层拆开。有教室的楼层是红色并显示数量，点楼层可以筛选列表。楼层由房间号推断，不会把教室放到虚构的位置。
- **教室详情：** 容量、座位形式、黑板、投影幕、麦克风、遮光效果、无障碍、设备清单、照片、座位图；CTL 提供 360° 全景的教室会有入口。
- **座位视角：** 在教室示意图里点任意座位，从那个位置看黑板，同时显示距离、偏离正中的角度，以及一张不同字号的幻灯片。示意图根据座位数和座位形式生成，不是真实教室；真实环境请看照片和 360° 全景。
- **找教室：** 按最少座位数、座位形式、无障碍、360° 全景和设备筛选。地图会把没有匹配教室的楼变淡，其余的楼显示匹配数量。
- **搜索：** 教学楼、教室（`seigle 301`、`eads204`），以及 Fall 2026 和 Spring 2027 的课程与老师。
- **收藏、分享链接、步行导航：** 收藏只保存在你的浏览器里。每栋楼、每间教室都有独立链接。
- **中文 / English：** 楼名、课程名、老师姓名保持 WashU 原文。

## 目前做不到的

这个项目参考的 UCSD 版本可以显示「现在哪间教室空着」，WashU 版本暂时不行，原因是 WashU 没有公开每节课的上课教室：

- 教务处公开的 [Class Schedule Search](https://registrar.washu.edu/classes-registration/class-schedule-search/) 只有星期、时间、老师和选课人数，没有地点。
- 上课教室在 Workday 和 reserve.wustl.edu 里，两者都需要 WashU Key 登录。

所以这里的课程搜索只显示时间和老师。如果 WashU 以后公开地点，或者有同学导出自己的 Workday 数据并愿意分享，就可以在现有数据上加教室课表和「现在空闲」。

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
npm run data:osm                 # OpenStreetMap 建筑、道路、绿地
npm run data:build               # 生成 classrooms.json 和 campus.json

npm run data:courses -- "2026 Fall"     # 生成 courses-2026F.json
npm run data:courses -- "2027 Spring"   # 生成 courses-2027S.json
```

新增学期：对该学期运行 `data:courses`，再把它加进 `src/App.tsx` 的 `TERMS`。

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

- **教室：** [CTL Classroom Directory](https://ctl.wustl.edu/classrooms/)，31 栋楼共 129 间教室。照片、座位图、360° 全景都链接自 ctl.wustl.edu，版权归 WashU。
- **课程：** 教务处公开的 Class Schedule Search。官方说明每 48 小时刷新一次，不保证实时准确；这里是各文件所标日期的快照。
- **地图：** © [OpenStreetMap](https://www.openstreetmap.org/copyright) 贡献者，ODbL。
- **楼层和高度：** 楼层由房间号推断（`L006`、`G052` 和小于 100 的号码算地下层，`301` 算 3 楼）。建筑高度优先用 OpenStreetMap 的标注，没有则估算。楼层分解只用于展示，不是实测。

## 致谢与许可

灵感来自 [@zhenzhenfufu](https://github.com/zhenzhenfufu) 维护的 [UCSD Classroom Explorer](https://github.com/zhenzhenfufu/ucsd-classrooms)，它建立在 [@wenhaoquestion](https://github.com/wenhaoquestion) 和 [SheepTester](https://github.com/SheepTester/ucsd-classrooms) 的工作之上。WashU 版本围绕 WashU 的数据从头编写。

代码采用 [MIT 许可证](LICENSE)。地图、照片和课程数据归各自来源所有。
