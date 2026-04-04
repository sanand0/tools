#!/usr/bin/env python3
"""Generate mock technology radar data files."""

import json
import random
from datetime import date

random.seed(42)

# ── Schema constants ──────────────────────────────────────────────────────────

QUADRANTS = ["techniques", "tools", "platforms", "frameworks"]
RINGS = ["adopt", "trial", "assess", "hold"]
RING_WEIGHTS = [0.20, 0.30, 0.30, 0.20]
CHANGE_WEIGHTS = [0.15, 0.25, 0.15, 0.45]  # new, in, out, ""
CHANGE_VALUES = ["new", "in", "out", ""]

CATEGORIES = [
    "devops", "frontend", "backend", "infrastructure", "data",
    "security", "testing", "mobile", "ai-ml", "systems-programming",
    "cloud", "observability", "messaging", "storage", "networking",
]
LICENSES = ["MIT", "Apache-2.0", "GPL-3.0", "BSL-1.1", "Proprietary", "MIT/Apache-2.0"]
MATURITIES = ["emerging", "growing", "stable", "declining"]

# ── Real technologies for data.json (100 nodes) ───────────────────────────────

REAL_TECHS = [
    # techniques
    {"name": "GitOps", "quadrant": "techniques", "ring": "adopt", "category": "devops",
     "desc": "**GitOps** uses Git as the single source of truth for declarative infrastructure and applications. Enables audit trails, rollbacks, and automated reconciliation. See [OpenGitOps](https://opengitops.dev/).",
     "github": "https://github.com/open-gitops/spec", "homepage": "https://opengitops.dev", "alts": ["Ansible Push", "Manual CD"]},
    {"name": "Trunk-Based Development", "quadrant": "techniques", "ring": "adopt", "category": "devops",
     "desc": "Developers integrate to a shared mainline frequently, avoiding long-lived branches. Reduces merge conflicts and speeds delivery. See [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/).",
     "homepage": "https://trunkbaseddevelopment.com", "alts": ["Feature Branching", "GitFlow"]},
    {"name": "Domain-Driven Design", "quadrant": "techniques", "ring": "trial", "category": "backend",
     "desc": "**DDD** aligns software design with the business domain through ubiquitous language and bounded contexts. Works well with microservices architectures.",
     "homepage": "https://domainlanguage.com/ddd", "alts": ["Anemic Domain Model"]},
    {"name": "Event Storming", "quadrant": "techniques", "ring": "trial", "category": "backend",
     "desc": "A workshop format for rapidly exploring complex business domains using domain events. Produces a shared understanding and feeds directly into DDD models.",
     "homepage": "https://eventstorming.com", "alts": ["Story Mapping", "Impact Mapping"]},
    {"name": "Chaos Engineering", "quadrant": "techniques", "ring": "trial", "category": "devops",
     "desc": "Proactively injecting failures into production-like systems to build confidence in resilience. Popularised by Netflix's [Chaos Monkey](https://github.com/Netflix/chaosmonkey).",
     "github": "https://github.com/Netflix/chaosmonkey", "homepage": "https://principlesofchaos.org", "alts": ["GameDay", "Fault Injection Testing"]},
    {"name": "BDD with Cucumber", "quadrant": "techniques", "ring": "assess", "category": "testing",
     "desc": "Behaviour-Driven Development using Gherkin syntax to express requirements as executable specifications. Bridges product and engineering conversations.",
     "github": "https://github.com/cucumber/cucumber-jvm", "homepage": "https://cucumber.io", "alts": ["SpecFlow", "Behave"]},
    {"name": "Platform Engineering", "quadrant": "techniques", "ring": "assess", "category": "devops",
     "desc": "Building internal developer platforms (IDPs) to reduce cognitive load for product teams. Treats developers as internal customers with golden paths.",
     "homepage": "https://platformengineering.org", "alts": ["DevOps", "SRE"]},
    {"name": "FinOps", "quadrant": "techniques", "ring": "assess", "category": "cloud",
     "desc": "**FinOps** brings financial accountability to cloud spend through cross-functional collaboration between engineering, finance, and business. See [finops.org](https://www.finops.org/).",
     "homepage": "https://www.finops.org", "alts": ["Cloud Cost Management", "Manual Budgeting"]},
    {"name": "Micro-frontends", "quadrant": "techniques", "ring": "hold", "category": "frontend",
     "desc": "Decomposing frontend monoliths into independently deployable units owned by separate teams. Adds significant complexity; consider carefully before adopting.",
     "homepage": "https://micro-frontends.org", "alts": ["Modular Monolith", "Monorepo"]},
    {"name": "GraphQL Federation", "quadrant": "techniques", "ring": "hold", "category": "backend",
     "desc": "Composing multiple GraphQL services into a single supergraph. Powerful but operationally complex; REST + API gateway may suffice for most teams.",
     "github": "https://github.com/apollographql/federation", "homepage": "https://www.apollographql.com/docs/federation", "alts": ["REST", "gRPC"]},

    # tools
    {"name": "Docker", "quadrant": "tools", "ring": "adopt", "category": "devops",
     "desc": "The de-facto standard container runtime. **Docker Desktop** simplifies local development on Mac and Windows. See [docs.docker.com](https://docs.docker.com/).",
     "github": "https://github.com/docker/docker-ce", "homepage": "https://www.docker.com", "alts": ["Podman", "containerd"]},
    {"name": "Terraform", "quadrant": "tools", "ring": "adopt", "category": "infrastructure",
     "desc": "**Infrastructure as Code** tool by HashiCorp using HCL. Supports 1000+ providers and enables repeatable, version-controlled infrastructure. [terraform.io](https://developer.hashicorp.com/terraform).",
     "github": "https://github.com/hashicorp/terraform", "homepage": "https://developer.hashicorp.com/terraform", "alts": ["Pulumi", "CloudFormation", "Ansible"]},
    {"name": "GitHub Actions", "quadrant": "tools", "ring": "adopt", "category": "devops",
     "desc": "CI/CD workflows defined in YAML directly in the repository. Tight GitHub integration, large marketplace, and generous free tier for public repos.",
     "homepage": "https://github.com/features/actions", "alts": ["CircleCI", "Jenkins", "GitLab CI"]},
    {"name": "Grafana", "quadrant": "tools", "ring": "adopt", "category": "observability",
     "desc": "**Open-source** dashboarding and analytics platform that connects to dozens of data sources. Part of the LGTM observability stack alongside Loki, Tempo, and Mimir.",
     "github": "https://github.com/grafana/grafana", "homepage": "https://grafana.com", "alts": ["Kibana", "Datadog", "New Relic"]},
    {"name": "Playwright", "quadrant": "tools", "ring": "trial", "category": "testing",
     "desc": "Modern end-to-end testing framework supporting Chromium, Firefox, and WebKit. **Auto-wait** and trace viewer reduce test flakiness. See [playwright.dev](https://playwright.dev/).",
     "github": "https://github.com/microsoft/playwright", "homepage": "https://playwright.dev", "alts": ["Cypress", "Selenium", "Puppeteer"]},
    {"name": "Vault", "quadrant": "tools", "ring": "trial", "category": "security",
     "desc": "HashiCorp Vault manages secrets, certificates, and identity across distributed systems. Dynamic secrets and lease management reduce long-lived credentials.",
     "github": "https://github.com/hashicorp/vault", "homepage": "https://www.vaultproject.io", "alts": ["AWS Secrets Manager", "1Password Secrets", "SOPS"]},
    {"name": "Temporal", "quadrant": "tools", "ring": "trial", "category": "backend",
     "desc": "**Durable execution** platform for writing fault-tolerant workflows as ordinary code. Handles retries, timeouts, and state persistence automatically.",
     "github": "https://github.com/temporalio/temporal", "homepage": "https://temporal.io", "alts": ["Conductor", "Prefect", "Apache Airflow"]},
    {"name": "Renovate", "quadrant": "tools", "ring": "trial", "category": "devops",
     "desc": "Automated dependency update tool that creates PRs for outdated packages. Highly configurable scheduling, grouping, and auto-merge rules.",
     "github": "https://github.com/renovatebot/renovate", "homepage": "https://renovateapp.com", "alts": ["Dependabot", "Snyk"]},
    {"name": "Trivy", "quadrant": "tools", "ring": "assess", "category": "security",
     "desc": "Fast, comprehensive vulnerability scanner for containers, filesystems, and IaC. Integrates easily into CI pipelines with zero configuration.",
     "github": "https://github.com/aquasecurity/trivy", "homepage": "https://trivy.dev", "alts": ["Snyk", "Grype", "Clair"]},
    {"name": "k9s", "quadrant": "tools", "ring": "assess", "category": "devops",
     "desc": "Terminal UI for Kubernetes that streamlines navigation across clusters, namespaces, and workloads. Significantly speeds up day-to-day cluster operations.",
     "github": "https://github.com/derailed/k9s", "homepage": "https://k9scli.io", "alts": ["Lens", "kubectl", "Octant"]},
    {"name": "Backstage", "quadrant": "tools", "ring": "assess", "category": "devops",
     "desc": "Spotify's **open-source** internal developer portal. Centralises service catalogue, docs, and scaffolding. Adoption requires significant investment to customise.",
     "github": "https://github.com/backstage/backstage", "homepage": "https://backstage.io", "alts": ["Port", "Cortex", "OpsLevel"]},
    {"name": "Jenkins", "quadrant": "tools", "ring": "hold", "category": "devops",
     "desc": "Mature CI/CD automation server with a vast plugin ecosystem. High operational overhead and security surface area make modern alternatives preferable for new projects.",
     "github": "https://github.com/jenkinsci/jenkins", "homepage": "https://www.jenkins.io", "alts": ["GitHub Actions", "GitLab CI", "CircleCI"]},
    {"name": "Ansible", "quadrant": "tools", "ring": "hold", "category": "infrastructure",
     "desc": "Agentless configuration management and orchestration tool. YAML playbooks can grow unwieldy; **Terraform** or **Pulumi** are preferable for cloud-native IaC.",
     "github": "https://github.com/ansible/ansible", "homepage": "https://www.ansible.com", "alts": ["Chef", "Puppet", "SaltStack"]},

    # platforms
    {"name": "Kubernetes", "quadrant": "platforms", "ring": "adopt", "category": "infrastructure",
     "desc": "The industry-standard container orchestration platform. **Kubernetes** provides self-healing, scaling, and service discovery for containerised workloads.",
     "github": "https://github.com/kubernetes/kubernetes", "homepage": "https://kubernetes.io", "alts": ["Docker Swarm", "Nomad", "ECS"]},
    {"name": "AWS", "quadrant": "platforms", "ring": "adopt", "category": "cloud",
     "desc": "Amazon Web Services is the leading cloud provider with 200+ services. Broad tooling, community support, and managed services reduce operational burden.",
     "homepage": "https://aws.amazon.com", "alts": ["GCP", "Azure", "DigitalOcean"], "vendor": "Amazon"},
    {"name": "Google Cloud Platform", "quadrant": "platforms", "ring": "adopt", "category": "cloud",
     "desc": "**GCP** excels in data analytics (BigQuery), ML (Vertex AI), and globally distributed networking. Strong choice for data-heavy workloads.",
     "homepage": "https://cloud.google.com", "alts": ["AWS", "Azure"], "vendor": "Google"},
    {"name": "GitHub", "quadrant": "platforms", "ring": "adopt", "category": "devops",
     "desc": "The primary platform for source control, code review, CI/CD, and project management at our organisation. Tight integration across the software development lifecycle.",
     "homepage": "https://github.com", "alts": ["GitLab", "Bitbucket"], "vendor": "Microsoft"},
    {"name": "Snowflake", "quadrant": "platforms", "ring": "trial", "category": "data",
     "desc": "**Cloud data warehouse** with separation of compute and storage, time-travel, and zero-copy cloning. Native data sharing across accounts simplifies data mesh patterns.",
     "homepage": "https://www.snowflake.com", "alts": ["BigQuery", "Redshift", "Databricks"], "vendor": "Snowflake"},
    {"name": "Confluent Kafka", "quadrant": "platforms", "ring": "trial", "category": "messaging",
     "desc": "Managed Apache Kafka with Schema Registry, ksqlDB, and connectors. Enables reliable, scalable event streaming for our data pipelines.",
     "github": "https://github.com/apache/kafka", "homepage": "https://www.confluent.io", "alts": ["AWS MSK", "Pulsar", "RabbitMQ"], "vendor": "Confluent"},
    {"name": "Cloudflare Workers", "quadrant": "platforms", "ring": "trial", "category": "cloud",
     "desc": "Serverless compute at the edge using the V8 isolate model. Sub-millisecond cold starts and 300+ PoPs make it ideal for latency-sensitive APIs.",
     "homepage": "https://workers.cloudflare.com", "alts": ["Lambda@Edge", "Fastly Compute@Edge"], "vendor": "Cloudflare"},
    {"name": "Databricks", "quadrant": "platforms", "ring": "trial", "category": "data",
     "desc": "**Unified analytics platform** built on Apache Spark. Delta Lake, MLflow, and Unity Catalog create a comprehensive lakehouse architecture.",
     "homepage": "https://databricks.com", "alts": ["Snowflake", "AWS Glue", "Dask"], "vendor": "Databricks"},
    {"name": "Vercel", "quadrant": "platforms", "ring": "assess", "category": "frontend",
     "desc": "Frontend cloud optimised for Next.js and edge-first deployments. Excellent DX with automatic preview environments per PR.",
     "homepage": "https://vercel.com", "alts": ["Netlify", "Cloudflare Pages", "AWS Amplify"], "vendor": "Vercel"},
    {"name": "HashiCorp Nomad", "quadrant": "platforms", "ring": "assess", "category": "infrastructure",
     "desc": "Lightweight workload orchestrator supporting containers, binaries, and Java JARs on bare metal or cloud. Simpler than Kubernetes for heterogeneous workloads.",
     "github": "https://github.com/hashicorp/nomad", "homepage": "https://developer.hashicorp.com/nomad", "alts": ["Kubernetes", "ECS", "Mesos"]},
    {"name": "Azure", "quadrant": "platforms", "ring": "assess", "category": "cloud",
     "desc": "Microsoft Azure offers strong hybrid-cloud and enterprise Active Directory integration. Teams evaluating vendor consolidation with Microsoft 365.",
     "homepage": "https://azure.microsoft.com", "alts": ["AWS", "GCP"], "vendor": "Microsoft"},
    {"name": "Heroku", "quadrant": "platforms", "ring": "hold", "category": "cloud",
     "desc": "PaaS that pioneered dyno-based deployments. Removal of free tier and lagging feature set vs. Render or Railway make it a poor choice for new projects.",
     "homepage": "https://www.heroku.com", "alts": ["Render", "Railway", "Fly.io"], "vendor": "Salesforce"},
    {"name": "OpenShift", "quadrant": "platforms", "ring": "hold", "category": "infrastructure",
     "desc": "Red Hat's enterprise Kubernetes distribution with opinionated security and CI/CD. High licensing cost and lock-in make vanilla Kubernetes preferable.",
     "homepage": "https://www.redhat.com/en/technologies/cloud-computing/openshift", "alts": ["Kubernetes", "Rancher"], "vendor": "Red Hat"},

    # frameworks / languages
    {"name": "TypeScript", "quadrant": "frameworks", "ring": "adopt", "category": "frontend",
     "desc": "**TypeScript** adds static typing to JavaScript, dramatically improving IDE support, refactoring safety, and documentation via types. Default choice for all new JS projects.",
     "github": "https://github.com/microsoft/TypeScript", "homepage": "https://www.typescriptlang.org", "alts": ["JavaScript", "Flow"]},
    {"name": "React", "quadrant": "frameworks", "ring": "adopt", "category": "frontend",
     "desc": "Component-based UI library with a huge ecosystem. The shift to **React Server Components** in v19 bridges client and server rendering.",
     "github": "https://github.com/facebook/react", "homepage": "https://react.dev", "alts": ["Vue", "Svelte", "SolidJS"]},
    {"name": "Go", "quadrant": "frameworks", "ring": "adopt", "category": "backend",
     "desc": "**Go** delivers C-like performance with garbage collection, easy concurrency via goroutines, and a powerful standard library. Ideal for CLIs, APIs, and system daemons.",
     "github": "https://github.com/golang/go", "homepage": "https://go.dev", "alts": ["Rust", "Java", "Node.js"]},
    {"name": "Python", "quadrant": "frameworks", "ring": "adopt", "category": "backend",
     "desc": "Dominant language for **data engineering**, ML, scripting, and rapid backend prototyping. FastAPI and SQLModel have modernised the async Python web ecosystem.",
     "github": "https://github.com/python/cpython", "homepage": "https://www.python.org", "alts": ["Ruby", "Node.js", "Julia"]},
    {"name": "Rust", "quadrant": "frameworks", "ring": "trial", "category": "systems-programming",
     "desc": "A systems language focused on **memory safety** without a GC. Strong adoption in WebAssembly, CLI tooling, and performance-critical services. See [the book](https://doc.rust-lang.org/book/).",
     "github": "https://github.com/rust-lang/rust", "homepage": "https://www.rust-lang.org", "alts": ["C++", "Zig", "C"]},
    {"name": "Next.js", "quadrant": "frameworks", "ring": "trial", "category": "frontend",
     "desc": "**React framework** with file-based routing, SSR, SSG, and RSC support. App Router and Server Actions significantly reduce client-side JavaScript.",
     "github": "https://github.com/vercel/next.js", "homepage": "https://nextjs.org", "alts": ["Remix", "Nuxt", "SvelteKit"]},
    {"name": "FastAPI", "quadrant": "frameworks", "ring": "trial", "category": "backend",
     "desc": "Modern Python web framework using type hints for **automatic OpenAPI docs** and data validation via Pydantic. Async-first and very fast.",
     "github": "https://github.com/tiangolo/fastapi", "homepage": "https://fastapi.tiangolo.com", "alts": ["Django REST", "Flask", "Litestar"]},
    {"name": "dbt", "quadrant": "frameworks", "ring": "trial", "category": "data",
     "desc": "**Data transformation** tool that brings software engineering practices (version control, testing, docs) to SQL-based analytics pipelines.",
     "github": "https://github.com/dbt-labs/dbt-core", "homepage": "https://www.getdbt.com", "alts": ["SQLMesh", "Dataform", "Spark SQL"]},
    {"name": "Vue.js", "quadrant": "frameworks", "ring": "assess", "category": "frontend",
     "desc": "Progressive JavaScript framework with Composition API and excellent TypeScript support in Vue 3. **Nuxt 3** provides full-stack capabilities.",
     "github": "https://github.com/vuejs/core", "homepage": "https://vuejs.org", "alts": ["React", "Svelte", "Angular"]},
    {"name": "Svelte", "quadrant": "frameworks", "ring": "assess", "category": "frontend",
     "desc": "Compiler-based framework that produces minimal runtime JavaScript. **SvelteKit** is the recommended app framework with excellent SSR and edge support.",
     "github": "https://github.com/sveltejs/svelte", "homepage": "https://svelte.dev", "alts": ["React", "Vue", "SolidJS"]},
    {"name": "LangChain", "quadrant": "frameworks", "ring": "assess", "category": "ai-ml",
     "desc": "Framework for building LLM-powered applications with chains, agents, and retrieval augmentation. Rapid iteration but high abstraction leakage.",
     "github": "https://github.com/langchain-ai/langchain", "homepage": "https://www.langchain.com", "alts": ["LlamaIndex", "Semantic Kernel", "Haystack"]},
    {"name": "Spring Boot", "quadrant": "frameworks", "ring": "hold", "category": "backend",
     "desc": "Mature Java framework for enterprise microservices. High memory footprint and slow startup vs. **Quarkus** or **Micronaut** make it a poor fit for serverless targets.",
     "github": "https://github.com/spring-projects/spring-boot", "homepage": "https://spring.io/projects/spring-boot", "alts": ["Quarkus", "Micronaut", "Helidon"]},
    {"name": "Angular", "quadrant": "frameworks", "ring": "hold", "category": "frontend",
     "desc": "Full-featured enterprise frontend framework from Google. Heavy opinioned structure and large bundle size; **React** or **Vue** preferred for new projects.",
     "github": "https://github.com/angular/angular", "homepage": "https://angular.dev", "alts": ["React", "Vue", "Svelte"]},

    # extra techniques
    {"name": "Contract Testing", "quadrant": "techniques", "ring": "trial", "category": "testing",
     "desc": "Consumer-driven contract tests verify API compatibility between services without integration environments. **Pact** is the most widely used framework.",
     "github": "https://github.com/pact-foundation/pact-js", "homepage": "https://pact.io", "alts": ["Integration Tests", "Spring Cloud Contract"]},
    {"name": "Feature Flags", "quadrant": "techniques", "ring": "adopt", "category": "devops",
     "desc": "Decoupling deployment from release via runtime toggles. Enables **progressive rollouts**, A/B testing, and instant kill-switches without redeployment.",
     "homepage": "https://www.openfeature.dev", "alts": ["Environment Variables", "Config Files"]},
    {"name": "Service Mesh", "quadrant": "techniques", "ring": "assess", "category": "networking",
     "desc": "Offloading cross-cutting concerns (mTLS, retries, observability) to a sidecar proxy layer. **Istio** and **Linkerd** are popular choices; adds operational complexity.",
     "homepage": "https://servicemesh.es", "alts": ["API Gateway", "Library-based resilience"]},
    {"name": "Blue-Green Deployment", "quadrant": "techniques", "ring": "hold", "category": "devops",
     "desc": "Maintaining two identical environments to enable instant rollback by routing traffic. Resource-intensive; **canary releases** with feature flags are often more efficient.",
     "homepage": "https://martinfowler.com/bliki/BlueGreenDeployment.html", "alts": ["Canary Release", "Rolling Update"]},

    # extra tools
    {"name": "OpenTelemetry", "quadrant": "tools", "ring": "adopt", "category": "observability",
     "desc": "**Vendor-neutral** telemetry SDK for traces, metrics, and logs. CNCF standard replacing proprietary instrumentation libraries.",
     "github": "https://github.com/open-telemetry/opentelemetry-specification", "homepage": "https://opentelemetry.io", "alts": ["Datadog Agent", "New Relic SDK"]},
    {"name": "Pulumi", "quadrant": "tools", "ring": "trial", "category": "infrastructure",
     "desc": "Infrastructure as Code using **real programming languages** (Python, Go, TypeScript). Better type safety and testing capabilities than HCL.",
     "github": "https://github.com/pulumi/pulumi", "homepage": "https://www.pulumi.com", "alts": ["Terraform", "CloudFormation", "CDK"]},
    {"name": "Argo CD", "quadrant": "tools", "ring": "adopt", "category": "devops",
     "desc": "**GitOps** continuous delivery tool for Kubernetes. Reconciles cluster state with declarative configs stored in Git; includes rich RBAC and audit trail.",
     "github": "https://github.com/argoproj/argo-cd", "homepage": "https://argo-cd.readthedocs.io", "alts": ["Flux", "Spinnaker", "Jenkins X"]},
    {"name": "Flux CD", "quadrant": "tools", "ring": "trial", "category": "devops",
     "desc": "CNCF GitOps toolkit for Kubernetes with modular controllers for image automation and Helm releases. Lighter-weight alternative to Argo CD.",
     "github": "https://github.com/fluxcd/flux2", "homepage": "https://fluxcd.io", "alts": ["Argo CD", "Jenkins X"]},
    {"name": "Skaffold", "quadrant": "tools", "ring": "assess", "category": "devops",
     "desc": "CLI tool that automates the build-push-deploy cycle for Kubernetes during local development. Watches source changes and hot-reloads manifests.",
     "github": "https://github.com/GoogleContainerTools/skaffold", "homepage": "https://skaffold.dev", "alts": ["Tilt", "Draft", "Garden"]},

    # extra platforms
    {"name": "Fly.io", "quadrant": "platforms", "ring": "assess", "category": "cloud",
     "desc": "PaaS that runs Docker containers close to users on Firecracker microVMs. Easy multi-region deployment and built-in Anycast networking.",
     "homepage": "https://fly.io", "alts": ["Render", "Railway", "Heroku"]},
    {"name": "Neon", "quadrant": "platforms", "ring": "assess", "category": "storage",
     "desc": "**Serverless Postgres** with branching, autoscaling, and scale-to-zero. Database branches per PR enable isolated testing environments.",
     "homepage": "https://neon.tech", "alts": ["PlanetScale", "Supabase", "RDS"], "vendor": "Neon"},
    {"name": "Supabase", "quadrant": "platforms", "ring": "trial", "category": "backend",
     "desc": "Open-source Firebase alternative built on Postgres. Auth, Storage, Realtime subscriptions, and Edge Functions with a generous free tier.",
     "github": "https://github.com/supabase/supabase", "homepage": "https://supabase.com", "alts": ["Firebase", "PocketBase", "Appwrite"]},

    # extra frameworks
    {"name": "Pydantic", "quadrant": "frameworks", "ring": "adopt", "category": "backend",
     "desc": "**Data validation** library using Python type annotations. v2 rewrote the core in Rust for 5-50× speed improvements. Foundation of FastAPI and LangChain.",
     "github": "https://github.com/pydantic/pydantic", "homepage": "https://docs.pydantic.dev", "alts": ["attrs", "marshmallow", "dataclasses"]},
    {"name": "Vite", "quadrant": "frameworks", "ring": "adopt", "category": "frontend",
     "desc": "Next-generation frontend build tool using native ES modules during development for near-instant HMR. Rollup-based production builds are highly optimised.",
     "github": "https://github.com/vitejs/vite", "homepage": "https://vitejs.dev", "alts": ["webpack", "Parcel", "esbuild"]},
    {"name": "tRPC", "quadrant": "frameworks", "ring": "trial", "category": "backend",
     "desc": "**End-to-end type-safe** RPC for TypeScript monorepos. Eliminates manual API client generation; pairs excellently with Next.js and Prisma.",
     "github": "https://github.com/trpc/trpc", "homepage": "https://trpc.io", "alts": ["GraphQL", "REST", "Zodios"]},
    {"name": "Prisma", "quadrant": "frameworks", "ring": "trial", "category": "backend",
     "desc": "**Type-safe ORM** for Node.js with a declarative schema, auto-generated migrations, and excellent TypeScript integration.",
     "github": "https://github.com/prisma/prisma", "homepage": "https://www.prisma.io", "alts": ["Drizzle ORM", "TypeORM", "Sequelize"]},
    {"name": "Drizzle ORM", "quadrant": "frameworks", "ring": "assess", "category": "backend",
     "desc": "Lightweight, headless TypeScript ORM with zero abstraction over SQL. Schema-as-code approach produces predictable, performant queries.",
     "github": "https://github.com/drizzle-team/drizzle-orm", "homepage": "https://orm.drizzle.team", "alts": ["Prisma", "Kysely", "pg"]},
    {"name": "Elixir / Phoenix", "quadrant": "frameworks", "ring": "assess", "category": "backend",
     "desc": "Erlang-VM based language with **LiveView** enabling real-time web apps with server-rendered HTML. Extraordinary fault-tolerance and concurrency characteristics.",
     "github": "https://github.com/phoenixframework/phoenix", "homepage": "https://www.phoenixframework.org", "alts": ["Node.js", "Go", "Rails"]},
    {"name": "Kotlin Multiplatform", "quadrant": "frameworks", "ring": "assess", "category": "mobile",
     "desc": "Share business logic across Android, iOS, Web, and Desktop from a single Kotlin codebase. JetBrains is investing heavily in KMP tooling for 2024.",
     "github": "https://github.com/JetBrains/kotlin", "homepage": "https://kotlinlang.org/lp/multiplatform", "alts": ["Flutter", "React Native", "Capacitor"]},
    {"name": "Ruby on Rails", "quadrant": "frameworks", "ring": "hold", "category": "backend",
     "desc": "Convention-over-configuration MVC framework that defined a generation of web apps. **Ruby's** performance and hiring difficulty make Go or Python preferable for new projects.",
     "github": "https://github.com/rails/rails", "homepage": "https://rubyonrails.org", "alts": ["Django", "Laravel", "FastAPI"]},
    {"name": "Flutter", "quadrant": "frameworks", "ring": "trial", "category": "mobile",
     "desc": "Google's **cross-platform UI toolkit** targeting iOS, Android, Web, and Desktop from one Dart codebase. Strong performance via Impeller rendering engine.",
     "github": "https://github.com/flutter/flutter", "homepage": "https://flutter.dev", "alts": ["React Native", "KMP", "Capacitor"]},

    # 30 more real technologies to reach 100
    # techniques
    {"name": "Canary Releases", "quadrant": "techniques", "ring": "adopt", "category": "devops",
     "desc": "Gradually rolling out changes to a small subset of users before full deployment. Reduces blast radius of bugs and enables **data-driven rollout** decisions.",
     "homepage": "https://martinfowler.com/bliki/CanaryRelease.html", "alts": ["Blue-Green", "Feature Flags"]},
    {"name": "API-First Design", "quadrant": "techniques", "ring": "trial", "category": "backend",
     "desc": "Designing APIs as the primary product artefact before writing implementation code. OpenAPI contracts enable **parallel development** and automated mock servers.",
     "homepage": "https://swagger.io/resources/articles/adopting-an-api-first-approach/", "alts": ["Code-First", "Schema-First"]},
    {"name": "Zero-Trust Security", "quadrant": "techniques", "ring": "assess", "category": "security",
     "desc": "**Never trust, always verify** — authenticate and authorise every request regardless of network location. mTLS, SPIFFE/SPIRE, and policy engines are common building blocks.",
     "homepage": "https://www.nist.gov/publications/zero-trust-architecture", "alts": ["Perimeter Security", "VPN"]},
    {"name": "SLO-Based Alerting", "quadrant": "techniques", "ring": "assess", "category": "observability",
     "desc": "Framing on-call alerts around Service Level Objectives rather than individual metric thresholds. Reduces alert fatigue and ties reliability to user experience.",
     "homepage": "https://sre.google/workbook/alerting-on-slos/", "alts": ["Threshold Alerting", "Anomaly Detection"]},
    {"name": "Polyglot Persistence", "quadrant": "techniques", "ring": "hold", "category": "data",
     "desc": "Using different database technologies for different microservices based on their data model. Increases operational complexity; a single well-chosen RDBMS often suffices.",
     "homepage": "https://martinfowler.com/bliki/PolyglotPersistence.html", "alts": ["Single Database", "CQRS"]},

    # tools
    {"name": "Datadog", "quadrant": "tools", "ring": "adopt", "category": "observability",
     "desc": "**Full-stack observability** SaaS platform integrating metrics, traces, logs, and synthetics. Broad integrations and AI-powered anomaly detection.",
     "homepage": "https://www.datadoghq.com", "alts": ["New Relic", "Dynatrace", "Grafana Stack"], "vendor": "Datadog"},
    {"name": "Snyk", "quadrant": "tools", "ring": "trial", "category": "security",
     "desc": "Developer-first security platform scanning code, dependencies, containers, and IaC for vulnerabilities. Tight IDE and CI integration.",
     "github": "https://github.com/snyk/snyk", "homepage": "https://snyk.io", "alts": ["Trivy", "OWASP Dependency-Check", "Dependabot"], "vendor": "Snyk"},
    {"name": "Helm", "quadrant": "tools", "ring": "adopt", "category": "devops",
     "desc": "The **package manager** for Kubernetes. Helm charts provide parameterised, versioned application templates that simplify complex manifest management.",
     "github": "https://github.com/helm/helm", "homepage": "https://helm.sh", "alts": ["Kustomize", "Carvel ytt", "Tanka"]},
    {"name": "Kustomize", "quadrant": "tools", "ring": "trial", "category": "devops",
     "desc": "Kubernetes-native configuration management using overlay-based patch approach. Built into `kubectl apply -k`; no templating language required.",
     "github": "https://github.com/kubernetes-sigs/kustomize", "homepage": "https://kustomize.io", "alts": ["Helm", "Carvel ytt"]},
    {"name": "Prometheus", "quadrant": "tools", "ring": "adopt", "category": "observability",
     "desc": "**Open-source** metrics collection and alerting system with a powerful query language (PromQL). De-facto standard in the Kubernetes ecosystem.",
     "github": "https://github.com/prometheus/prometheus", "homepage": "https://prometheus.io", "alts": ["InfluxDB", "Datadog Metrics", "CloudWatch"]},
    {"name": "cert-manager", "quadrant": "tools", "ring": "adopt", "category": "security",
     "desc": "Kubernetes controller that automates TLS certificate issuance and renewal via Let's Encrypt and other ACME providers. Eliminates manual certificate rotation.",
     "github": "https://github.com/cert-manager/cert-manager", "homepage": "https://cert-manager.io", "alts": ["AWS ACM", "Manual certs"]},
    {"name": "KEDA", "quadrant": "tools", "ring": "assess", "category": "infrastructure",
     "desc": "**Kubernetes Event-Driven Autoscaling** scales workloads based on external event sources (Kafka, queues, custom metrics) rather than CPU/memory alone.",
     "github": "https://github.com/kedacore/keda", "homepage": "https://keda.sh", "alts": ["HPA", "KARPENTER", "VPA"]},
    {"name": "Tilt", "quadrant": "tools", "ring": "assess", "category": "devops",
     "desc": "Multi-service development environment for Kubernetes with a live-updating web UI. Orchestrates rebuilds, restarts, and log streaming from one `Tiltfile`.",
     "github": "https://github.com/tilt-dev/tilt", "homepage": "https://tilt.dev", "alts": ["Skaffold", "Garden", "DevSpace"]},

    # platforms
    {"name": "Redis", "quadrant": "platforms", "ring": "adopt", "category": "storage",
     "desc": "In-memory data structure store used as a **cache, message broker, and session store**. Redis 7 adds multi-part transactions and ACLv2.",
     "github": "https://github.com/redis/redis", "homepage": "https://redis.io", "alts": ["Memcached", "DragonflyDB", "KeyDB"]},
    {"name": "PostgreSQL", "quadrant": "platforms", "ring": "adopt", "category": "storage",
     "desc": "**World's most advanced open-source relational database**. JSON support, logical replication, and extensions like pgvector and TimescaleDB extend its reach far beyond OLTP.",
     "github": "https://github.com/postgres/postgres", "homepage": "https://www.postgresql.org", "alts": ["MySQL", "CockroachDB", "SQLite"]},
    {"name": "Apache Kafka", "quadrant": "platforms", "ring": "adopt", "category": "messaging",
     "desc": "Distributed event streaming platform handling trillions of events per day at scale. **Kafka Streams** and **KSQL** enable stateful stream processing without external systems.",
     "github": "https://github.com/apache/kafka", "homepage": "https://kafka.apache.org", "alts": ["Pulsar", "RabbitMQ", "NATS"]},
    {"name": "NATS", "quadrant": "platforms", "ring": "trial", "category": "messaging",
     "desc": "**Ultra-fast** cloud-native messaging system with at-most-once, at-least-once, and exactly-once semantics via JetStream. Tiny footprint ideal for edge and IoT.",
     "github": "https://github.com/nats-io/nats-server", "homepage": "https://nats.io", "alts": ["Kafka", "RabbitMQ", "Redis Pub/Sub"]},
    {"name": "Elasticsearch", "quadrant": "platforms", "ring": "hold", "category": "storage",
     "desc": "Distributed search and analytics engine based on Lucene. High operational complexity and BSL licence change driving teams towards **OpenSearch** or **Typesense**.",
     "github": "https://github.com/elastic/elasticsearch", "homepage": "https://www.elastic.co", "alts": ["OpenSearch", "Typesense", "Meilisearch"], "vendor": "Elastic"},
    {"name": "Render", "quadrant": "platforms", "ring": "assess", "category": "cloud",
     "desc": "Modern PaaS supporting web services, static sites, cron jobs, and Postgres. Simpler developer experience than AWS with competitive pricing.",
     "homepage": "https://render.com", "alts": ["Fly.io", "Railway", "Heroku"], "vendor": "Render"},

    # frameworks
    {"name": "Remix", "quadrant": "frameworks", "ring": "trial", "category": "frontend",
     "desc": "**Full-stack React framework** embracing web fundamentals — forms, progressive enhancement, and nested layouts. Acquired by Shopify; strong future roadmap.",
     "github": "https://github.com/remix-run/remix", "homepage": "https://remix.run", "alts": ["Next.js", "SvelteKit", "Astro"]},
    {"name": "Astro", "quadrant": "frameworks", "ring": "assess", "category": "frontend",
     "desc": "Islands architecture framework shipping **zero JavaScript by default**. Ideal for content-heavy sites; supports React, Vue, Svelte, and Solid components.",
     "github": "https://github.com/withastro/astro", "homepage": "https://astro.build", "alts": ["Next.js", "Eleventy", "Gatsby"]},
    {"name": "Hono", "quadrant": "frameworks", "ring": "assess", "category": "backend",
     "desc": "Ultrafast **web framework** for edge runtimes (Cloudflare Workers, Deno, Bun). Zero dependencies and ergonomic API inspired by Express.",
     "github": "https://github.com/honojs/hono", "homepage": "https://hono.dev", "alts": ["Express", "Fastify", "Elysia"]},
    {"name": "Zig", "quadrant": "frameworks", "ring": "assess", "category": "systems-programming",
     "desc": "A general-purpose systems language prioritising simplicity, explicit control flow, and **comptime** metaprogramming. Growing as a C replacement and build system.",
     "github": "https://github.com/ziglang/zig", "homepage": "https://ziglang.org", "alts": ["Rust", "C", "C++"]},
    {"name": "Quarkus", "quadrant": "frameworks", "ring": "trial", "category": "backend",
     "desc": "**Kubernetes-native** Java framework with GraalVM native compilation for sub-100ms startup and low memory footprint. Ideal for serverless Java workloads.",
     "github": "https://github.com/quarkusio/quarkus", "homepage": "https://quarkus.io", "alts": ["Spring Boot", "Micronaut", "Helidon"]},
    {"name": "Nuxt", "quadrant": "frameworks", "ring": "trial", "category": "frontend",
     "desc": "**Vue.js meta-framework** with file-based routing, SSR, SSG, and auto-imports. Nitro server engine enables edge and serverless deployment targets.",
     "github": "https://github.com/nuxt/nuxt", "homepage": "https://nuxt.com", "alts": ["Next.js", "SvelteKit", "Analog"]},
    {"name": "PyTorch", "quadrant": "frameworks", "ring": "adopt", "category": "ai-ml",
     "desc": "**Dynamic computation graph** deep learning framework from Meta. Dominant in research and increasingly in production via TorchServe and torch.compile.",
     "github": "https://github.com/pytorch/pytorch", "homepage": "https://pytorch.org", "alts": ["TensorFlow", "JAX", "MXNet"]},
    {"name": "LlamaIndex", "quadrant": "frameworks", "ring": "assess", "category": "ai-ml",
     "desc": "Data framework for **RAG** (Retrieval-Augmented Generation) applications. Provides connectors, indexes, query engines, and agents for LLM pipelines.",
     "github": "https://github.com/run-llama/llama_index", "homepage": "https://www.llamaindex.ai", "alts": ["LangChain", "Haystack", "Semantic Kernel"]},
    {"name": "Tailwind CSS", "quadrant": "frameworks", "ring": "adopt", "category": "frontend",
     "desc": "**Utility-first** CSS framework enabling rapid UI development without leaving HTML. JIT compiler ships only used classes resulting in minimal CSS bundles.",
     "github": "https://github.com/tailwindlabs/tailwindcss", "homepage": "https://tailwindcss.com", "alts": ["Bootstrap", "CSS Modules", "styled-components"]},
    {"name": "SolidJS", "quadrant": "frameworks", "ring": "assess", "category": "frontend",
     "desc": "Reactive UI library with **fine-grained reactivity** and no virtual DOM. Minimal runtime and near-Svelte performance benchmarks with a React-like API.",
     "github": "https://github.com/solidjs/solid", "homepage": "https://www.solidjs.com", "alts": ["React", "Svelte", "Preact"]},
    {"name": "Django", "quadrant": "frameworks", "ring": "hold", "category": "backend",
     "desc": "**Batteries-included** Python web framework. Monolithic design and synchronous-first model make **FastAPI** or async-native alternatives preferable for new greenfield projects.",
     "github": "https://github.com/django/django", "homepage": "https://www.djangoproject.com", "alts": ["FastAPI", "Flask", "Litestar"]},
]

