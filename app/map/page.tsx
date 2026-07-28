import { MapScreen } from "../../components/Map";
import { TopBar } from "../../components/Chrome";

export default function Page() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar />
      <MapScreen />
    </div>
  );
}
