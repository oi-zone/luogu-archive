import { RecommendationsPanel } from "@/components/recommendations/recommendations-panel";

export default async function Layout({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;

  return <RecommendationsPanel items={[]} layout="inline" />;
}