# ── History generation helpers ────────────────────────────────────────────────

def rand_ym(start_year=2018, end_year=2024):
    y = random.randint(start_year, end_year)
    m = random.randint(1, 12)
    if y == 2024 and m > 12:
        m = 12
    return f"{y}-{m:02d}"


def ring_progression(final_ring):
    """Return plausible ring history ending at final_ring."""
    order = ["assess", "trial", "adopt", "hold"]
    progressions = {
        "adopt": ["assess", "trial", "adopt"],
        "trial": ["assess", "trial"],
        "assess": ["assess"],
        "hold": ["trial", "hold"],
    }
    return progressions.get(final_ring, ["assess"])


def make_history(node_ring, added_date):
    """Generate 1-4 history entries in reverse-chronological order."""
    rings = ring_progression(node_ring)
    notes = {
        ("assess", "assess"): "First appearance on radar.",
        ("assess", "trial"): "Promoted from Assess after pilot projects showed promise.",
        ("trial", "trial"): "Moved to Trial — broader team pilots underway.",
        ("trial", "adopt"): "Promoted from Trial; strong production usage across multiple teams.",
        ("adopt", "adopt"): "Reaffirmed Adopt status; no change in recommendation.",
        ("trial", "hold"): "Moved to Hold; operational complexity outweighs benefits.",
        ("hold", "hold"): "Kept on Hold; teams advised to migrate to modern alternatives.",
    }
    dates = sorted(
        [rand_ym(2018, 2024) for _ in range(len(rings) - 1)] + [added_date],
        reverse=False,
    )
    # ensure dates are unique and ascending
    seen = set()
    unique_dates = []
    for d in dates:
        while d in seen:
            y, m = int(d[:4]), int(d[5:])
            m += 1
            if m > 12:
                m = 1
                y += 1
            d = f"{y}-{m:02d}"
        seen.add(d)
        unique_dates.append(d)

    history = []
    for i, (r, d) in enumerate(zip(rings, unique_dates)):
        prev = rings[i - 1] if i > 0 else None
        key = (prev, r) if prev else ("assess", "assess")
        note = notes.get(key, f"Entered {r} ring.")
        history.append({"date": d, "ring": r, "note": note})

    return list(reversed(history))


