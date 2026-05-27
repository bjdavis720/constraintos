export function traceActivityToMilestone(
  activityId,
  relationships = [],
  activities = [],
  milestoneIds = [],
  maxDepth = 25
) {
  if (!activityId || !Array.isArray(relationships) || !Array.isArray(activities)) {
    return null;
  }

  const activityMap = {};

  activities.forEach((activity) => {
    const id = activity.activityId || activity.id;
    if (id) activityMap[String(id)] = activity;
  });

  const successorMap = {};

  relationships.forEach((rel) => {
    const predId = rel.predTaskId || rel.predActivityId;
    const succId = rel.succTaskId || rel.succActivityId;

    if (!predId || !succId) return;

    const predKey = String(predId);
    const succKey = String(succId);

    if (!successorMap[predKey]) successorMap[predKey] = [];
    successorMap[predKey].push(succKey);
  });

  const milestoneSet = new Set(milestoneIds.map(String));
  const visited = new Set();

  function walk(currentId, depth, path) {
    const currentKey = String(currentId);

    if (depth > maxDepth) return null;
    if (visited.has(currentKey)) return null;

    visited.add(currentKey);

    if (milestoneSet.has(currentKey)) {
      const milestone = activityMap[currentKey];

      return {
        milestoneId: currentKey,
        milestoneName:
          milestone?.activityName ||
          milestone?.name ||
          currentKey,
        stepsAway: depth,
        path,
      };
    }

    const successors = successorMap[currentKey] || [];

    for (const successorId of successors) {
      const result = walk(successorId, depth + 1, [...path, successorId]);
      if (result) return result;
    }

    return null;
  }

  return walk(String(activityId), 0, [String(activityId)]);
}