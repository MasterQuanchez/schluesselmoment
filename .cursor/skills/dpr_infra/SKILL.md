---
name: infrastructure-deployment
description: Infrastructure decision guide for DPR applications on Azure - helps developers, product managers, designers, analysts, and AI agents choose the right services based on project stage, requirements, and SGRE governance
---

# DPR Infrastructure Skill

> **Purpose:** Guide teams and AI agents on infrastructure choices for application development at SGRE DIS, following company standards and governance requirements.

---

## Who Is This For?

| Role | How to Use This Guide |
|------|----------------------|
| **Product Managers** | Use the Quick Reference and Stage-Specific Guidelines to understand timelines, approvals needed, and what to communicate to stakeholders |
| **Designers & Analysts** | Understand data sensitivity rules — especially what data can/cannot be used in PoC phase |
| **Developers** | Follow the technical templates and checklists for deployment |
| **AI Agents** | Reference decision trees and templates when assisting with infrastructure questions |

> 💡 **Not technical?** Focus on the **Quick Reference**, **Core Principles**, and **Governance Summary** sections. The detailed templates are for developers.

---

## Quick Reference

| Project Stage | Compute | Database | Approval Required |
|---------------|---------|----------|-------------------|
| **PoC** | AKS (static IP, no hostname) | PostgreSQL | ❌ None |
| **MVP** | Azure Container Apps (preferred) | PostgreSQL | ✅ Architecture Board |
| **Production** | Azure Container Apps (preferred) | PostgreSQL | ✅ Architecture Board |

---

## Core Principles

### 🎯 Keep It Simple
> **The most common mistake is over-engineering: choosing too many tools or new/unfamiliar technologies.**

- Start with the most common approach in the company
- Improve and optimize later once the solution is validated
- Avoid introducing new services unless there's a clear, justified need

### 🔐 Data Sensitivity Warning

> ⚠️ **CRITICAL FOR PoC PHASE**
> 
> Never use **Strictly Confidential** data in PoC environments. PoC infrastructure does not go through Architecture Board review and may not meet security requirements for sensitive data.

**Data Classification Levels (SGRE):**
| Level | PoC | MVP | Production |
|-------|-----|-----|------------|
| Public | ✅ | ✅ | ✅ |
| Restricted | ⚠️ Caution | ✅ | ✅ |
| Confidential | ❌ Avoid | ✅ With review | ✅ |
| Strictly Confidential | ❌ **Never** | ⚠️ Special approval | ✅ With controls |

---

## Available Azure Services

### Compute Services

| Service | When to Use | Notes |
|---------|-------------|-------|
| **Azure Container Apps** | APIs, web apps, microservices | ✅ **Preferred for MVP/Prod** |
| **Azure Kubernetes Service (AKS)** | Complex orchestration needs, PoC deployments | Standard for PoC (static IP) |
| **Azure Functions** | Event-driven, lightweight tasks | Triggers, scheduled jobs, webhooks |
| **Databricks Apps** | Data engineering, ML workloads | Not common for app development yet |

### Database Services

| Service | When to Use | Notes |
|---------|-------------|-------|
| **PostgreSQL** | User-facing applications, relational data | ✅ **Default choice** |
| **CosmosDB** | Backend services, NoSQL performance needs | ❌ Not always ideal for user-facing apps |

### Supporting Services

| Service | Purpose | Required? |
|---------|---------|-----------|
| **Azure Key Vault** | Secrets management | ✅ Yes - use Service Principal |
| **Application Insights** | Monitoring & observability | 📋 Recommended |

---

## Decision Trees

### Compute Selection

```
Is it event-driven (triggers, scheduled tasks, webhooks)?
├── YES → Azure Functions
└── NO → Is it PoC phase?
    ├── YES → AKS (static IP, no hostname)
    └── NO → Azure Container Apps (preferred)
```

### Database Selection

```
Is it a user-facing application?
├── YES → PostgreSQL (default)
└── NO → Is NoSQL performance beneficial?
    ├── YES → CosmosDB
    └── NO → PostgreSQL (default)
```

---

## Stage-Specific Guidelines

### PoC (Proof of Concept)

**Goal:** Validate idea quickly with minimal overhead

| Aspect | Guidance |
|--------|----------|
| **Compute** | AKS with static IP (no hostname) |
| **Database** | PostgreSQL |
| **Approval** | None required |
| **Data** | ⚠️ **No Strictly Confidential data** |
| **DNS** | Not needed (use static IP) |

**Checklist:**
- [ ] Using only Public or Restricted data
- [ ] Deployed to AKS with static IP
- [ ] Key Vault configured with Service Principal
- [ ] Application Insights enabled (recommended)

### MVP (Minimum Viable Product)

**Goal:** Production-like environment for user validation