# ── Build 100-node dataset ────────────────────────────────────────────────────

def build_node(idx, tech):
    ring = tech["ring"]
    added = rand_ym(2018, 2024)
    history = make_history(ring, added)
    # added should match earliest history entry date
    added = history[-1]["date"]

    tags = {"category": tech["category"]}
    if "license" not in tech:
        tags["license"] = random.choice(LICENSES)
    else:
        tags["license"] = tech["license"]
    if "github" in tech:
        tags["github_url"] = tech["github"]
    if "homepage" in tech:
        tags["homepage"] = tech["homepage"]
    if "alts" in tech:
        tags["alternatives"] = tech["alts"]
    if "vendor" in tech:
        tags["vendor"] = tech["vendor"]
    tags["maturity"] = random.choice(MATURITIES)

    return {
        "id": idx,
        "name": tech["name"],
        "quadrant": tech["quadrant"],
        "ring": ring,
        "change": random.choices(CHANGE_VALUES, weights=CHANGE_WEIGHTS)[0],
        "description": tech["desc"],
        "added": added,
        "tags": tags,
        "history": history,
    }


def build_100():
    nodes = []
    for i, tech in enumerate(REAL_TECHS[:100], start=1):
        nodes.append(build_node(i, tech))
    return nodes


# ── Synthetic tech name generator for 2000-node dataset ──────────────────────

