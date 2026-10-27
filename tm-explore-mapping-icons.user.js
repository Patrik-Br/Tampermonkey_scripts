// ==UserScript==
// @name         TM: mapping-type icons on project cards
// @namespace    https://github.com/Patrik-Br
// @homepageURL  https://github.com/Patrik-Br/Tampermonkey_scripts
// @updateURL    https://raw.githubusercontent.com/Patrik-Br/Tampermonkey_scripts/main/tm-explore-mapping-icons.user.js
// @downloadURL  https://raw.githubusercontent.com/Patrik-Br/Tampermonkey_scripts/main/tm-explore-mapping-icons.user.js
// @version      1.0.0
// @description  Shows each project's mapping types (roads, buildings, waterways, land use, other) on Tasking Manager project cards, e.g. on Explore projects. Workaround for hotosm/tasking-manager#5568.
// @match        https://tasks.hotosm.org/*
// @match        https://tasks-stage.hotosm.org/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Each Tasking Manager site has its own API.
  const API = {
    'tasks.hotosm.org': 'https://tasking-manager-production-api.hotosm.org/api/v2/',
    'tasks-stage.hotosm.org': 'https://tasking-manager-staging-api.hotosm.org/api/v2/',
  }[location.hostname];
  const MAX_PARALLEL = 4;
  const STORAGE_PREFIX = 'tmus-mapping-types-';
  const CACHE_TTL = 24 * 60 * 60 * 1000; // mapping types rarely change after a project is set up

  // Same icons and order as the project page (frontend/src/components/mappingTypes.js and svgIcons/).
  const TYPES = [
    {
      value: 'ROADS',
      title: 'Roads',
      viewBox: '0 0 19 26',
      paths: [
        'M0 .5v24.671h18.44V.5H0zm8.497 19.595v3.63H4.462V1.945h4.035v4.113h1.446V1.946h4.035v21.78H9.943v-3.631H8.497zM1.446 1.945h1.57v21.78h-1.57V1.945zm15.549 21.78h-1.571V1.945h1.57v21.78z',
        'M8.497 7.835h1.446v4.353H8.497zM8.497 13.965h1.446v4.353H8.497z',
      ],
    },
    {
      value: 'BUILDINGS',
      title: 'Buildings',
      viewBox: '0 0 26 23',
      paths: [
        'M25.096 8.939l-2.948-2.024V1.737c0-.4-.323-.724-.721-.724h-3.513a.722.722 0 0 0-.721.724v1.777L13.357.878a.72.72 0 0 0-.82 0L.794 8.938a.725.725 0 0 0 .408 1.32c.14 0 .283-.04.407-.126l2.134-1.464v12.801c0 .4.323.723.721.723h16.964a.722.722 0 0 0 .72-.723V8.668l2.135 1.464a.716.716 0 0 0 1.002-.188.724.724 0 0 0-.188-1.005zM14.442 20.746h-2.994v-7.033h2.994v7.033zm6.264 0h-4.821V12.99c0-.4-.323-.723-.722-.723h-4.436a.722.722 0 0 0-.722.723v7.756h-4.82V7.678l7.76-5.327 7.76 5.327v13.068zm0-14.821l-2.07-1.421V2.46h2.07v3.465z',
      ],
    },
    {
      value: 'WATERWAYS',
      title: 'Waterways',
      viewBox: '0 0 25 18',
      paths: [
        'M.81 9.516c1.434 1.233 3.059 2.63 6.202 2.63 3.144 0 4.769-1.397 6.203-2.63 1.356-1.167 2.527-2.174 4.97-2.174 2.442 0 3.614 1.007 4.97 2.174a.945.945 0 0 0 1.335-.103.951.951 0 0 0-.103-1.339c-1.433-1.233-3.059-2.63-6.202-2.63-3.144 0-4.77 1.397-6.203 2.63-1.356 1.167-2.527 2.174-4.97 2.174-2.442 0-3.613-1.007-4.97-2.174a.945.945 0 0 0-1.334.103.951.951 0 0 0 .102 1.339z',
        'M.81 4.322c1.434 1.234 3.059 2.632 6.202 2.632 3.144 0 4.769-1.398 6.203-2.632 1.356-1.166 2.527-2.173 4.97-2.173 2.442 0 3.613 1.007 4.97 2.173a.945.945 0 0 0 1.335-.102.951.951 0 0 0-.103-1.339C22.953 1.648 21.328.25 18.185.25c-3.144 0-4.77 1.398-6.203 2.631-1.356 1.166-2.527 2.174-4.97 2.174-2.442 0-3.613-1.007-4.97-2.174a.945.945 0 0 0-1.334.103.951.951 0 0 0 .102 1.338zM24.387 13.267c-1.433-1.233-3.059-2.63-6.202-2.63-3.144 0-4.77 1.397-6.203 2.63-1.356 1.167-2.527 2.174-4.97 2.174-2.442 0-3.613-1.007-4.97-2.174a.945.945 0 0 0-1.334.103.951.951 0 0 0 .102 1.339c1.434 1.233 3.059 2.63 6.202 2.63 3.144 0 4.769-1.397 6.203-2.63 1.356-1.167 2.527-2.174 4.97-2.174 2.442 0 3.614 1.007 4.97 2.174a.945.945 0 0 0 1.335-.103.951.951 0 0 0-.103-1.339z',
      ],
    },
    {
      value: 'LAND_USE',
      title: 'Land use',
      viewBox: '0 0 25 23',
      paths: [
        'M24.457 15.579l-11.225-5.007V8.136l1.029-1.03h3.524a.784.784 0 0 0 .783-.784V.784A.784.784 0 0 0 17.785 0H7.215a.784.784 0 0 0-.783.784v5.538c0 .432.35.783.783.783h3.51l1.043 1.033v2.434L.543 15.579a.918.918 0 0 0 0 1.675l11.584 5.167a.915.915 0 0 0 .746 0l11.584-5.167a.918.918 0 0 0 0-1.675zm-7.729 3.516L14.28 17.97l2.18-1 2.516 1.122-2.248 1.003zm-4.205-1.932l-2.154-.989 2.154-.96 2.154.96-2.154.99zm-6.476.94l2.539-1.133 2.18 1-2.472 1.135-2.247-1.003zm2.696-4.576l1.98.883-2.128.95-1.95-.896 2.098-.937zm3.757-1.676l1.98.883-1.957.873-1.98-.883 1.957-.873zm1.823 2.56l1.957-.874 2.099.937-1.928.885-2.128-.949zm-3.318-8.773H7.897v-4.17h9.206v4.17h-3.125a.778.778 0 0 0-.553.23l-.928.93-.942-.934a.777.777 0 0 0-.55-.226zM4.86 15.259l1.95.896-2.565 1.144-1.98-.883 2.595-1.157zm7.639 5.722l-2.422-1.08 2.445-1.124 2.422 1.113-2.445 1.091zm8.277-3.692l-2.543-1.134 1.928-.886 2.571 1.147-1.956.873z',
        'M16.25 3.125c0-.345-.354-.625-.79-.625H9.54c-.436 0-.79.28-.79.625s.354.625.79.625h5.92c.436 0 .79-.28.79-.625z',
      ],
    },
    {
      value: 'OTHER',
      title: 'Other',
      viewBox: '0 0 512 512',
      paths: [
        'M478.21 334.093L336 256l142.21-78.093c11.795-6.477 15.961-21.384 9.232-33.037l-19.48-33.741c-6.728-11.653-21.72-15.499-33.227-8.523L296 186.718l3.475-162.204C299.763 11.061 288.937 0 275.48 0h-38.96c-13.456 0-24.283 11.061-23.994 24.514L216 186.718 77.265 102.607c-11.506-6.976-26.499-3.13-33.227 8.523l-19.48 33.741c-6.728 11.653-2.562 26.56 9.233 33.037L176 256 33.79 334.093c-11.795 6.477-15.961 21.384-9.232 33.037l19.48 33.741c6.728 11.653 21.721 15.499 33.227 8.523L216 325.282l-3.475 162.204C212.237 500.939 223.064 512 236.52 512h38.961c13.456 0 24.283-11.061 23.995-24.514L296 325.282l138.735 84.111c11.506 6.976 26.499 3.13 33.227-8.523l19.48-33.741c6.728-11.653 2.563-26.559-9.232-33.036z',
      ],
    },
  ];

  // --- Fetching mapping types --------------------------------------------------
  // The project search results don't include mapping types, so each card's project
  // summary is fetched once it scrolls into view, and kept in localStorage for CACHE_TTL.

  const cache = new Map(); // projectId -> Promise<string[]>
  const queue = [];
  let active = 0;

  function getMappingTypes(projectId) {
    if (!cache.has(projectId)) {
      const stored = readStored(projectId);
      cache.set(projectId, stored ? Promise.resolve(stored) : enqueue(() => fetchMappingTypes(projectId)));
    }
    return cache.get(projectId);
  }

  function enqueue(job) {
    return new Promise((resolve, reject) => {
      queue.push({ job, resolve, reject });
      pump();
    });
  }

  function pump() {
    while (active < MAX_PARALLEL && queue.length) {
      const { job, resolve, reject } = queue.shift();
      active++;
      job()
        .then(resolve, reject)
        .finally(() => {
          active--;
          pump();
        });
    }
  }

  async function fetchMappingTypes(projectId) {
    const headers = {};
    const token = readToken(); // only needed for private projects
    if (token) headers.Authorization = `Token ${token}`;
    const response = await fetch(`${API}projects/${projectId}/queries/summary/`, { headers });
    if (!response.ok) throw new Error(`Project ${projectId} summary: HTTP ${response.status}`);
    const types = (await response.json()).mappingTypes || [];
    try {
      localStorage.setItem(STORAGE_PREFIX + projectId, JSON.stringify({ types, time: Date.now() }));
    } catch (e) {}
    return types;
  }

  function readStored(projectId) {
    try {
      const entry = JSON.parse(localStorage.getItem(STORAGE_PREFIX + projectId));
      return entry && Date.now() - entry.time < CACHE_TTL ? entry.types : null;
    } catch (e) {
      return null;
    }
  }

  function pruneStored() {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(STORAGE_PREFIX) && !readStored(key.slice(STORAGE_PREFIX.length))) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {}
  }

  function readToken() {
    try {
      return localStorage.getItem('token');
    } catch (e) {
      return null;
    }
  }

  // --- Rendering ---------------------------------------------------------------

  function renderIcons(holder, types) {
    holder.title = types.length
      ? 'Mapping types: ' + TYPES.filter((t) => types.includes(t.value)).map((t) => t.title).join(', ')
      : 'No mapping types set';
    for (const type of TYPES) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', type.viewBox);
      svg.setAttribute('height', '14');
      svg.setAttribute('class', `ml1 ${types.includes(type.value) ? 'blue-dark' : 'grey-light'}`);
      for (const d of type.paths) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'currentColor');
        svg.appendChild(path);
      }
      holder.appendChild(svg);
    }
  }

  // The difficulty label is the card's last text, unless a due date box (clock icon + text)
  // follows it in the same row. It's found by position, since the label text is translated.
  function findDifficultyLabel(link) {
    const leaves = [...link.querySelectorAll('*')].filter(
      (el) => !el.firstElementChild && !el.closest('svg') && el.textContent.trim(),
    );
    return leaves.reverse().find((el) => !el.parentElement.querySelector(':scope > svg')) || null;
  }

  // Project cards are `article > a[href="/projects/<id>"]` with a "#<id>  OSM" row near the top
  // and the difficulty row at the bottom. The icons go at the right end of the difficulty row
  // (or the id row as a fallback) so the card height doesn't change.
  function scan() {
    for (const link of document.querySelectorAll('article > a[href^="/projects/"]')) {
      const projectId = link.getAttribute('href').match(/^\/projects\/(\d+)\/?$/)?.[1];
      if (!projectId) continue;

      const existing = link.querySelector('.tmus-mapping-types');
      if (existing && existing.dataset.projectId === projectId) continue;
      existing?.remove(); // card reused by React for a different project

      const idRow = [...link.querySelectorAll('div.f7.blue-grey')].find(
        (div) => div.textContent.trim() === `#${projectId}`,
      )?.parentElement;
      if (!idRow) continue;

      const holder = document.createElement('div');
      holder.className = 'tmus-mapping-types flex items-center flex-shrink-0';
      holder.dataset.projectId = projectId;
      const difficultyLabel = findDifficultyLabel(link);
      if (difficultyLabel && difficultyLabel.parentElement !== link) {
        // The row lays out its children with floats; flex keeps the icons on the same line.
        const row = difficultyLabel.parentElement;
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        holder.style.marginLeft = 'auto';
        difficultyLabel.after(holder);
      } else {
        idRow.appendChild(holder);
      }
      visibility.observe(link); // no-op if it's already waiting to become visible
    }
  }

  // Loads a card's icons once it's (nearly) on screen. The card link is observed rather than
  // the holder, which has no size until its icons are rendered.
  const visibility = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        visibility.unobserve(entry.target);
        const holder = entry.target.querySelector('.tmus-mapping-types');
        if (!holder) continue;
        // On failure the empty holder stays, so the card isn't retried on every DOM change.
        getMappingTypes(holder.dataset.projectId).then(
          (types) => renderIcons(holder, types),
          () => (holder.title = 'Could not load mapping types'),
        );
      }
    },
    { rootMargin: '200px' },
  );

  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  }).observe(document.body, { childList: true, subtree: true });
  pruneStored();
  scan();
})();
