import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, XCircle } from "lucide-react";

const Alerts = () => {
  const { data: alerts } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, current_stock, reorder_level, categories(name)")
        .or("current_stock.eq.0,current_stock.lte.reorder_level")
        .order("current_stock", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const outOfStock = alerts?.filter((a) => a.current_stock === 0) || [];
  const lowStock = alerts?.filter((a) => a.current_stock > 0 && a.current_stock <= a.reorder_level) || [];

  return (
    <div>
      <PageHeader title="Alerts" description="Stock level warnings" />

      {outOfStock.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-danger">
            <XCircle className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Out of Stock ({outOfStock.length})</h2>
          </div>
          <div className="rounded-md border border-danger/20 bg-danger/5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outOfStock.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono-data text-xs">{p.sku}</TableCell>
                    <TableCell className="text-sm font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(p as any).categories?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono-data text-sm">{p.reorder_level}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Low Stock ({lowStock.length})</h2>
          </div>
          <div className="rounded-md border border-warning/20 bg-warning/5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono-data text-xs">{p.sku}</TableCell>
                    <TableCell className="text-sm font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(p as any).categories?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono-data text-sm text-warning">{p.current_stock}</TableCell>
                    <TableCell className="text-right font-mono-data text-sm">{p.reorder_level}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {outOfStock.length === 0 && lowStock.length === 0 && (
        <div className="rounded-md border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          All stock levels are healthy
        </div>
      )}
    </div>
  );
};

export default Alerts;
