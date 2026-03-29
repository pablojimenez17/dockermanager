# 🐳 DockerManager: Plataforma CaaS/PaaS con Aislamiento VPC

DockerManager es una solución integral de "Contenedores como Servicio" (CaaS) diseñada para entornos multi-tenant. Permite a usuarios y organizaciones aprovisionar, gestionar y exponer aplicaciones Docker de forma segura, bajo un modelo de **Defensa en Profundidad** que combina aislamiento de red de Capa 2, inspección de tráfico perimetral y políticas comerciales automatizadas.

---

## 🔧 Entornos: `docker-compose.yml` vs `docker-compose.override.yml`

El proyecto usa **dos ficheros Compose** que Docker fusiona automáticamente al ejecutar `docker compose up`:

```
docker-compose.yml          ← Definición base (producción)
docker-compose.override.yml ← Sobreescritura local (desarrollo)
```

### ¿Cómo funciona el override?

Docker Compose tiene un comportamiento incorporado: si existe un fichero llamado exactamente `docker-compose.override.yml` en el mismo directorio, **lo carga y fusiona automáticamente** con el fichero base sin que tengas que especificarlo. Es el equivalente a hacer:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up
```

Las reglas de fusión son:
- Las claves que existen en el override **sobreescriben** las del base.
- Las que no existen en el override **se heredan** del base sin cambios.
- Las listas como `ports` o `volumes` se **concatenan** (se añaden, no se reemplazan).

### ¿Por qué separar los dos ficheros?

| | `docker-compose.yml` (Base) | `docker-compose.override.yml` (Dev) |
|---|---|---|
| **Propósito** | Producción / CI | Desarrollo local |
| **Backend** | Imagen compilada, sin hot-reload | `npm run dev` + hot-reload |
| **Frontend** | Nginx sirviendo el build | Vite dev server con HMR |
| **MinIO** | Sin puertos expuestos al host | Puerto `9001` expuesto (consola web) |
| **Volúmenes** | Solo los de datos | + bind mounts del código fuente |

### Flujo de trabajo

```bash
# Desarrollo (carga base + override automáticamente)
docker compose up -d

# Producción (solo el fichero base, ignora el override)
docker compose -f docker-compose.yml up -d

