import { useEffect, useState } from "react";
import { getStoreStatus } from "@/lib/store-hours";

export function StoreHoursLabel() {
  const [status, setStatus] = useState(() => getStoreStatus());
  useEffect(() => {
    const id = setInterval(() => setStatus(getStoreStatus()), 60_000);
    return () => clearInterval(id);
  }, []);
  return <>{status.label}</>;
}
