import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Plus, Clock, CheckCircle, AlertTriangle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const statusConfig = {
  Rascunho: { icon: FileText, color: "bg-muted text-muted-foreground" },
  Enviado: { icon: Send, color: "bg-primary/10 text-primary" },
  "Em Análise": { icon: Clock, color: "bg-warning/10 text-warning" },
  Aprovado: { icon: CheckCircle, color: "bg-success/10 text-success" },
  Recusado: { icon: AlertTriangle, color: "bg-destructive/10 text-destructive" },
};

export default function Documents() {
  const [requests, setRequests] = useState([]);
  const [industry, setIndustry] = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    requested_demand_kw: "", reason: "", responsible_name: "",
    responsible_cpf: "", responsible_role: "", notes: "",
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [industries, reqs, allReadings] = await Promise.all([
      base44.entities.Industry.list(),
      base44.entities.DemandChangeRequest.list("-created_date", 50),
      base44.entities.EnergyReading.list("-month", 6),
    ]);
    if (industries.length > 0) setIndustry(industries[0]);
    setRequests(reqs);
    setReadings(allReadings);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const avgConsumed = readings.length > 0
      ? Math.round(readings.reduce((s, r) => s + r.consumed_demand_kw, 0) / readings.length)
      : 0;

    await base44.entities.DemandChangeRequest.create({
      industry_id: industry?.id || "",
      current_demand_kw: industry?.contracted_demand_kw || 0,
      requested_demand_kw: parseFloat(form.requested_demand_kw),
      reason: form.reason,
      avg_consumed_demand_kw: avgConsumed,
      responsible_name: form.responsible_name,
      responsible_cpf: form.responsible_cpf,
      responsible_role: form.responsible_role,
      status: "Rascunho",
      notes: form.notes,
    });

    setDialogOpen(false);
    setForm({ requested_demand_kw: "", reason: "", responsible_name: "", responsible_cpf: "", responsible_role: "", notes: "" });
    setLoading(true);
    await loadData();
  }

  async function updateStatus(id, status) {
    await base44.entities.DemandChangeRequest.update(id, { status });
    setLoading(true);
    await loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const avgConsumed = readings.length > 0
    ? Math.round(readings.reduce((s, r) => s + r.consumed_demand_kw, 0) / readings.length)
    : 0;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold tracking-tight">Documentos</h1>
          <p className="text-muted-foreground mt-1">Solicitações de alteração de demanda junto à concessionária</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Solicitação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">Solicitação de Alteração de Demanda</DialogTitle>
            </DialogHeader>
            <div className="bg-muted/50 rounded-lg p-3 mb-4 space-y-1">
              <p className="text-xs text-muted-foreground">Indústria: <strong>{industry?.name || "Não configurada"}</strong></p>
              <p className="text-xs text-muted-foreground">Demanda Atual: <strong>{industry?.contracted_demand_kw || 0} kW</strong></p>
              <p className="text-xs text-muted-foreground">Média Consumida (6 meses): <strong>{avgConsumed} kW</strong></p>
              <p className="text-xs text-muted-foreground">Concessionária: <strong>{industry?.energy_provider || "—"}</strong></p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Nova Demanda Solicitada (kW)</Label>
                <Input type="number" step="0.01" value={form.requested_demand_kw} onChange={(e) => setForm({ ...form, requested_demand_kw: e.target.value })} required placeholder={`Sugestão: ${Math.round(avgConsumed * 1.1)} kW`} />
              </div>
              <div>
                <Label>Justificativa</Label>
                <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Descreva o motivo da solicitação..." rows={3} />
              </div>
              <div>
                <Label>Nome do Responsável</Label>
                <Input value={form.responsible_name} onChange={(e) => setForm({ ...form, responsible_name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CPF do Responsável</Label>
                  <Input value={form.responsible_cpf} onChange={(e) => setForm({ ...form, responsible_cpf: e.target.value })} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label>Cargo</Label>
                  <Input value={form.responsible_role} onChange={(e) => setForm({ ...form, responsible_role: e.target.value })} placeholder="Ex: Gerente Industrial" />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <Button type="submit" className="w-full">Criar Solicitação</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma solicitação. Clique em "Nova Solicitação" para iniciar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const config = statusConfig[req.status] || statusConfig.Rascunho;
            const StatusIcon = config.icon;
            return (
              <div key={req.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", config.color)}>
                      <StatusIcon className="w-[18px] h-[18px]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">
                        Alteração: {req.current_demand_kw} kW → {req.requested_demand_kw} kW
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Responsável: {req.responsible_name} • {req.responsible_role || "—"}
                      </p>
                      {req.reason && <p className="text-xs text-muted-foreground mt-1">{req.reason}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", config.color)}>
                      {req.status}
                    </span>
                    {req.status === "Rascunho" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(req.id, "Enviado")} className="gap-1.5 text-xs">
                        <Send className="w-3.5 h-3.5" /> Enviar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}