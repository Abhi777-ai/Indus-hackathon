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

const Receipts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ reference: "", supplier: "", warehouse_id: "", notes: "" });

  const { data: receipts } = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("receipts").select("*, warehouses(name)").order("created_at", { ascending: false });
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

  const createReceipt = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("receipts").insert({
        reference: form.reference,
        supplier: form.supplier || null,
        warehouse_id: form.warehouse_id,
        notes: form.notes || null,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      setDialogOpen(false);
      setForm({ reference: "", supplier: "", warehouse_id: "", notes: "" });
      toast({ title: "Receipt created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const validateReceipt = useMutation({
    mutationFn: async (id: string) => {
      // Get receipt lines
      const { data: lines, error: lErr } = await supabase.from("receipt_lines").select("*").eq("receipt_id", id);
      if (lErr) throw lErr;
      // Update stock for each line
      for (const line of lines || []) {
        const { data: product } = await supabase.from("products").select("current_stock").eq("id", line.product_id).single();
        await supabase.from("products").update({ current_stock: (product?.current_stock ?? 0) + line.quantity }).eq("id", line.product_id);
        await supabase.from("stock_ledger").insert({
          product_id: line.product_id,
          quantity_change: line.quantity,
          movement_type: "receipt" as const,
          reference_id: id,
          dest_location_id: line.location_id,
          user_id: user!.id,
        });
      }
      const { error } = await supabase.from("receipts").update({ status: "done" as const, validated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      toast({ title: "Receipt validated — stock updated" });
    },
  });

  return (
    <div>
      <PageHeader
        title="Receipts"
        description="Incoming stock operations"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />New Receipt</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Receipt</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createReceipt.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required className="font-mono-data" /></div>
                  <div className="space-y-1.5"><Label>Supplier</Label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Warehouse</Label>
                  <Select value={form.warehouse_id} onValueChange={(v) => setForm({ ...form, warehouse_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                    <SelectContent>{warehouses?.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button type="submit" className="w-full">Create Receipt</Button>
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
              <TableHead>Supplier</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts?.map((r) => (
              <TableRow key={r.id} className="table-row-stripe">
                <TableCell className="font-mono-data text-xs">{r.reference}</TableCell>
                <TableCell className="text-sm">{r.supplier || "—"}</TableCell>
                <TableCell className="text-sm">{(r as any).warehouses?.name}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  {r.status !== "done" && r.status !== "cancelled" && (
                    <Button size="sm" variant="outline" onClick={() => validateReceipt.mutate(r.id)} disabled={validateReceipt.isPending}>
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Validate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!receipts || receipts.length === 0) && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No receipts</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Receipts;