# Ver la configuración fusionada final que se aplicará
docker compose config
```

> [!NOTE]
> El fichero `docker-compose.override.yml` **nunca debe subirse a producción**. En un pipeline CI/CD, especifica explícitamente `-f docker-compose.yml` para ignorarlo.

> [!TIP]
> Puedes crear ficheros adicionales para otros entornos: `docker-compose.staging.yml`, `docker-compose.test.yml`, etc., y cargarlos manualmente con `-f`.

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

### 🧩 Referencia de Contenedores de Infraestructura

El sistema se compone de **9 contenedores** fijos definidos en `docker-compose.yml`. Cada uno tiene un rol único e irremplazable:

---

#### 1. `dockermanager-edge-fw` — Firewall Perimetral (Suricata IDS/IPS)
| | |
|---|---|
| **Imagen** | `jasonish/suricata:latest` |
| **Redes** | `public_net` → `transit_proxy_inverso` → `transit_proxy_forward` |
| **Puertos expuestos** | `80`, `443` (punto de entrada único al sistema) |

Actúa como el primer y único punto de contacto con Internet. Realiza **Inspección Profunda de Paquetes (DPI)** usando firmas Suricata para detectar y bloquear ataques (SQLi, XSS, escaneos de red, exploits conocidos) antes de que lleguen a ningún servicio interno. Redirige el tráfico limpio a los proxies mediante reglas `iptables` (DNAT/MASQUERADE) inyectadas por `edge-fw.sh`.

---

#### 2. `dockermanager-proxy` — Proxy Inverso DMZ (Traefik Admin)
| | |
|---|---|
| **Imagen** | `traefik:v2.10` |
| **Redes** | `transit_proxy_inverso` + `dmz_net` |
| **Constraint label** | `traefik.constraint-label=dmz-proxy` |

Gestiona exclusivamente el acceso a los servicios de administración: la API del Backend (`/api`) y el Frontend. **Ignora completamente** los contenedores de los usuarios. Lee la configuración de Docker vía el Socket Proxy (nunca directamente del socket).

---

#### 3. `dockermanager-lan-proxy` — Proxy de Usuario (Traefik LAN)
| | |
|---|---|
| **Imagen** | `traefik:v2.10` |
| **Redes** | `transit_proxy_forward` + `lan_net` + VPCs de usuarios (dinámico) |
| **Constraint label** | `traefik.constraint-label=lan-proxy` |

Proxy dedicado para el tráfico de los contenedores de clientes. Se conecta **dinámicamente** a la red VPC de un usuario solo cuando éste expone un dominio personalizado. Es el **único puente de entrada** permitido a las VPCs privadas — ningún tráfico externo puede llegar a un contenedor de usuario sin pasar por aquí.

---

#### 4. `dockermanager-socket-proxy` — Escudo del Daemon Docker
| | |
|---|---|
| **Imagen** | `tecnativa/docker-socket-proxy` |
| **Redes** | `dmz_net` |
| **Socket** | `/var/run/docker.sock` (solo lectura) |

El Backend **nunca** accede al socket de Docker directamente. Este proxy actúa como intermediario TCP que permite solo las operaciones explícitamente autorizadas (`CONTAINERS`, `IMAGES`, `NETWORKS`, `VOLUMES`, `EXEC`). Impide que un posible compromiso del backend escale privilegios al host.

---

#### 5. `dockermanager-backend` — API y Cerebro del Sistema (Node.js)
| | |
|---|---|
| **Imagen** | `dockermanager/backend:local` |
| **Redes** | `dmz_net` + `storage_transit_net` |
| **Puerto interno** | `5000` |

El núcleo de la plataforma. Gestiona autenticación, cuotas, despliegues, VPCs de usuario, y todos los servicios internos. Arranca tres servicios en segundo plano al iniciarse: el Reaper Service, el Backup Scheduler y el servicio de IA Ollama.

---

#### 6. `dockermanager-frontend` — Interfaz Web (React + Vite)
| | |
|---|---|
| **Imagen** | `dockermanager/frontend:local` |
| **Redes** | `dmz_net` |
| **Puerto interno** | `80` |

SPA construida en React. Se sirve desde Nginx dentro del contenedor. El proxy de admin la expone bajo la ruta `/`. Toda la comunicación con el backend se hace a través de la API en `/api`.

---

#### 7. `dockermanager-mongo` — Base de Datos Principal (MongoDB)
| | |
|---|---|
| **Imagen** | `mongo:latest` |
| **Redes** | `dmz_net` (inaccesible desde el exterior) |
| **Volumen** | `mongo-data:/data/db` |

Almacena todos los datos de la plataforma: usuarios, contenedores registrados, secretos cifrados, redes, audit logs, etc. Solo es accesible desde el backend dentro de la DMZ. Sus datos persisten en el volumen `mongo-data` y se respaldan automáticamente a MinIO cada 24h a través del Storage Firewall.

---

#### 8. `dockermanager-storage-fw` — Firewall de Almacenamiento (HAProxy)
| | |
|---|---|
| **Imagen** | `haproxy:alpine` |
| **Redes** | `storage_transit_net` + `storage_net` |
| **Config** | `./config/haproxy.cfg` |

Puente de Capa 4 que separa físicamente el Backend del almacenamiento. El backend envía peticiones a `storage-fw:9000` (MinIO API), y este proxy las cruza hacia la red `storage_net` verificando que el origen sea legítimo. MinIO es **completamente invisible** desde la DMZ sin pasar por este firewall.

---

#### 9. `dockermanager-minio` — Almacenamiento Unificado (MinIO S3)
| | |
|---|---|
| **Imagen** | `minio/minio:latest` |
| **Redes** | `storage_net` (aislada) |
| **Volumen** | `minio-data:/data` |
| **Consola** | Puerto `9001` (solo accesible internamente) |

Sistema de almacenamiento centralizado. Usado para guardar snapshots de contenedores, exportaciones de volúmenes y **backups automáticos de MongoDB**. El backend interactúa con él a través del `storage-fw` usando el protocolo S3, garantizando un aislamiento total de los datos persistentes.

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
| `POST /api/admin/backup/run` | **[Admin]** Dispara un backup manual inmediato de MongoDB → NAS. |
| `GET /api/admin/backup/list` | **[Admin]** Lista todos los archivos de backup disponibles en el NAS con fecha y tamaño. |

| `/api/snapshots` & `/api/buckets` | Backup de contenedores como archivos `.tar` exportados a MinIO/NAS. |
| `/api/ai` | Asistente IA local via Ollama. Los datos nunca salen del servidor. |

---

### Arquitectura del Backup (Zero-Trust S3)

A diferencia de los sistemas tradicionales, DockerManager no utiliza volúmenes compartidos entre el Backend y el Almacenamiento. Todo el tráfico de persistencia es inspeccionado por el firewall.

```
[Red DMZ]                    [Red Storage Transit]          [Red Storage Internal]
────────────────────────     ──────────────────────────     ───────────────────────
[dockermanager-mongo]
        │
        │ 1. Docker Exec API
        ▼
