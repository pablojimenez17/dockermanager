# 🐳 OrbitCloud: Plataforma CaaS/PaaS con Aislamiento VPC

OrbitCloud es una solución integral de "Contenedores como Servicio" (CaaS) diseñada para entornos multi-tenant. Permite a usuarios y organizaciones aprovisionar, gestionar y exponer aplicaciones Docker de forma segura, estructurada bajo un modelo de **Defensa en Profundidad** que combina aislamiento de red VPC (Capa 2), inspección de tráfico perimetral activo (Suricata IPS) y políticas de retención automatizadas.

---

## 🌟 1. Introducción y Acceso a Producción

La infraestructura de OrbitCloud ejecuta en producción integrando de forma continua código mediante acciones de CI/CD para garantizar que el despliegue de las actualizaciones carezca de interrupciones (*zero-downtime*).

| Servicio                                  | Enlace                         | Notas de Acceso |
|-------------------------------------------|--------------------------------|-----------------|
| **Plataforma Web (Frontend)**             | https://orbitcloud.app         | Registro abierto público |
| **Monitorización (Grafana + Loki)**       | https://grafana.orbitcloud.app | Requiere credenciales Admin generadas en `.env` |
| **Bóveda de Backups (MinIO)**             | *Sin acceso público*           | Solo accesible vía SSH Tunnel al puerto 9001 del VPS |

> [!TIP]
> Para acceder a la consola de MinIO en producción sin exponerla públicamente: `ssh -L 9001:orbitcloud-minio:9001 root@167.99.252.155`

---

## 🚀 2. Guía de Despliegue y CI/CD

El proyecto rige un ecosistema dual para dividir de forma inquebrantable el desarrollo local de la ejecución real en el Cloud:

### `docker-compose.yml` vs `docker-compose.dev.yml`
- **Producción (`docker-compose.yml`)**: Diseñado para Linux/VPS. El Firewall acapara los puestos 80/443 íntegros e intercepta **todo el tráfico**. `docker compose up` debe usar **solo** este archivo en el servidor (sin override automático) para no sustituir el frontend por Vite por error.
- **Local (`docker-compose.dev.yml`)**: Desarrollo con hot-reload. Ejemplo: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`. Expone MinIO en el host y usa Vite/Nodemon donde aplica.

### 🤖 CI/CD (Despliegue Continuo)
Se sitúa en un entorno autogestionado `.github/workflows/deploy.yml`. Cada `git push` a `main`:
1. Se conecta mediante SSH en secreto (Secrets de Github) al VPS en DigitalOcean.
2. Descarga el código actualizado (`git pull`).
3. Ejecuta de un modo ininterrumpido `docker compose -f docker-compose.yml up -d --build`, destruyendo, compilando y recreando sólo aquello reconstruido y manteniendo intactos y seguros los volúmenes de usuarios.

---

## 🏗️ 3. Arquitectura de Red (El Modelo de Defensa en Profundidad)

La infraestructura de OrbitCloud no es un simple alojamiento donde los contenedores conviven desordenadamente. Emplea un modelo estricto de **Defensa en Profundidad (Defense in Depth)**, estructurado en **5 capas herméticas** que garantizan el aislamiento, la inspección de tráfico y la protección de los datos:

1. **Capa 1: Red Pública Perimetral (Firewall IDS/IPS):** Todo el tráfico real de Internet colisiona primero contra **Suricata**. Nada entra al servidor sin que este motor analice las firmas de los paquetes. Si detecta tráfico malicioso, lo bloquea. También inspecciona el tráfico de *salida* de los contenedores para evitar que participen en botnets o ciberataques.
2. **Capa 2: Tránsito Neutro (Enrutadores Proxy):** Una vez Suricata limpia el tráfico, este se bifurca a dos proxies Traefik independientes:
   - **Proxy DMZ Inverso:** Exclusivo para la plataforma administrativa y API.
   - **Proxy VPC LAN:** Exclusivo para enrutar tráfico a las aplicaciones de los clientes.
3. **Capa 3: VPCs Aisladas de Usuarios (Aislamiento L2):** Los contenedores de cada cliente residen en redes puente de Docker independientes. A nivel de kernel de Linux (iptables), redes distintas **no pueden comunicarse entre sí**. El contenedor del Usuario A jamás podrá ver al del Usuario B.
4. **Capa 4: Zona Desmilitarizada (DMZ):** Aquí habitan el Cerebro (Backend), Frontend Vite y MongoDB. Son **invisibles** tanto a Internet como a los propios usuarios. Además, el Backend no ejecuta comandos Docker como Root, sino a través de un **Socket Shield** que bloquea operaciones destructivas.
5. **Capa 5: Zero-Trust Storage (Bóveda MinIO):** Los backups del sistema NO residen en la DMZ, viven en su propia red (`storage_net`). Para que el Backend almacene datos, debe cruzar un **Firewall de Almacenamiento (HAProxy)** que actúa como un túnel unidireccional estricto. Si la DMZ sufriera un hackeo, sería imposible formatear o comprometer la bóveda de backups.

### Esquema del Flujo de Red

```mermaid
graph TD
    classDef firewall fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:white;
    classDef dmz fill:#f39c12,stroke:#d35400,stroke-width:2px,color:white;
    classDef proxy fill:#3498db,stroke:#2980b9,stroke-width:2px,color:white;
    classDef private fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:white;
    classDef storage fill:#9b59b6,stroke:#8e44ad,stroke-width:2px,color:white;
    classDef monitor fill:#16a085,stroke:#1abc9c,stroke-width:2px,color:white;

    1(((1. Internet))) --> 2[2. Edge Firewall IPS]:::firewall
    2 -->|Dominios| 3[3. Proxy VPC LAN]:::proxy
    2 -->|Plataforma| 4[4. Proxy DMZ Inverso]:::proxy
    
    3 --> 5[5. Apps de Usuarios]:::private
    5 -. Salida Vigilada .-> 2
    
    4 --> 6[6. Core DMZ]:::dmz
    4 --> 9[9. Stack Observabilidad]:::monitor
    
    6 --> 7[7. Storage Firewall]:::storage
    7 --> 8[(8. Bóveda Backups)]:::storage
