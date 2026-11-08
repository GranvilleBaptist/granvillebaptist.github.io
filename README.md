# Editing the church website

Routine updates belong in these content files. The website publishes automatically after changes are saved to the main branch on GitHub.

| File | What to edit |
| --- | --- |
| `church/events.csv` | Meetings, special events, individual cancellations, and footer schedules |
| `church/news.csv` | Announcements and homepage highlights |
| `church/verseoftheweek.csv` | The weekly Bible reference and verse |
| `church/church-info.csv` | Address, phone, email, social links, and optional footer labels |
| `homepage.md` | Welcome text, the three introductory sections, and the longer message about Jesus |
| `photos/gallery/photos.json` | Gallery image filenames, in display order |

Lines beginning with `#` in CSV files are notes, not public content. Put quotation marks around a field that contains commas. Keep each event or announcement on its own line; quoted text can also span lines when needed.

## Events and the footer

Each event has five fields:

```csv
# Status, day or date, time, title, show_in_footer
active, Sunday, 08:30 AM, Sunday School, yes
active, Thursday, 06:00 PM, Corporate Prayer, yes
active, 11/15/26, , "Special dinner, games and fellowship", no
```

- `yes` includes an active recurring event in both the calendar and the regular footer schedule.
- `no` keeps an event in the calendar only. A missing final field also defaults to `no`.
- Only recurring events can be marked `yes`. One-time events use `no`.
- Sunday footer entries appear under Sunday Services. Other selected recurring entries appear under Weekly Activities.
- A blank time is allowed. A supplied time must look like `08:30 AM` or `6:30 PM`.
- Use a weekday for weekly meetings; use a rule such as `1st Sunday`, `last Saturday`, or `2nd & 4th & 5th Sunday` for monthly meetings.
- Dates use `MM/DD/YY` or `MM/DD/YYYY`.
- `active` schedules an event. `inactive` or `cancelled` displays it as cancelled in the calendar and leaves it out of the footer.

Keep the format notes at the top of the file. Invalid entries show the filename and line needing attention.

### Cancel only one meeting

Leave the ordinary weekly entry active and add a dated cancellation:

```csv
active, Wednesday, 06:30 PM, Bible Study, yes
cancel, 11/04/26, , Bible Study, no
```

The title must match the recurring event. This marks only the November 4 occurrence cancelled, keeps other Wednesdays active, and retains the normal weekly footer schedule. A blank override time matches that title on the specified date; enter a time to select one meeting when the title appears more than once.

### Optional footer labels

The footer normally uses the event's own title. `church/church-info.csv` can provide a shorter label without changing its calendar title:

```csv
footer_label.Thursday.Corporate Prayer, Thursday Prayer
```

The setting name contains the exact day/rule and event title. If you rename an event, update its optional label setting as well. The footer's time always comes from `events.csv`.

## News and the weekly verse

News entries use status, title, and body. Prefix an entry with `h` to prioritize it in the three homepage highlight positions:

```csv
h, active, Upcoming fellowship, "Join us for lunch, conversation and prayer."
inactive, Previous announcement, This announcement is hidden.
```

The News page shows every active announcement in file order. The homepage uses active highlighted entries first, then fills remaining positions with other active entries. Fewer than three announcements leave no old placeholder stories behind.

The verse file uses reference and verse text:

```csv
Hebrews 10:23, "Let us hold fast the profession of our faith without wavering; for He is faithful that promised."
```

## Homepage and photographs

In `homepage.md`, edit the welcome, tagline, and column text above the second `---` line; keep the existing indentation. Edit the longer message below that line as ordinary paragraphs. A line starting `##` is a heading. Leave `layout`, `permalink`, and `page_type` in place.

Upload gallery images into `photos/gallery/` and add their exact filenames to `photos.json`. Capitalization matters: `img1.JPG` and `img1.jpg` are different filenames. The first filename is shown first, and photos rotate every five seconds. Visitors who request reduced motion see a stationary first slide.

## Code and layout maintenance

The four pages share `_layouts/default.html` and the header/footer in `_includes/`. The home page uses `_layouts/home.html`; its published address remains `/index.html`. GitHub Pages builds these templates with its built-in Jekyll support.

The original appearance is defined by `styles.css`. Shared browser modules live in `assets/js/`: CSV loading/validation, event rules, calendar rendering, news/verse rendering, carousel/gallery behavior, and site-wide contact/footer updates. Routine content editing does not require changing these files.

Developer checks require Node.js and no installed packages:

```sh
node --test tests/*.test.mjs
```