| Aspect | Guidance |
|--------|----------|
| **Compute** | Azure Container Apps (preferred) |
| **Database** | PostgreSQL |
| **Approval** | ✅ Architecture Board required |
| **DNS** | IT ticket required for Container Apps |

**Architecture Board Requirements:**
1. **Architecture Diagram** — Show components, data flows, and Azure services
2. **Presentation** — Explain the idea and justify technical choices

**Checklist:**
- [ ] Architecture diagram prepared
- [ ] Presentation ready for Architecture Board
- [ ] IT ticket submitted for DNS resolution (Container Apps)
- [ ] Data classification reviewed and appropriate for MVP
- [ ] Key Vault + Service Principal configured
- [ ] Application Insights enabled

### Production

**Goal:** Scalable, secure, fully governed deployment

| Aspect | Guidance |
|--------|----------|
| **Compute** | Azure Container Apps (preferred) |
| **Database** | PostgreSQL |
| **Approval** | Architecture Board (if not done at MVP) |
| **DNS** | IT ticket for domain registration |

---

## PoC Deployment Templates

Ready-to-use templates for deploying applications to AKS in PoC phase. Copy these to your project and replace the `{{PLACEHOLDER}}` values.

### Quick Start

1. **Create a `deployment/` folder** in your repository root
2. **Copy Kubernetes files** to `deployment/`:
   - `deployment.yml`
   - `service.yml`
   - `secrets.yml` (add to `.gitignore`!)
   - `kustomization.yaml`
3. **Copy to repository root**:
   - `azure-pipelines.yml`
   - `Dockerfile`
4. Replace all `{{PLACEHOLDER}}` values with your project-specific values
5. **Never commit real secrets** — create the Kubernetes secret manually or use sealed secrets
6. Configure Azure Pipeline service connections in Azure DevOps

### Project Structure

```
your-project/
├── deployment/              # ← Create this folder for K8s manifests
│   ├── deployment.yml       # Kubernetes Deployment
│   ├── service.yml          # Kubernetes Service (LoadBalancer)
│   ├── secrets.yml          # ⚠️ Add to .gitignore! Never commit!
│   └── kustomization.yaml   # Kustomize configuration
├── azure-pipelines.yml      # ← Root folder: CI/CD pipeline
├── Dockerfile               # ← Root folder: Container build
├── requirements.txt
├── app.py                   # Your application code
└── ...
```

### Placeholder Reference

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{APP_NAME}}` | Application name (used in K8s resources) | `dis-portfolio-discover` |
| `{{NAMESPACE}}` | Kubernetes namespace | `demo-app` |
| `{{CONTAINER_PORT}}` | Port your app listens on | `8501` |
| `{{ACR_NAME}}` | Azure Container Registry name | `acrdevdvlstr01` |
| `{{ACR_FQDN}}` | Full ACR domain | `acrdevdvlstr01.azurecr.io` |
| `{{SERVICE_CONNECTION}}` | K8s service connection in Azure DevOps | `ksdevdvlcoe01-demo-app` |
| `{{AZURE_SUBSCRIPTION}}` | Azure subscription endpoint for ACR | `DevOps_RGDEVDVLGENDFPWE01_contributor` |
| `{{AZURE_SUBSCRIPTION_SECRETS}}` | Azure subscription for secrets | `DevOps_RGDEVDVLGENOTSWE01_contributor` |
| `{{AGENT_POOL}}` | AKS node pool name | `agentpooldfp` |
| `{{BRANCH}}` | Git branch to trigger pipeline | `master` |
| `{{DOCKERFILE}}` | Dockerfile name | `Dockerfile` |

---

### Template Files

All template files are in the [`example_files/`](example_files/) folder. Read each file to get the full template content.

**Kubernetes manifests** (`example_files/kubernetes/`):

| File | Purpose | Notes |
|------|---------|-------|
| [`deployment.yml`](example_files/kubernetes/deployment.yml) | Kubernetes Deployment | Defines pods, containers, resource limits, and secret mounts |
| [`service.yml`](example_files/kubernetes/service.yml) | Kubernetes Service (LoadBalancer) | Provides a static external IP — no DNS needed for PoC |
| [`secrets.yml`](example_files/kubernetes/secrets.yml) | Kubernetes Secret | ⚠️ **Never commit with real values** — add to `.gitignore` |
| [`kustomization.yaml`](example_files/kubernetes/kustomization.yaml) | Kustomize configuration | Secrets intentionally excluded to prevent accidental commits |

**CI/CD & container** (`example_files/`):

| File | Purpose | Notes |
|------|---------|-------|
| [`azure-pipelines.yml`](example_files/azure-pipelines.yml) | CI/CD pipeline | Builds Docker image, pushes to ACR, deploys to AKS |
| [`Dockerfile`](example_files/Dockerfile) | Container build (Python/Streamlit) | Adjust CMD for your framework (FastAPI, Flask, etc.) |

> ⚠️ **SECURITY WARNING for `secrets.yml`:**
> - **Never commit this file with real values to Git**
> - Add `deployment/secrets.yml` to your `.gitignore`
> - Create the secret manually: `kubectl apply -f secrets.yml`
> - For production, use Azure Key Vault with CSI driver instead

---

### First-Time Setup Checklist

1. **Azure DevOps Service Connections**
   - [ ] Create Kubernetes service connection to your AKS cluster
   - [ ] Create Azure subscription connection with ACR push permissions

2. **Kubernetes Namespace**
   - [ ] Ensure namespace exists: `kubectl create namespace {{NAMESPACE}}`

3. **Secrets**
   - [ ] Fill in `secrets.yml` with real values locally
   - [ ] Apply secret: `kubectl apply -f deployment/secrets.yml`
   - [ ] Verify: `kubectl get secrets -n {{NAMESPACE}}`

4. **Pipeline**
   - [ ] Commit `azure-pipelines.yml` to your repository
   - [ ] Contact **Talal Chaudhry** to set up the Azure DevOps pipeline
   - [ ] Provide: repository name, branch, and service connection requirements
   - [ ] Verify build completes in Azure DevOps
   - [ ] Check deployment: `kubectl get pods -n {{NAMESPACE}}`

5. **Access Application**
   - [ ] Get external IP: `kubectl get svc -n {{NAMESPACE}}`
   - [ ] Access via `http://<EXTERNAL-IP>`

