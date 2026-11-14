# WashU Classroom Explorer

**English** | [简体中文](README.zh-CN.md)

A 3D map of the WashU Danforth Campus that shows every classroom in the CTL Classroom Directory: where it is, how many people it seats, what equipment it has, what it looks like, and roughly what you would see from a given seat.

**[Open the site](https://yuanshengbo8-sketch.github.io/washu-classrooms/)** · **[Seigle Hall](https://yuanshengbo8-sketch.github.io/washu-classrooms/?b=seigle-hall)** · **[Brown 100](https://yuanshengbo8-sketch.github.io/washu-classrooms/?r=brown-100)**

This is an unofficial student project. It is not affiliated with or endorsed by Washington University in St. Louis.

## What it does

- **3D campus map.** The whole Danforth Campus is drawn from OpenStreetMap footprints. Buildings with classrooms are WashU red and carry a label with their classroom count. Drag to move, scroll to zoom, right-drag to rotate.
- **Floor stack.** Selecting a building splits it into floors. Floors with classrooms are red and show a count; clicking a floor filters the room list. Floors come from room numbers, so no room is placed at a made-up position.
- **Every teaching building is labelled.** Schools such as Olin, Law, Sam Fox and McKelvey schedule their own classrooms (Bauer, Knight, Anheuser-Busch, Givens, Green and others), and WashU publishes no list of those rooms. These buildings are labelled and can be opened; they show the few rooms a public WashU page names, and say plainly that the list is incomplete.
- **Classroom pages.** Capacity, seating style, boards, projection screens, microphones, room darkening, accessibility, the equipment list, photos, the seating chart, and a link to the 360° room tour where CTL has one.
- **Seat view.** Pick any seat in a schematic of the room and look at the board from it, with the distance, the angle off centre and a slide with text at several sizes. The schematic is generated from the seat count and seating style. It is not the real room; the photos and 360° tour are.
- **Find a room.** Filter by minimum capacity, seating style, wheelchair access, 360° tour and equipment. The map dims buildings with no match and relabels the rest with their matching count.
- **Search.** Buildings, rooms (`seigle 301`, `eads204`), courses and instructors for Fall 2026 and Spring 2027.
- **Saved rooms, share links, walking directions.** Saved rooms stay in your browser. Every building and room has its own URL.
- **English and 中文.** Building names, course titles and instructor names stay as WashU writes them.

## What it cannot do yet

The reference project this is modelled on shows which rooms are free right now. This one does not, because WashU does not publish which room a course section meets in:

- The Registrar's public [Class Schedule Search](https://registrar.washu.edu/classes-registration/class-schedule-search/) lists day, time, instructor and enrollment, with no location.
- Room assignments live in Workday and in the reservation system at reserve.wustl.edu, both behind WashU Key login.

So course search here shows times and instructors only. If WashU publishes locations, or a student exports their own Workday data and chooses to share it, room schedules and a "free now" view can be added on top of the existing data.

## Run it locally

Needs Node.js 20 or newer.

```sh
git clone https://github.com/yuanshengbo8-sketch/washu-classrooms.git
cd washu-classrooms
npm ci
npm run dev
```

Then open http://localhost:5183/.

```sh
npm run build       # type-check and build into dist/
npm run preview     # serve the build
```

## Refresh the data

The site reads three kinds of JSON from `public/data/`. Each has a script that downloads the public source into `data/raw/` (not committed) and a build step.

```sh
npm run data:classrooms          # CTL Classroom Directory pages, 10 s apart as robots.txt asks (about 22 minutes)
npm run data:osm                 # OpenStreetMap buildings, paths and green space
npm run data:build               # writes classrooms.json and campus.json

npm run data:courses -- "2026 Fall"     # writes courses-2026F.json
npm run data:courses -- "2027 Spring"   # writes courses-2027S.json
```

To add a term, run `data:courses` for it and add it to `TERMS` in `src/App.tsx`.

### Adding a school-managed classroom

Rooms that a school runs itself are listed by hand in [`data/extra-rooms.json`](data/extra-rooms.json). Add an entry with the building's OpenStreetMap name, the room number, the school, and a public page that names the room, then run `npm run data:build`. Leave `capacity` and `style` out unless the source gives them. Pull requests are welcome.

## How it is built

| Path | Purpose |
| --- | --- |
| `src/three/campus.ts` | Three.js campus scene: extruded footprints, labels, picking, the floor stack |
| `src/three/seatview.ts` | Seat-view room generator and first-person camera |
| `src/components/` | React UI: search, finder, building and room panels, dialogs |
| `src/lib/` | Types, filters, search, i18n, saved rooms, URL state |
| `scripts/` | Data download and build scripts |
| `public/data/` | The JSON the site loads |

React 19, TypeScript, Three.js and Vite. The 3D code is loaded on demand. There is no server and no API key: the build is static files, deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Data and accuracy

- **Classrooms:** the [CTL Classroom Directory](https://ctl.wustl.edu/classrooms/), 129 rooms in 31 buildings. It covers the pooled classrooms the Registrar schedules, not rooms a school runs itself; a handful of those are added from `data/extra-rooms.json`, each with its source. Photos, seating charts and 360° tours are linked from ctl.wustl.edu and remain WashU's.
- **Courses:** the Registrar's public Class Schedule Search. It says it refreshes every 48 hours and is not meant for real-time accuracy; the copy here is a snapshot from the date in each file.
- **Map:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL.
- **Floors and heights:** floors are inferred from room numbers (`L006`, `G052` and numbers below 100 are the lower level; `301` is floor 3). Building heights use OpenStreetMap tags where they exist and an estimate otherwise. The floor stack is a display, not a survey.

## Credits and license

Inspired by the [UCSD Classroom Explorer](https://github.com/zhenzhenfufu/ucsd-classrooms) maintained by [@zhenzhenfufu](https://github.com/zhenzhenfufu), which builds on work by [@wenhaoquestion](https://github.com/wenhaoquestion) and [SheepTester](https://github.com/SheepTester/ucsd-classrooms). The WashU version is written from scratch around WashU's data.

Code is under the [MIT License](LICENSE). Map data, photos and course data belong to their sources.