```

### 📖 Leyenda del Esquema Completo
1. **Internet**: Origen y destino global del tráfico.
2. **Edge Firewall IPS** (`dockermanager-edge-fw`): Escudo perimetral físico (Suricata). Intercepta los puertos 80/443 reales e inspecciona tráfico malicioso.
3. **Proxy VPC LAN** (`dockermanager-lan-proxy`): Enrutador Traefik dedicado en exclusiva a redireccionar el tráfico web de los clientes a sus propios contenedores.
4. **Proxy DMZ Inverso** (`dockermanager-proxy`): Enrutador Traefik maestro para dar acceso a los servicios administrativos de la plataforma.
5. **Apps de Usuarios** (Contenedores Dinámicos, ej. `user-app-xyz`): Redes temporales y aisladas (VPCs L2) que contienen los servicios levantados por los clientes.
6. **Core DMZ** (El núcleo central invisible a Internet):
   - `dockermanager-backend`: Cerebro de la API en Node.js.
   - `dockermanager-frontend`: Panel web de clientes (Vite/React).
   - `dockermanager-mongo`: Base de datos de estado global.
   - `dockermanager-ollama`: Motor de Inteligencia Artificial local.
7. **Storage Firewall** (`dockermanager-storage-fw`): Cortafuegos interno HAProxy que ejerce como peaje de un solo sentido (TCP 9000).
8. **Bóveda Backups** (`dockermanager-minio`): Zero-Trust Storage. Caja fuerte S3 desconectada del resto de la plataforma.
9. **Stack Observabilidad** (Telemetría y Monitorización):
   - `dockermanager-grafana`: Panel de visualización de datos.
   - `dockermanager-prometheus`: Motor de extracción de métricas.
   - `dockermanager-loki`: Base de datos transaccional de Logs.
   - `dockermanager-promtail`: Recolector de logs de ataques del firewall.
   - `dockermanager-cadvisor`: Monitorización de CPU/RAM de contenedores.
   - `dockermanager-node-exporter`: Monitorización del hardware del VPS.

### 🔐 Conceptos Clave de Seguridad en el Esquema
*   **La "Salida Vigilada" (Egress Filtering)**: Cuando los contenedores de los clientes intentan conectarse a Internet por su cuenta (por ejemplo, para descargar un virus, hacer peticiones externas o lanzar un ataque DDoS), este tráfico está forzado a salir a través de la red física del anfitrión. El contenedor `dockermanager-edge-fw` intercepta silenciosamente este tráfico saliente usando `NFQUEUE`, inspeccionando los paquetes y cortando de raíz cualquier intento de conexión hacia servidores maliciosos o botnets.
*   **El "Socket Shield" (`dockermanager-socket-proxy`)**: En sistemas normales, el backend de Node.js tiene control absoluto sobre el motor de Docker (acceso *root* al host). Si un hacker encontrara una vulnerabilidad en tu backend, podría destruir todo el servidor físico. Para impedirlo, el backend está obligado a hablar con Docker a través de este proxy intermedio. El `socket-proxy` intercepta las órdenes y solo deja pasar comandos inofensivos (como arrancar o parar los contenedores de los clientes), bloqueando permanentemente comandos letales (como borrar redes maestras, acceder al sistema de archivos del host o escalar privilegios).
*   **La Consola Segura (Terminal Web)**: Es importante entender que el enrutador `Proxy VPC LAN` sirve **únicamente** para que los visitantes externos vean la web que un cliente ha alojado (ej. `app.usuario.com`). Cuando el dueño de la app quiere abrir la terminal de comandos desde el panel de OrbitCloud, el flujo es completamente distinto: la conexión WebSocket viaja por la ruta de la plataforma (`Proxy DMZ Inverso`) hacia el `Backend`. Es el Backend quien, a través del `Socket Shield`, inyecta la sesión de terminal (`docker exec`) de forma 100% segura. **Nunca** se abren puertos SSH físicos al exterior ni se conectan directamente los usuarios a sus contenedores.

### 👯‍♂️ Redes VPC y Acceso a Internet — Cómo Funciona

Docker tiene una limitación crítica de diseño: **no permite cambiar la bandera `Internal` de una red existente**. Esto significa que no es posible activar o desactivar el acceso a internet de una red sobre la marcha. OrbitCloud resuelve esto mediante el patrón de **redes sibling** (gemelas permanentes):

#### Las dos redes permanentes por usuario

Cada usuario tiene **dos redes Docker dedicadas** que se crean automáticamente en el primer despliegue:

| Red | Nombre Docker | `Internal` | Acceso a Internet |
|-----|--------------|-----------|-------------------|
| VPC Privada | `{userId}_default_vlan` | `true` | ❌ Sin acceso (aislada) |
| VPC Abierta | `{userId}_default_vlan_open` | `false` | ✅ Con acceso (salida vigilada por IPS) |

#### Lógica de selección de red al crear un contenedor

El backend de OrbitCloud selecciona la red correcta según la configuración del usuario en el panel:

```
networkMode = 'none'          → Red = none (air-gapped, sin stack de red)
networkMode = custom (tuya)
  + Internet activado         → Usa/crea '{tuRed}_open' sibling con Internal:false
  + Internet desactivado      → Usa '{tuRed}' tal cual (Internal:true)
