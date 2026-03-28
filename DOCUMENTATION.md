# 🐳 DockerManager: Plataforma CaaS/PaaS con Aislamiento VPC

DockerManager es una solución integral de "Contenedores como Servicio" (CaaS) diseñada para entornos multi-tenant. Permite a usuarios y organizaciones aprovisionar, gestionar y exponer aplicaciones Docker de forma segura, bajo un modelo de **Defensa en Profundidad** que combina aislamiento de red de Capa 2, inspección de tráfico perimetral y políticas comerciales automatizadas.

---

## 🏗️ Arquitectura de Red: El Modelo VPC (Virtual Private Cloud)

A diferencia de las soluciones estándar, DockerManager no utiliza una red compartida. Implementa un sistema de **VPC dinámico** donde cada usuario opera en una burbuja de red totalmente privada e invisible para el resto de los inquilinos.

### 🛡️ Segmentación por Capas (Las 7 Subredes)

La infraestructura se orquestra mediante un despliegue de **7 redes aisladas** para garantizar que el fallo o compromiso de un componente no afecte al resto:

| Red | Rol |
|---|---|
| `public_net` | Punto de entrada único desde el exterior hacia el Firewall perimetral. |
| `transit_proxy_inverso` & `transit_proxy_forward` | Redes de tránsito que conectan el tráfico limpio (tras ser inspeccionado) con los proxies correspondientes. |
| `dmz_net` | **Zona Desmilitarizada.** Núcleo del sistema: aloja la API, el Frontend, MongoDB y el Proxy de administración. Inaccesible desde las redes de los clientes. |
| `${userId}_default_vlan` (VPC del Usuario) | Redes auto-generadas con `{ Internal: true }` por defecto. Cortan el cable a internet y aíslan cada usuario del resto. |
| `storage_transit_net` & `storage_net` | Enclave ultra-seguro para MinIO y el NAS, protegido por un firewall interno que solo permite conexiones desde el Backend. |

### 🧩 Componentes Core de Infraestructura

- **`edge-fw` (Suricata IDS/IPS):** Guardián perimetral. Realiza Inspección Profunda de Paquetes (DPI) para bloquear ataques antes de que toquen la red interna. Si un usuario activa el _"Acceso a Internet"_, aplica reglas NAT que permiten la salida a la red pero prohíben estrictamente el salto hacia la DMZ.

- **Dual Traefik Stack (Proxy Inverso):**
  - **Admin Proxy:** Gestiona el acceso a la plataforma DockerManager.
  - **LAN Proxy:** Se conecta _dinámicamente_ a las redes de los usuarios solo cuando estos exponen un dominio, actuando como el único puente de entrada permitido a sus VPCs.

- **`socket-proxy` (Escudo del Daemon):** El Backend nunca toca el `/var/run/docker.sock` directamente. Se comunica vía TCP limitado con este proxy, que filtra las peticiones para evitar que un contenedor comprometido pueda tomar el control del servidor host.

- **`storage-fw` (HAProxy Bridge):** Actúa como un puente de Capa 4 que cruza las peticiones de almacenamiento desde la DMZ hacia la red de Storage, verificando que el origen sea legítimo.

---

## ⚙️ Inteligencia del Backend (Cerebro Operativo)

El backend en Node.js no solo gestiona Docker, sino que aplica la lógica de negocio y seguridad:

### 1. Gestión de Cuotas y Recursos (RBAC)
Verifica en tiempo real que el despliegue no exceda los límites de RAM y CPU asignados al plan del usuario (`User.planType`).

### 2. Reaper Service ("El Segador")
Un servicio de tres fases que se ejecuta cada **5 minutos** en segundo plano:

**Fase 1 — Expiración de Planes:**
Busca en MongoDB usuarios con `planExpiresAt` vencido y detiene todos sus contenedores activos. Genera un registro en el Audit Log por cada acción.

**Fase 2 — Límite de Uptime Gratuito (Política Heroku):**
Para usuarios del plan `free`, inspecciona el campo `State.StartedAt` de Docker en tiempo real. Si un contenedor lleva más de **24 horas ininterrumpidas** en ejecución, el Reaper lo detiene automáticamente para liberar recursos del host.

