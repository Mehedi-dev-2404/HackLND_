import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function loadDotEnv() {
  const localEnvPath = path.resolve(process.cwd(), ".env");
  const myappEnvPath = path.resolve(process.cwd(), "..", "myapp", ".env");
  loadEnvFile(localEnvPath);
  loadEnvFile(myappEnvPath);
}

function normalizeBaseUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

loadDotEnv();

const PORT = Number(process.env.PORT || 8010);
const FASTAPI_BASE_URL = normalizeBaseUrl(
  process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000"
);

const DATA_DIR = path.resolve(process.cwd(), "backend", "data");
const LATEST_RESULT_FILE = path.join(DATA_DIR, "llm_priority_latest.json");
const PIPELINE_MOCK_FILE = path.resolve(process.cwd(), "backend", "pipeline_mock_data.json");
const GEMINI_JOB_SEARCH_MODEL = String(
  process.env.GEMINI_JOB_SEARCH_MODEL || process.env.LLM_MODEL || "gemini-2.5-flash"
).trim();

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, payload) {
  setCors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new Error("Request body too large");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

function writeLatestJsonFile(payload) {
  ensureDataDir();
  writeFileSync(LATEST_RESULT_FILE, JSON.stringify(payload, null, 2));
}

function readLatestJsonFile() {
  if (!existsSync(LATEST_RESULT_FILE)) {
    throw new Error("No latest result file. Run POST /member4/llm-priority first.");
  }
  return JSON.parse(readFileSync(LATEST_RESULT_FILE, "utf8"));
}

function sampleCareerOpportunities() {
  return [
    {
      company: "HSBC",
      role: "Summer Internship",
      closesOn: "2026-02-22",
      skills: ["python", "reasoning"]
    },
    {
      company: "BBC",
      role: "Graduate Scheme",
      closesOn: "2026-03-05",
      skills: ["media", "data"]
    },
    {
      company: "BlackRock",
      role: "Off-Cycle Internship",
      closesOn: "2026-02-28",
      skills: ["finance", "python"]
    }
  ];
}

function scoreBand(score) {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function clampPriorityScore(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function parseJsonText(rawText) {
  const text = String(rawText || "").trim();
  const fenced = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
  return JSON.parse(fenced);
}

function normalizeGeminiLinkedInJobs(parsed, { keywords, location, limit }) {
  const rawItems = Array.isArray(parsed?.jobs)
    ? parsed.jobs
    : Array.isArray(parsed?.items)
      ? parsed.items
      : Array.isArray(parsed)
        ? parsed
        : [];

  const jobs = rawItems
    .slice(0, Math.max(1, Number(limit) || 5))
    .map((item, index) => {
      const title = String(item?.title || item?.role || "Unknown Title");
      const company = String(item?.company || item?.company_name || "Unknown Company");
      const itemLocation = String(item?.location || location || "Remote");
      const url = String(item?.url || item?.link || "").trim();
      return {
        id: String(item?.id || `linkedin-llm-${index + 1}`),
        title,
        company,
        location: itemLocation,
        postedDate: String(item?.postedDate || item?.posted_date || item?.date || ""),
        applicantCount: String(item?.applicantCount || item?.applicant_count || ""),
        url: url.startsWith("http") ? url : "",
        description: String(item?.description || item?.summary || "")
      };
    })
    .filter((job) => Boolean(job.title));

  return {
    source: "linkedin-gemini",
    query: { keywords, location, limit: Math.max(1, Number(limit) || 5) },
    jobCount: jobs.length,
    jobs,
    summary: String(parsed?.summary || parsed?.note || `Found ${jobs.length} LinkedIn jobs`)
  };
}

function buildGeminiLinkedInJobsPrompt({ keywords, location, limit }) {
  return `Find current job opportunities on LinkedIn.
Return up to ${Math.max(1, Number(limit) || 5)} roles for this query:
- keywords: ${keywords}
- location: ${location}

Rules:
1) Only include jobs that are likely to exist on LinkedIn.
2) Prefer recent openings.
3) If exact posting date/applicant count is unavailable, use empty string.
4) Return JSON only (no markdown).

Required JSON shape:
{
  "summary": "short summary",
  "jobs": [
    {
      "id": "string",
      "title": "string",
      "company": "string",
      "location": "string",
      "postedDate": "string",
      "applicantCount": "string",
      "url": "https://www.linkedin.com/jobs/view/...",
      "description": "string"
    }
  ]
}`;
}

function buildGeminiPriorityPrompt(tasks, llmConfig = {}) {
  const customPrompt = String(llmConfig.customPrompt || "").trim();
  const prompt = customPrompt
    ? customPrompt
    : "Prioritize student tasks by due date urgency, module weighting, and estimated effort.";

  return `${prompt}

Return JSON only in this exact shape:
{
  "rated_tasks": [
    {
      "id": "string",
      "title": "string",
      "priority_score": 0,
      "priority_band": "critical|high|medium|low",
      "reason": "short reason"
    }
  ],
  "summary": "short summary"
}

Tasks:
${JSON.stringify(tasks, null, 2)}`;
}

function normalizeGeminiRatedTasks(parsed, sourceTasks) {
  const byId = Object.fromEntries(sourceTasks.map((task) => [String(task.id), task]));
  const incoming = Array.isArray(parsed?.rated_tasks)
    ? parsed.rated_tasks
    : Array.isArray(parsed?.ratedTasks)
      ? parsed.ratedTasks
      : [];

  const normalized = incoming.map((task, index) => {
    const id = String(task?.id || `task-${index + 1}`);
    const source = byId[id] || {};
    const title = String(task?.title || source.title || `Task ${index + 1}`);
    const score = clampPriorityScore(task?.priority_score ?? task?.priorityScore);
    const band = String(task?.priority_band || task?.priorityBand || scoreBand(score)).toLowerCase();
    const reason = String(task?.reason || "Gemini prioritization");
    return {
      id,
      title,
      priority_score: score,
      priority_band: ["critical", "high", "medium", "low"].includes(band)
        ? band
        : scoreBand(score),
      reason
    };
  });

  normalized.sort((a, b) => b.priority_score - a.priority_score);
  return {
    rated_tasks: normalized,
    summary: String(parsed?.summary || `Prioritized ${normalized.length} task(s)`),
    fallback: false
  };
}

async function callGeminiPriorityDirect(tasks, llmConfig = {}) {
  const apiKey = String(llmConfig.apiKey || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error(
      "No Gemini API key available for direct LLM prioritization. " +
        "Provide llmConfig.apiKey or set GEMINI_API_KEY in Tom/.env or myapp/.env"
    );
  }

  const rawModel = String(llmConfig.model || "gemini-2.5-flash").trim();
  const model = rawModel.replace(/^models\//i, "");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildGeminiPriorityPrompt(tasks, llmConfig) }]
        }
      ],
      generationConfig: {
        temperature: Number(llmConfig.temperature ?? 0.2),
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("Gemini response missing content");
  }

  const parsed = parseJsonText(content);
  return normalizeGeminiRatedTasks(parsed, tasks);
}

async function callGeminiLinkedInJobs({ keywords, location, limit, llmConfig = {} }) {
  const apiKey = String(llmConfig.apiKey || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error(
      "No Gemini API key available for LinkedIn job finding. " +
        "Provide llmConfig.apiKey or set GEMINI_API_KEY in Tom/.env or myapp/.env"
    );
  }

  const rawModel = String(llmConfig.model || GEMINI_JOB_SEARCH_MODEL || "gemini-2.5-flash").trim();
  const model = rawModel.replace(/^models\//i, "");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildGeminiLinkedInJobsPrompt({
                keywords: String(keywords || "software engineer"),
                location: String(location || "Remote"),
                limit: Math.max(1, Number(limit) || 5)
              })
            }
          ]
        }
      ],
      generationConfig: {
        temperature: Number(llmConfig.temperature ?? 0.2),
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("Gemini response missing content");
  }

  const parsed = parseJsonText(content);
  return {
    ...normalizeGeminiLinkedInJobs(parsed, {
      keywords: String(keywords || "software engineer"),
      location: String(location || "Remote"),
      limit: Math.max(1, Number(limit) || 5)
    }),
    provider: "gemini-direct",
    model
  };
}

