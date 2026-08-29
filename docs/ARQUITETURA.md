graph TB
    subgraph "🔌 INTAKE"
        GMAIL["📧 Gmail Connector<br/>Rodriguez/Export/@<br/>Multi-inbox"]
        WHATSAPP["💬 WhatsApp Business<br/>Single WABA Webhook"]
        MANUAL["👤 Manual Entry<br/>Spreadsheet Input"]
    end

    subgraph "⚙️ ORQUESTRAÇÃO"
        MASTER["🎛️ ORQUESTRADOR-MASTER<br/>State Machine Router<br/>- FTR validation<br/>- Phase sequencing<br/>- Mutex lock per FTR<br/>- 70% determinístico<br/>- 30% AI delegation"]
    end

    subgraph "🤖 CAMADA AGENTES (11 AGENTS)"
        COMUNICACAO["📢 COMUNICACAO<br/>- Parse email/WhatsApp<br/>- Extract FTR/Booking/Invoice<br/>- Route to proper agent<br/>- Response templating"]
        
        COMERCIAL["💼 COMERCIAL<br/>- Quote generation<br/>- Pricing validation<br/>- T&C negotiation<br/>- Client preference lookup"]
        
        CONTRATOS["📋 CONTRATOS<br/>- Contract T&C parse<br/>- Signature workflow<br/>- Amendment tracking<br/>- Legal compliance"]
        
        COMPLIANCE["✅ COMPLIANCE<br/>- ACID calendar mgmt<br/>- Import permit tracking<br/>- Aflatoxin spec validation<br/>- Phyto renewal alerts<br/>- Regulatory calendar"]
        
        DOCUMENTACAO["📄 DOCUMENTACAO<br/>- BL/CO/Phyto assembly<br/>- Invoice generation<br/>- Document validation<br/>- Format conformance"]
        
        FINANCEIRO["💳 FINANCEIRO<br/>- SWIFT validation<br/>- CAD settlement verify<br/>- Payment proof tracking<br/>- Bank credit confirmation<br/>- Release authorization"]
        
        QUALIDADE["🔬 QUALIDADE<br/>- Lab report parsing<br/>- Aflatoxin result reading<br/>- Buyer approval check<br/>- Quality exception mgmt"]
        
        LOGISTICS["🚢 LOGISTICS<br/>- ETD/ETA tracking<br/>- Container number lookup<br/>- Carrier coordination<br/>- Searates integration<br/>- Calendar sync"]
        
        COMISSOES["💰 COMISSOES<br/>- % calculation<br/>- Invoice generation<br/>- Payment reconciliation<br/>- Commission accrual"]
        
        EXCEPCOES["⚠️ EXCEPCOES<br/>- Retry logic<br/>- DLQ management<br/>- Manual escalation<br/>- Audit logging"]
        
        MONITOR["📊 MONITOR<br/>- KPI calculation<br/>- SLA alerts<br/>- Health checks<br/>- Performance metrics"]
    end

    subgraph "💾 PERSISTÊNCIA"
        FIRESTORE["🔥 Firestore<br/>(Cache + State)<br/>- sessions<br/>- ftr_processing<br/>- booking_draft<br/>- audit_log<br/>- temp_documents"]
        
        SUPABASE["🐘 Supabase PostgreSQL<br/>(Permanent Records)<br/>- ftr (master)<br/>- customers (Excel sync)<br/>- bookings<br/>- invoices<br/>- payments<br/>- bl_documents<br/>- compliance_events<br/>- commissions"]
        
        SHEETS["📊 Google Sheets<br/>- TRACKING 2026<br/>- DigestBuffer<br/>- ContainerTracker<br/>- Dashboard<br/>- Manual review tabs"]
    end

    subgraph "🌐 INTEGRAÇÕES EXTERNAS"
        SEARATES["🌍 Searates API<br/>Carrier detection<br/>ETD/ETA sync"]
        
        CARGOWISE["📦 CargoX / ACID<br/>Egypt compliance<br/>Document registry"]
        
        CARRIER["✈️ Carrier APIs<br/>Maersk/CMA CGM<br/>Hapag-Lloyd/MSC"]
        
        BANCO["🏦 Bank API<br/>SWIFT validation<br/>Credit confirmation"]
    end

    subgraph "🔐 SEGURANÇA"
        SECRETS["🔑 Secret Manager<br/>- Bank details<br/>- API keys<br/>- JWT tokens<br/>- Credentials"]
        
        AUDIT["📋 Audit Trail<br/>- user/operation<br/>- FTR/document<br/>- timestamp/delta<br/>- IP/context"]
        
        BACKUP["💾 Backup Strategy<br/>- Daily Firestore<br/>- Daily Supabase<br/>- Cross-region repl"]
    end

    subgraph "🚀 DEPLOYMENT"
        CLOUDRUN["☁️ Cloud Run<br/>- Node.js server.js<br/>- Endpoints:
/digest
/classificar-doc
/rastrear
/webhook-whatsapp
/webhook-email
- Load balancer<br/>- Rate limiting<br/>- Auto-scaling"]
        
        APPSCRIPT["🔧 Apps Script<br/>- Gmail intake<br/>- Trigger 15min<br/>- Weekly reprocess<br/>- TRACKING mgmt<br/>- ContainerTracker"]
    end

    %% FLUXO PRINCIPAL
    GMAIL --> COMUNICACAO
    WHATSAPP --> COMUNICACAO
    MANUAL --> COMUNICACAO
    
    COMUNICACAO --> MASTER
    
    MASTER --> |FTR valid| CONTRATOS
    MASTER --> |Quote req| COMERCIAL
    MASTER --> |Booking ready| LOGISTICS
    MASTER --> |Invoice pending| DOCUMENTACAO
    MASTER --> |Payment check| FINANCEIRO
    MASTER --> |Compliance check| COMPLIANCE
    
    CONTRATOS --> |Signed| COMPLIANCE
    COMERCIAL --> |Price approved| CONTRATOS
    COMPLIANCE --> |Approved| DOCUMENTACAO
    DOCUMENTACAO --> |Generated| QUALIDADE
    QUALIDADE --> |QA passed| FINANCEIRO
    FINANCEIRO --> |Payment verified| COMISSOES
    LOGISTICS --> |ETD confirmed| SHEETS
    COMISSOES --> |Invoice created| SUPABASE
    
    %% EXCEÇÕES
    EXCEPCOES -.->|Retry| MASTER
    EXCEPCOES -.->|Escalate| MONITOR
    MONITOR -.->|Alert| COMUNICACAO
    
    %% PERSISTÊNCIA
    MASTER --> FIRESTORE
    COMUNICACAO --> FIRESTORE
    DOCUMENTACAO --> FIRESTORE
    
    CONTRATOS --> SUPABASE
    FINANCEIRO --> SUPABASE
    COMISSOES --> SUPABASE
    QUALIDADE --> SUPABASE
    LOGISTICS --> SUPABASE
    
    MASTER --> SHEETS
    LOGISTICS --> SHEETS
    MONITOR --> SHEETS
    
    %% INTEGRAÇÕES
    LOGISTICS --> SEARATES
    COMPLIANCE --> CARGOWISE
    LOGISTICS --> CARRIER
    FINANCEIRO --> BANCO
    
    %% SEGURANÇA
    MASTER -.->|Encrypt| SECRETS
    EXCEPCOES -.->|Log| AUDIT
    SUPABASE -.->|Backup| BACKUP
    FIRESTORE -.->|Backup| BACKUP
    
    %% DEPLOYMENT
    CLOUDRUN -.->|Hosts| MASTER
    CLOUDRUN -.->|Hosts| COMERCIAL
    CLOUDRUN -.->|Hosts| FINANCEIRO
    APPSCRIPT -.->|Triggers| COMUNICACAO
    APPSCRIPT -.->|Manages| SHEETS

    classDef intake fill:#e1f5ff,stroke:#01579b,stroke-width:2px,color:#000
    classDef orchestration fill:#fff3e0,stroke:#e65100,stroke-width:3px,color:#000
    classDef agent fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000
    classDef persistence fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px,color:#000
    classDef external fill:#fce4ec,stroke:#880e4f,stroke-width:2px,color:#000
    classDef security fill:#fff9c4,stroke:#f57f17,stroke-width:2px,color:#000
    classDef deployment fill:#c8e6c9,stroke:#33691e,stroke-width:2px,color:#000

    class GMAIL,WHATSAPP,MANUAL intake
    class MASTER orchestration
    class COMUNICACAO,COMERCIAL,CONTRATOS,COMPLIANCE,DOCUMENTACAO,FINANCEIRO,QUALIDADE,LOGISTICS,COMISSOES,EXCEPCOES,MONITOR agent
    class FIRESTORE,SUPABASE,SHEETS persistence
    class SEARATES,CARGOWISE,CARRIER,BANCO external
    class SECRETS,AUDIT,BACKUP security
    class CLOUDRUN,APPSCRIPT deployment
