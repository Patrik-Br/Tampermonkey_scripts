# HOT Tasking Manager userscripts

Small browser userscripts that add features to the [HOT Tasking Manager](https://tasks.hotosm.org). Each one is a stopgap for an open Tasking Manager issue and can be removed once that issue is fixed upstream.

Both scripts work on the live site ([tasks.hotosm.org](https://tasks.hotosm.org)) and on staging ([tasks-stage.hotosm.org](https://tasks-stage.hotosm.org)).

| Script | What it does | Upstream issue |
| --- | --- | --- |
| [Mapping-type icons on project cards](#mapping-type-icons-on-project-cards) | Shows what objects are required to be mapped on the project card | [#5568](https://github.com/hotosm/tasking-manager/issues/5568) |
| [Stop validating individual tasks](#stop-validating-individual-tasks) | During multivalidation adds a new button to stop validating specific task | [#5618](https://github.com/hotosm/tasking-manager/issues/5618) |

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension for your browser. 
2. Click an install link below. Tampermonkey opens the script and asks you to confirm the installation.
   - [Install: Mapping-type icons on project cards](https://raw.githubusercontent.com/Patrik-Br/Tampermonkey_scripts/main/tm-explore-mapping-icons.user.js)
   - [Install: Stop validating individual tasks](https://raw.githubusercontent.com/Patrik-Br/Tampermonkey_scripts/main/tm-partial-stop-validation.user.js)
3. Reload the Tasking Manager tab or restart your browser.

Tampermonkey checks this repository for new versions and updates installed scripts automatically.

To turn a script off, disable it in the Tampermonkey dashboard. To remove it, delete it there.

## Mapping-type icons on project cards

**File:** [`tm-explore-mapping-icons.user.js`](tm-explore-mapping-icons.user.js)

The project page shows which mapping types a project covers (roads, buildings, waterways, land use, other). The project cards on Explore projects and Manage (if you are one of the project managers). This script adds the same five icons to every project card, on the same row as the difficulty ("Easy", "Moderate", "Challenging"):

### How it works and how much it asks of the server

The project list doesn't include mapping types, so the script requests each project's summary from the Tasking Manager API (`/projects/<id>/queries/summary/`). It keeps the requests to a minimum:

- A card's summary is requested only when the card scrolls into view.
- At most 4 requests run at the same time.
- Results are cached in your browser for 24 hours, so going back to a page or reloading it doesn't repeat the requests.

Browsing one page of projects costs about as much as opening one or two project pages.

## Stop validating individual tasks

**File:** [`tm-partial-stop-validation.user.js`](tm-partial-stop-validation.user.js)

When you validate several tasks at once (multivalidation), Tasking Manager only lets you stop validating all of them together. This script adds a third option to each task:

> Stop validating (keep its current status)

When you submit:

- tasks marked *Stop validating* are released and keep the status they had before, together with any comment you wrote
- all other tasks are validated or invalidated as usual

Notes:

- The option appears only when you validate 2 or more tasks. For a single task, use Tasking Manager's own *Stop validation* button.
- The *Valid* / *Invalid* choice for all tasks (shown for more than 3 tasks) cancels every *Stop validating* choice.

### How it works and how much it asks of the server

When you click *Submit*, the script splits Tasking Manager's request into the two calls you would otherwise make by hand: *stop validation* for the stopped tasks, then *validate* for the rest. It uses Tasking Manager's own API with your own login and makes no other requests.

If the first call succeeds and the second one fails, the stopped tasks are already released. They are then shown as "Validation stopped, task released" and are left out when you submit again.

## Privacy

The scripts talk only to the Tasking Manager API of the site you are on, and only with your own login. Nothing is sent anywhere else, and nothing is collected.