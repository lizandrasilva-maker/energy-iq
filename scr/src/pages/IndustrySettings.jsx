import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Settings, Save, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function IndustrySettings() {
  const [industry, setIndustry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", cnpj: "", address: "", city: "", state: "",
    contracted_demand_kw: "", energy_provider: "",
    tariff_group: "A4", tariff_modality: "Verde",
    monthly_cost_avg: "", contact_email: "", contact_phone: "",
  });

  useEffect(() => {
    async function load() {
      const industries = await base44.entities.Industry.list();
      if (industries.length > 0) {
        setIndustry(industries[0]);
        setForm({
          name: industries[0].name || "",
          cnpj: industries[0].cnpj || "",
          address: industries[0].address || "",
          city: industries[0].city || "",
          state: industries[0].state || "",
          contracted_demand_kw: String(industries[0].contracted_demand_kw || ""),
          energy_provider: industries[0].energy_provider || "",
          tariff_group: industries[0].tariff_group || "A4",
          tariff_modality: industries[0].tariff_modality || "Verde",
          monthly_cost_avg: String(industries[0].monthly_cost_avg || ""),
          contact_email: industries[0].contact_email || "",
          contact_phone: industries[0].contact_phone || "",
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const data = {
      ...form,
      contracted_demand_kw: parseFloat(form.contracted_demand_kw) || 0,
      monthly_cost_avg: parseFloat(form.monthly_cost_avg) || 0,
    };

    if (industry) {
      await base44.entities.Industry.update(industry.id, data);
    } else {
      await base44.entities.Industry.create(data);
    }
    toast.success("Configurações salvas com sucesso!");
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Dados da indústria e parâmetros de contrato</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Factory className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold">Dados da Indústria</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nome da Indústria</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Email de Contato</Label>
                <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold">Parâmetros de Contrato</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Demanda Contratada (kW)</Label>
                <Input type="number" step="0.01" value={form.contracted_demand_kw} onChange={(e) => setForm({ ...form, contracted_demand_kw: e.target.value })} required />
              </div>
              <div>
                <Label>Concessionária</Label>
                <Input value={form.energy_provider} onChange={(e) => setForm({ ...form, energy_provider: e.target.value })} placeholder="Ex: CEMIG, CPFL, Enel" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Grupo Tarifário</Label>
                <Select value={form.tariff_group} onValueChange={(v) => setForm({ ...form, tariff_group: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["A1", "A2", "A3", "A3a", "A4", "AS", "B1", "B2", "B3"].map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modalidade Tarifária</Label>
                <Select value={form.tariff_modality} onValueChange={(v) => setForm({ ...form, tariff_modality: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Verde", "Azul", "Convencional"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Custo Médio Mensal (R$)</Label>
                <Input type="number" step="0.01" value={form.monthly_cost_avg} onChange={(e) => setForm({ ...form, monthly_cost_avg: e.target.value })} />
              </div>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={saving} className="gap-2">
          <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </form>
    </div>
  );
}