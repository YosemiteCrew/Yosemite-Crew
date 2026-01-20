import { YosemiteLoader } from "./components/Loader";

export default function Loading() {
  return <YosemiteLoader variant="fullscreen" size={160} testId="app-route-loader" />;
}
