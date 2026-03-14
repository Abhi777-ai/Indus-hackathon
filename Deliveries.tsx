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

const Deliveries = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ reference: "", customer: "", warehouse_id: "", notes: "" });

  const { data: deliveries } = useQuery({
    queryKey: ["deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deliveries").select("*, warehouses(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("*");
      if (error) throw error;
      return data;
    },
  });

  const createDelivery = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("deliveries").insert({
        reference: form.reference,
        customer: form.customer || null,
        warehouse_id: form.warehouse_id,
        notes: form.notes || null,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      setDialogOpen(false);
      setForm({ reference: "", customer: "", warehouse_id: "", notes: "" });
      toast({ title: "Delivery order created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const validateDelivery = useMutation({
    mutationFn: async (id: string) => {
      const { data: lines, error: lErr } = await supabase.from("delivery_lines").select("*").eq("delivery_id", id);
      if (lErr) throw lErr;
      for (const line of lines || []) {
        const { data: product } = await supabase.from("products").select("current_stock").eq("id", line.product_id).single();
        const newStock = Math.max(0, (product?.current_stock ?? 0) - line.quantity);
        await supabase.from("products").update({ current_stock: newStock }).eq("id", line.product_id);
        await supabase.from("stock_ledger").insert({
          product_id: line.product_id,
          quantity_change: -line.quantity,
          movement_type: "delivery" as const,
          reference_id: id,
          source_location_id: line.location_id,
          user_id: user!.id,
        });
      }
      const { error } = await supabase.from("deliveries").update({ status: "done" as const, validated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      toast({ title: "Delivery validated — stock updated" });
    },
  });

  return (
    <div>
      <PageHeader
        title="Deliveries"
        description="Outgoing stock operations"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />New Delivery</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Delivery Order</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createDelivery.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required className="font-mono-data" /></div>
                  <div className="space-y-1.5"><Label>Customer</Label><Input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Warehouse</Label>
                  <Select value={form.warehouse_id} onValueChange={(v) => setForm({ ...form, warehouse_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                    <SelectContent>{warehouses?.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button type="submit" className="w-full">Create Delivery</Button>
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
              <TableHead>Customer</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries?.map((d) => (
              <TableRow key={d.id} className="table-row-stripe">
                <TableCell className="font-mono-data text-xs">{d.reference}</TableCell>
                <TableCell className="text-sm">{d.customer || "—"}</TableCell>
                <TableCell className="text-sm">{(d as any).warehouses?.name}</TableCell>
                <TableCell><StatusBadge status={d.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  {d.status !== "done" && d.status !== "cancelled" && (
                    <Button size="sm" variant="outline" onClick={() => validateDelivery.mutate(d.id)}>
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Validate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!deliveries || deliveries.length === 0) && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No deliveries</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Deliveries;
