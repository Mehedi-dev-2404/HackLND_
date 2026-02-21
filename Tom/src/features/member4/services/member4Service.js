const DEFAULT_DELAY_MS = 700;


const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl) return "";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

async function postJson(baseUrl, path, payload) {
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  if (!normalizeBaseUrl(baseUrl)) {
    throw new Error("No API base URL configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
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

export async function runMoodleSync({ baseUrl, moodleHtml }) {
  return runWithMockFallback({
    baseUrl,
    path: "/member4/moodle-sync",
    payload: { moodleHtml },
    mockData: {
      source: "moodle",
      assignments: [
        { title: "Reviewing econometrics", module: "Macroeconomics Essay", dueAt: new Date("2026-03-24T16:00:00Z"), priority: 1},
        { title: "Apple essay", module: "Business Essay", dueAt: "2026-02-23T16:00:00Z", priority: 2 },
        { title: "Mathingy", module: "Math", dueAt: "2026-02-25T16:00:00Z", priority: 3 },
        { title: "Badminton Training", module: "Sport", dueAt: "2026-02-26T16:00:00Z", priority: 4 }
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
