// ==UserScript==
// @name         TM: stop validating individual tasks
// @namespace    https://github.com/Patrik-Br
// @homepageURL  https://github.com/Patrik-Br/Tampermonkey_scripts
// @updateURL    https://raw.githubusercontent.com/Patrik-Br/Tampermonkey_scripts/main/tm-partial-stop-validation.user.js
// @downloadURL  https://raw.githubusercontent.com/Patrik-Br/Tampermonkey_scripts/main/tm-partial-stop-validation.user.js
// @version      1.0.0
// @description  When validating several Tasking Manager tasks at once, adds a "Stop validating" option per task, so you can release some tasks and validate/invalidate the rest. Workaround for hotosm/tasking-manager#5618.
// @match        https://tasks.hotosm.org/*
// @match        https://tasks-stage.hotosm.org/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const VALIDATE_PAGE = /^\/projects\/\d+\/validate/;
  const SUBMIT_PATH = /\/projects\/\d+\/tasks\/actions\/unlock-after-validation\/?$/;
  const STOP_LABEL = 'Stop validating (keep its current status)';
  const RELEASED_LABEL = 'Validation stopped, task released';

  const stopIds = new Set(); // tasks marked "Stop" on the current validation page
  const releasedIds = new Set(); // tasks already released by an earlier submit whose second half failed
  let suppressClick = false;

  // --- Request interception ---------------------------------------------------
  // TM submits validation through axios (XMLHttpRequest). Tasks marked "Stop" are taken out
  // of that request and released with stop-validation first, because unlock-after-validation
  // rejects the whole batch if any listed task is no longer locked.

  const xhrProto = XMLHttpRequest.prototype;
  const origOpen = xhrProto.open;
  const origSend = xhrProto.send;
  const origSetRequestHeader = xhrProto.setRequestHeader;

  xhrProto.open = function (method, url) {
    this._tmus = { method: String(method).toUpperCase(), url: new URL(url, location.href).href, headers: {} };
    return origOpen.apply(this, arguments);
  };

  xhrProto.setRequestHeader = function (name, value) {
    if (this._tmus) this._tmus.headers[name] = value;
    return origSetRequestHeader.apply(this, arguments);
  };

  xhrProto.send = function (body) {
    const req = this._tmus;
    if (!req || req.method !== 'POST' || !SUBMIT_PATH.test(new URL(req.url).pathname) || typeof body !== 'string') {
      return origSend.apply(this, arguments);
    }
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      return origSend.apply(this, arguments);
    }

    const tasks = payload.validatedTasks || [];
    const isStopped = (task) => stopIds.has(Number(task.taskId)) || releasedIds.has(Number(task.taskId));
    const toSubmit = tasks.filter((task) => !isStopped(task));
    const toStop = tasks.filter((task) => isStopped(task) && !releasedIds.has(Number(task.taskId)));
    if (toSubmit.length === tasks.length) return origSend.apply(this, arguments);

    const xhr = this;
    const submitBody = JSON.stringify({ ...payload, validatedTasks: toSubmit });
    const stopUrl = req.url.replace(/unlock-after-validation\/?$/, 'stop-validation/');
    const stopBody = JSON.stringify({
      resetTasks: toStop.map((task) => ({ taskId: task.taskId, comment: task.comment })),
    });
    // Re-targets TM's own request, so its usual success/error handling (toast, redirect) runs on the response.
    const sendStopInstead = () => {
      origOpen.call(xhr, 'POST', stopUrl, true);
      for (const [name, value] of Object.entries(req.headers)) origSetRequestHeader.call(xhr, name, value);
      origSend.call(xhr, stopBody);
    };

    if (!toSubmit.length) return sendStopInstead();
    if (!toStop.length) return origSend.call(xhr, submitBody);

    fetch(stopUrl, { method: 'POST', headers: req.headers, body: stopBody }).then(
      (response) => {
        if (!response.ok) return sendStopInstead(); // surfaces the same error through TM's UI
        toStop.forEach((task) => markReleased(Number(task.taskId)));
        origSend.call(xhr, submitBody);
      },
      sendStopInstead,
    );
  };

  // --- UI -----------------------------------------------------------------------
  // Each task row in the validation sidebar gets a third option under Valid / Invalid.
  // It's a checkbox styled like TM's radios, so clicking it again cancels it.

  const STYLE = `
    .tmus-stopping .radio-input:not(.tmus-stop):checked {
      background-color: #fff;
      border: 1px solid #929db3;
    }
  `;

  function injectStopOptions() {
    if (!VALIDATE_PAGE.test(location.pathname)) {
      stopIds.clear();
      releasedIds.clear();
      return;
    }
    const validRadios = document.querySelectorAll('input.radio-input[type="radio"][value="VALIDATED"][id^="#"]');
    if (validRadios.length < 2) return; // with one task, TM's own "Stop validation" button already does this

    for (const validRadio of validRadios) {
      const taskId = Number(validRadio.id.match(/^#(\d+)-VALIDATED$/)?.[1]);
      const options = validRadio.closest('div.flex')?.parentElement;
      if (!taskId || !options || options.querySelector('.tmus-stop')) continue;
      const invalidRow = options.querySelector(`input[id="#${taskId}-INVALIDATED"]`)?.closest('div.flex');
      if (!invalidRow) continue;

      options.dataset.tmusTaskId = taskId;
      invalidRow.after(buildStopRow(taskId, options));
      // Picking Valid or Invalid cancels "Stop" for this task.
      options.addEventListener('click', (event) => {
        if (!suppressClick && event.target.matches('input.radio-input:not(.tmus-stop)')) {
          setStopped(taskId, options, false);
        }
      });
      setStopped(taskId, options, stopIds.has(taskId));
      if (releasedIds.has(taskId)) markReleased(taskId);
    }
  }

  function buildStopRow(taskId, options) {
    const row = document.createElement('div');
    row.className = 'flex items-start mb2';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `tmus-stop-${taskId}`;
    input.className = 'tmus-stop radio-input input-reset pointer flex-shrink-0 h2 w2 mr2 br-100 ba b--blue-light';
    input.addEventListener('change', () => setStopped(taskId, options, input.checked));
    const label = document.createElement('label');
    label.htmlFor = input.id;
    label.className = 'pointer lh-copy';
    label.textContent = STOP_LABEL;
    row.append(input, label);
    return row;
  }

  function setStopped(taskId, options, stopped) {
    if (!stopped && releasedIds.has(taskId)) return; // already released on the server, can't be undone
    if (stopped &&!options.querySelector('input.radio-input:not(.tmus-stop):checked')) {
      // TM only enables Submit once every task has a status, so give this task a placeholder
      // status. It's never sent: the task is taken out of the request on submit.
      suppressClick = true;
      options.querySelector(`input[id="#${taskId}-VALIDATED"]`).click();
      suppressClick = false;
    }
    if (stopped) stopIds.add(taskId);
    else stopIds.delete(taskId);
    options.classList.toggle('tmus-stopping', stopped);
    options.querySelector('.tmus-stop').checked = stopped;
  }

  function markReleased(taskId) {
    releasedIds.add(taskId);
    const input = document.getElementById(`tmus-stop-${taskId}`);
    if (!input) return;
    input.checked = true;
    input.disabled = true;
    input.nextElementSibling.textContent = RELEASED_LABEL;
    input.closest('[data-tmus-task-id]').classList.add('tmus-stopping');
  }

  // The "all tasks" Valid / Invalid radios (shown for more than 3 tasks) apply to every task,
  // so they cancel all "Stop" choices that haven't been sent yet.
  document.addEventListener('click', (event) => {
    if (!event.target.matches('input.radio-input[type="radio"]#VALIDATED, input.radio-input[type="radio"]#INVALIDATED')) {
      return;
    }
    for (const options of document.querySelectorAll('[data-tmus-task-id]')) {
      setStopped(Number(options.dataset.tmusTaskId), options, false);
    }
  });

  function start() {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    let scheduled = false;
    new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        injectStopOptions();
      });
    }).observe(document.body, { childList: true, subtree: true });
    injectStopOptions();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