networkMode = bridge / VPC
  + Internet activado         → Usa '{userId}_default_vlan_open' (Internal:false)
  + Internet desactivado      → Usa '{userId}_default_vlan' (Internal:true)
```

#### ¿Por qué este patrón?

> [!IMPORTANT]
> Docker **no permite modificar** la bandera `Internal` de una red existente. Si un usuario crea primero un contenedor sin internet (lo que genera `_default_vlan` con `Internal:true`) y luego intenta crear otro con internet activado, si se reutilizara la misma red, el contenedor **no tendría internet aunque el toggle estuviera activo**. El patrón de redes sibling evita este bug estructural usando siempre redes con el flag correcto desde su creación.

#### Redes personalizadas del usuario

Cuando el usuario crea sus propias redes desde la sección **Docker Networks**, estas se crean por defecto con `Internal:true` (sin internet). Si luego despliega un contenedor en esa red con "Internet activado", el backend crea automáticamente una red gemela `{nombreRed}_open` con `Internal:false` y usa esa en su lugar, preservando la red original intacta para otros contenedores.

#### Egress (tráfico de salida)

Incluso los contenedores en redes `_open` **no tienen acceso directo a internet**. Su tráfico de salida pasa obligatoriamente por el **Edge Firewall IPS (Suricata)** que inspecciona cada paquete saliente, bloqueando comunicaciones con servidores de C&C (Command & Control), botnets o IPs maliciosas.

---

### 🔗 Redes Múltiples Simultáneas — Multi-Network

Un contenedor puede pertenecer a **más de una red Docker a la vez**, de forma equivalente a como lo hacen Docker Compose y Kubernetes. Esto es útil cuando necesitas que un contenedor tenga aislamiento diferente en cada interfaz. Por ejemplo:

```
Máquina A (sin internet):
  → Red primaria: {userId}_default_vlan   (Internal: true, aislada)
  → Red extra:    mi-red-compartida       (puente con Máquina B)

Máquina B (con internet):
  → Red primaria: {userId}_default_vlan_open  (Internal: false, con salida)
  → Red extra:    mi-red-compartida           (puente con Máquina A)

Resultado:
  ✅ A y B se comunican entre sí por "mi-red-compartida"
  ❌ A no tiene salida directa a internet
  ✅ B sí tiene salida a internet (vigilada por Suricata)
