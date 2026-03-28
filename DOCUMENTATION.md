# 🐳 DockerManager - Sistema CaaS/PaaS Completo

DockerManager es una plataforma integral al estilo de Portainer o Heroku que permite a los usuarios aprovisionar, gestionar y exponer contenedores Docker de forma segura a través de una interfaz web, con políticas estrictas de cuotas comerciales, seguridad y aislamiento de red.

---

## 🏗 Arquitectura de Red y Seguridad (Implementación Avanzada)

Para garantizar la máxima seguridad y segmentación de los clientes, la infraestructura se levanta mediante `docker-compose` utilizando **7 subredes aisladas** y contenedores dedicados de infraestructura:

### Zonas de Red
1. **`public_net`**: Red exterior donde interactúa el router de borde (Firewall).
2. **`transit_proxy_inverso` & `transit_proxy_forward`**: Redes puente para enrutar el tráfico inspeccionado hacia los proxies.
3. **`dmz_net`**: La **Zona Desmilitarizada (DMZ)**. Aloja los componentes críticos del sistema (Frontend, Backend, MongoDB y Proxy Inverso). Nadie desde fuera o desde las redes de los clientes puede llegar aquí directamente.
4. **`lan_net`**: Red aislada de los usuarios (**LAN**). Aquí nacen automáticamente todos los contenedores creados por los clientes. No tienen visibilidad de la DMZ ni de la base de datos.
5. **`storage_transit_net` & `storage_net`**: Redes ultra-restringidas para los respaldos y buckets. El backend se comunica con ellas mediante un cortafuegos interno.

### Contenedores de Infraestructura (Core)
* **`edge-fw` (Suricata IDS/IPS)**: Inspecciona cada paquete que entra de internet. Escucha en los puertos 80/443 y utiliza reglas `iptables` (DNAT/MASQUERADE) inyectadas mediante `edge-fw.sh` para desviar el tráfico limpio a los Proxies (Traefik).
* **`proxy-inverso` (Traefik DMZ)**: Actúa como el Proxy Inverso principal enfocado **exclusivamente** en dar acceso a la web (Frontend) y a la API (Backend). Ignora los contenedores de los clientes.
* **`lan-proxy` (Traefik LAN)**: Un segundo Traefik dedicado puramente a enrutar dominios personalizados y tráfico hacia los contenedores de los clientes dentro de la `lan_net`.
* **`socket-proxy` (Tecnativa)**: Actúa como un escudo para el Daemon de Docker. El backend **no tiene acceso a nivel de root** (al archivo `.sock`), sino que le pide a este proxy (vía TCP HTTP) crear contenedores. Evita ataques de escalada de privilegios.
* **`storage-fw` (HAProxy Bridge)**: Cortafuegos interno de capa 4. Recibe las conexiones del Backend destinadas a MinIO (9000) o NAS (445) y las cruza físicamente hacia la zona segura del `storage_net`.
* **NAS & MinIO**: Sistemas de almacenamiento de base de datos, respaldos de configuraciones web y _Buckets_ tipo S3 (S3 Compatible).

---

## ⚙️ Características Clave del Backend (Node.js)

El backend de Node.js actúa como el cerebro comercial e integrador de Docker API:

1. **Gestión de Cuotas y Planes (RBAC)**
   - Protege los despliegues verificando la Memoria RAM, CPU, número de dominios y volúmenes según el Plan (Free, Pro, Enterprise, etc.) que ha pagado el usuario (`User.planType`).
   - Los Usuarios Regulares solo ven los contenedores vinculados a su cuenta en MongoDB gracias a los filtros `$or: [{userId}, {organizationId}]`.
   
2. **Reaper Service (Segador de Recursos Auto-Administrado)**
   - Ejecuta un bucle cada 5 minutos en el backend (`reaperService.js`).
   - Bloquea cuentas morosas: Detiene contenedores de usuarios cuyo `planExpiresAt` haya pasado.
   - Restringe el Plan Gratuito (Heroku-style): Inspecciona el tiempo de actividad de Docker (`StartedAt`). Si un usuario gratuito mantiene un contenedor continuo por >24h, lo duerme automáticamente para liberar RAM del host principal.

