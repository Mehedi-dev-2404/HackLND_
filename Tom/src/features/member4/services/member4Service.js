const DEFAULT_DELAY_MS = 700;
const DEFAULT_POST_TIMEOUT_MS = 20000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl) return "";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

async function postJson(baseUrl, path, payload, options = {}) {
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  if (!normalizeBaseUrl(baseUrl)) {
    throw new Error("No API base URL configured");
  }

  const timeoutMs = Math.max(1000, Number(options.timeoutMs ?? DEFAULT_POST_TIMEOUT_MS));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(`Request timeout after ${timeoutMs}ms`);
  }, timeoutMs);

  try {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`Request timeout after ${timeoutMs}ms for ${path}`);
      }
      throw error;
    }

    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = text ? { raw: text } : {};
    }

    if (!response.ok) {
      const detail = parsed?.error ? `: ${parsed.error}` : "";
      throw new Error(`HTTP ${response.status}${detail}`);
    }

    return parsed;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runWithMockFallback({ baseUrl, path, payload, mockData }) {
  try {
    const data = await postJson(baseUrl, path, payload);
    return {
      mode: "live",
      data
    };
  } catch (error) {
    await wait(DEFAULT_DELAY_MS);
    return {
      mode: "mock",
      data: mockData,
      reason: error.message
    };
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function daysUntil(dueAt) {
  const iso = toIsoString(dueAt);
  if (!iso) return 999;
  const now = Date.now();
  const due = new Date(iso).getTime();
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

function sanitizeTasksForPriority(tasks) {
  if (!Array.isArray(tasks)) return [];

  return tasks.map((task, index) => {
    const dueAt = toIsoString(task.dueAt);
    return {
      id: task.id ?? `task-${index + 1}`,
      title: task.title ?? task.module ?? `Task ${index + 1}`,
      module: task.module ?? "General",
      dueAt,
      moduleWeightPercent: Number(task.moduleWeightPercent ?? 0),
      estimatedHours: Number(task.estimatedHours ?? 0),
      notes: task.notes ?? ""
    };
  });
}

function buildPrompt(tasks, llmConfig) {
  const prompt = llmConfig.customPrompt?.trim()
    ? llmConfig.customPrompt.trim()
    : "You are a strict academic planner. Prioritize tasks by due date urgency and module weighting.";

  return `${prompt}

Return JSON only in this shape:
{
  "ratedTasks": [
    {
      "id": "string",
      "priorityScore": 0-100,
      "priorityBand": "critical|high|medium|low",
      "reason": "short reason"
    }
  ],
  "summary": "short summary"
}

Tasks:
${JSON.stringify(tasks, null, 2)}`;
}

function parseJsonText(rawText) {
  const text = String(rawText || "").trim();
  const fenced = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
  return JSON.parse(fenced);
}

async function callGeminiDirect(tasks, llmConfig) {
  const model = String(llmConfig.model || "gemini-2.5-flash").replace(/^models\//i, "");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    llmConfig.apiKey
  )}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(tasks, llmConfig) }]
        }
      ],
      generationConfig: {
        temperature: llmConfig.temperature,
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

  return parseJsonText(content);
}

