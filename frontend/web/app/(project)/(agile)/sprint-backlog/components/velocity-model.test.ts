import type { SprintVelocityPoint } from '@/services/tasks-contract';
import { calculateVelocityMetrics, selectVelocityRange } from './velocity-model';

const sprint = (
  id: number,
  committedPoints: number,
  completedPoints: number,
  commitmentCaptured = true,
): SprintVelocityPoint => ({
  sprintId: id,
  sprintName: `Sprint ${id}`,
  startDate: null,
  endDate: null,
  completedAt: null,
  committedPoints,
  completedPoints,
  commitmentCaptured,
});

describe('velocity model', () => {
  it('calculates weighted predictability and delivery metrics', () => {
    const metrics = calculateVelocityMetrics([
      sprint(1, 10, 8),
      sprint(2, 20, 24),
      sprint(3, 30, 21),
    ]);

    expect(metrics).toEqual(expect.objectContaining({
      averageDelivered: 17.7,
      predictability: 88,
      latestDelta: -3,
    }));
    expect(metrics?.best.sprintId).toBe(2);
  });

  it('excludes legacy and zero-commitment rows from predictability', () => {
    const metrics = calculateVelocityMetrics([
      sprint(1, 20, 18, false),
      sprint(2, 0, 5),
    ]);

    expect(metrics?.predictability).toBeNull();
  });

  it('selects the newest requested sprint range', () => {
    const sprints = Array.from({ length: 14 }, (_, index) => sprint(index + 1, 10, 8));
    expect(selectVelocityRange(sprints, 6).map((item) => item.sprintId)).toEqual([9, 10, 11, 12, 13, 14]);
    expect(selectVelocityRange(sprints, 'all')).toHaveLength(14);
  });
});
