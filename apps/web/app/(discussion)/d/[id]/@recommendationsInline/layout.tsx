import { RecommendationsPanel } from "@/components/recommendations/recommendations-panel";

export default async function Layout({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);

  return <RecommendationsPanel items={[]} layout="inline" />;
}