function toCamelAssignment(item) {
  return {
    title: item.title,
    module: item.module,
    dueAt: item.due_at ?? null,
    moduleWeightPercent: Number(item.module_weight_percent ?? 0),
    estimatedHours: Number(item.estimated_hours ?? 0),
    notes: item.notes ?? ""
  };
}

function toSnakeTask(task, index) {
  return {
    id: String(task.id ?? `task-${index + 1}`),
    title: String(task.title ?? task.module ?? `Task ${index + 1}`),
    module: String(task.module ?? "General"),
    due_at: task.dueAt ?? null,
    module_weight_percent: Number(task.moduleWeightPercent ?? 0),
    estimated_hours: Number(task.estimatedHours ?? 0),
    notes: String(task.notes ?? "")
  };
}

function buildMappedTasks(moodleData, careerData) {
  const assignments = Array.isArray(moodleData?.assignments)
    ? moodleData.assignments
    : [];
  const opportunities = Array.isArray(careerData?.opportunities)
    ? careerData.opportunities
    : [];

  const coursework = assignments.map((task) => ({
    title: `Finish ${task.title || "assignment"}`,
    owner: "student",
    kind: "coursework",
    priority: 1
  }));

  const career = opportunities.map((item) => ({
    title: `Prepare for ${item.company || "company"} ${item.role || "opportunity"}`,
    owner: "student",
    kind: "career",
    priority: 1
  }));

  return coursework.concat(career);
}

