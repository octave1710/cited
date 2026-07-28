import { AutopsyScreen } from "../../components/Autopsy";
import { TopBar } from "../../components/Chrome";

export default async function Page({ searchParams }: { searchParams: Promise<{ domain?: string; q?: string }> }) {
  const sp = await searchParams;
  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar />
      <AutopsyScreen initialDomain={sp.domain} initialQuestion={sp.q} />
    </div>
  );
}