PREFIXES = [
    "Fast", "Smart", "Cloud", "Edge", "Open", "Micro", "Nano", "Hyper",
    "Meta", "Ultra", "Auto", "Deep", "Flex", "Stream", "Proto", "Turbo",
    "Spark", "Flow", "Data", "Net", "Web", "Core", "Zero", "Lambda",
    "Quantum", "Sigma", "Alpha", "Nova", "Apex", "Swift", "Bolt", "Iron",
    "Solid", "Bright", "Clear", "Mesh", "Sync", "Safe", "Pure", "Lean",
]
ROOTS = [
    "Stack", "Flow", "Base", "Link", "Hub", "Kit", "Labs", "Works",
    "Engine", "Agent", "Node", "Wire", "Forge", "Craft", "Bench",
    "Guard", "Shield", "Vault", "Relay", "Proxy", "Gate", "Broker",
    "Store", "Cache", "Queue", "Bus", "Grid", "Map", "Graph", "Search",
    "DB", "SQL", "Scale", "Pod", "Fleet", "Mesh", "Lens", "Watch",
    "Beam", "Trace", "Pulse", "Signal", "Sync", "Audit", "Helm",
    "Deck", "Canvas", "Studio", "Console", "Portal", "Index", "Scope",
]
SUFFIXES = ["", " v2", " v3", " Lite", " Pro", " Plus", " OSS", " Cloud", " X", " AI"]

