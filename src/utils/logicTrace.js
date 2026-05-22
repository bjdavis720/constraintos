export function traceActivityToMilestone(
  activityId,
  relationships,
  activities,
  milestoneIds = [],
  maxDepth = 15
) {
  const activityMap = {};
  activities.forEach((a) => {
    activityMap[a.id] = a;
  });

  const successorMap = {};

  relationships.forEach((rel) => {
    if (!successorMap[rel.predTaskId]) {
      successorMap[rel.predTaskId] = [];
    }

    successorMap[rel.predTaskId].push(rel.succTaskId);
  });

  const visited = new Set();

  function walk(currentId, depth, path) {
    if (depth > maxDepth) return null;

    if (visited.has(currentId)) return null;

    visited.add(currentId);

    if (milestoneIds.includes(currentId)) {
      return {
        milestoneId: currentId,
        milestoneName: activityMap[currentId]?.name || currentId,
        stepsAway: depth,
        path,
      };
    }

    const successors = successorMap[currentId] || [];

    for (const succId of successors) {
      const result = walk(
        succId,
        depth + 1,
        [...path, succId]
      );

      if (result) return result;
    }

    return null;
  }

  return walk(activityId, 0, [activityId]);
}