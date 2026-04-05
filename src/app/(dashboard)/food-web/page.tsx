import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { buildTopologyData } from "@/lib/engines/topology-builder";
import { foodWebQueryKey } from "@/lib/food-web-query-key";
import { resolveUserId } from "@/lib/auth/user-service";
import FoodWebClient from "./food-web-client";

export default async function FoodWebPage() {
  const userId = await resolveUserId();
  if (!userId) redirect("/login");

  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: [...foodWebQueryKey({ pantryOnly: true, minWeight: 1 })],
    queryFn: () => buildTopologyData(userId, { pantryOnly: true, minWeight: 1 }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FoodWebClient />
    </HydrationBoundary>
  );
}
