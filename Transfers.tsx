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

const Transfers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ reference: "", source_warehouse_id: "", dest_warehouse_id: "", notes: "" });

  const { data: transfers } = useQuery({
    queryKey: ["transfers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transfers").select("*").order("created_at", { ascending: false });
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

  const createTransfer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("transfers").insert({
        reference: form.reference,
        source_warehouse_id: form.source_warehouse_id,
        dest_warehouse_id: form.dest_warehouse_id,
        notes: form.notes || null,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
      setDialogOpen(false);
      setForm({ reference: "", source_warehouse_id: "", dest_warehouse_id: "", notes: "" });
      toast({ title: "Transfer created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const validateTransfer = useMutation({
    mutationFn: async (id: string) => {
      const { data: lines } = await supabase.from("transfer_lines").select("*").eq("transfer_id", id);
      for (const line of lines || []) {
        await supabase.from("stock_ledger").insert({
          product_id: line.product_id,
          quantity_change: 0,
          movement_type: "transfer" as const,
          reference_id: id,
          user_id: user!.id,
          notes: `Transfer of ${line.quantity} units`,
        });
      }
      await supabase.from("transfers").update({ status: "done" as const, validated_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
      toast({ title: "Transfer validated" });
    },
  });

  return (
    <div>
      <PageHeader
        title="Internal Transfers"
        description="Move stock between warehouses"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />New Transfer</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Transfer</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createTransfer.mutate(); }} className="space-y-4">
                <div className="space-y-1.5"><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required className="font-mono-data" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Source Warehouse</Label>
                    <Select value={form.source_warehouse_id} onValueChange={(v) => setForm({ ...form, source_warehouse_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                      <SelectContent>{warehouses?.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Destination Warehouse</Label>
                    <Select value={form.dest_warehouse_id} onValueChange={(v) => setForm({ ...form, dest_warehouse_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
                      <SelectContent>{warehouses?.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button type="submit" className="w-full">Create Transfer</Button>
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
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers?.map((t) => (
              <TableRow key={t.id} className="table-row-stripe">
                <TableCell className="font-mono-data text-xs">{t.reference}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  {t.status !== "done" && t.status !== "cancelled" && (
                    <Button size="sm" variant="outline" onClick={() => validateTransfer.mutate(t.id)}>
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Validate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!transfers || transfers.length === 0) && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No transfers</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Transfers;