async function callFastApi(pathname, method = "GET", payload = undefined) {
  if (!FASTAPI_BASE_URL) {
    throw new Error("FASTAPI_BASE_URL is missing");
  }

  const response = await fetch(`${FASTAPI_BASE_URL}${pathname}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`FastAPI ${method} ${pathname} failed: HTTP ${response.status}`);
  }

  return parsed;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    setCors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    try {
      const fastapiHealth = await callFastApi("/api/v1/health");
      sendJson(res, 200, {
        ok: true,
        service: "member4-node-bridge",
        fastapiBaseUrl: FASTAPI_BASE_URL,
        fastapi: fastapiHealth
      });
    } catch (error) {
      sendJson(res, 200, {
        ok: false,
        service: "member4-node-bridge",
        fastapiBaseUrl: FASTAPI_BASE_URL,
        error: error.message
      });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/member4/llm-priority/file") {
    try {
      const fileData = readLatestJsonFile();
      sendJson(res, 200, fileData);
    } catch (error) {
      sendJson(res, 404, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/member4/moodle-sync") {
    try {
      const body = await readJson(req);
      const payload = await callFastApi("/api/v1/scrape", "POST", {
        source_url: "",
        mode: "http",
        raw_html: String(body.moodleHtml || "")
      });

      sendJson(res, 200, {
        source: payload.source || "moodle",
        assignments: (payload.assignments || []).map(toCamelAssignment)
      });
    } catch (error) {
      sendJson(res, 502, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/member4/career-sync") {
    try {
      const body = await readJson(req);
      let opportunities = sampleCareerOpportunities();

      if (body.injectedCareerJson) {
        const parsed = JSON.parse(String(body.injectedCareerJson));
        if (!Array.isArray(parsed)) {
          throw new Error("injectedCareerJson must be a JSON array");
        }
        opportunities = parsed;
      }

      sendJson(res, 200, {
        source: "career",
        opportunities
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/member4/load-data") {
    try {
      const body = await readJson(req);
      let payload = {
        source_url: "",
        scrape_mode: "http",
        custom_prompt:
          "Prioritize by nearest due date, then highest module weighting, then effort.",
        raw_html:
          "<html><body><ul><li>Business Essay Draft</li><li>Math Revision Sheet</li></ul></body></html>"
      };

      if (existsSync(PIPELINE_MOCK_FILE)) {
        payload = {
          ...payload,
          ...JSON.parse(readFileSync(PIPELINE_MOCK_FILE, "utf8"))
        };
      }

      if (body?.rawHtml) {
        payload.raw_html = String(body.rawHtml);
      }

      const workflow = await callFastApi("/api/v1/workflow/run", "POST", payload);
      sendJson(res, 200, {
        mode: "live",
        source: "pipeline-mock",
        requestPayload: payload,
        workflow
      });
    } catch (error) {
      sendJson(res, 502, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/member4/load-jobs") {
    try {
      const body = await readJson(req);
      const keywords = String(body.keywords || "software engineer");
      const location = String(body.location || "Remote");
      const limit = Math.max(1, Number(body.limit) || 5);
      const llmConfig = body.llmConfig || {};

      const payload = await callGeminiLinkedInJobs({
        keywords,
        location,
        limit,
        llmConfig
      });

      const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
      sendJson(res, 200, {
        mode: "live",
        source: "linkedin-gemini",
        query: { keywords, location, limit },
        provider: payload.provider || "gemini-direct",
        model: payload.model || GEMINI_JOB_SEARCH_MODEL,
        summary: payload.summary || "",
        jobCount: jobs.length,
        jobs
      });
    } catch (error) {
      sendJson(res, 502, {
        error: `LinkedIn Gemini job search failed: ${error.message}`
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/member4/clean-map") {
    try {
      const body = await readJson(req);
      const mappedTasks = buildMappedTasks(body.moodleData, body.careerData);
      sendJson(res, 200, {
        schemaVersion: "task-v1",
        mappedTasks
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/member4/llm-priority") {
    try {
      const body = await readJson(req);
      const incomingTasks = Array.isArray(body.tasks) ? body.tasks : [];
      const tasks = incomingTasks.map((task, index) => toSnakeTask(task, index));

      const llmConfig = body.llmConfig || {};
      const llmResponse = await callGeminiPriorityDirect(tasks, llmConfig);
      const llmSource = "gemini-direct";

      const byId = Object.fromEntries(incomingTasks.map((task) => [String(task.id), task]));
      const ratedTasks = (llmResponse.rated_tasks || []).map((task) => ({
        id: task.id,
        title: task.title,
        module: byId[task.id]?.module || "General",
        dueAt: byId[task.id]?.dueAt || null,
        moduleWeightPercent: Number(byId[task.id]?.moduleWeightPercent ?? 0),
        priorityScore: Number(task.priority_score ?? 0),
        priorityBand: task.priority_band,
        reason: task.reason
      }));

      const payload = {
        ratedTasks,
        summary: llmResponse.summary || "Prioritization complete",
        provider: "gemini-direct",
        model: String(llmConfig.model || "gemini-2.5-flash").replace(/^models\//i, ""),
        fallback: Boolean(llmResponse.fallback),
        fallbackReason: llmResponse.fallback_reason || null,
        source: llmSource,
        generatedAt: new Date().toISOString(),
        filePath: LATEST_RESULT_FILE
      };

      writeLatestJsonFile(payload);
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 502, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/member4/demo-seed") {
    try {
      const body = await readJson(req);
      const mappedData = body.mappedData || {};
      const mappedTasks = Array.isArray(mappedData.mappedTasks)
        ? mappedData.mappedTasks
        : [];

      sendJson(res, 200, {
        seeded: true,
        seedId: `golden-path-${Date.now()}`,
        notes: `Received ${mappedTasks.length} mapped task(s)`
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  sendJson(res, 404, { error: "Route not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[member4-node-bridge] listening on http://127.0.0.1:${PORT}`);
  console.log(`[member4-node-bridge] forwarding to FastAPI: ${FASTAPI_BASE_URL}`);
  console.log("[member4-node-bridge] routes: GET /health, POST /member4/*");
});
