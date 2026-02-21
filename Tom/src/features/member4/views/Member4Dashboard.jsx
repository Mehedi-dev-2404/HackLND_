import React from "react";
import TaskCard from "../../../shared/components/TaskCard";
import useMember4ViewModel from "../viewmodels/useMember4ViewModel";

export default function Member4Dashboard() {
  const vm = useMember4ViewModel();

  return (
    <section className="dashboard">
      <div className="stack">
        <section className="panel">
          <h2>Runner Config</h2>
          <label htmlFor="apiBaseUrl">Backend API Base URL (optional)</label>
          <input
            id="apiBaseUrl"
            type="text"
            placeholder="http://localhost:8000"
            value={vm.apiBaseUrl}
            onChange={(event) => vm.setApiBaseUrl(event.target.value)}
          />
          <p className="small">
            If URL is empty or endpoint fails, the UI auto-falls back to mock mode.
          </p>

          <div style={{ marginTop: 12 }}>
            <label htmlFor="moodleHtml">Moodle HTML (optional raw input)</label>
            <textarea
              id="moodleHtml"
              placeholder="Paste captured Moodle HTML here"
              value={vm.moodleHtml}
              onChange={(event) => vm.setMoodleHtml(event.target.value)}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <label htmlFor="careerJson">Career JSON Inject (optional)</label>
            <textarea
              id="careerJson"
              placeholder='[{"company":"HSBC","role":"Summer Internship"}]'
              value={vm.injectedCareerJson}
              onChange={(event) => vm.setInjectedCareerJson(event.target.value)}
            />
          </div>
        </section>

        <section className="panel">
          <div className="row" style={{ marginBottom: 8 }}>
            <div>
              <h2 style={{ marginBottom: 6 }}>Member 4 Tasks</h2>
              <p className="small">Progress: {vm.overallProgress}%</p>
            </div>
            <button type="button" className="secondary" onClick={vm.resetAll}>
              Reset
            </button>
          </div>

          <div className="stack">
            {vm.tasks.map((task) => (
              <TaskCard
                key={task.id}
                title={task.title}
                description={task.description}
                state={vm.taskState[task.id]}
                onRun={() => vm.runTask(task.id)}
              />
            ))}
          </div>
        </section>
      </div>

      <aside className="stack">
        <section className="panel">
          <h3>Live Data Snapshot</h3>
          <p className="small">Last outputs from each run step.</p>
          <div className="log-box">
            <pre className="log-line">
{JSON.stringify(vm.dataStore, null, 2)}
            </pre>
          </div>
        </section>

        <section className="panel">
          <h3>Run Log</h3>
          <div className="log-box">
            {vm.logs.map((line, index) => (
              <p className="log-line" key={`${line}-${index}`}>
                {line}
              </p>
            ))}
          </div>
        </section>
      </aside>
    </section>
  );
}