**Fase 3 — Limpieza de Redes VPC Huérfanas:**
Cada ciclo, el Reaper barre todas las redes con la etiqueta `dockermanager.vpc=true` de cada usuario. Si una red ya no tiene contenedores de usuario conectados, la elimina, desconectando previamente el `lan-proxy` si estaba adjunto. Sin este mecanismo, operaciones repetidas de deploy/delete generarían miles de redes `_vlan` y `_open` acumuladas en memoria del kernel del host.

### 3. Zero-Downtime Blue/Green Deployments
Al actualizar una aplicación, el sistema mantiene la versión antigua activa hasta que el nuevo contenedor pasa los healthchecks. El cambio de tráfico en el Proxy es instantáneo y transparente.

### 4. Secret Manager (Cifrado AES-256)
Las variables de entorno sensibles nunca se guardan en texto plano. Se cifran en la base de datos y solo se inyectan en el contenedor en el momento exacto del arranque mediante la sintaxis `APP_KEY={{SECRET:NombreDelSecreto}}`.

---

## 📡 API y Control en Tiempo Real

La comunicación se segmenta en módulos de Express especializados:

| Endpoint | Descripción |
|---|---|
| `POST /api/containers` | Despliega un contenedor o stack completo. Aplica cuotas, crea la VPC del usuario, y conecta el LAN Proxy bajo demanda (_Lazy Attachment_). |
| `PUT /api/containers/:id/redeploy` | Lanzamiento Blue/Green sin corte de servicio. |
| `PUT /api/containers/:id/edit` | Modifica configuración en caliente (dominio, red, recursos). |
| `GET /api/admin/system-containers` | Vista exclusiva para admins de toda la infraestructura (Firewalls, Proxies, DB). |
| `GET /api/audit` | Registros auditables: quién borró qué, qué detuvo el Reaper, etc. |
| `/api/git` & `/api/webhooks` | Pipelines CI/CD. Escucha eventos `push` de GitHub/GitLab para redeploys automáticos. |
| `/api/secrets` | Gestión del Vault de credenciales cifradas. |
| `/api/networks` | Crea VLANs privadas prefijadas por usuario (`${userId}_nombre`), siempre con `Internal: true`. |
| `/api/volumes` | Gestión de discos de persistencia. |
| `/api/snapshots` & `/api/buckets` | Backup de contenedores como archivos `.tar` exportados a MinIO/NAS. |
| `/api/ai` | Asistente IA local via Ollama. Los datos nunca salen del servidor. |

---

## 💻 La Terminal Interactiva (xterm.js)

El sistema ofrece una consola profesional que funciona mediante un flujo de **tres saltos seguros**:

```
[Navegador (React)] → [WebSocket] → [Backend] → [Socket-Proxy] → [stdin/stdout del contenedor]
```

1. El usuario escribe en la terminal del navegador.
2. Los datos viajan por WebSockets hasta el Backend.
3. El Backend los retransmite al Socket-Proxy, que los inyecta directamente en el proceso del contenedor.

> Esto permite administrar cualquier contenedor sin exponer puertos SSH o Telnet vulnerables al exterior.

---

## ✅ Garantías de Seguridad del Sistema

| Garantía | Descripción |
|---|---|
| **Aislamiento de Capa 2** | Ningún usuario puede ver el tráfico de otro. Docker actúa como un muro físico entre VPCs. |
| **Prevención de Escaneo** | El firewall Suricata bloquea intentos de descubrimiento de red interna (NMAP, etc.). |
| **Inmutabilidad de Red** | Las VPCs son `--internal` por defecto. El acceso a internet es un privilegio concedido y filtrado, no un derecho automático. |
| **Confinamiento del Daemon** | El Socket Proxy impide que el backend (o un contenedor comprometido) escale privilegios al host. |
| **Cifrado en Tránsito y Reposo** | Secretos cifrados con AES-256. Conexiones HTTPS gestionadas por Traefik + Let's Encrypt. |

### Sistema de "Redes Gemelas" — La Solución al Flag `Internal` Inmutable

Docker impone una restricción de diseño: el flag `Internal` de una red es **inmutable** una vez creada. No existe ninguna API para convertir una red cerrada en abierta o viceversa sin borrarla y recrearla (lo que rompería las conexiones activas de los contenedores).