QUADRANT_CATEGORIES = {
    "techniques": ["devops", "testing", "security", "observability", "networking"],
    "tools": ["devops", "testing", "security", "observability", "storage"],
    "platforms": ["cloud", "infrastructure", "data", "messaging", "storage"],
    "frameworks": ["backend", "frontend", "mobile", "ai-ml", "systems-programming"],
}

DESCRIPTION_TEMPLATES = [
    "**{name}** is a {adj} {type} for {use_case}. It integrates seamlessly with existing {ecosystem} tooling.",
    "A {adj} {type} designed for {use_case}. Provides built-in support for **{feature}** and scales to large workloads.",
    "{name} offers {adj} {use_case} capabilities with a {philosophy} approach. See the [docs]({homepage}).",
    "**{name}** simplifies {use_case} through a {philosophy} design. Strong community adoption and active development.",
    "Cloud-native {type} for {use_case}. **Zero-configuration** defaults make it approachable for small teams.",
]

ADJS = ["lightweight", "high-performance", "developer-friendly", "scalable", "distributed",
        "secure", "extensible", "opinionated", "composable", "event-driven", "reactive",
        "type-safe", "portable", "observable", "resilient"]
TYPES = ["framework", "toolkit", "platform", "runtime", "library", "SDK", "tool",
         "engine", "service mesh", "proxy", "gateway", "pipeline", "orchestrator"]
