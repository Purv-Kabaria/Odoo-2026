import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { formatTableDate } from "@/lib/date-format";
import { humanizeEnum } from "@/lib/labels";

type Allocation = {
  id: string;
  allocatedAt: string;
  returnedAt: string | null;
  returnCondition: string | null;
  toEmployee: { id: string; name: string } | null;
  toDepartment: { id: string; name: string } | null;
};

type MaintenanceRequest = {
  id: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  resolvedAt: string | null;
};

type Asset = {
  id: string;
  assetTag: string;
  name: string;
  status: string;
  condition: string;
  location: string | null;
  serialNumber: string | null;
  isBookable: boolean;
  category: { id: string; name: string };
  allocations: Allocation[];
  maintenanceRequests: MaintenanceRequest[];
};

export function AssetDetail({ asset }: { asset: Asset; canManage: boolean }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <Link href="/assets" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to directory
      </Link>

      <div className="mb-5 flex flex-col gap-3 border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-xs text-muted-foreground">{asset.assetTag}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{asset.name}</h1>
          <p className="text-sm text-muted-foreground">{asset.category.name}</p>
        </div>
        <StatusBadge kind="assetStatus" status={asset.status} className="w-fit" />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 border border-border bg-card p-4 shadow-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Condition</p>
          <p className="text-sm font-medium">
            <StatusBadge kind="assetCondition" status={asset.condition} />
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Location</p>
          <p className="text-sm font-medium">{asset.location ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Serial</p>
          <p className="text-sm font-medium">{asset.serialNumber ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Bookable</p>
          <p className="text-sm font-medium">{asset.isBookable ? "Yes" : "No"}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Allocation history</h2>
          {asset.allocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No allocations yet.</p>
          ) : (
            <ul className="space-y-2">
              {asset.allocations.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="text-muted-foreground">{formatTableDate(a.allocatedAt)}</span> — Allocated to{" "}
                  <span className="font-medium">{a.toEmployee?.name ?? a.toDepartment?.name}</span>
                  {a.returnedAt && (
                    <span className="text-muted-foreground">
                      {" "}— Returned {formatTableDate(a.returnedAt)}
                      {a.returnCondition ? ` (condition: ${humanizeEnum(a.returnCondition)})` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Maintenance history</h2>
          {asset.maintenanceRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No maintenance requests yet.</p>
          ) : (
            <ul className="space-y-2">
              {asset.maintenanceRequests.map((m) => (
                <li key={m.id} className="text-sm">
                  <span className="text-muted-foreground">{formatTableDate(m.createdAt)}</span> — {m.description}{" "}
                  <StatusBadge kind="maintenanceStatus" status={m.status} className="ml-1" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
