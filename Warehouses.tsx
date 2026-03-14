import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, MapPin, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Warehouses = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [locDialogOpen, setLocDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [form, setForm] = useState({ name: "", address: "" });
  const [locForm, setLocForm] = useState({ name: "", description: "" });

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["locations", selectedWarehouse?.id],
    queryFn: async () => {
      if (!selectedWarehouse) return [];
      const { data, error } = await supabase.from("locations").select("*").eq("warehouse_id", selectedWarehouse.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedWarehouse,
  });

  const saveWarehouse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("warehouses").insert({ name: form.name, address: form.address || null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warehouses"] }); setDialogOpen(false); setForm({ name: "", address: "" }); toast({ title: "Warehouse created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addLocation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("locations").insert({ warehouse_id: selectedWarehouse.id, name: locForm.name, description: locForm.description || null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); setLocDialogOpen(false); setLocForm({ name: "", description: "" }); toast({ title: "Location added" }); },
  });

  return (
    <div>
      <PageHeader
        title="Warehouses"
        description="Manage warehouses and storage locations"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Warehouse</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Warehouse</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveWarehouse.mutate(); }} className="space-y-4">
                <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <Button type="submit" className="w-full">Create Warehouse</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Warehouse</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses?.map((w) => (
                <TableRow key={w.id} className={`table-row-stripe cursor-pointer ${selectedWarehouse?.id === w.id ? "bg-primary/5" : ""}`} onClick={() => setSelectedWarehouse(w)}>
                  <TableCell className="text-sm font-medium">{w.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{w.address || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7"><MapPin className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!warehouses || warehouses.length === 0) && (
                <TableRow><TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">No warehouses</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {selectedWarehouse && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{selectedWarehouse.name} — Locations</CardTitle>
              <Dialog open={locDialogOpen} onOpenChange={setLocDialogOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1.5 h-3.5 w-3.5" />Add Location</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Location</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); addLocation.mutate(); }} className="space-y-4">
                    <div className="space-y-1.5"><Label>Name</Label><Input value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} required /></div>
                    <div className="space-y-1.5"><Label>Description</Label><Input value={locForm.description} onChange={(e) => setLocForm({ ...locForm, description: e.target.value })} /></div>
                    <Button type="submit" className="w-full">Add Location</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Location</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
                <TableBody>
                  {locations?.map((l) => (
                    <TableRow key={l.id} className="table-row-stripe">
                      <TableCell className="text-sm font-medium">{l.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.description || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(!locations || locations.length === 0) && (
                    <TableRow><TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">No locations</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Warehouses;
