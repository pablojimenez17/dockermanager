# Despliegue en Kubernetes (Alta Disponibilidad) en DigitalOcean

Esta carpeta contiene todos los manifiestos declarativos de Kubernetes necesarios para migrar **dockermanager** desde Docker Compose a un clúster de Kubernetes en **DigitalOcean** (DOKS o clúster auto-gestionado), garantizando alta disponibilidad, tolerancia a fallos y auto-recuperación.

---

## 1. Arquitectura de Alta Disponibilidad

El diseño implementado consta de los siguientes componentes:

*   **`frontend`**: Deployment con **3 réplicas** distribuidas dinámicamente entre nodos físicos usando reglas de **Pod Anti-Affinity**. Si un nodo se cae, el frontend sigue disponible a través de las réplicas restantes.
*   **`backend`**: Deployment con **3 réplicas**, también con **Pod Anti-Affinity**, balanceadas internamente.
*   **`mongodb`**: `StatefulSet` persistente. Mantiene la identidad de red del pod y conecta los datos a un volumen persistente de alta velocidad utilizando el CSI nativo de DigitalOcean (`do-block-storage`).
*   **`minio`**: `StatefulSet` persistente para almacenar backups y snapshots, respaldado también por `do-block-storage`.
*   **`socket-proxy`**: Proxy seguro que da acceso al Docker socket `/var/run/docker.sock` local al backend (útil si los nodos del clúster ejecutan Docker).
*   **`ingress`**: Reglas de enrutamiento web con soporte para **Certificados SSL automáticos (Let's Encrypt)** y **Afinidad de Sesión (Sticky Sessions)** mediante cookies. Esto último es crítico para que las conexiones WebSockets de Socket.io no se desconecten al balancear el tráfico.

---

## 2. Requisitos Previos

Antes de aplicar los manifiestos, asegúrate de tener:

1.  **Clúster de Kubernetes en DigitalOcean (DOKS)** listo.
2.  **`kubectl`** instalado y configurado con el contexto de tu clúster (`doctl kubernetes cluster kubeconfig save <nombre-del-cluster>`).
3.  **Nginx Ingress Controller** instalado en el clúster. En DigitalOcean, puedes desplegar el controlador preparado para su infraestructura ejecutando:
    ```bash
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/do/deploy.yaml
    ```
    *Esto creará automáticamente un Load Balancer externo en tu panel de DigitalOcean con una IP pública.*
4.  **Cert-Manager** instalado para renovar automáticamente los certificados SSL:
    ```bash
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml
    ```

---

## 3. Preparación y Configuración

### Paso 1: Generar y Subir las Imágenes Docker
Kubernetes descargará las imágenes desde un registro de contenedores (e.g., DigitalOcean Container Registry o Docker Hub). Debes compilar y subir tus imágenes:

```bash
# Iniciar sesión en el registro de DigitalOcean
doctl registry login

# Compilar y subir Backend
docker build -t registry.digitalocean.com/<tu-registro>/dockermanager-backend:latest ./backend
docker push registry.digitalocean.com/<tu-registro>/dockermanager-backend:latest

# Compilar y subir Frontend
docker build -t registry.digitalocean.com/<tu-registro>/dockermanager-frontend:latest ./frontend
docker push registry.digitalocean.com/<tu-registro>/dockermanager-frontend:latest
```

> [!NOTE]
> Una vez subidas, edita los archivos [backend-deployment.yaml](file:///c:/Programacion/dockermanager/kubernetes/backend-deployment.yaml) y [frontend-deployment.yaml](file:///c:/Programacion/dockermanager/kubernetes/frontend-deployment.yaml) reemplazando la directiva `image: dockermanager/...` con las rutas correspondientes a tu registro.

### Paso 2: Configurar Secretos y Ajustes
1.  Abre el archivo [secrets.yaml](file:///c:/Programacion/dockermanager/kubernetes/secrets.yaml).
2.  Actualiza las contraseñas en Base64 con tus propios valores de producción:
    *   Puedes codificar cualquier cadena a Base64 en Linux/macOS con: `echo -n 'mi-secreto' | base64`
    *   En Windows PowerShell: `[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("mi-secreto"))`
3.  Abre el archivo [configmap.yaml](file:///c:/Programacion/dockermanager/kubernetes/configmap.yaml) y modifica las variables según requieras.

### Paso 3: Configurar el Emisor de Certificados SSL (Cert-Manager)
Crea un archivo llamado `kubernetes/letsencrypt-issuer.yaml` para indicarle a Cert-Manager cómo obtener los certificados SSL gratuitos de Let's Encrypt:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: tu-email@tudominio.com # Reemplazar con tu email real
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```
Aplica este emisor en el clúster:
```bash
kubectl apply -f kubernetes/letsencrypt-issuer.yaml
```

---

## 4. Despliegue de los Recursos

Aplica todo el directorio de Kubernetes en orden:

```bash
# 1. Crear el namespace
kubectl apply -f kubernetes/namespace.yaml

# 2. Aplicar ConfigMap y Secrets
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secrets.yaml

# 3. Desplegar bases de datos y almacenamiento persistente (MongoDB y MinIO)
kubectl apply -f kubernetes/mongodb-statefulset.yaml
kubectl apply -f kubernetes/minio-statefulset.yaml

# 4. Desplegar socket-proxy de Docker (si aplica)
kubectl apply -f kubernetes/socket-proxy-deployment.yaml

# 5. Desplegar los servicios de la aplicación (Frontend y Backend)
kubectl apply -f kubernetes/backend-deployment.yaml
kubectl apply -f kubernetes/backend-service.yaml
kubectl apply -f kubernetes/frontend-deployment.yaml
kubectl apply -f kubernetes/frontend-service.yaml

# 6. Desplegar reglas de Ingress para tráfico HTTP/HTTPS
kubectl apply -f kubernetes/ingress.yaml
```

---

## 5. Configurar el DNS

Una vez aplicados los manifiestos, obtén la IP externa asignada por DigitalOcean al Ingress Controller ejecutando:

```bash
kubectl get service ingress-nginx-controller -n ingress-nginx
```

Verás una IP en la columna `EXTERNAL-IP`. Dirígete a tu proveedor de dominio (DNS) y crea los siguientes registros tipo **A**:
*   `orbitcloud.app` -> `<IP EXTERNA DEL LOAD BALANCER>`
*   `www.orbitcloud.app` -> `<IP EXTERNA DEL LOAD BALANCER>`

Cert-Manager detectará el Ingress y generará los certificados SSL de forma totalmente transparente e inmediata.

---

## 6. Monitoreo y Escalabilidad

*   **Verificar el estado de todos los Pods:**
    ```bash
    kubectl get pods -n dockermanager -o wide
    ```
    *(Verás cómo las 3 réplicas del frontend y backend están corriendo en diferentes nodos de forma balanceada).*

*   **Verificar logs del backend:**
    ```bash
    kubectl logs -l app=dockermanager-backend -n dockermanager -f --tail=100
    ```

*   **Escalar el Backend en caliente si el tráfico aumenta:**
    ```bash
    kubectl scale deployment dockermanager-backend -n dockermanager --replicas=5
    ```

*   **Autoscaling automático (HPA):**
    Puedes habilitar el escalado automático basado en consumo de CPU:
    ```bash
    kubectl autoscale deployment dockermanager-backend -n dockermanager --cpu-percent=70 --min=3 --max=10
    ```
