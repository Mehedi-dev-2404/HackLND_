import React from "react";

const STATUS_LABELS = {
  idle: "Idle",
  running: "Running",
  done: "Done",
  failed: "Failed"
};

export default function TaskCard({
  title,
  description,
  state,
  onRun,
  disabled
}) {
  const status = state?.status ?? "idle";

  return (
    <article className="task-card">
      <h3 className="task-title">{title}</h3>
      <p className="task-desc">{description}</p>

      <div className="status-row">
        <span className={`badge ${status}`}>{STATUS_LABELS[status]}</span>
        <span className="small">{state?.message}</span>
      </div>

      <div className="status-row">
        <button
          type="button"
          className="primary"
          onClick={onRun}
          disabled={disabled || status === "running"}
        >
          Run
        </button>
      </div>
    </article>
  );
}