```

#### Cómo funciona internamente

1. El usuario selecciona la **red primaria** en el panel (con/sin internet).
2. Opcionalmente, añade **redes adicionales** mediante chips en la misma sección de configuración.
3. El backend crea y arranca el contenedor en la red primaria.
4. **Post-arranque**, el backend ejecuta `docker network connect <extraRed> <containerId>` para cada red adicional.

> [!NOTE]
> La conexión a redes extra es **no bloqueante**: si una red no existe o falla la conexión, el backend loguea el error pero el contenedor sigue funcionando en su red primaria. Nunca se cancela un despliegue por un fallo en una red secundaria.

#### Dónde configurarlo en el panel

- **Create Container**: en la sección *Advanced Configuration → Network Mode*, debajo del selector principal de red aparece una sección "Additional networks" con chips removibles y un selector desplegable.
- **Marketplace (Templates)**: en la sección *3. Resources & Network*, misma UI.

> [!TIP]
> Si quieres que dos contenedores se vean entre sí pero con distintas políticas de internet, crea primero una red personalizada en **Docker Networks**, y luego añádela como red extra en ambos contenedores al crearlos.

---

### 🛡️ Auto-Subnet — Prevención de Colisiones entre Tenants

#### El problema

Cuando dos usuarios distintos crean una red personalizada dejando el campo **Subnet** vacío, Docker asigna IPs desde el mismo pool por defecto (`172.17.x.x`, `10.0.x.x`). Esto causa que las redes **colisionen silenciosamente**, impidiendo el enrutamiento correcto entre contenedores de diferentes usuarios.

#### La solución: hash determinista de subnet

Si el usuario **no especifica** una subnet manualmente, el backend genera una automáticamente usando un hash de `userId + nombreRed`:

```
hash(userId + prefixedName) → rango 10.128.0.0 – 10.254.255.0/24
```

El rango `10.128.x.x` – `10.254.x.x` está fuera de los rangos por defecto de Docker (`172.17-31.x` y `10.0-127.x`), minimizando colisiones accidentales.

**Flujo de resolución:**
1. Se calcula un bloque `/24` determinista a partir del hash
2. Se comprueba contra todos los subnets existentes en Docker (`docker.listNetworks()`)
3. Si ya está ocupado → se prueba el siguiente `/24` (third octet + 1)
4. Si sigue colisionando → se deja que Docker asigne automáticamente y se loguea un warning
5. Si el usuario **sí especificó** subnet → se respeta exactamente lo que puso

> [!NOTE]
> Si dos usuarios generan el mismo hash (colisión matemática), el sistema reintenta con un octeto desplazado antes de rendirse. En la práctica, el espacio `10.128-254.x.x` ofrece ~32.000 bloques `/24` distintos, suficiente para miles de redes concurrentes.

---

### ⚡ Volumes — Cache de `docker system df`

#### El problema

`docker.df()` (equivalente a `docker system df`) **inspecciona todos los recursos del sistema** — imágenes, contenedores, volúmenes — y puede tardar entre 3 y 10 segundos dependiendo de cuántos recursos haya en el host. El código anterior lo ejecutaba en **cada listado de volúmenes y en cada creación**, bloqueando la respuesta.

#### La solución: cache en memoria de 30 segundos

```
Primera petición  → ejecuta docker.df() (lento), guarda resultado en caché
Siguientes 30s    → devuelve el caché instantáneamente sin tocar Docker
Tras 30s          → refresca el caché en la próxima petición
```

Adicionalmente, en la creación de un volumen nuevo:
- El check de **cuota por número** (`maxVolumes`) se hace directamente contra la BD — sin llamar a Docker
- El check de **cuota por tamaño** solo se ejecuta si el plan tiene un límite finito (no para planes Enterprise/Agency con cuota alta)

> [!IMPORTANT]
> El tamaño mostrado en el panel puede tener hasta **30 segundos de retraso** respecto al tamaño real en disco. Esto es un trade-off deliberado: se prefiere rapidez de carga sobre precisión de tamaño en tiempo real, ya que los volúmenes no cambian de tamaño drásticamente en esa ventana de tiempo.

---

## 🛡️ 4. Seguridad Profunda e IDS/IPS Suricata

### 🚫 De Detector (IDS) a Bloqueador Nítido (IPS)
Antiguamente los firewalls tradicionales se regían simplemente por escuchar pasivamente el tráfico con interfaces clonadas (`af-packet / PCAP`) alertando sobre intrusiones sin intervenir.
OrbitCloud ahora blinda en Capa 4 a través de Netfilter Queue (NFQUEUE):

1. **La Front-Door:** El Firewall (`edge-fw`) secuestra por completo los puertos del Host (80/443). Ni siquiera el proxy tiene control sobre la placa de red directamente.
2. **Enrutamiento y Reglas IPTables:** Todo se gestiona mediante reglas estrictas de iptables que aseguran que ningún tráfico escape la verificación.
   - **DNAT y MASQUERADE:** Todo el tráfico entrante a los puertos web (80/443) es capturado y redireccionado forzosamente (`PREROUTING -j DNAT`) hacia el Proxy Interno (Traefik). Se aplica `MASQUERADE` al retornar a fin de garantizar el flujo bidireccional correcto.
   - **Cola de Prevención IPS:** En vez de que las reglas de reenvío pasen a ciegas, se aplica un embudo maestro a través de las reglas:
     `iptables -I FORWARD -p tcp --dport 80 -j NFQUEUE --queue-num 0 --queue-bypass` (y análogas para el puerto 443).
     Esto evita romper conexiones internas (como los WebSockets locales de Docker o puertos de administración internos), auditando **únicamente** la navegación web expuesta.
3. **Decisión por Lotes (Veredictos):** Suricata levanta el motor de prevención IPS (`-q 0`) interceptando el canal del NFQUEUE. Aquí, en lugar de realizar cálculos de Checksum (`checksum-validation: no` desactivado para evitar choques con el offloading de las redes virtuales inter-Docker), el motor cruza los paquetes TCP contra las Firmas Malignas. Si se detecta un intruso con firma `DROP`, Suricata envía la orden de abortar la conexión; en caso contrario, devuelve `ACCEPT` e iptables continúa la ruta habitual hasta el VPC.

### 🛡️ Escudo Daemon (Socket-Proxy)
En sistemas convencionales el API del Orquestador suele montar y acceder libremente a `/var/run/docker.sock` poseyendo permisos infinitos como *Root*. Aquí un contenedor proxy en medio restringe todas las directrices, y si el código madre es vulnerado por un usuario mediante comandos mal intencionados en Node, el `Socket Proxy` rechazará peticiones de "Borrado Masivo", "Escalada de Permisos" y "Privilegios" en `/run/docker.sock`.

*Actualización de permisos (Storage)*: Para calcular con precisión las cuotas de disco consumido (`docker system df`), el Socket Proxy tiene habilitado específicamente el comando de consulta de disco (`SYSTEM=1`), pero preserva bloqueados los accesos inseguros de control maestro.

---

## ⚙️ 5. Inteligencia del Backend "El Cerebro"

### El Segador (Reaper Service)
Para garantizar la economía del PaaS y controlar el abuso informático existe un Robot perenne operando sin pausas en background en Node.js, cubriendo 3 etapas cada 5 minutos:
1. **Límite Heroku:** Contenedores de planes gratuitos no pueden ejecutarse por 24h seguidas. Pasados 1440 minutos en el _Docker State_, les inyecta señal SIGTERM para forzar ahorro e hibernación.
2. **Destornillador de VPCs:** Las "Habitaciones Gemelas" (_VPC_Open_) que resultan vacías de recursos al deshabilitarse la exposición de Dominios en el panel de UI, quedan estancadas temporalmente. El recolector de basuras limpia agresivamente todas las redes residuales sin servicios levantados.
3. **Rotación Autosuficiente:** Evalúa tarjetas de suscripciones Premium para bajarlos ordenadamente a _Freemium_ de manera natural antes que derribar su ecosistema abruptamente, restringiéndoles paulatinamente RAM según su cambio.

### Terminal Interactiva Segura (xterm.js)
No se abren puertos SSH por cliente ni se abren puertos remotos. Las sesiones de consolas interactúan con XTERM generando una comunicación con WebSocket puenteada a través de Backend hacia el Socket Proxy. El usuario final dispone de un shell encapsulado e irreversible sobre su propio contenedor mediante una ventana renderizada en formato cine sin tocar comandos inseguros hacia afuera.

*Resolución de Rutas y Websockets (Traefik)*: El tráfico para la consola terminal viaja por la ruta paralela `/socket.io/` gestionada íntegramente por Traefik, que evalúa explícitamente tanto el tráfico del API como el de los WebSockets (`PathPrefix('/api') || PathPrefix('/socket.io')`). Además, para evitar colisiones y timeouts (Error 504) causados por la pertenencia del Backend a múltiples redes simultáneas, se ha implementado la asignación estricta de red en Traefik (`traefik.docker.network=dmz_net`), garantizando el enrutamiento directo y exclusivo por la DMZ.

---

## 🔄 6. Alta Disponibilidad y Recuperación Automática

### El Problema Original

El backend de OrbitCloud podía quedarse **colgado** tras ciertos reinicios o errores internos (por ejemplo, pérdida de conexión con MongoDB, o un reinicio del VPS). Cuando esto ocurría:
- Los usuarios no podían crear ni listar contenedores.
- Los sockets se desconectaban permanentemente.
- El único remedio era **cerrar sesión y volver a entrar**, o en los peores casos, hacer SSH al VPS para reiniciar manualmente los contenedores.

### La Solución: Tres Capas de Resiliencia

#### 1️⃣ Docker `restart: always` + Healthchecks

Los servicios críticos de la plataforma tienen ahora política de reinicio automático:

```yaml
# docker-compose.yml
backend:
  restart: always
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:5000/api/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s