3. **Zero-Downtime Deployments (Blue/Green)**
   - Al actualizar una imagen ("Redeploy"), el backend levanta primero el contenedor nuevo con la etiqueta `...-redeploy-XYZ`. Si y solo si levanta correctamente y el proxy de Traefik lo asienta en ruta, detiene y elimina el contenedor antiguo sin perder ni 1 milisegundo de tránsito.

4. **Secret Manager Integrado**
   - En lugar de guardar variables de entorno planas en texto, usa la sintaxis `APP_KEY={{SECRET:MiClaveSecreta}}`. El backend descifra AES-256 en tiempo real justo antes de inyectar las credenciales al entorno de Docker nativo.

---

## 📡 API Endpoints (Referencia General)

El backend expone todo a través de conectores modulares en Express:

### 1. Autenticación y RBAC (`/api/auth`)
- `POST /login`, `POST /register`: Controlan el acceso y emiten tokens JWT.
- `GET /me`: Obtiene detalles del usuario y sus cuotas activas.

### 2. Contenedores (`/api/containers`)
- `GET /`: Devuelve todos los contenedores del usuario logueado en base a MongoDB, enriquecidos en tiempo real asincrónicamente con `Dockerode` (Status, Puertos, RAM).
- `POST /`: **Crea un Contenedor / Stack**. 
  - Restringe cuotas (RAM, CPU, Dominios).
  - Configura el enrutamiento de red (`lan_net`).
  - Inyecta de manera automática el `traefik.constraint-label=lan-proxy` para que el `lan-proxy` empiece a redirigir tráfico externo sin modificar firewalls.
- `POST /:id/start`, `POST /:id/stop`: Controla el ciclo de vida.
- `PUT /:id/redeploy`: Lanza un despliegue Blue/Green Zero-Downtime para la última imagen pública o privada del contenedor.
- `PUT /:id/edit`: Modifica la configuración (ej. exponer un dominio de Traefik en vuelo clonando el estado base).
- `DELETE /:id`: Limpia el registro y fuerza el apagado nativo en Docker.

### 3. Administración Global Limitada (`/api/admin`)
_(Endpoints protegidos exclusivamente para cuentas con rol 'admin')_
- `GET /users`: Recupera toda la base de datos de clientes.
- `GET /containers`: Consulta los contenedores en general (clientes combinados).
- `DELETE /containers/:id`: Borrado forzado con omisión de autoría.
- **`GET /system-containers`**: Llama en crudo a la API del Socket de Docker devolviendo **TODA la infraestructura real** que soporta la web (incluyendo bases de datos, edge-fw, proxies, etc.). Ideal para un Panel de Control.
- `GET /audit`: Registros auditables cruciales (Quién borró qué, a qué hora, qué detuvo el Reaper Service, etc.).

### 4. Funcionalidades Expandidas
- `/api/git` y `/api/webhooks`: Habilita pipelines CI/CD simples. Escucha eventos `push` desde GitHub/GitLab para automatizar reconstrucciones o hacer un _Redeploy_ asincrónico directo sobre el contenedor afectado.
- `/api/registries`: Guarda credenciales encriptadas para que el usuario pueda bajar imágenes cerradas (ej. _Docker Hub Private_, _GHCR_).
- `/api/networks` y `/api/volumes`: Permiten a los usuarios levantar VLANs personalizadas y discos de persistencia.
- `/api/buckets` y `/api/snapshots`: Endpoints de conectividad con **MinIO**. Transfiere copias de seguridad de los contenedores empaquetados como _tar_ para guardarlos de forma redundante y exportarlos a NAS.
- `/api/ai` (`ollamaService`): Ofrece un asistente integrado usando modelos LLM locales corriendo directos en la DMZ para asesoría DevSecOps dentro de la terminal web de DockerManager.
