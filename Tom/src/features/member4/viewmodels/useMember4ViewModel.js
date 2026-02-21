import { useMemo, useState } from "react";
import {
  MEMBER4_TASKS,
  createInitialTaskState
} from "../models/member4Tasks";
import {
  runCareerSync,
  runCleanAndMap,
  runDemoSeed,
  runMoodleSync
} from "../services/member4Service";

function nowLabel() {
  return new Date().toLocaleTimeString();
}

export default function useMember4ViewModel() {
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [moodleHtml, setMoodleHtml] = useState("");
  const [injectedCareerJson, setInjectedCareerJson] = useState("");
  const [taskState, setTaskState] = useState(createInitialTaskState);
  const [logs, setLogs] = useState([
    `[${nowLabel()}] Ready. Start with Moodle Sync or Career Sync.`
  ]);
  const [dataStore, setDataStore] = useState({
    moodle: null,
    career: null,
    mapped: null,
    seed: null
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

  const resetAll = () => {
    setTaskState(createInitialTaskState());
    setDataStore({ moodle: null, career: null, mapped: null, seed: null });
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
    runTask,
    resetAll,
    overallProgress
  };
}