frontend:
  restart: always
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:80"]
    interval: 30s
    timeout: 10s
    retries: 3

mongodb:
  restart: always
```

- **`restart: always`**: Docker Engine reinicia el contenedor automáticamente tras cualquier crash o reinicio del VPS, sin intervención humana.
- **`healthcheck`**: Si el endpoint `/api/health` falla 3 veces seguidas (90 segundos), Docker marca el contenedor como `unhealthy` y lo reinicia forzosamente.
- **`GET /api/health`**: Endpoint sin autenticación que devuelve `{ status: "ok", ts: <timestamp> }`. Usado también por Traefik y balanceadores externos.

> [!TIP]
> Para consultar el estado de salud de un contenedor: `docker inspect --format='{{.State.Health.Status}}' dockermanager-backend`

#### 2️⃣ Socket.IO — Reconexión Automática sin Cerrar Sesión

Anteriormente, si el backend reiniciaba, el socket del navegador se desconectaba permanentemente y el usuario tenía que cerrar sesión para recuperar la funcionalidad en tiempo real.

Ahora, todos los puntos de conexión socket del frontend (`Dashboard`, `ViewContainers`, `AdminDashboard`) usan reconexión exponencial automática:

```js
const socket = io('', {
  reconnection: true,
  reconnectionAttempts: Infinity,  // reintenta indefinidamente
  reconnectionDelay: 1500,         // 1.5s entre primer y segundo intento
  reconnectionDelayMax: 15000,     // máximo 15s entre intentos
});
socket.on('connect', () => fetchData()); // refresca datos al reconectar
```

**Comportamiento resultante:**
- El backend reinicia → el socket del navegador detecta la desconexión y empieza a reintentar.
- Cuando el backend vuelve (típicamente en 5-30s con `restart: always`), el socket reconecta automáticamente.
- El callback `on('connect')` lanza un refresco de datos para que la UI muestre el estado actualizado.
- **El usuario nunca tiene que cerrar sesión.**

---

## 💾 7. Almacenamiento Zero-Trust y Backups S3

La persistencia de copias de seguridad de configuración global rige mediante una zona muerta Zero-Trust. El sistema de DB y Archivos jamás está directamente unido al disco o volumen de acceso compartido.
El nodo `backend` empaqueta con `tar/mongodump` 3 elementos críticos: MongoDB, Web-Panel y el Server System. Los inyecta vía protocolo AWS S3 apuntando a una muralla HAProxy en el puerto estricto interno 9000, quien cruza de a un solo sentido el paquete para blindarlo en **MinIO**. Si alguien ataca o formatea la VPC/DMZ, la base interna MinIO carece de retorno salvaguardando las bases de la Plataforma inmutables.

### 🗂️ Sistema de Backups Granulares

El sistema de backups ha evolucionado de un modelo monolítico (todo o nada, cada 24h fijo en código) a un sistema **completamente configurable desde la interfaz web**.

#### Tipos de backup independientes

| Tipo | Contenido | Bucket MinIO |
|------|-----------|--------------|
| **Database** | `mongodump --archive --gzip` de la BD `dockermanager` | `backups-mongodb` |
| **Backend** | `docker export` del filesystem del contenedor `dockermanager-backend` | `backups-server` |
| **Frontend** | `docker export` del filesystem del contenedor `dockermanager-frontend` | `backups-web` |

#### Configuración persistente en MongoDB (`BackupConfig`)

```js
{
  db:     { enabled: true,  intervalMs: 86400000 }, // cada 24h
  server: { enabled: true,  intervalMs: 86400000 },
  web:    { enabled: true,  intervalMs: 86400000 },
  retention: 7  // copias a conservar por bucket
}
```

El documento es un **singleton**: si no existe, se crea con valores por defecto al arrancar el servidor.

#### Scheduler dinámico — Recarga en caliente

```
Antes: setInterval fijo en server.js con BACKUP_INTERVAL_MS (variable de entorno)
Ahora: 3 setIntervals independientes en backupService.js,
       leyendo la config de MongoDB.