function scoreBand(score) {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function runHeuristicPriority(tasks, llmConfig) {
  const tuning = llmConfig.tuning || {};
  const deadlineWeight = Number(tuning.deadlineWeight ?? 0.55);
  const moduleWeight = Number(tuning.moduleWeight ?? 0.35);
  const effortWeight = Number(tuning.effortWeight ?? 0.1);

  const sum = deadlineWeight + moduleWeight + effortWeight || 1;
  const dw = deadlineWeight / sum;
  const mw = moduleWeight / sum;
  const ew = effortWeight / sum;

  const ratedTasks = tasks
    .map((task) => {
      const daysLeft = daysUntil(task.dueAt);
      const urgency = clamp(100 - daysLeft * 9, 0, 100);
      const moduleImpact = clamp(Number(task.moduleWeightPercent) * 2.2, 0, 100);
      const effort = clamp(Number(task.estimatedHours) * 10, 0, 100);
      const priorityScore = Math.round(dw * urgency + mw * moduleImpact + ew * effort);

      return {
        ...task,
        priorityScore,
        priorityBand: scoreBand(priorityScore),
        reason: `Due in ${daysLeft} day(s), module weight ${task.moduleWeightPercent}%`
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    ratedTasks,
    summary: "Heuristic fallback mode used"
  };
}

export async function runLlmPriorityRating({ baseUrl, tasks, llmConfig }) {
  const sanitizedTasks = sanitizeTasksForPriority(tasks);

  if (!sanitizedTasks.length) {
    return {
      mode: "mock",
      data: { ratedTasks: [], summary: "No tasks available to prioritize" },
      reason: "No tasks"
    };
  }

  let backendError = null;

  try {
    const data = await postJson(baseUrl, "/member4/llm-priority", {
      tasks: sanitizedTasks,
      llmConfig: {
        model: llmConfig.model,
        apiKey: llmConfig.apiKey,
        temperature: llmConfig.temperature,
        customPrompt: llmConfig.customPrompt,
        tuning: llmConfig.tuning
      }
    }, { timeoutMs: 45000 });

    return {
      mode: "live",
      data
    };
  } catch (error) {
    backendError = error;
  }

  if (llmConfig.allowDirectApi && llmConfig.apiKey) {
    try {
      const data = await callGeminiDirect(sanitizedTasks, llmConfig);

      return {
        mode: "direct",
        data,
        reason: backendError?.message
      };
    } catch (directError) {
      throw new Error(
        `Backend: ${backendError?.message || "n/a"}; Direct API: ${directError.message}`
      );
    }
  }

  await wait(DEFAULT_DELAY_MS);
  throw new Error(
    backendError?.message || "No backend/direct Gemini API available for live LLM ranking"
  );
}

export async function runMoodleSync({ baseUrl, moodleHtml }) {
  return runWithMockFallback({
    baseUrl,
    path: "/member4/moodle-sync",
    payload: { moodleHtml },
    mockData: {
      source: "moodle",
      assignments: [
        {
          title: "Reviewing econometrics",
          module: "Macroeconomics Essay",
          dueAt: "2026-03-24T16:00:00Z",
          moduleWeightPercent: 20,
          estimatedHours: 4
        },
        {
          title: "Apple essay",
          module: "Business Essay",
          dueAt: "2026-02-23T16:00:00Z",
          moduleWeightPercent: 40,
          estimatedHours: 8
        },
        {
          title: "Mathingy",
          module: "Math",
          dueAt: "2026-02-25T16:00:00Z",
          moduleWeightPercent: 30,
          estimatedHours: 5
        },
        {
          title: "Badminton Training",
          module: "Sport",
          dueAt: "2026-02-26T16:00:00Z",
          moduleWeightPercent: 10,
          estimatedHours: 2
        }
      ]
    }
  });
}

export async function runCareerSync({ baseUrl, injectedCareerJson }) {
  return runWithMockFallback({
    baseUrl,
    path: "/member4/career-sync",
    payload: { injectedCareerJson },
    mockData: {
      source: "career",
      opportunities: [
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
      ]
    }
  });
}

export async function runCleanAndMap({ baseUrl, moodleData, careerData }) {
  return runWithMockFallback({
    baseUrl,
    path: "/member4/clean-map",
    payload: { moodleData, careerData },
    mockData: {
      schemaVersion: "task-v1",
      mappedTasks: [
        {
          title: "Finish Macroeconomics assignment",
          owner: "student",
          kind: "coursework",
          priority: 1
        },
        {
          title: "Practice Python for HSBC technical test",
          owner: "student",
          kind: "career",
          priority: 1
        }
      ]
    }
  });
}

export async function runDemoSeed({ baseUrl, mappedData }) {
  return runWithMockFallback({
    baseUrl,
    path: "/member4/demo-seed",
    payload: { mappedData },
    mockData: {
      seeded: true,
      seedId: "golden-path-001",
      notes: "Stable demo scenario loaded"
    }
  });
}

const MOCK_LOAD_DATA_RESPONSE = {
  mode: "mock",
  source: "pipeline-mock",
  requestPayload: {
    source_url: "",
    scrape_mode: "http",
    custom_prompt:
      "Prioritize by nearest due date, then highest module weighting, then effort.",
    raw_html:
      "<html><body><ul><li>Macroeconomics Essay Draft</li><li>Business Strategy Presentation</li><li>Mathematics Revision Quiz</li><li>Sport Science Reflection</li></ul></body></html>"
  },
  workflow: {
    scrape: {
      source: "inline",
      mode: "http",
      assignment_count: 4,
      assignments: [
        {
          title: "Macroeconomics Essay Draft",
          module: "Economics",
          due_at: "2026-02-23T16:00:00Z",
          module_weight_percent: 40,
          estimated_hours: 6
        },
        {
          title: "Business Strategy Presentation",
          module: "Business",
          due_at: "2026-02-25T16:00:00Z",
          module_weight_percent: 50,
          estimated_hours: 8
        }
      ]
    },
    llm: {
      summary: "Mock prioritization output",
      rated_tasks: [
        { id: "task-1", title: "Business Strategy Presentation", priority_score: 88 },
        { id: "task-2", title: "Macroeconomics Essay Draft", priority_score: 75 }
      ]
    },
    persisted_jobs: 4,
    persisted_tasks: 4
  }
};

export async function runLoadData({ baseUrl, rawHtml = "" }) {
  return runWithMockFallback({
    baseUrl,
    path: "/member4/load-data",
    payload: { rawHtml },
    mockData: MOCK_LOAD_DATA_RESPONSE
  });
}

export async function runLoadJobs({
  baseUrl,
  keywords,
  location,
  limit,
  llmConfig = {}
}) {
  const data = await postJson(baseUrl, "/member4/load-jobs", {
    keywords,
    location,
    limit,
    llmConfig: {
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      temperature: llmConfig.temperature
    }
  }, { timeoutMs: 300000 });
  return {
    mode: String(data?.mode || "live"),
    data
  };
}
