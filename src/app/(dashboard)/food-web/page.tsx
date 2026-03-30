import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { buildTopologyData } from "@/lib/engines/topology-builder";
import { foodWebQueryKey } from "@/lib/food-web-query-key";
import FoodWebClient from "./food-web-client";

const DEMO_USER_ID = "demo-user";

export default async function FoodWebPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: [...foodWebQueryKey()],
    queryFn: () => buildTopologyData(DEMO_USER_ID, { minWeight: 1 }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FoodWebClient />
    </HydrationBoundary>
  );
}
