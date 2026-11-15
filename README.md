# WashU Classroom Explorer

**English** | [简体中文](README.zh-CN.md)

A 3D map of the WashU Danforth Campus for finding a room: the library study rooms with their live bookings, and every classroom we can find a public record of — where it is, how many people it seats, what equipment it has, what it looks like, and roughly what you would see from a given seat.

**[Open the site](https://yuanshengbo8-sketch.github.io/washu-classrooms/)** · **[Olin Library study rooms](https://yuanshengbo8-sketch.github.io/washu-classrooms/?b=olin-library)** · **[Simon Hall](https://yuanshengbo8-sketch.github.io/washu-classrooms/?b=simon-hall)** · **[Brown 100](https://yuanshengbo8-sketch.github.io/washu-classrooms/?r=brown-100)**

This is an unofficial student project. It is not affiliated with or endorsed by Washington University in St. Louis.

## What it does

- **Study rooms with live bookings.** The 34 study spaces WashU Libraries list, in Olin Library and the business, art and East Asian libraries. The ones that can be booked show whether they are free right now and until when, a strip of today's and tomorrow's bookings, and a button to the room's LibCal booking page. The rest are marked walk-in, graduate-only and so on. Olin Library’s rooms are pinned on the floor plans the Libraries publish for its five levels. Buildings that have study rooms but no classrooms have green roofs.
- **Which classrooms have no class right now.** For 283 classrooms the site knows this term's weekly class meetings. A room's page shows the week as bars and says whether a class is in it now and until when; room lists carry the same label, and "No class now" is a filter in Find a room. It shows when a room is in use, not which course is using it.
- **3D campus map.** The whole Danforth Campus is drawn from OpenStreetMap: buildings with roofs and window bays, the 1,600 mapped campus trees, lawns, plazas, courts, parking and named streets. Buildings with classrooms have red roofs and a label with their room count. Drag to move, scroll to zoom, right-drag to rotate.
- **Floor stack.** Selecting a building splits it into floors. Floors with classrooms are red and show a count; clicking a floor filters the room list. Floors come from room numbers, so no room is placed at a made-up position.
- **Rooms beyond the CTL directory.** Schools such as Olin, Law, Sam Fox and McKelvey schedule their own classrooms, so the CTL directory leaves them out (Simon Hall's first floor, Bauer, Anheuser-Busch, Urbauer, Bixby and others). Those rooms are added from WashU's old public Course Listings as archived by the Internet Archive: about 350 rooms in 51 buildings in all. They have no photos; the page says where each one comes from and how recently a class met there.
- **Labels coloured by school.** Each building label takes the colour of the school it belongs to (Arts & Sciences, McKelvey, Olin, Sam Fox, Brown School, Law, Libraries, campus life), with a key on the map. The assignment is in `src/lib/schools.ts`.
- **Classroom pages.** Capacity, seating style, boards, projection screens, microphones, room darkening, accessibility, the equipment list, photos, the seating chart, and a link to the 360° room tour where CTL has one.
- **Seat view.** Pick any seat in a schematic of the room and look at the board from it, with the distance, the angle off centre and a slide with text at several sizes. The schematic is generated from the seat count and seating style. It is not the real room; the photos and 360° tour are.
- **Find a room.** Filter by minimum capacity, seating style, wheelchair access, 360° tour and equipment. The map dims buildings with no match and relabels the rest with their matching count.
- **Search.** Buildings, rooms (`seigle 301`, `eads204`), courses and instructors for Fall 2026 and Spring 2027.
- **Saved rooms, share links, walking directions.** Saved rooms stay in your browser. Every building and room has its own URL.
- **English and 中文.** Building names, course titles and instructor names stay as WashU writes them.

## What it cannot do yet

WashU does not publish which room a course section meets in:

- The Registrar's public [Class Schedule Search](https://registrar.washu.edu/classes-registration/class-schedule-search/) lists day, time, instructor and enrollment, with no location.
- Room assignments live in Workday and in the reservation system at reserve.wustl.edu, both behind WashU Key login.

- The old public Course Listings did give rooms, which is where the extra rooms here come from, but they stopped in 2025 and the archive holds only part of each term. That is enough to know a room exists, not to say it is free.

So the classroom schedule here comes from a signed-in student reading Workday's Find Course Sections report (see [Data and accuracy](#data-and-accuracy)), and only the times a room is in use are published. Course search still shows times and instructors without rooms. The schedule has classes only: exams, review sessions, events and one-off bookings are missing, and a room with no class may be locked. About 20 rooms that hold a few classes this term are not on the site yet.

Olin Business School's group study rooms are booked at reserve.wustl.edu behind WashU Key, so the site links to that page and does not show their bookings.

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
npm run data:osm                 # OpenStreetMap buildings, paths, trees and green space
npm run data:archive             # archived Course Listings from the Internet Archive (over an hour), then data/listing-rooms.json
npm run data:study               # library study rooms and their LibCal booking pages
npm run data:build               # writes classrooms.json and campus.json
npm run data:schedule            # writes schedule.json from data/raw/workday/sections.json (see below)

npm run data:courses -- "2026 Fall"     # writes courses-2026F.json
npm run data:courses -- "2027 Spring"   # writes courses-2027S.json
```

`data:schedule` needs a list of this term's sections with their rooms, which only Workday has. A signed-in student opens the Find Course Sections report, filters it to the term and the Danforth Campus, and saves the rows as `data/raw/workday/sections.json` in the shape described at the top of [`scripts/build-schedule.mjs`](scripts/build-schedule.mjs). That file stays out of the repository. Term dates and no-class days are set in the same script.

To add a term, run `data:courses` for it and add it to `TERMS` in `src/App.tsx`.

### Live study-room bookings

`.github/workflows/study-availability.yml` runs every 20 minutes during the day. It reads the public LibCal booking grid (three requests, ten seconds apart, no login) and pushes one JSON file to the `live-data` branch, which the site loads. Disable the workflow under Actions to stop it; the site then says live data is unavailable and still links to LibCal. `npm run data:availability` writes the same file locally.

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

## Shared core

The same code runs the classroom maps for other campuses. Everything listed in [`shared.json`](shared.json) (the React app, the 3D scene, the map builder in `scripts/lib/`, the workflows) is identical in every campus repository; what belongs to this campus is `src/campus.ts`, `src/lib/schools.ts`, `campus.data.json`, `index.html`, the data and the data scripts. After changing a shared file, copy it to the other repository:

```sh
node scripts/sync-shared.mjs ../ucd-classrooms           # copy
node scripts/sync-shared.mjs ../ucd-classrooms --check   # only list differences
```

## Data and accuracy

- **Classrooms:** the [CTL Classroom Directory](https://ctl.wustl.edu/classrooms/), 129 rooms in 31 buildings. It covers the pooled classrooms the Registrar schedules. Photos, seating charts and 360° tours are linked from ctl.wustl.edu and remain WashU's.
- **Other rooms:** WashU's public Course Listings (courses.wustl.edu and acadinfo.wustl.edu/CourseListings, retired in 2025), read from the [Internet Archive](https://web.archive.org/). A room is added when at least two archived class sections met in it. The seat figure shown for these rooms is the largest class listed there, a lower bound rather than the capacity. `data/listing-rooms.json` is the condensed list; `data/extra-rooms.json` holds a few rooms added by hand.
- **Study rooms:** [WashU Libraries' study room directory](https://library.washu.edu/study-rooms/) and the Libraries' public [LibCal](https://wustl.libcal.com/allspaces) booking pages. Bookings are a copy up to 20 minutes old; LibCal is the authority, and booking happens there. The Olin Library floor plans are the Libraries’ own images, loaded from library.washu.edu (or the Internet Archive’s copy when that is slow); `data/study-room-spots.json` records where each room’s label sits on them, read off by hand.
- **Class schedule by room:** Workday's Find Course Sections report for Fall 2026 on the Danforth Campus, read by a signed-in student on 2026-11-15. WashU shows room assignments only to signed-in members of the university, so `schedule.json` keeps just room, days and times, with no course or instructor. It is a snapshot: later room changes are not picked up, and no-class days follow the Registrar's academic calendar.
- **Courses:** the Registrar's public Class Schedule Search. It says it refreshes every 48 hours and is not meant for real-time accuracy; the copy here is a snapshot from the date in each file.
- **Building photos:** exterior photos for 15 buildings come from [Wikimedia Commons](https://commons.wikimedia.org/) under the licence shown with each one; they are loaded from Commons, not copied. `data/building-photos.json` lists them, each checked by eye. Every building also links to Google Street View.
- **Map:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL. Trees on campus are the ones mapped there; the trees in the surrounding neighbourhoods, the roof shapes and the windows are generated for looks.
- **Floors and heights:** floors are inferred from room numbers (`L006`, `G052` and numbers below 100 are the lower level; `301` is floor 3; the engineering buildings' four-digit numbers start with the floor, so `2101` is floor 2). Building heights use OpenStreetMap tags where they exist and an estimate otherwise. The floor stack is a display, not a survey.

## Credits and license

Inspired by the [UCSD Classroom Explorer](https://github.com/zhenzhenfufu/ucsd-classrooms) maintained by [@zhenzhenfufu](https://github.com/zhenzhenfufu), which builds on work by [@wenhaoquestion](https://github.com/wenhaoquestion) and [SheepTester](https://github.com/SheepTester/ucsd-classrooms). The WashU version is written from scratch around WashU's data.

Code is under the [MIT License](LICENSE). Map data, photos and course data belong to their sources.