USE_CASES = ["microservices", "data pipelines", "API development", "stream processing",
             "ML model serving", "distributed tracing", "container orchestration",
             "identity management", "secret management", "event sourcing",
             "schema validation", "async task processing", "real-time analytics",
             "infrastructure automation", "edge computing"]
ECOSYSTEMS = ["Kubernetes", "cloud-native", "AWS", "GCP", "Azure", "CNCF", "POSIX", "gRPC"]
FEATURES = ["RBAC", "mTLS", "auto-scaling", "hot-reload", "schema evolution",
            "circuit breaking", "distributed tracing", "zero-downtime deploys"]
PHILOSOPHIES = ["convention-over-configuration", "batteries-included", "minimal footprint",
                "composable", "declarative", "code-first", "schema-first"]


def synth_name(existing_names):
    for _ in range(200):
        p = random.choice(PREFIXES)
        r = random.choice(ROOTS)
        s = random.choice(SUFFIXES)
        name = f"{p}{r}{s}"
        if name not in existing_names:
            existing_names.add(name)
            return name
    return f"Tech{random.randint(1000, 9999)}"


def synth_desc(name, homepage="https://example.com"):
    tmpl = random.choice(DESCRIPTION_TEMPLATES)
    return tmpl.format(
        name=name,
        adj=random.choice(ADJS),
        type=random.choice(TYPES),
        use_case=random.choice(USE_CASES),
        ecosystem=random.choice(ECOSYSTEMS),
        feature=random.choice(FEATURES),
        philosophy=random.choice(PHILOSOPHIES),
        homepage=homepage,
    )


