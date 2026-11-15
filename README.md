# Granville Baptist Church

This site uses GitHub Pages with its existing Jekyll configuration. Upload the replacement files and the six new files using the folders in the download. GitHub Pages builds the site after the files are committed.

Routine updates are made in the following files.

| File | Content to edit |
| --- | --- |
| `church/events.csv` | Weekly meetings, monthly fellowship, dated events, times, and cancellations |
| `church/news.csv` | Church announcements and their active status |
| `church/verseoftheweek.csv` | The weekly verse and its reference |
| `church/church-info.csv` | Address, phone, email, visitor information, social links, and optional display labels |
| `homepage.md` | Home welcome, tagline, and location line in the fields between the first two `---` lines |
| `church/about.md` | The three Our Church summaries and the longer Jesus Christ message |
| `photos/gallery/photos.json` | The ordered list of photographs to display |

The public pages are `/index.html`, `/church/about.html`, `/church/contact.html`, `/church/news.html`, `/church/calendar.html`, and `/photos/`. The previous `/church/social.html` address forwards to Visit & Contact.

Events use five comma-separated fields in this order.

| Field | Value |
| --- | --- |
| Status | `active`, `inactive`, `cancelled`, or `cancel` |
| When | A weekday, a monthly rule, or a date such as `11/15/26` |
| Time | A time such as `06:30 PM`, or an empty field |
| Title | The event name |
| Regular schedule | `yes` for a regular event in the service schedule, or `no` for calendar-only events |

A weekly entry can read `active, Wednesday, 06:30 PM, Bible Study, yes`. Monthly rules include `1st Sunday`, `last Saturday`, and `2nd & 4th & 5th Sunday`. A one-time event uses a date and `no` in the last field.

To cancel one meeting, keep the weekly entry active and add `cancel, 11/04/26, , Bible Study, no`. The title must match the ordinary event. An empty time cancels matching events with that title on that date. Supply a time to select one occurrence when that title is used more than once. The usual weekly schedule continues to display its regular time. A dated notice appears on Home and Visit & Contact during the rolling upcoming period.

`inactive` and `cancelled` display an event as canceled. Remove a row when it should no longer appear on its date. One-time events use `no` for the regular schedule field. The calendar, upcoming list, and home rotation share this event data.

News uses `active, Title, Body` or `h, active, Title, Body`. The `h` gives an announcement priority in the home rotation. Change `active` to `inactive` to remove it from display. The Events & News page shows every active announcement. The home rotation shows up to ten combined news and event cards before returning to the weekly verse.

The verse file uses `Reference, "Verse text"`. Put quotes around any field containing a comma and use two double quotes to include a quotation mark inside a quoted field.

Church settings use one setting and one value per row. Blank social values keep their icons hidden. Enter the full HTTPS URL of each church account in `social.facebook`, `social.instagram`, `social.twitter` for X, `social.youtube`, or `social.spotify`. Generic social network home pages remain hidden. Address, phone, and email updates also update directions and contact links.

Edit `visitor.welcome` and `visitor.details` to change What to Expect. Put quotes around these values when they contain commas. `footer_sunday_note` supplies the fellowship message below Sunday times.

Optional event settings use the exact title from `events.csv` after the setting prefix.

| Setting prefix | Effect |
| --- | --- |
| `event_label.` | Shorter event name on the calendar and upcoming cards |
| `event_location.` | Venue shown with the event |
| `event_time.` | Description for an event whose CSV time is empty |
| `event_end_time.` | End time appended to the start time from `events.csv` |

For example, `event_end_time.Bible Study,8:00 PM` adds an end time while preserving the editable start time from the event row. A date can be inserted after the prefix to change one occurrence, such as `event_label.2026-11-15.Pot Blessing Fellowship After Sermon,Pot Blessing Lunch`.

Optional news settings use the exact news title. `news_label.` changes the displayed heading. `news_event.` contains the exact related event title so that the home rotation avoids repeating the same announcement and event. `news_date.` contains an ISO date such as `2026-11-15` and removes that announcement from the home rotation after its date. Its news-page visibility continues to follow the status in `news.csv`.

Upload new images into `photos/gallery/` and add their exact filenames in double quotes to `photos.json`. Separate filenames with commas, retain the square brackets, and match capitalization. Their order is the order in the photo slideshow and gallery.

To change the Our Church message, edit the paragraphs in `church/about.md`. The three summaries are the `columns` entries near the top. Keep the surrounding frontmatter and HTML tags in place.

The upcoming list includes today through seven days ahead using New York time and groups all events on each date together. Date windows refresh after midnight while a page is open. The verse stays visible for eight seconds, each update stays for six seconds, and photos advance every five seconds. Visitors whose device requests reduced motion see stationary content. The Events & News page remains available through a permanent link.

The source files and photographs already in the repository supply the remaining site dependencies. The download contains 19 replacements and six additions with no file deletions. The shared layout, data parsers, event and news CSVs, verse CSV, photo list, images, domain file, and Jekyll configuration remain available at their existing paths.

Development checks run with `node --test tests/*.test.mjs`. No package installation is required for these checks.