Cuando el admin guarda cambios desde el panel → PUT /api/admin/backup/config
→ reloadScheduler() cancela los intervalos existentes y los recrea con la nueva config
→ NO es necesario reiniciar el servidor
```

#### Panel de Administración — 4 Botones + Configurador

Desde el **Panel de Control Admin → Sección Backups**:

1. **4 botones de ejecución manual inmediata:**
   - `Backup All` — lanza los 3 en paralelo
   - `Database` — solo `mongodump`
   - `Backend` — solo export del contenedor backend
   - `Frontend` — solo export del contenedor frontend

2. **Configurador del scheduler por tipo:**
   - Toggle on/off individual por tipo
   - Campo de intervalo en horas (mínimo 1h, máximo 720h)
   - Campo de copias a conservar (retention)
   - Botón "Guardar Configuración" → actualiza MongoDB + recarga scheduler en caliente

#### Rotación automática

Cada vez que se ejecuta un backup, `rotateBucket(bucket, retention)` lista los objetos del bucket, los ordena por fecha y elimina los más antiguos que sobrepasen el límite `retention`.

#### API Endpoints (solo admin)

```
POST /api/admin/backup/run         → backup completo (todos los tipos)
POST /api/admin/backup/run/db      → solo base de datos
POST /api/admin/backup/run/server  → solo backend
POST /api/admin/backup/run/web     → solo frontend
GET  /api/admin/backup/config      → configuración actual del scheduler
PUT  /api/admin/backup/config      → actualizar config + recargar scheduler
GET  /api/admin/backup/list        → listar todos los archivos de backup en MinIO
DELETE /api/admin/backup/:bucket/:filename → eliminar un backup específico
```

> [!NOTE]
> La configuración de backups depende de MongoDB. Si la BD no está disponible al arrancar el servidor, el scheduler hace un único reintento 30 segundos después. Si sigue sin estar disponible, no se iniciará ningún scheduler automático pero los endpoints manuales seguirán funcionando.

---

## 📊 8. Observabilidad Integral

Una Plataforma de este tamaño dispone de un panel propio paralelo unificado bajo una base monitorizada temporal de métricas para dominar la visión de todos los frentes posibles:

- **Eje de Redimiento Físico (Prometheus)**:
  - **Node Exporter**: Toma las constantes vitales del servidor VPS de producción (CPU en hardware, RAM en la placa total, Inodos/Disco al bare-metal).
  - **cAdvisor**: Corta y fracciona de manera autónoma las cuotas que gasta individualmente cada contenedor (`[+]` y `[-]`), graficalizando abusos.
- **Eje Ciberseguridad (Stack Loki)**:
  - Todas las tramas, detecciones SSL de firmas y cruces TLS inspeccionadas en el borde (`Suricata`) generan un stream json enorme. Un recolector `Promtail` aspira ese registro por volumen y lo entierra ultra-segmentado en el clúster transaccional temporal `Loki` permitiendo desde Grafana aplicar búsquedas `LogQL` completas con alarmísticas visuales de detecciones perimetrales.

---

## 📧 9. Servicio de Correo y Autenticación 2FA

OrbitCloud incorpora un robusto sistema de autenticación multifactor (2FA) y notificaciones transaccionales gestionadas a través del motor **SendGrid**. Esta capa adicional de seguridad protege el acceso al panel de control y a los entornos de los clientes.

- **Doble Factor de Autenticación (2FA):** Al registrarse o iniciar sesión, la plataforma no entrega acceso inmediatamente. En su lugar, el Backend genera un código temporal (OTP de 6 dígitos) con caducidad estricta (10 minutos) que se envía al correo del usuario. Solo tras introducir y verificar correctamente este pin se establece la sesión mediante una cookie segura e invisible (`httpOnly`).
- **Recuperación Segura de Credenciales:** Un flujo de *Forgot Password* protegido contra enumeración de correos. Genera pines efímeros transmitidos vía email que permiten validar la identidad y restablecer la contraseña en un entorno de cero confianza.
- **Emails Transaccionales:** Sistema asíncrono para enviar correos de bienvenida (Onboarding) y alertas transaccionales a los clientes sin bloquear la latencia principal de la API Node.js.

---

## ⚖️ 10. Modelo de Responsabilidad Compartida

| Resonsabilidad / Capa | ¿Quién se hace cargo? | Comportamiento en OrbitCloud |
|-----------------------|-------------------------|--------------------------------|
| **Bloqueo Network DOS/Escaneo** | OrbitCloud ✅ | Suricata IPS dropa tráfico hostil e infiltración masiva en red (NFQUEUE). |
| **Separación de Lógica (Capa 2)** | OrbitCloud ✅ | VPC prefijadas internas prohibidas al resto. Cifrado RSA/AES. |
| **Versión del OS Docker / Engine**| OrbitCloud ✅ | Mantenimiento a cargo de los administradores. CI/CD nativo Traefik/Mongo. |
| **Librerias Interiores/Base Apps**| Usuario ⚠️ | Elegir PHP 5 vulnerable en tu app privada recae en tu irresponsabilidad. |
| **Roles / Autenticación CMS App** | Usuario ⚠️ | Configurar un Wordpress propio `admin/1234` será bajo tus secuelas. |
| **Archivos en Volúmenes App**     | Usuario ⚠️ | Persistir en Minio (S3 Snapshot) requiere que se inicie bajo petición. |

---

## 💻 11. Stack Tecnológico y Estructura de Archivos

### 🎨 Frontend (Panel de Control y UI)
Tecnologías y librerías clave utilizadas en el desarrollo del cliente web:
- **Core:** React 19, Vite (Bundler hiper-rápido para un arranque y HMR instantáneo).
- **Enrutamiento:** React Router DOM v7 (Manejo de navegación estilo SPA, anidación de rutas protegidas).
- **Estilos y UI:** Tailwind CSS v3 (Framework de utilidades), Lucide React (Iconografía), Framer Motion (Animaciones fluidas y transiciones de estado de carga).
- **Gestión de Estado Global:** Patrón de Contexto (`AuthContext` para inyectar perfiles y cuotas, `ToastContext` para alertas, `ThemeContext` para dark/light mode).
- **Peticiones HTTP:** Axios (Configurado con interceptores para inyectar automáticamente el token JWT Bearer en cada llamada).
- **Comunicaciones Real-Time:** Socket.io-client (Conexiones bidireccionales multiplexadas. Escucha eventos `container:status_change` para actualizar el UI sin refrescar).
- **Internacionalización (i18n):** i18next y react-i18next (Traducción dinámica al vuelo).
- **Terminal Web:** Xterm.js y xterm-addon-fit (Renderizado de consola interactiva. Mapea la salida estándar del contenedor físico al div del navegador a través del socket).
- **Visualización de Datos:** Recharts (Gráficos SVG estadísticos para interpretar la CPU, RAM y E/S de Red).

#### Estructura de Directorios (`/frontend/src/`)
- `/components/`: Componentes atómicos (Ej. `Card`, `TerminalModal`, `DeployForm`).
- `/pages/`: Vistas de ruteo completas (`Dashboard.jsx`, `CreateContainer.jsx`, `AdminDashboard.jsx`, `Marketplace.jsx`).
- `/context/`: Estado de React puramente lógico sin representación visual.
- `/locales/`: Diccionarios JSON (`en.json`, `es.json`).
- `/utils/`: Helpers como formateadores de Bytes (`formatBytes`) o parseadores de fechas.
- `App.jsx`: Wrapper principal de Providers y enrutador.

### 🧠 Backend (API, Cerebro y Orquestador)
Tecnologías y herramientas que alimentan el servidor Node.js y controlan la infraestructura subyacente:
- **Core:** Node.js, Express (API REST rápida que gestiona middlewares de enrutamiento).
- **Base de Datos:** Mongoose (ODM con validadores de esquema pre/post guardado).
- **Autenticación y Seguridad:** JSON Web Tokens (Firmados con ECDSA o HMAC), Bcryptjs (Coste de Hash de nivel 10), Helmet (Inyección estricta de `Content-Security-Policy`), Express Rate Limit (Throttling contra fuerza bruta), XSS Clean (Filtro de etiquetas script maliciosas).
- **Orquestación de Contenedores:** Dockerode (Habla por socket UNIX con el motor Docker para hacer el trabajo sucio: `docker.createContainer()`, `docker.pull()`).
- **WebSockets:** Socket.io (Configurado con adaptadores CORS estrictos y middleware de autenticación por Token para impedir el secuestro de sesiones).
- **Backups (S3):** MinIO SDK (Abre flujos `Stream` directamente desde `tar-fs` hacia el almacén de objetos S3).
- **Mensajería:** Twilio (SMS OTP) y SendGrid Mail (Emails de verificación y reseteos usando templates HTML).
- **GitOps:** Simple-Git (Para despliegues continuos haciendo pulls en directorios clonados).

#### Estructura de Directorios (`/backend/`)
- `server.js`: Archivo bootstrap. Conecta Mongo, Traefik, levanta sockets y el puerto HTTP.
- `/models/`: Esquemas de Mongoose con índices y métodos de instancia (ej. `.comparePassword()`).
- `/routes/`: Controladores segregados (`containerRoutes.js`, `authRoutes.js`).
- `/middleware/`: Lógica de barrera (`authMiddleware.js`, `checkPlanLimits.js`, `checkRole.js`).
- `/services/`: Lógica pesada aislada (`backupService.js`, `dockerService.js`).

---

## 🗄️ 12. Arquitectura de la Base de Datos (MongoDB)

El sistema emplea un diseño documental. En lugar de utilizar bases de datos relacionales lentas en consultas multi-nodo, aprovecha referencias (`mongoose.Schema.Types.ObjectId`) y `.populate()` para vincular entidades, manteniendo la flexibilidad.

### Colecciones Principales y Campos Críticos
1. **Users (`User.js`):**
   - *Campos clave:* `email`, `password` (hashed), `role` (`user` o `admin`), `planType` (`free`, `pro`, `enterprise`), `limits` (Sub-documento de cuotas con campos como `maxContainers`, `maxVolumes`), `verificationCode`.
2. **Containers (`Container.js`):**
   - *Campos clave:* `dockerId` (El ID hexadecimal real de 64 caracteres de Docker), `image`, `status` (`created`, `running`, `stopped`), `userId` (Owner), `domain` (URL de Traefik vinculada), `deployedViaGit` (Booleano), `gitRepositoryUrl`.
3. **Organizations (`Organization.js`), Memberships (`Membership.js`) y Roles (`Role.js`):**
   - *Organizaciones:* `name`, `ownerId`.
   - *Membresías:* Unen `userId` con `organizationId` y `roleId`.
   - *Roles:* Objeto booleano inmenso de privilegios (`canCreateContainers: true`, `canManageBilling: false`).
4. **Networks (`Network.js`):**
   - *Campos clave:* `name` (Nombre lógico del panel), `dockerNetworkId`, `subnet` (El bloque determinista, ej. `10.128.5.0/24`), `isInternal` (Si carece de Egress a Internet).
5. **Volumes (`Volume.js`):**
   - *Campos clave:* `name`, `dockerVolumeName`, `sizeMb`, `attachedContainers` (Array de ObjectIds).
6. **Registries (`Registry.js`) y Secrets (`Secret.js`):**
   - *Campos clave:* `registryUrl`, `username`, `password` (Encriptados antes de guardar).
7. **AuditLogs (`AuditLog.js`):**
   - *Campos clave:* `userId`, `action` (`DELETE_CONTAINER`, `LOGIN_FAILED`), `resourceName`, `ipAddress`, `createdAt`.
8. **BackupConfig (`BackupConfig.js`):**
   - *Campos clave:* `db` (`{enabled, intervalMs}`), `retention` (Entero del máximo de archivos vivos por bucket).

---

## 🔌 13. Mapa de la API REST (Endpoints Detallados)

A excepción del login, todos los endpoints exigen el header `Authorization: Bearer <jwt>`.

### 👤 Autenticación y Perfil (`/api/auth`)
- `POST /register`: { `name`, `email`, `password` } -> Crea usuario y envía correo.
- `POST /login`: { `email`, `password` } -> Devuelve `{ token, user }`.
- `POST /verify`: { `email`, `code` } -> Activa la cuenta verificando el OTP.
- `GET /me`: Devuelve el `user` poblado y las métricas de consumo actuales para renderizar progresos de cuota.

### 📦 Contenedores y App Marketplace (`/api/containers`, `/api/templates`)
- `GET /`: Soporta query params `?orgId=<id>` para listar contenedores B2B o personales.
- `POST /`: Comando maestro. Recibe un JSON gordo: `{ image, name, networkMode, environment: { key: value }, volumes: [{ source, target }], ports: [{ host, container }] }`. Crea la imagen, inyecta subredes, genera volúmenes bajo demanda y levanta el Docker.
- `POST /template`: { `templateId`, `name`, `envVars` } -> Clona una app preconfigurada (ej. Ghost, Redis).
- `POST /:id/start` | `POST /:id/stop`: No requieren body. Impactan directamente al Socket Proxy.
- `PUT /:id/redeploy`: Forza `docker pull` de la última etiqueta `latest` y recrea el contenedor en frío.
- `DELETE /:id`: { `force: true/false` } -> Purgado total en host físico y BD.
- `POST /:id/snapshot`: { `snapshotName` } -> Hace un `docker commit` y lo expone como una imagen personalizada.

### 🌐 Infraestructura: Redes y Volúmenes (`/api/networks`, `/api/volumes`, `/api/buckets`)
- `POST /networks`: { `name`, `subnet` (opcional), `isInternal` (booleano) } -> Usa hashing determinista para la subred si viene vacía.
- `POST /volumes`: { `name`, `sizeMb` } -> Chequea la cuota del usuario (`maxVolumeSizeMb`) antes de crear.
- `DELETE /:id`: Si un volumen está vinculado a un array `attachedContainers`, lanza un HTTP 409 Conflict.

### 🏢 Plataforma Colaborativa B2B (`/api/org`)
- `POST /`: { `name` } -> Instancia la empresa y asigna al creador el Rol Maestro por defecto.
- `POST /:orgId/invites`: { `email`, `roleId` } -> Genera token criptográfico temporal y envía email.
- `POST /:orgId/roles`: { `name`, `permissions`: { `canManage...`: true } } -> Crea permisos RBAC customizados.
- `DELETE /:orgId/members/:membershipId`: Revoca privilegios de inmediato.

### ⚙️ Almacén de Secretos (`/api/secrets`, `/api/registries`)
- `POST /secrets`: { `key`, `value` } -> El backend intercepta el `value` y le aplica encriptación AES-256-CBC antes de tocar Mongo.
- `POST /registries`: { `url`, `username`, `password` } -> Inyecta la autenticación privada cuando se usa `docker pull` contra repositorios empresariales como AWS ECR.

### 🛡️ Panel de Supervisión Total (Admin) (`/api/admin`)
*(Requieren JWT donde `user.role === 'admin'`)*
- `GET /users`, `GET /containers`: Listados masivos y sin filtrar de todo el ecosistema.
- `GET /audit`: Devuelve el JSON de los AuditLogs de los últimos 30 días ordenado descendentemente.
- `POST /backup/run/:type`: `:type` puede ser `all`, `db`, `server` o `web`. Llama al `backupService.js` para generar el Tarball/Mongodump.
- `GET /backup/list`, `DELETE /backup/:bucket/:filename`: Gestión CRUD directa al servidor local MinIO a través de su SDK.

--- 

_Documentación estructurada y consolidada para OrbitCloud SaaS_