---

## Operational Procedures

### DNS Resolution (Azure Container Apps)

Container Apps require an IT ticket for DNS resolution.

**Information to provide:**
1. Azure resource name
2. Subnet the resource is deployed in

### Domain Registration (All Services)

For custom domain names, an IT ticket is required for both AKS and Container Apps.

### Key Vault Access

**Standard pattern:** Use Service Principal for application access to Key Vault secrets.

```
App → Service Principal → Key Vault → Secrets
```

---

## Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|----------|---------------|
| Use Strictly Confidential data in PoC | Use synthetic or Public/Restricted data |
| Introduce multiple new technologies at once | Start with company standards, iterate |
| Skip Architecture Board for MVP | Prepare diagram + presentation, get approval |
| Use CosmosDB for user-facing apps | Default to PostgreSQL |
| Over-engineer PoC infrastructure | Keep it simple: AKS + static IP |

---

## Governance Summary

| Stage | Architecture Board | Data Restrictions | IT Tickets |
|-------|-------------------|-------------------|------------|
| PoC | ❌ Not required | No Strictly Confidential | None (static IP) |
| MVP | ✅ Required | Review classification | DNS (Container Apps) |
| Production | ✅ Required | Full compliance | DNS + Domain |

---

## AI Agent Instructions

When guiding infrastructure decisions:

1. **Always ask about project stage first** (PoC/MVP/Production)
2. **Always highlight data sensitivity** — especially warn about Strictly Confidential in PoC
3. **Default to simple choices** — PostgreSQL, Container Apps
4. **Remind about governance** — Architecture Board for MVP+
5. **Flag IT dependencies early** — DNS tickets have lead time
6. **Discourage over-engineering** — "Start simple, improve later"

### Example Agent Response

> "For your MVP, I recommend:
> - **Compute:** Azure Container Apps (company preferred)
> - **Database:** PostgreSQL (default choice)
> - **Secrets:** Key Vault with Service Principal
> - **Monitoring:** Application Insights
> 
> ⚠️ **Before deployment:**
> 1. Prepare architecture diagram for Architecture Board
> 2. Submit IT ticket for DNS resolution (provide resource name + subnet)
> 
> What data classification level will this application handle?"

---

## Glossary (Non-Technical Readers)

| Term | Simple Explanation |
|------|-------------------|
| **AKS (Azure Kubernetes Service)** | Microsoft's service for running containerized applications. Think of it as a "server manager" that runs your app. |
| **Azure Container Apps** | A simpler alternative to AKS — easier to set up, preferred for MVP and Production. |
| **Container / Docker** | A packaged version of your application that can run anywhere. Like a "shipping container" for software. |
| **CI/CD Pipeline** | Automated process that builds and deploys your app whenever code changes. No manual deployment needed. |
| **Static IP** | A fixed internet address for your app (like a permanent phone number). Used in PoC instead of a domain name. |
| **DNS** | Turns a domain name (like `myapp.siemensgamesa.com`) into an IP address. Requires IT ticket to set up. |
| **PostgreSQL** | A database for storing structured data (like Excel, but for applications). Our default choice. |
| **CosmosDB** | A different type of database for special performance needs. Not for user-facing apps. |
| **Key Vault** | Secure storage for passwords and API keys. Never put secrets in code — use Key Vault. |
| **Service Principal** | A special "robot account" that lets your app access Azure services securely. |
| **Architecture Board** | Internal review committee that approves technical designs for MVP and Production. |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 03.02.2026 | Initial draft from interview  |
