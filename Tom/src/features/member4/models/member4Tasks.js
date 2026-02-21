export const MEMBER4_TASKS = [
  {
    id: "moodleSync",
    title: "Moodle Sync",
    description:
      "Pull Upcoming Events / Grades HTML from Moodle test account (or use sample input)."
  },
  {
    id: "careerSync",
    title: "Career Sync",
    description:
      "Pull Bright Network + LeetCode deadline data, or inject mock JSON."
  },
  {
    id: "cleanMap",
    title: "Clean + Map",
    description:
      "Normalise scraped data and map it into backend task schema."
  },
  {
    id: "seedDemo",
    title: "Golden Path Seed",
    description:
      "Prepare stable demo data if real scraping is flaky during the hackathon."
  }
];

export const createInitialTaskState = () =>
  Object.fromEntries(
    MEMBER4_TASKS.map((task) => [
      task.id,
      {
        status: "idle",
        lastRunMode: null,
        updatedAt: null,
        message: "Not run yet"
      }
    ])
  );
