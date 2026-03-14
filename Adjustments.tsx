import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Adjustments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ reference: "", product_id: "", counted_quantity: "", reason: "" });

  const { data: adjustments } = useQuery({
    queryKey: ["adjustments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_adjustments").select("*, products(name, sku)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, sku, current_stock");
      if (error) throw error;
      return data;
    },
  });

  const selectedProduct = products?.find((p) => p.id === form.product_id);

  const createAdjustment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stock_adjustments").insert({
        reference: form.reference,
        product_id: form.product_id,
        counted_quantity: parseInt(form.counted_quantity),
        system_quantity: selectedProduct?.current_stock ?? 0,
        reason: form.reason || null,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      setDialogOpen(false);
      setForm({ reference: "", product_id: "", counted_quantity: "", reason: "" });
      toast({ title: "Adjustment created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const validateAdjustment = useMutation({
    mutationFn: async (adj: any) => {
      const diff = adj.counted_quantity - adj.system_quantity;
      await supabase.from("products").update({ current_stock: adj.counted_quantity }).eq("id", adj.product_id);
      await supabase.from("stock_ledger").insert({
        product_id: adj.product_id,
        quantity_change: diff,
        movement_type: "adjustment" as const,
        reference_id: adj.id,
        user_id: user!.id,
        notes: adj.reason,
      });
      await supabase.from("stock_adjustments").update({ status: "done" as const, validated_at: new Date().toISOString() }).eq("id", adj.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      toast({ title: "Adjustment validated — stock corrected" });
    },
  });

  return (
    <div>
      <PageHeader
        title="Stock Adjustments"
        description="Correct inventory mismatches"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />New Adjustment</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Adjustment</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createAdjustment.mutate(); }} className="space-y-4">
                <div className="space-y-1.5"><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required className="font-mono-data" /></div>
                <div className="space-y-1.5">
                  <Label>Product</Label>
                  <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>{products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {selectedProduct && (
                  <p className="text-sm text-muted-foreground">System quantity: <span className="font-mono-data font-semibold text-foreground">{selectedProduct.current_stock}</span></p>
                )}
                <div className="space-y-1.5"><Label>Counted Quantity</Label><Input type="number" value={form.counted_quantity} onChange={(e) => setForm({ ...form, counted_quantity: e.target.value })} required /></div>
                <div className="space-y-1.5"><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
                <Button type="submit" className="w-full">Create Adjustment</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">System Qty</TableHead>
              <TableHead className="text-right">Counted</TableHead>
              <TableHead className="text-right">Diff</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments?.map((a) => (
              <TableRow key={a.id} className="table-row-stripe">
                <TableCell className="font-mono-data text-xs">{a.reference}</TableCell>
                <TableCell className="text-sm">{(a as any).products?.name ?? "—"}</TableCell>
                <TableCell className="text-right font-mono-data text-sm">{a.system_quantity}</TableCell>
                <TableCell className="text-right font-mono-data text-sm">{a.counted_quantity}</TableCell>
                <TableCell className={`text-right font-mono-data text-sm ${(a.difference ?? 0) > 0 ? "text-success" : (a.difference ?? 0) < 0 ? "text-danger" : ""}`}>
                  {(a.difference ?? 0) > 0 ? "+" : ""}{a.difference}
                </TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
                <TableCell className="text-right">
                  {a.status !== "done" && a.status !== "cancelled" && (
                    <Button size="sm" variant="outline" onClick={() => validateAdjustment.mutate(a)}>
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Validate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!adjustments || adjustments.length === 0) && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No adjustments</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Adjustments;
