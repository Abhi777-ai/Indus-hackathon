import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const typeColors: Record<string, string> = {
  receipt: "bg-success/10 text-success border-success/20",
  delivery: "bg-warning/10 text-warning border-warning/20",
  transfer: "bg-primary/10 text-primary border-primary/20",
  adjustment: "bg-muted text-muted-foreground",
};

const StockLedger = () => {
  const { data: entries } = useQuery({
    queryKey: ["stock-ledger"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_ledger")
        .select("*, products(name, sku)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader title="Stock Ledger" description="Complete movement history" />
      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((e) => (
              <TableRow key={e.id} className="table-row-stripe">
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString()}
                </TableCell>
                <TableCell className="font-mono-data text-xs">{(e as any).products?.sku}</TableCell>
                <TableCell className="text-sm">{(e as any).products?.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs capitalize ${typeColors[e.movement_type]}`}>
                    {e.movement_type}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right font-mono-data text-sm ${e.quantity_change > 0 ? "text-success" : e.quantity_change < 0 ? "text-danger" : ""}`}>
                  {e.quantity_change > 0 ? "+" : ""}{e.quantity_change}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{e.notes || "—"}</TableCell>
              </TableRow>
            ))}
            {(!entries || entries.length === 0) && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No movements recorded</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default StockLedger;
