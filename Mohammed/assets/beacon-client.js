(function () {
  const API_BASE = "/api/v1";
  const DEFAULT_JOB_QUERY = "software engineer internship";
  const DEFAULT_JOB_LOCATION = "London";

  async function api(path, options) {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const text = await response.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch (_err) {
      // plain text fallback
    }
    if (!response.ok) {
      const detail = typeof data === "object" ? JSON.stringify(data) : String(data);
      throw new Error(`${response.status} ${detail}`);
    }
    return data;
  }

  function pageName() {
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || "";
  }

  function showToast(message, isError) {
    const id = "beacon-toast";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.position = "fixed";
      el.style.right = "16px";
      el.style.bottom = "16px";
      el.style.maxWidth = "520px";
      el.style.padding = "10px 12px";
      el.style.borderRadius = "8px";
      el.style.zIndex = "9999";
      el.style.fontSize = "13px";
      el.style.fontWeight = "600";
      document.body.appendChild(el);
    }
    el.style.background = isError ? "#7f1d1d" : "#1e40af";
    el.style.color = "#ffffff";
    el.textContent = message;
    window.clearTimeout(el.__timer);
    el.__timer = window.setTimeout(() => {
      if (el) {
        el.remove();
      }
    }, 4200);
  }

  function encodeFileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function createPanel(title) {
    const panel = document.createElement("section");
    panel.style.marginTop = "16px";
    panel.style.padding = "14px";
    panel.style.border = "1px solid rgba(148, 163, 184, 0.35)";
    panel.style.borderRadius = "12px";
    panel.style.background = "rgba(15, 23, 42, 0.04)";

    const heading = document.createElement("h3");
    heading.textContent = title;
    heading.style.fontWeight = "800";
    heading.style.marginBottom = "8px";
    panel.appendChild(heading);

    const body = document.createElement("div");
    panel.appendChild(body);

    return { panel, body };
  }

  async function triggerJobRefreshSilently() {
    try {
      await api("/jobs/refresh", {
        method: "POST",
        body: JSON.stringify({
          query: DEFAULT_JOB_QUERY,
          location: DEFAULT_JOB_LOCATION,
          limit: 10,
        }),
      });
    } catch (_err) {
      // non-blocking
    }
  }

  function wireJobRefreshClicks() {
    const candidates = Array.from(document.querySelectorAll("a, button"));
    candidates.forEach((el) => {
      const text = (el.textContent || "").toLowerCase();
      if (!/(job|career|application|goldman|opportunit|load job|view all jobs)/.test(text)) {
        return;
      }
      el.addEventListener("click", () => {
        triggerJobRefreshSilently();
      });
    });
  }

  async function initSchedulePage() {
    const main = document.querySelector("main");
    if (!main) return;

    const { panel, body } = createPanel("AI Scheduler");
    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "8px";
    controls.style.marginBottom = "10px";

    const addBtn = document.createElement("button");
    addBtn.textContent = "Add Task";
    addBtn.style.padding = "8px 12px";
    addBtn.style.borderRadius = "8px";
    addBtn.style.border = "0";
    addBtn.style.background = "#2563eb";
    addBtn.style.color = "#fff";
    addBtn.style.fontWeight = "700";

    const rescheduleBtn = document.createElement("button");
    rescheduleBtn.textContent = "Auto Reschedule";
    rescheduleBtn.style.padding = "8px 12px";
    rescheduleBtn.style.borderRadius = "8px";
    rescheduleBtn.style.border = "1px solid #93c5fd";
    rescheduleBtn.style.background = "#eff6ff";
    rescheduleBtn.style.color = "#1e3a8a";
    rescheduleBtn.style.fontWeight = "700";

    controls.appendChild(addBtn);
    controls.appendChild(rescheduleBtn);
    body.appendChild(controls);

    const eventList = document.createElement("div");
    body.appendChild(eventList);

    function renderEvents(events) {
      eventList.innerHTML = "";
      if (!events.length) {
        eventList.textContent = "No scheduled tasks yet.";
        return;
      }
      events.slice(0, 8).forEach((event) => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";
        row.style.padding = "8px 0";
        row.style.borderTop = "1px dashed rgba(100, 116, 139, 0.35)";

        const label = document.createElement("div");
        label.textContent = `${event.title} | ${new Date(event.start_at).toLocaleString()}`;
        label.style.fontSize = "13px";

        const doneBtn = document.createElement("button");
        doneBtn.textContent = "Mark Done";
        doneBtn.style.fontSize = "12px";
        doneBtn.style.padding = "4px 8px";
        doneBtn.style.borderRadius = "6px";
        doneBtn.style.border = "1px solid #94a3b8";
        doneBtn.style.background = "white";
        doneBtn.addEventListener("click", async () => {
          try {
            await api(`/scheduler/tasks/${event.task_id}`, {
              method: "PATCH",
              body: JSON.stringify({ completed: true }),
            });
            await loadEvents();
            showToast("Task completed and schedule updated.", false);
          } catch (err) {
            showToast(`Failed to complete task: ${err.message}`, true);
          }
        });

        row.appendChild(label);
        row.appendChild(doneBtn);
        eventList.appendChild(row);
      });
    }

    async function loadEvents() {
      const payload = await api("/scheduler/events");
      renderEvents(payload.events || []);
    }

    addBtn.addEventListener("click", async () => {
      const title = window.prompt("Task title");
      if (!title) return;
      const module = window.prompt("Module", "General") || "General";
      const dueAt = window.prompt("Due date ISO (optional)", "");
      const hoursText = window.prompt("Estimated hours", "2") || "2";
      const hours = Number.parseInt(hoursText, 10) || 2;

      try {
        const payload = await api("/scheduler/tasks", {
          method: "POST",
          body: JSON.stringify({
            title,
            module,
            due_at: dueAt || null,
            estimated_hours: hours,
            module_weight_percent: 30,
            notes: "Added from schedule UI",
          }),
        });
        renderEvents(payload.events || []);
        showToast("Task added and calendar rescheduled.", false);
      } catch (err) {
        showToast(`Failed to add task: ${err.message}`, true);
      }
    });

    rescheduleBtn.addEventListener("click", async () => {
      try {
        const payload = await api("/scheduler/reschedule", { method: "POST", body: "{}" });
        renderEvents(payload.events || []);
        showToast("Schedule recomputed.", false);
      } catch (err) {
        showToast(`Reschedule failed: ${err.message}`, true);
      }
    });

    main.insertBefore(panel, main.firstChild.nextSibling || main.firstChild);
    try {
      await loadEvents();
    } catch (err) {
      showToast(`Could not load events: ${err.message}`, true);
    }
  }

  async function initModuleNotesPage() {
    const headerButtons = Array.from(document.querySelectorAll("button"));
    const target = headerButtons.find((btn) => /add new module/i.test(btn.textContent || ""));
    if (!target) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,application/pdf";
    input.style.display = "none";
    document.body.appendChild(input);

    const uploadBtn = document.createElement("button");
    uploadBtn.textContent = "Upload Lecture PDF";
    uploadBtn.className = target.className;
    uploadBtn.style.marginLeft = "8px";
    target.parentElement.appendChild(uploadBtn);

    const { panel, body } = createPanel("Lecture Notes in MongoDB");
    const list = document.createElement("div");
    body.appendChild(list);

    async function refreshList() {
      const payload = await api("/documents/lecture-notes");
      list.innerHTML = "";
      if (!payload.documents || !payload.documents.length) {
        list.textContent = "No lecture PDFs uploaded yet.";
        return;
      }
      payload.documents.slice(0, 6).forEach((doc) => {
        const row = document.createElement("div");
        row.style.padding = "8px 0";
        row.style.borderTop = "1px dashed rgba(100, 116, 139, 0.35)";
        row.textContent = `${doc.title} (${doc.pages} pages)`;
        list.appendChild(row);
      });
    }

    uploadBtn.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const dataBase64 = await encodeFileBase64(file);
        await api("/documents/lecture-notes/upload", {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            content_type: file.type || "application/pdf",
            data_base64: dataBase64,
            title: file.name,
            module: "General",
          }),
        });
        showToast("Lecture PDF uploaded to MongoDB.", false);
        await refreshList();
      } catch (err) {
        showToast(`Upload failed: ${err.message}`, true);
      }
    });

    const main = document.querySelector("main");
    if (main) {
      main.insertBefore(panel, main.firstChild.nextSibling || main.firstChild);
    }
    try {
      await refreshList();
    } catch (err) {
      showToast(`Could not load lecture notes: ${err.message}`, true);
    }
  }

  async function initProfilePage() {
    const sectionHeading = Array.from(document.querySelectorAll("h2")).find((h) =>
      /documents/i.test(h.textContent || "")
    );
    if (!sectionHeading) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,application/pdf";
    input.style.display = "none";
    document.body.appendChild(input);

    const uploadBtn = document.createElement("button");
    uploadBtn.textContent = "Upload Academic Report";
    uploadBtn.style.marginLeft = "10px";
    uploadBtn.style.padding = "6px 10px";
    uploadBtn.style.borderRadius = "8px";
    uploadBtn.style.border = "1px solid #93c5fd";
    uploadBtn.style.fontWeight = "700";
    uploadBtn.style.fontSize = "12px";
    uploadBtn.style.color = "#1d4ed8";
    uploadBtn.style.background = "#eff6ff";
    sectionHeading.appendChild(uploadBtn);

    const { panel, body } = createPanel("Academic Reports in MongoDB");
    const list = document.createElement("div");
    body.appendChild(list);

    async function refreshList() {
      const payload = await api("/documents/academic-reports");
      list.innerHTML = "";
      if (!payload.documents || !payload.documents.length) {
        list.textContent = "No reports uploaded yet.";
        return;
      }
      payload.documents.slice(0, 6).forEach((doc) => {
        const row = document.createElement("div");
        row.style.padding = "8px 0";
        row.style.borderTop = "1px dashed rgba(100, 116, 139, 0.35)";
        row.textContent = `${doc.title} (${doc.report_type || "report"})`;
        list.appendChild(row);
      });
    }

    uploadBtn.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const dataBase64 = await encodeFileBase64(file);
        await api("/documents/academic-reports/upload", {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            content_type: file.type || "application/pdf",
            data_base64: dataBase64,
            title: file.name,
            report_type: "academic_report",
          }),
        });
        showToast("Academic report uploaded.", false);
        await refreshList();
      } catch (err) {
        showToast(`Upload failed: ${err.message}`, true);
      }
    });

    const main = document.querySelector("main");
    if (main) {
      main.insertBefore(panel, main.firstChild.nextSibling || main.firstChild);
    }
    try {
      await refreshList();
    } catch (err) {
      showToast(`Could not load reports: ${err.message}`, true);
    }
  }

  function initChatboxPage() {
    const input = document.querySelector('input[placeholder*="Ask Beacon"]');
    if (!input) return;
    const sendButton = input.parentElement && input.parentElement.querySelector("span.material-symbols-outlined");

    const history = document.createElement("div");
    history.style.marginTop = "10px";
    history.style.maxHeight = "180px";
    history.style.overflowY = "auto";
    history.style.fontSize = "12px";
    history.style.display = "grid";
    history.style.gap = "8px";
    input.parentElement.parentElement.appendChild(history);

    const conversationId = `conv-${Date.now()}`;

    function appendMessage(role, text) {
      const bubble = document.createElement("div");
      bubble.textContent = `${role}: ${text}`;
      bubble.style.padding = "8px";
      bubble.style.borderRadius = "8px";
      bubble.style.background = role === "You" ? "#dbeafe" : "#f1f5f9";
      bubble.style.color = "#0f172a";
      history.appendChild(bubble);
      history.scrollTop = history.scrollHeight;
    }

    async function send() {
      const message = String(input.value || "").trim();
      if (!message) return;
      input.value = "";
      appendMessage("You", message);
      try {
        const payload = await api("/assistant/chat", {
          method: "POST",
          body: JSON.stringify({
            conversation_id: conversationId,
            message,
            context_page: "dashboard",
          }),
        });
        appendMessage("Beacon", payload.reply || "No response");
      } catch (err) {
        appendMessage("Beacon", `Error: ${err.message}`);
      }
    }

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        send();
      }
    });
    if (sendButton) {
      sendButton.style.cursor = "pointer";
      sendButton.addEventListener("click", send);
    }
  }

  async function initJobsPage() {
    const heading = Array.from(document.querySelectorAll("h1")).find((h) =>
      /tailored jobs/i.test(h.textContent || "")
    );
    if (!heading) return;

    const row = heading.parentElement && heading.parentElement.parentElement;
    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "8px";
    controls.style.marginTop = "10px";

    const loadBtn = document.createElement("button");
    loadBtn.textContent = "Load Jobs (Gemini + LinkedIn)";
    loadBtn.style.padding = "8px 12px";
    loadBtn.style.borderRadius = "8px";
    loadBtn.style.border = "0";
    loadBtn.style.background = "#2563eb";
    loadBtn.style.color = "#fff";
    loadBtn.style.fontWeight = "700";

    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "Refresh Jobs";
    refreshBtn.style.padding = "8px 12px";
    refreshBtn.style.borderRadius = "8px";
    refreshBtn.style.border = "1px solid #93c5fd";
    refreshBtn.style.background = "#eff6ff";
    refreshBtn.style.color = "#1e3a8a";
    refreshBtn.style.fontWeight = "700";

    controls.appendChild(loadBtn);
    controls.appendChild(refreshBtn);
    if (row) row.appendChild(controls);

    const mainListContainer = document.querySelector(".lg\\:col-span-8");
    if (!mainListContainer) return;

    const dynamicPanel = document.createElement("div");
    dynamicPanel.style.border = "1px solid rgba(148, 163, 184, 0.35)";
    dynamicPanel.style.borderRadius = "12px";
    dynamicPanel.style.padding = "12px";
    dynamicPanel.style.background = "rgba(15, 23, 42, 0.03)";
    dynamicPanel.style.marginBottom = "10px";

    const meta = document.createElement("div");
    meta.style.fontSize = "12px";
    meta.style.marginBottom = "8px";
    dynamicPanel.appendChild(meta);

    const list = document.createElement("div");
    list.style.display = "grid";
    list.style.gap = "8px";
    dynamicPanel.appendChild(list);

    mainListContainer.insertBefore(dynamicPanel, mainListContainer.firstChild.nextSibling || mainListContainer.firstChild);

    function renderJobs(payload) {
      const jobs = payload.jobs || [];
      meta.textContent = `Jobs in dashboard: ${jobs.length} | Last refreshed: ${payload.last_refreshed_at || "n/a"}`;
      list.innerHTML = "";
      if (!jobs.length) {
        list.textContent = "No jobs found yet.";
        return;
      }
      jobs.slice(0, 8).forEach((job) => {
        const rowEl = document.createElement("div");
        rowEl.style.padding = "8px";
        rowEl.style.border = "1px dashed rgba(100, 116, 139, 0.35)";
        rowEl.style.borderRadius = "8px";

        const link = job.source_url
          ? `<a href="${job.source_url}" target="_blank" rel="noreferrer">LinkedIn</a>`
          : "No link";
        rowEl.innerHTML = `<strong>${job.title}</strong> (${job.company || "Unknown"}) - ${job.location || ""}<br/>${link}`;
        list.appendChild(rowEl);
      });
    }

    async function loadJobs() {
      const payload = await api("/jobs");
      renderJobs(payload);
    }

    async function discoverJobs() {
      const payload = await api("/jobs/discover", {
        method: "POST",
        body: JSON.stringify({
          query: DEFAULT_JOB_QUERY,
          location: DEFAULT_JOB_LOCATION,
          limit: 10,
        }),
      });
      renderJobs(payload);
      showToast(`Jobs updated (+${payload.jobs_added}, ~${payload.jobs_updated}).`, false);
    }

    loadBtn.addEventListener("click", async () => {
      try {
        await discoverJobs();
      } catch (err) {
        showToast(`Load jobs failed: ${err.message}`, true);
      }
    });

    refreshBtn.addEventListener("click", async () => {
      try {
        const payload = await api("/jobs/refresh", {
          method: "POST",
          body: JSON.stringify({
            query: DEFAULT_JOB_QUERY,
            location: DEFAULT_JOB_LOCATION,
            limit: 10,
          }),
        });
        renderJobs(payload);
        showToast("Jobs refreshed.", false);
      } catch (err) {
        showToast(`Refresh failed: ${err.message}`, true);
      }
    });

    try {
      await loadJobs();
    } catch (err) {
      showToast(`Could not load jobs: ${err.message}`, true);
    }
  }

  function init() {
    const current = pageName().toLowerCase();

    wireJobRefreshClicks();

    if (current === "schedule.html") {
      initSchedulePage();
    }
    if (current === "modulenotes.html") {
      initModuleNotesPage();
    }
    if (current === "profile.html") {
      initProfilePage();
    }
    if (current === "code.html") {
      initChatboxPage();
    }
    if (current === "opportunities.html") {
      initJobsPage();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
