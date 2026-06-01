import Papa from "papaparse";

function SubmittalReadiness({
  project = "",
  submittals = [],
  scheduleActivities = [],
  issues = [],
  updateCurrentProjectData = () => {},
}) {
  function handleFileUpload(event) {
    const file = event.target.files[0];

    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,

      complete: function (results) {
        const formattedSubmittals = results.data.map((row, index) => ({
          id: Date.now() + index,

          title:
            row.Title ||
            row.title ||
            "Unnamed Submittal",

          specSection:
            row["Spec Section"] ||
            row.specSection ||
            "",

          responsibleContractor:
            row["Responsible Contractor"] ||
            row.responsibleContractor ||
            "",

          status:
            row.Status ||
            row.status ||
            "Open",

          submitBy:
            row["Submit By"] ||
            row.submitBy ||
            "",

          dueDate:
            row["Due Date"] ||
            row.dueDate ||
            "",

          returnedDate:
            row["Returned Date"] ||
            row.returnedDate ||
            "",

          leadTimeDays: 30,

          readinessStatus: "Imported",
        }));

        updateCurrentProjectData({
          submittals: formattedSubmittals,
        });

        alert(
          `${formattedSubmittals.length} submittals imported successfully.`
        );
      },
    });
  }

  function findSuggestedActivity(submittal) {
    if (
      !Array.isArray(scheduleActivities) ||
      scheduleActivities.length === 0
    ) {
      return null;
    }

    const submittalText = [
      submittal?.title,
      submittal?.specSection,
      submittal?.responsibleContractor,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!submittalText.trim()) {
      return null;
    }

    const scoredActivities = scheduleActivities
      .filter(
        (activity) =>
          activity && typeof activity === "object"
      )
      .map((activity) => {
        const activityName =
          activity.activityName ||
          activity.name ||
          activity.ActivityName ||
          activity["Activity Name"] ||
          "";

        const activityId =
          activity.activityId ||
          activity.id ||
          activity.ActivityID ||
          activity["Activity ID"] ||
          "";

        const activityText =
          `${activityId} ${activityName}`.toLowerCase();

        let score = 0;

        submittalText
          .split(/\s+/)
          .filter((word) => word.length >= 4)
          .forEach((word) => {
            if (activityText.includes(word)) {
              score += 1;
            }
          });

        return {
          activityId,
          activityName,

          activityStart:
            activity.start ||
            activity.Start ||
            activity["Start"] ||
            "",

          activityFinish:
            activity.finish ||
            activity.Finish ||
            activity["Finish"] ||
            "",

          score,
        };
      });

    return (
      scoredActivities
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)[0] ||
      null
    );
  }

  function getNeededByDate(
    submittal,
    suggestedMatch
  ) {
    if (
      !suggestedMatch ||
      !suggestedMatch.activityStart
    ) {
      return "-";
    }

    const activityStart = new Date(
      suggestedMatch.activityStart
    );

    if (
      Number.isNaN(activityStart.getTime())
    ) {
      return "-";
    }

    const leadTimeDays = Number(
      submittal?.leadTimeDays || 30
    );

    const neededByDate = new Date(
      activityStart
    );

    neededByDate.setDate(
      neededByDate.getDate() - leadTimeDays
    );

    return neededByDate
      .toISOString()
      .split("T")[0];
  }

  function getReadinessStatus(
    submittal,
    suggestedMatch
  ) {
    if (!suggestedMatch) return "Unmapped";

    const status = (
      submittal.status || ""
    ).toLowerCase();

    const activityStart =
      suggestedMatch.activityStart
        ? new Date(
            suggestedMatch.activityStart
          )
        : null;

    if (status.includes("approved"))
      return "Ready";

    if (
      !activityStart ||
      Number.isNaN(activityStart.getTime())
    ) {
      return "No Activity Date";
    }

    const leadTimeDays = Number(
      submittal.leadTimeDays || 30
    );

    const neededByDate = new Date(
      activityStart
    );

    neededByDate.setDate(
      neededByDate.getDate() - leadTimeDays
    );

    const today = new Date();

    const daysUntilNeeded = Math.ceil(
      (neededByDate - today) /
        (1000 * 60 * 60 * 24)
    );

    if (daysUntilNeeded < 0)
      return "Late";

    if (daysUntilNeeded <= 14)
      return "Critical";

    if (daysUntilNeeded <= 30)
      return "At Risk";

    return "Tracking";
  }

  function createSubmittalIssue(
    submittal,
    suggestedMatch
  ) {
    const readiness =
      getReadinessStatus(
        submittal,
        suggestedMatch
      );

    if (
      readiness !== "Critical" &&
      readiness !== "Late"
    ) {
      alert(
        "Only Critical or Late submittals create issues."
      );

      return;
    }

    const newIssue = {
      id: Date.now(),

      title: `${submittal.title} submittal is ${readiness}`,

      source: "Submittal Readiness",

      scheduleDeltaType:
        "Procurement Risk",

      activityId:
        suggestedMatch?.activityId || "",

      start:
        suggestedMatch?.activityStart ||
        "",

      finish:
        suggestedMatch?.activityFinish ||
        "",

      totalFloat: "",

      milestone:
        suggestedMatch?.activityName ||
        "Unassigned",

      status: "Open",

      manuallyEscalated:
        readiness === "Late",

      createdAt:
        new Date().toISOString(),

      notes:
        "Submittal requires attention before activity start.",
    };

    updateCurrentProjectData({
      issues: [...issues, newIssue],
    });

    alert(
      `${submittal.title} issue added to Issues Board.`
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Submittal Readiness</h1>
          <p>{project}</p>
        </div>
      </div>

      <div className="card">
        <h2>Import Procore Submittal Log</h2>

        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
        />
      </div>

      <div className="data-card">
        <h2>Imported Submittals</h2>

        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Spec Section</th>
              <th>Responsible Contractor</th>
              <th>Status</th>
              <th>Suggested Activity ID</th>
              <th>Suggested Activity</th>
              <th>Match Score</th>
              <th>Activity Start</th>
              <th>Activity Finish</th>
              <th>Needed By</th>
              <th>Readiness</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {submittals.length === 0 && (
              <tr>
                <td colSpan="12">
                  No submittals imported.
                </td>
              </tr>
            )}

            {submittals.map((submittal) => {
              const suggestedMatch =
                findSuggestedActivity(
                  submittal
                );

              return (
                <tr key={submittal.id}>
                  <td>{submittal.title}</td>

                  <td>
                    {submittal.specSection}
                  </td>

                  <td>
                    {
                      submittal.responsibleContractor
                    }
                  </td>

                  <td>
                    {submittal.status}
                  </td>

                  <td>
                    {suggestedMatch?.activityId ||
                      "No match"}
                  </td>

                  <td>
                    {suggestedMatch?.activityName ||
                      "No suggested activity"}
                  </td>

                  <td>
                    {suggestedMatch?.score || 0}
                  </td>

                  <td>
                    {suggestedMatch?.activityStart ||
                      "-"}
                  </td>

                  <td>
                    {suggestedMatch?.activityFinish ||
                      "-"}
                  </td>

                  <td>
                    {getNeededByDate(
                      submittal,
                      suggestedMatch
                    )}
                  </td>

                  <td>
                    <span
                      className={`readiness-pill ${getReadinessStatus(
                        submittal,
                        suggestedMatch
                      )
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {getReadinessStatus(
                        submittal,
                        suggestedMatch
                      )}
                    </span>
                  </td>

                  <td>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        createSubmittalIssue(
                          submittal,
                          suggestedMatch
                        )
                      }
                    >
                      Create Issue
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SubmittalReadiness;