El backend resuelve este problema con el **patrón de redes gemelas**: cada red privada tiene una _hermana_ abierta con el sufijo `_open` que se crea bajo demanda y se destruye cuando queda vacía.

**Flujo de decisión al desplegar un contenedor:**

```
¿El usuario activa "Internet"?
       │
      NO ──────────────────────────────────────────────────────────────────────
       │                                                                        │
       ▼                                                                        ▼
  networkMode = 'bridge'          networkMode = 'mi-red' (custom)
       │                                        │
       ▼                                        ▼
${userId}_default_vlan           ${userId}_mi-red
  Internal: true ✅                Internal: true ✅

      SÍ ──────────────────────────────────────────────────────────────────────
       │                                                                        │
       ▼                                                                        ▼
  networkMode = 'bridge'          networkMode = 'mi-red' (custom)
       │                                        │
       ▼                                        ▼
${userId}_default_vlan           ${userId}_mi-red_open
  Internal: false ⚠️               Internal: false ⚠️
  (se recrea si era interna)       (se auto-crea si no existe)
```

**¿Por qué `_open` y no modificar la red original?**
Modificar `Internal` requeriría:
1. Detener todos los contenedores de la red (downtime).
2. Borrar la red.
3. Recrearla con el nuevo flag.
4. Reconectar todos los contenedores.

Con el sistema gemelo, el contenedor **se conecta directamente a la red correcta desde el arranque**, sin afectar al resto de contenedores del usuario que puedan seguir en la red interna original.

**Ciclo de vida de las redes `_open`:**
- Se crean automáticamente al primer deploy con Internet activado.
- Son rastreadas con las labels `dockermanager.vpc=true` y `dockermanager.owner=${userId}`.
- El Reaper las borra en cuanto quedan sin contenedores de usuario (Fase 3).

| Situación | Red utilizada | Acceso a Internet |
|---|---|---|
| VPC por defecto, Internet **OFF** | `${userId}_default_vlan` | ❌ Bloqueado |
| VPC por defecto, Internet **ON** | `${userId}_default_vlan` recreada | ✅ Filtrado |
| Red custom, Internet **OFF** | `${userId}_mi-red` | ❌ Bloqueado |
| Red custom, Internet **ON** | `${userId}_mi-red_open` (auto-creada) | ✅ Filtrado |
| Sin red (`none`) | — | ❌ Completamente aislado |
| Stack multi-contenedor | `${userId}_stack_xxx_net` | ❌ Bloqueado (por diseño) |

---

## ⚖️ Modelo de Responsabilidad Compartida

DockerManager sigue el mismo modelo de responsabilidad que los grandes proveedores cloud (AWS, Azure, GCP): **la plataforma garantiza la seguridad _de_ la infraestructura; el usuario es responsable de la seguridad _dentro_ de sus aplicaciones.**

| Capa | Responsable | Ejemplos |
|---|---|---|
| **Red perimetral e IDS/IPS** | DockerManager ✅ | Firewall Suricata, bloqueo de escaneos, aislamiento VPC |
| **Aislamiento entre usuarios** | DockerManager ✅ | Redes `Internal`, prefijado de redes, Socket Proxy |
| **Actualizaciones del host** | DockerManager ✅ | Kernel, Docker Engine, Traefik, MongoDB |
| **Imagen del contenedor** | **Usuario** ⚠️ | Usar imágenes base actualizadas, evitar versiones con CVEs conocidos |
| **Seguridad de la aplicación** | **Usuario** ⚠️ | WordPress, plugins, contraseñas, autenticación de la app |
| **Datos dentro del contenedor** | **Usuario** ⚠️ | Backups, cifrado de datos en reposo dentro del volumen |
| **Acceso a Internet activado** | **Usuario** ⚠️ | El usuario acepta la responsabilidad del tráfico saliente al habilitarlo |

> [!NOTE]
> DockerManager protege el **perímetro y la infraestructura**. La seguridad de lo que se ejecuta dentro de cada contenedor — versiones de software, configuraciones, contraseñas de aplicación — es responsabilidad exclusiva del usuario que lo despliega, tal y como ocurre en servicios como Heroku, Render o Railway.