import { useStoreStatus } from "@/lib/store-open";

export function StoreHoursLabel() {
  const status = useStoreStatus();
  return <>{status.label}</>;
}