[dockermanager-backend] ───► [dockermanager-storage-fw] ───► [dockermanager-minio]
 (Servicio de Backup)        (Firewall HAProxy:9000)         (S3 API:9000)
                                                                    │
                                                                    │ 2. Persistencia
                                                                    ▼
                                                            [Volumen: minio-data]
                                                              (Aislado de la DMZ)
```

**Flujo de Datos:** El backup utiliza el protocolo S3. El chorro de datos viaja desde la base de datos hasta un bucket de MinIO a través del firewall, sin tocar nunca el disco local del Backend.

### Funcionamiento Paso a Paso

1. **Extracción:** El `backupService.js` ejecuta `mongodump` dentro del contenedor de MongoDB y captura el flujo de salida.
2. **Tránsito:** Envía el chorro de datos mediante el SDK de MinIO (S3) al punto de entrada `storage-fw:9000`, pasando por el **Storage Firewall**.
3. **Validación:** El Firewall redirige el tráfico S3 al contenedor interno de MinIO.
4. **Persistencia:** MinIO guarda el archivo en el bucket `backups-mongodb`.
5. **Rotación:** El Backend utiliza el listado de objetos de MinIO para borrar archivos antiguos según la política de retención (`BACKUP_RETENTION`).

### Convención de Nombres

```
mongo-backup-2026-03-29T10-00-00-000Z.archive.gz
```

Formato: `mongo-backup-{ISO8601}.archive.gz` — ordenables cronológicamente por nombre.

### Configuración (Variables de Entorno)

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `MINIO_ENDPOINT` | `storage-fw` | Punto de entrada S3 (a través del firewall) |
| `MINIO_PORT` | `9000` | Puerto del API S3 |
| `NAS_USERNAME` | `admin` | Access Key de MinIO |
| `NAS_PASSWORD` | `password123` | Secret Key de MinIO |
| `BACKUP_INTERVAL_MS` | `86400000` (24h) | Intervalo entre backups automáticos |
| `BACKUP_RETENTION` | `7` | Número de copias a conservar |

### Cómo Restaurar un Backup

La restauración se realiza descargando el archivo desde la consola de MinIO (puerto 9001) e inyectándolo:

```bash
# 1. El administrador descarga el archivo desde el bucket 'backups-mongodb'
# 2. Restaurar usando mongorestore desde el host:
cat mongo-backup-XXX.archive.gz | docker exec -i dockermanager-mongo mongorestore --archive --gzip --drop
```

> [!IMPORTANT]
> El aislamiento de red garantiza que, incluso si el Backend es comprometido, el atacante no tiene acceso físico a los volúmenes de almacenamiento, solo a un endpoint S3 filtrado por el Firewall.

### Endpoints de Administración

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/admin/backup/run` | `POST` | Fuerza un backup inmediato (útil antes de actualizaciones) |
| `/api/admin/backup/list` | `GET` | Lista todos los backups disponibles con tamaño y fecha |

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