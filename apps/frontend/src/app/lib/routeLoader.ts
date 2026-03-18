import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';

export const startRouteLoader = () => {
  useRouteLoaderStore.getState().start();
};

export const stopRouteLoader = () => {
  useRouteLoaderStore.getState().stop();
};
