import { useState, useMemo } from "react";
import {
  Plus,
  Star,
  Phone,
  Mail,
  Globe,
  X,
  Check,
  Search,
  Building2,
  MapPin,
} from "lucide-react";

// Categorias disponíveis para filtro
const categories = [
  "Todos",
  "Banco de Capacitores",
  "Energia Solar",
  "Mercado Livre",
  "Eficiência Energética",
  "Automação Industrial",
  "Medição Inteligente",
];

// Dados Iniciais dos Fornecedores
const initialProviders = [
  {
    id: 1,
    name: "SmartMeter IoT",
    category: "Medição Inteligente",
    rating: 4.9,
    description:
      "Sensores IoT e medidores inteligentes para monitoramento de energia em tempo real.",
    location: "Campinas, SP",
    phone: "(19) 3700-0000",
    email: "contato@smartmeteriot.com.br",
    website: "https://smartmeteriot.com.br",
  },
  {
    id: 2,
    name: "Solar Industrial Brasil",
    category: "Energia Solar",
    rating: 4.8,
    description:
      "Sistemas fotovoltaicos para autoprodução industrial. Financiamento próprio e gestão completa do projeto.",
    location: "São Paulo, SP",
    phone: "(11) 4000-0000",
    email: "comercial@solarindustrial.com.br",
    website: "https://solarindustrial.com.br",
  },
  {
    id: 3,
    name: "Capacitec Energia",
    category: "Banco de Capacitores",
    rating: 4.7,
    description:
      "Especialista em correção de fator de potência e bancos de capacitores para indústria. Projetos turnkey com garantia de resultados.",
    location: "Belo Horizonte, MG",
    phone: "(31) 3300-0000",
    email: "vendas@capacitec.com.br",
    website: "https://capacitec.com.br",
  },
  {
    id: 4,
    name: "Efficaxy Solutions",
    category: "Eficiência Energética",
    rating: 4.6,
    description:
      "Auditorias energéticas, diagnósticos e projetos de eficiência para processos industriais.",
    location: "Curitiba, PR",
    phone: "(41) 3200-0000",
    email: "contato@efficaxy.com.br",
    website: "https://efficaxy.com.br",
  },
  {
    id: 5,
    name: "GreenVolt Solar",
    category: "Energia Solar",
    rating: 4.6,
    description:
      "Geração distribuída e autoprodução compartilhada para grandes consumidores industriais.",
    location: "Salvador, BA",
    phone: "(71) 3100-0000",
    email: "atendimento@greenvoltsolar.com.br",
    website: "https://greenvoltsolar.com.br",
  },
  {
    id: 6,
    name: "Mercado Livre Energia Consultoria",
    category: "Mercado Livre",
    rating: 4.5,
    description:
      "Consultoria para migração ao mercado livre de energia. Análise contratual e gestão de portfólio.",
    location: "Rio de Janeiro, RJ",
    phone: "(21) 2500-0000",
    email: "contato@mercadolivreconsultoria.com.br",
    website: "https://mercadolivreconsultoria.com.br",
  },
];

export default function ServiceProviders() {
  const [providers, setProviders] = useState(initialProviders);
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados do formulário do novo fornecedor
  const [formData, setFormData] = useState({
    name: "",
    category: "Medição Inteligente",
    rating: "5.0",
    description: "",
    location: "",
    phone: "",
    email: "",
    website: "",
  });

  // Filtragem dinâmica de fornecedores por Categoria e Busca
  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      const matchesCategory =
        selectedCategory === "Todos" || p.category === selectedCategory;
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [providers, selectedCategory, searchQuery]);

  // Handler para submeter o formulário do novo fornecedor
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name || !formData.description || !formData.location) {
      alert("Por favor, preencha os campos obrigatórios.");
      return;
    }

    const newProvider = {
      id: Date.now(),
      ...formData,
      rating: parseFloat(formData.rating) || 5.0,
    };

    setProviders([newProvider, ...providers]);

    // Reseta e fecha o modal
    setFormData({
      name: "",
      category: "Medição Inteligente",
      rating: "5.0",
      description: "",
      location: "",
      phone: "",
      email: "",
      website: "",
    });
    setIsModalOpen(false);
  };

  return (
    <div className="lg:p-6 space-y-6 relative">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fornecedores</h1>
          <p className="text-sm text-slate-500">
            Empresas especializadas em soluções energéticas
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-medium flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Fornecedor</span>
        </button>
      </div>

      {/* Barra de Filtros por Categoria e Busca */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-sky-500 text-white shadow-sm"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Input de Pesquisa */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, serviço ou localização..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-sm"
          />
        </div>
      </div>

      {/* Grid de Cards de Fornecedores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProviders.map((provider) => (
          <div
            key={provider.id}
            className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              {/* Título e Nota */}
              <div className="flex justify-between items-start gap-2 mb-2">
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {provider.name}
                </h3>
                <div className="flex items-center space-x-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 shrink-0">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-bold text-slate-800">
                    {provider.rating}
                  </span>
                </div>
              </div>

              {/* Tag de Categoria */}
              <span className="inline-block px-2.5 py-0.5 bg-sky-50 text-sky-700 rounded-lg text-[11px] font-medium border border-sky-100 mb-3">
                {provider.category}
              </span>

              {/* Descrição */}
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                {provider.description}
              </p>

              {/* Localização */}
              <p className="text-xs text-slate-400 mb-5 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                <span>{provider.location}</span>
              </p>
            </div>

            {/* Ações / Contatos */}
            <div className="pt-4 border-t border-slate-100 flex items-center space-x-2">
              <a
                href={provider.phone ? `tel:${provider.phone}` : "#"}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>Ligar</span>
              </a>

              <a
                href={provider.email ? `mailto:${provider.email}` : "#"}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                <span>Email</span>
              </a>

              <a
                href={provider.website || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Globe className="h-3.5 w-3.5 text-slate-500" />
                <span>Site</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL CADASTRAR NOVO FORNECEDOR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-sky-600" />
                Cadastrar Novo Fornecedor
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nome da Empresa *
                </label>
                <input
                  type="text"
                  placeholder="Ex: SolarTech Soluções"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  >
                    {categories
                      .filter((c) => c !== "Todos")
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Avaliação (0 a 5)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={formData.rating}
                    onChange={(e) =>
                      setFormData({ ...formData, rating: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Descrição dos Serviços *
                </label>
                <textarea
                  rows="3"
                  placeholder="Descreva resumidamente os serviços prestados..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none"
                  required
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Localização (Cidade, UF) *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: São Paulo, SP"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    placeholder="contato@empresa.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    placeholder="https://empresa.com"
                    value={formData.website}
                    onChange={(e) =>
                      setFormData({ ...formData, website: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Cadastrar Fornecedor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}