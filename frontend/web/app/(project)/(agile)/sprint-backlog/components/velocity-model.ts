import type { SprintVelocityPoint } from '@/services/tasks-contract';

export type VelocityRange = 6 | 12 | 'all';

export type VelocityMetrics = {
  averageDelivered: number;
  predictability: number | null;
  latest: SprintVelocityPoint;
  latestDelta: number | null;
  best: SprintVelocityPoint;
};

export const selectVelocityRange = (
  sprints: SprintVelocityPoint[],
  range: VelocityRange,
): SprintVelocityPoint[] => range === 'all' ? sprints : sprints.slice(-range);

export const calculateVelocityMetrics = (sprints: SprintVelocityPoint[]): VelocityMetrics | null => {
  if (sprints.length === 0) return null;

  const totalDelivered = sprints.reduce((total, sprint) => total + sprint.completedPoints, 0);
  const captured = sprints.filter((sprint) => sprint.commitmentCaptured && sprint.committedPoints > 0);
  const committed = captured.reduce((total, sprint) => total + sprint.committedPoints, 0);
  const deliveredAgainstCommitment = captured.reduce((total, sprint) => total + sprint.completedPoints, 0);
  const latest = sprints[sprints.length - 1];
  const previous = sprints.length > 1 ? sprints[sprints.length - 2] : null;
  const best = sprints.reduce((currentBest, sprint) => (
    sprint.completedPoints > currentBest.completedPoints ? sprint : currentBest
  ));

  return {
    averageDelivered: Math.round((totalDelivered / sprints.length) * 10) / 10,
    predictability: committed > 0 ? Math.round((deliveredAgainstCommitment / committed) * 100) : null,
    latest,
    latestDelta: previous ? latest.completedPoints - previous.completedPoints : null,
    best,
  };
};
