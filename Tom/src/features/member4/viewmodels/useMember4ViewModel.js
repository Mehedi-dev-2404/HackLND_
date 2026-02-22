import { useMemo, useState } from "react";
import {
  MEMBER4_TASKS,
  createInitialTaskState
} from "../models/member4Tasks";
import {
  runCareerSync,
  runCleanAndMap,
  runDemoSeed,
  runLoadData,
  runLoadJobs,
  runLlmPriorityRating,
  runMoodleSync
} from "../services/member4Service";

function nowLabel() {
  return new Date().toLocaleTimeString();
}

function safeParseJson(text, fallbackValue = {}) {
  try {
    return JSON.parse(text);
  } catch {
    return fallbackValue;
  }
}

export default function useMember4ViewModel() {
  const [apiBaseUrl, setApiBaseUrl] = useState("http://127.0.0.1:8010");
  const [moodleHtml, setMoodleHtml] = useState("");
  const [injectedCareerJson, setInjectedCareerJson] = useState("");
  const [moduleWeightsJson, setModuleWeightsJson] = useState(`{
  "Macroeconomics Essay": 40,
  "Business Essay": 50,
  "Math": 30,
  "Sport": 10
}`);

  const [llmModel, setLlmModel] = useState("gemini-2.5-flash");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmTemperature, setLlmTemperature] = useState(0.2);
  const [allowDirectApi, setAllowDirectApi] = useState(false);
  const [llmCustomPrompt, setLlmCustomPrompt] = useState(
    "Prioritize by near due date and high module weight. Penalize tasks with far deadlines."
  );
  const [deadlineWeight, setDeadlineWeight] = useState(0.55);
  const [moduleWeight, setModuleWeight] = useState(0.35);
  const [effortWeight, setEffortWeight] = useState(0.1);
  const [jobKeywords, setJobKeywords] = useState("software engineer");
  const [jobLocation, setJobLocation] = useState("Toronto");
  const [jobLimit, setJobLimit] = useState(5);

  const [taskState, setTaskState] = useState(createInitialTaskState);
  const [logs, setLogs] = useState([
    `[${nowLabel()}] Ready. Start with Moodle Sync or Career Sync.`
  ]);
  const [dataStore, setDataStore] = useState({
    moodle: null,
    career: null,
    mapped: null,
    priorityRatings: null,
    seed: null,
    pipeline: null,
    jobs: null
  });

  const overallProgress = useMemo(() => {
    const doneCount = Object.values(taskState).filter(
      (task) => task.status === "done"
    ).length;
    return Math.round((doneCount / MEMBER4_TASKS.length) * 100);
  }, [taskState]);

  const appendLog = (message) => {
    setLogs((current) => [`[${nowLabel()}] ${message}`, ...current]);
  };

  const setTask = (taskId, patch) => {
    setTaskState((current) => ({
      ...current,
      [taskId]: {
        ...current[taskId],
        ...patch,
        updatedAt: new Date().toISOString()
      }
    }));
  };

  const getPriorityInputTasks = () => {
    const moduleWeights = safeParseJson(moduleWeightsJson, {});
    const moodleAssignments = dataStore.moodle?.assignments ?? [];

    return moodleAssignments.map((task, index) => {
      const moduleFromTask = task.module ?? "General";
      const fromConfig = Number(moduleWeights[moduleFromTask]);
      const fromTask = Number(task.moduleWeightPercent ?? 0);

      return {
        id: task.id ?? `moodle-${index + 1}`,
        title: task.title ?? moduleFromTask,
        module: moduleFromTask,
        dueAt: task.dueAt,
        moduleWeightPercent: Number.isFinite(fromConfig) && fromConfig > 0 ? fromConfig : fromTask,
        estimatedHours: Number(task.estimatedHours ?? 0),
        notes: task.notes ?? ""
      };
    });
  };

  const runTask = async (taskId) => {
    setTask(taskId, { status: "running", message: "Running..." });

    try {
      if (taskId === "moodleSync") {
        const result = await runMoodleSync({ baseUrl: apiBaseUrl, moodleHtml });
        setDataStore((current) => ({ ...current, moodle: result.data }));
        setTask(taskId, {
          status: "done",
          lastRunMode: result.mode,
          message:
            result.mode === "live"
              ? "Moodle data synced from API"
              : `Mock Moodle data loaded (${result.reason})`
        });
        appendLog(`Moodle Sync finished in ${result.mode.toUpperCase()} mode.`);
        return;
      }

      if (taskId === "careerSync") {
        const result = await runCareerSync({
          baseUrl: apiBaseUrl,
          injectedCareerJson
        });
        setDataStore((current) => ({ ...current, career: result.data }));
        setTask(taskId, {
          status: "done",
          lastRunMode: result.mode,
          message:
            result.mode === "live"
              ? "Career data synced from API"
              : `Mock career data loaded (${result.reason})`
        });
        appendLog(`Career Sync finished in ${result.mode.toUpperCase()} mode.`);
        return;
      }

      if (taskId === "cleanMap") {
        const result = await runCleanAndMap({
          baseUrl: apiBaseUrl,
          moodleData: dataStore.moodle,
          careerData: dataStore.career
        });
        setDataStore((current) => ({ ...current, mapped: result.data }));
        setTask(taskId, {
          status: "done",
          lastRunMode: result.mode,
          message:
            result.mode === "live"
              ? "Data cleaned and mapped"
              : `Mock mapped data used (${result.reason})`
        });
        appendLog(`Clean + Map finished in ${result.mode.toUpperCase()} mode.`);
        return;
      }

      if (taskId === "llmPriority") {
        const ratingInputTasks = getPriorityInputTasks();

        const result = await runLlmPriorityRating({
          baseUrl: apiBaseUrl,
          tasks: ratingInputTasks,
          llmConfig: {
            model: llmModel,
            apiKey: llmApiKey,
            temperature: Number(llmTemperature),
            allowDirectApi,
            customPrompt: llmCustomPrompt,
            tuning: {
              deadlineWeight: Number(deadlineWeight),
              moduleWeight: Number(moduleWeight),
              effortWeight: Number(effortWeight)
            }
          }
        });

        setDataStore((current) => ({ ...current, priorityRatings: result.data }));
        const modeLabel = result.mode === "direct" ? "direct API" : result.mode;
        setTask(taskId, {
          status: "done",
          lastRunMode: result.mode,
          message:
            result.mode === "live"
              ? "Priority ratings generated by backend LLM"
              : result.mode === "direct"
                ? "Priority ratings generated by direct LLM call"
                : `Priority ratings generated by fallback (${result.reason})`
        });
        appendLog(`LLM Priority finished in ${modeLabel.toUpperCase()} mode.`);
        return;
      }

      if (taskId === "seedDemo") {
        const result = await runDemoSeed({
          baseUrl: apiBaseUrl,
          mappedData: dataStore.mapped
        });
        setDataStore((current) => ({ ...current, seed: result.data }));
        setTask(taskId, {
          status: "done",
          lastRunMode: result.mode,
          message:
            result.mode === "live"
              ? "Demo data seeded to backend"
              : `Mock seed completed (${result.reason})`
        });
        appendLog(`Golden Path Seed finished in ${result.mode.toUpperCase()} mode.`);
      }
    } catch (error) {
      setTask(taskId, {
        status: "failed",
        message: error.message || "Task failed"
      });
      appendLog(`${taskId} failed: ${error.message || "Unknown error"}`);
    }
  };

  const normalizeAssignmentsFromPipeline = (assignments) => {
    if (!Array.isArray(assignments)) return [];
    return assignments.map((item, index) => ({
      id: `pipeline-${index + 1}`,
      title: item.title ?? `Assignment ${index + 1}`,
      module: item.module ?? "General",
      dueAt: item.due_at ?? null,
      moduleWeightPercent: Number(item.module_weight_percent ?? 0),
      estimatedHours: Number(item.estimated_hours ?? 0),
      notes: item.notes ?? ""
    }));
  };

  const loadData = async () => {
    try {
      const result = await runLoadData({
        baseUrl: apiBaseUrl,
        rawHtml: moodleHtml
      });
      const workflow = result.data?.workflow ?? {};
      const assignments = normalizeAssignmentsFromPipeline(
        workflow?.scrape?.assignments ?? []
      );

      setDataStore((current) => ({
        ...current,
        pipeline: result.data,
        moodle: {
          source: workflow?.scrape?.source ?? "pipeline",
          assignments
        },
        priorityRatings: {
          ratedTasks: workflow?.llm?.rated_tasks ?? [],
          summary: workflow?.llm?.summary ?? ""
        }
      }));

      const resolvedMode = result.data?.mode || result.mode;
      appendLog(
        `Load Data finished in ${String(resolvedMode).toUpperCase()} mode. Jobs persisted: ${
          workflow?.persisted_jobs ?? 0
        }, tasks persisted: ${workflow?.persisted_tasks ?? 0}.`
      );
    } catch (error) {
      appendLog(`Load Data failed: ${error.message || "Unknown error"}`);
    }
  };

  const loadJobs = async () => {
    try {
      const result = await runLoadJobs({
        baseUrl: apiBaseUrl,
        keywords: jobKeywords,
        location: jobLocation,
        limit: Number(jobLimit),
        llmConfig: {
          model: llmModel,
          apiKey: llmApiKey,
          temperature: Number(llmTemperature)
        }
      });
      setDataStore((current) => ({ ...current, jobs: result.data }));
      const resolvedMode = result.data?.mode || result.mode;
      appendLog(
        `Load Jobs finished in ${String(resolvedMode).toUpperCase()} mode. Received ${
          result.data?.jobCount ?? 0
        } jobs for "${jobKeywords}" in "${jobLocation}".`
      );
    } catch (error) {
      appendLog(`Load Jobs failed: ${error.message || "Unknown error"}`);
    }
  };

  const resetAll = () => {
    setTaskState(createInitialTaskState());
    setDataStore({
      moodle: null,
      career: null,
      mapped: null,
      priorityRatings: null,
      seed: null,
      pipeline: null,
      jobs: null
    });
    setLogs([`[${nowLabel()}] State reset.`]);
  };

  return {
    tasks: MEMBER4_TASKS,
    taskState,
    dataStore,
    logs,
    apiBaseUrl,
    setApiBaseUrl,
    moodleHtml,
    setMoodleHtml,
    injectedCareerJson,
    setInjectedCareerJson,
    moduleWeightsJson,
    setModuleWeightsJson,
    llmModel,
    setLlmModel,
    llmApiKey,
    setLlmApiKey,
    llmTemperature,
    setLlmTemperature,
    allowDirectApi,
    setAllowDirectApi,
    llmCustomPrompt,
    setLlmCustomPrompt,
    deadlineWeight,
    setDeadlineWeight,
    moduleWeight,
    setModuleWeight,
    effortWeight,
    setEffortWeight,
    jobKeywords,
    setJobKeywords,
    jobLocation,
    setJobLocation,
    jobLimit,
    setJobLimit,
    runTask,
    loadData,
    loadJobs,
    resetAll,
    overallProgress
  };
}
