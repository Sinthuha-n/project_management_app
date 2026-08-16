import { RouteLoadingState } from '@/components/shared/RouteBoundaryState';

export default function BacklogLoading() {
  return <RouteLoadingState title="Loading backlog" subtitle="Fetching tasks and backlog filters." variant="cards" />;
}