def build_2000():
    # Target counts per zone: ~125 each (16 zones)
    target = {(q, r): 125 for q in QUADRANTS for r in RINGS}

    # Pre-fill with real techs
    nodes = []
    existing_names = set()
    zone_counts = {(q, r): 0 for q in QUADRANTS for r in RINGS}

    for i, tech in enumerate(REAL_TECHS, start=1):
        ring = tech["ring"]
        quadrant = tech["quadrant"]
        added = rand_ym(2018, 2024)
        history = make_history(ring, added)
        added = history[-1]["date"]
        tags = {
            "category": tech["category"],
            "maturity": random.choice(MATURITIES),
        }
        if "homepage" in tech:
            tags["homepage"] = tech["homepage"]
        node = {
            "id": i,
            "name": tech["name"],
            "quadrant": quadrant,
            "ring": ring,
            "change": random.choices(CHANGE_VALUES, weights=CHANGE_WEIGHTS)[0],
            "description": tech.get("desc", synth_desc(tech["name"])),
            "added": added,
            "tags": tags,
            "history": history,
        }
        nodes.append(node)
        existing_names.add(tech["name"])
        zone_counts[(quadrant, ring)] += 1

    # Fill remaining slots with synthetic nodes
    next_id = len(REAL_TECHS) + 1
    zones = [(q, r) for q in QUADRANTS for r in RINGS]

    while next_id <= 2000:
        # Pick zone with most deficit
        zone = max(zones, key=lambda z: target[z] - zone_counts[z])
        if target[zone] - zone_counts[zone] <= 0:
            zone = random.choice(zones)

        quadrant, ring = zone
        cat = random.choice(QUADRANT_CATEGORIES[quadrant])
        name = synth_name(existing_names)
        hp = f"https://www.{name.lower().replace(' ', '').replace('v', '').replace('.', '')}.io"
        gh = f"https://github.com/org/{name.lower().replace(' ', '-').replace('.', '')}"
        added = rand_ym(2018, 2024)
        history = make_history(ring, added)
        added = history[-1]["date"]

        tags = {"category": cat, "maturity": random.choice(MATURITIES)}
        if random.random() > 0.4:
            tags["license"] = random.choice(LICENSES)
        if random.random() > 0.5:
            tags["homepage"] = hp
        if random.random() > 0.6:
            tags["github_url"] = gh

        node = {
            "id": next_id,
            "name": name,
            "quadrant": quadrant,
            "ring": ring,
            "change": random.choices(CHANGE_VALUES, weights=CHANGE_WEIGHTS)[0],
            "description": synth_desc(name, hp),
            "added": added,
            "tags": tags,
            "history": history,
        }
        nodes.append(node)
        zone_counts[zone] += 1
        next_id += 1

    return nodes


# ── Assemble and write ────────────────────────────────────────────────────────

BASE = {
    "version": 1,
    "title": "Technology Radar",
    "subtitle": "Tracking technology adoption across our organization",
    "quadrants": {
        "techniques": "Techniques",
        "tools": "Tools",
        "platforms": "Platforms",
        "frameworks": "Languages & Frameworks",
    },
    "rings": {
        "adopt": "Adopt",
        "trial": "Trial",
        "assess": "Assess",
        "hold": "Hold",
    },
}

import os
out_dir = os.path.dirname(os.path.abspath(__file__))

print("Generating data.json (100 nodes)...")
d100 = {**BASE, "nodes": build_100()}
with open(os.path.join(out_dir, "data.json"), "w") as f:
    json.dump(d100, f, indent=2)
print(f"  Written: {len(d100['nodes'])} nodes")

print("Generating data-2000.json (2000 nodes)...")
d2000 = {**BASE, "nodes": build_2000()}
with open(os.path.join(out_dir, "data-2000.json"), "w") as f:
    json.dump(d2000, f, indent=2)
print(f"  Written: {len(d2000['nodes'])} nodes")

print("Done.")
