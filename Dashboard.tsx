import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/KpiCard";
import StatusBadge from "@/components/StatusBadge";
import {
  Package,
  AlertTriangle,
  XCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Dashboard = () => {
  const { data: kpis } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_kpis");
      if (error) throw error;
      return data as {
        total_products: number;
        total_in_stock: number;
        low_stock_count: number;
        out_of_stock_count: number;
        pending_receipts: number;
        pending_deliveries: number;
        scheduled_transfers: number;
      };
    },
  });

  const { data: recentMoves } = useQuery({
    queryKey: ["recent-moves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_ledger")
        .select("*, products(name, sku)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ["low-stock-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, current_stock, reorder_level")
        .gt("current_stock", 0)
        .order("current_stock", { ascending: true })
        .limit(5);
      if (error) throw error;
      return (data || []).filter((p) => p.current_stock <= p.reorder_level);
    },
  });

  return (
    <div>
      <PageHeader title="Dashboard" description="Inventory overview and key metrics" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard title="Total Products" value={kpis?.total_products ?? 0} icon={Package} />
        <KpiCard title="In Stock" value={kpis?.total_in_stock ?? 0} icon={TrendingUp} variant="success" />
        <KpiCard title="Low Stock" value={kpis?.low_stock_count ?? 0} icon={AlertTriangle} variant="warning" />
        <KpiCard title="Out of Stock" value={kpis?.out_of_stock_count ?? 0} icon={XCircle} variant="danger" />
        <KpiCard title="Pending Receipts" value={kpis?.pending_receipts ?? 0} icon={ArrowDownToLine} />
        <KpiCard title="Pending Deliveries" value={kpis?.pending_deliveries ?? 0} icon={ArrowUpFromLine} />
        <KpiCard title="Transfers" value={kpis?.scheduled_transfers ?? 0} icon={ArrowLeftRight} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Reorder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockProducts && lowStockProducts.length > 0 ? (
                  lowStockProducts.map((p) => (
                    <TableRow key={p.id} className="table-row-stripe">
                      <TableCell className="font-mono-data text-xs">{p.sku}</TableCell>
                      <TableCell className="text-sm">{p.name}</TableCell>
                      <TableCell className="text-right font-mono-data text-sm text-danger">{p.current_stock}</TableCell>
                      <TableCell className="text-right font-mono-data text-sm">{p.reorder_level}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                      No low stock items
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recent Movements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMoves && recentMoves.length > 0 ? (
                  recentMoves.map((m) => (
                    <TableRow key={m.id} className="table-row-stripe">
                      <TableCell className="text-sm">{(m as any).products?.name ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={m.movement_type === "receipt" ? "done" : m.movement_type === "delivery" ? "waiting" : "ready"} />
                      </TableCell>
                      <TableCell className={`text-right font-mono-data text-sm ${m.quantity_change > 0 ? "text-success" : "text-danger"}`}>
                        {m.quantity_change > 0 ? "+" : ""}{m.quantity_change}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                      No recent movements
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
