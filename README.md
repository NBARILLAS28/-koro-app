# KORO 🎵🔑

App para bandas y comunidades musicales: arma setlists, ajusta tonalidades al vuelo, comenta temas y guarda referencias de YouTube — todo sincronizado en tiempo real para tu comunidad de hasta 30+ integrantes.

Stack: **Expo SDK 57 (React Native 0.86 + React 19) + expo-router + TypeScript** en el front, **Supabase** (Postgres + Auth + Realtime) en el backend.

## 1. Poner en marcha el backend (Supabase)

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. En el editor SQL de tu proyecto, pega y ejecuta **en este orden**:
   - `supabase/schema.sql` — tablas base, códigos de invitación, RLS y Realtime.
   - `supabase/migrations/002_live_session.sql` — modo **Director en vivo** (ver sección 7).
   - `supabase/migrations/003_leave_community.sql` — permite **salir de una comunidad** (ver sección 10).
   - `supabase/migrations/004_admin_safety.sql` — evita que una comunidad se quede sin admin.
   - `supabase/migrations/005_song_search_index.sql` — índice para búsqueda rápida de canciones.
   - `supabase/migrations/006_push_notifications.sql` — infraestructura de notificaciones push (ver sección 12).
   - `supabase/migrations/007_profile_auto_create.sql` — crea el perfil automáticamente al registrarse (arregla un bug real que puede dejar una cuenta sin perfil).
   - `supabase/migrations/008_fix_admin_trigger_security.sql` — arregla el trigger de "admin automático" al crear una comunidad, que fallaba por falta de `SECURITY DEFINER` (RLS lo bloqueaba).
   - `supabase/migrations/009_safe_owner_deletion.sql` — evita que borrar la cuenta del creador elimine en cascada toda la comunidad (necesario antes de habilitar "Eliminar cuenta").
3. Ve a **Project Settings > API** y copia:
   - `Project URL`
   - `anon public key`

## 2. Configurar el proyecto local

```bash
cp .env.example .env
# Pega tu Project URL y anon key en .env
```

```bash
npm install --legacy-peer-deps
npx expo install --fix   # asegura versiones compatibles con tu SDK de Expo
```

## 3. Correr la app

```bash
npx expo start
```

Escanea el QR con **Expo Go** (Android/iOS) o presiona `a` / `i` para emulador.

Si tu computadora y tu celular NO están en la misma red wifi (por ejemplo, si compartes internet del celular a la laptop por hotspot), usa en su lugar:

```bash
npx expo start --tunnel
```

La primera vez que uses `--tunnel` te va a pedir iniciar sesión con una cuenta de Expo (gratis en [expo.dev/signup](https://expo.dev/signup)) — es un requisito de Expo, no del proyecto.

> Nota (de tus proyectos anteriores): en Windows usa **cmd**, no PowerShell, para evitar errores de política de ejecución. Usa siempre `npx expo install` en vez de `npm install` para paquetes nativos, y si un `npm install` normal te da un error `ERESOLVE`, usa `npm install --legacy-peer-deps` (necesario por una dependencia opcional de soporte web que Expo trae de fábrica y que no usamos).

## 4. Flujo de uso

1. Un integrante crea cuenta y crea una comunidad → la app genera un código único (ej: `KORO-7F3A`).
2. Comparte el código con el resto de la banda (hasta 30 por defecto, configurable en la tabla `communities.max_members`).
3. Cualquiera con el código puede unirse desde "Unirme con código" sin necesidad de aprobación manual.
4. Dentro de la comunidad: se crean **setlists** (ej: "Ensayo martes"), se agregan **temas**, se ajusta la **tonalidad** con los botones +/− (transposición automática de acordes), se pega el **link de YouTube** de referencia, y se dejan **comentarios** por tema.

## 5. Lo que ya está implementado

- ✅ Auth (registro/login) con Supabase
- ✅ Crear/unirse a comunidades por código autogenerado
- ✅ CRUD de setlists y canciones
- ✅ Reordenar canciones dentro de un setlist
- ✅ Motor de transposición de tonalidad (acordes y letra en formato ChordPro `[G]like this[C]`)
- ✅ Reproductor de YouTube embebido por canción
- ✅ Comentarios por canción
- ✅ Row Level Security: solo miembros de una comunidad ven su contenido
- ✅ Roles (`admin`, `director`, `member`) en la base de datos, listos para restringir acciones en el front
- ✅ **Director en vivo**: un admin/director transmite en tiempo real qué tema y tonalidad ve toda la comunidad
- ✅ **Gestión de miembros**: ver integrantes, promover/degradar roles (admin/director/integrante), expulsar
- ✅ **Indicador de presencia en vivo**: el director ve cuántos están conectados y siguiendo activamente
- ✅ **Salir de la comunidad**: cualquier integrante puede salirse por su cuenta
- ✅ **Autoscroll de letra**: velocidad ajustable (1x-5x), se detiene solo al llegar al final
- ✅ **Tamaño de letra ajustable** (A−/A+) para leer cómodo desde lejos en el escenario
- ✅ **Modo offline**: el último setlist y canción vistos quedan cacheados localmente (AsyncStorage) y se muestran automáticamente si no hay conexión
- ✅ **Editor visual de letra/acordes**: pantalla dedicada con botonera de acordes rápida y vista previa en vivo
- ✅ **Búsqueda de canciones**: biblioteca completa por comunidad con búsqueda por título/artista
- ✅ **Eliminar setlists y temas**: quitar un tema de un setlist (long-press), borrar un setlist completo, borrar una canción de la biblioteca
- ✅ **Exportar setlist a PDF**: genera y comparte un PDF con el orden y tonalidades
- ✅ **Editar perfil**: nombre, instrumento y preferencias de notificación
- ✅ **Notificaciones push**: infraestructura completa (token, Edge Function, triggers) para avisar de temas nuevos, transmisiones en vivo y comentarios
- ✅ **Protección contra comunidad sin admin**: la base de datos rechaza dejar una comunidad sin ningún admin
- ✅ **Mensajes de error amigables** y reintento automático en llamadas de red
- ✅ **Confirmaciones visuales (toast)** al guardar comentarios, crear/unirse a comunidades, guardar links
- ✅ **Metrónomo**: pulso visual siempre + clic audible (100% local a cada dispositivo, nunca sincronizado por red) — se silencia solo cuando hay una transmisión en vivo activa en la comunidad
- ✅ **Búsqueda de referencia**: enlaces rápidos a CifraClub y La Cuerda para buscar la canción (abre el navegador, no reproduce contenido de terceros dentro de la app)
- ✅ **Recuperar contraseña**: enlace "¿Olvidaste tu contraseña?" en el login, envía un correo con un link que abre la app directo en la pantalla de nueva contraseña
- ✅ **Eliminar cuenta**: desde Perfil, borra la cuenta por completo (requisito de Apple); las comunidades creadas sobreviven para los demás integrantes
- ✅ **Versión web**: el mismo proyecto exporta a un sitio estático (HTML/JS/CSS), desplegable gratis en Netlify, conectado al mismo Supabase
- ✅ **Soporte básico para tablet/pantallas anchas**: el contenido se centra en una columna de lectura cómoda

## 7. Cómo funciona el Director en vivo

Es el diferenciador de KORO frente a CifraClub/OnStage: en un ensayo o presentación, el director controla la pantalla de todo el grupo.

- En la pantalla de un **setlist**, si tu rol es `admin` o `director`, ves el botón **"🔴 Iniciar transmisión en vivo"**. Al presionarlo, tu tema actual queda marcado como "en vivo" para toda la comunidad.
- El resto de integrantes ve un banner rojo **"En vivo ahora: <tema>"** tanto en el setlist como, si están dentro de otra canción, saltan automáticamente a la que el director está mostrando (se puede desactivar tocando "Dejar de seguir" dentro de la pantalla de la canción).
- El director tiene botones **Anterior / Siguiente** para avanzar el setlist en vivo, y **"Ir aquí"** en cualquier fila para saltar directo a ese tema.
- Si el director sube o baja la tonalidad con los botones +/− mientras transmite, el cambio se propaga en tiempo real a todos los que están siguiendo.
- **"Finalizar"** apaga la transmisión para todos.
- Técnicamente: una fila por comunidad en `live_sessions`, actualizada vía función `start_or_update_live_session` (RPC) y escuchada por todos los clientes con **Supabase Realtime** (`postgres_changes`). Solo `admin`/`director` pueden escribir (verificado también a nivel de RLS, no solo en el front).

## 8. Gestión de miembros

Desde la pantalla de una comunidad, el chip "👥 X/30 integrantes" lleva a la lista completa.

- Cualquier miembro puede ver la lista y los roles.
- Solo `admin`/`director` pueden tocar una fila para abrir un menú: **Hacer Admin / Hacer Director / Hacer Integrante / Expulsar**.
- Nadie puede cambiar su propio rol ni auto-expulsarse desde esta pantalla (evita que un admin se bloquee a sí mismo por error).
- Reforzado con RLS: aunque alguien manipule las llamadas a la API directamente, la base de datos rechaza cambios de rol o expulsiones si quien los pide no es `admin`/`director` de esa comunidad.

**Limitación conocida:** no hay validación que impida dejar una comunidad sin ningún `admin` (ej: si el único admin se degrada a sí mismo... aunque eso ya está bloqueado; el riesgo real sería que dos admins se degraden mutuamente uno tras otro). Vale la pena revisarlo antes de producción si esto va a manejar comunidades grandes.

## 9. Indicador de presencia ("quién está siguiendo en vivo")

Usa **Supabase Realtime Presence** (canal `presence:community:<id>`), separado de la tabla `live_sessions` — no requiere nada nuevo en la base de datos.

- Mientras hay una sesión en vivo activa, cada persona con la app abierta (en el setlist o en la canción) reporta su presencia y si está seleccionado "siguiendo".
- El director ve **"👥 X de Y siguiendo en este momento"** tanto en la pantalla de setlist como en la barra de transmisión dentro de la canción.
- Un seguidor que toca "Dejar de seguir" sigue conectado pero deja de contar como "siguiendo" — así el director distingue entre "conectados" y "realmente sincronizados conmigo".

**Limitación conocida:** esto solo cuenta a quienes tienen la app abierta en ese momento (presencia en tiempo real), no a todos los integrantes de la comunidad — alguien sin conexión o con la app cerrada no aparece en el conteo. Es el comportamiento esperado, pero vale aclararlo si alguien espera ver "30 de 30".

## 10. Detalle de lo agregado en esta ronda

**Salir de la comunidad** — Corre `supabase/migrations/003_leave_community.sql` (después de 002). Agrega una política RLS que permite a cualquier miembro borrar su propia fila de `community_members`. El botón está en la pantalla de comunidad, con confirmación previa. No hay protección todavía contra que una comunidad se quede sin ningún admin (ver limitación en la sección de Miembros).

**Autoscroll de letra** — Botón ▶/⏸ flotante sobre la letra, con velocidad 1x-5x. Se detiene solo al llegar al final del texto. Es 100% local (no se sincroniza entre integrantes ni con el modo Director en vivo todavía — cada quien controla su propio scroll).

**Modo offline** — Cachea localmente (AsyncStorage) el último setlist visto y la última canción vista, incluyendo comentarios. Si falla la conexión al cargar, la app muestra automáticamente la copia guardada con un banner "📴 Sin conexión" y la fecha de esa copia. Mientras está offline se deshabilitan las acciones que requieren escribir (reordenar, agregar temas, comentar, cambiar tonalidad, editar letra). El video de YouTube no funciona sin conexión (es esperado). Esto NO es una cola de sincronización — los cambios hechos offline no se guardan, solo se permite *ver* la última copia conocida.

**Editor de letra/acordes** — Nueva pantalla (`song/[id]/edit`), accesible desde "+ Agregar letra" / "Editar" en la canción. Incluye: selector de tonalidad original, botonera rápida de los 12 acordes (con toggle de menor `m`) que inserta `[Acorde]` en la posición del cursor, editor de texto plano en formato ChordPro, y vista previa en vivo con el mismo renderizador que usa la pantalla de la canción. Cualquier miembro de la comunidad puede editar (mismo permiso que ya regía para `songs` desde el esquema original).

## 11. Roadmap sugerido (lo que sigue pendiente)

- [ ] Cola de sincronización para cambios hechos offline (hoy el modo offline es solo de lectura)
- [ ] Sincronizar el autoscroll también entre el director y quienes lo siguen en vivo
- [ ] Buscador de canciones por tonalidad/género además de título/artista
- [ ] Subir foto de perfil (avatar) — hoy solo se puede editar nombre e instrumento
- [ ] Tests automatizados (hoy todo se validó por revisión de código, no hay test suite)
- [ ] Eliminar cuenta desde la app (Apple lo exige si permites crear cuentas)
- [ ] Distribución real sin depender de tu computadora (TestFlight / Internal Testing, o publicar en las tiendas)

**Nota legal que sigue vigente:** si tu comunidad va a cargar letras/acordes de canciones comerciales de terceros (no composiciones propias), conviene revisar los derechos de autor aplicables en tu país antes de escalar esto más allá de uso interno de la banda.

## 12.5 Qué falta para pasar de "mi banda la prueba" a "cualquiera la puede usar"

Dos niveles distintos, con esfuerzo muy diferente:

**Para que tu banda la use de verdad (no solo pruebas)**
- Hoy la única forma de abrir la app es que tu computadora esté corriendo `npx expo start` y todos escaneen el QR con Expo Go — no es viable para uso semanal real.
- Alternativa: **TestFlight** (Apple) o **Internal Testing** (Google) — instala una vez, queda en el teléfono, no depende de tu computadora. Requiere cuenta de desarrollador de Apple (US$99/año) y/o Google (US$25 pago único), y usar `eas build` para generar el build real (no cubierto en este proyecto todavía).
- ✅ Ya resuelto: recuperación de contraseña (ver sección 16).

**Para publicar en App Store / Play Store (alcance público)**
- Política de privacidad (obligatoria en ambas tiendas — aquí sí aplica porque se guardan correos, nombres, datos de comunidades)
- Eliminar cuenta desde la app (Apple Guideline 5.1.1(v))
- Aspecto legal de letras de canciones de terceros — el riesgo sube con alcance público
- Moderación de contenido (hoy nada impide un nombre de comunidad inapropiado, y no hay forma de reportarlo)
- Actualizaciones OTA (Expo Updates) para poder corregir bugs sin re-subir a las tiendas cada vez

## 12. Notificaciones push — cómo activarlas

Esto SÍ requiere un paso manual de despliegue, no es automático como el resto:

1. Instala la CLI de Supabase (`npm install -g supabase`) si no la tienes.
2. `supabase login` y `supabase link --project-ref <tu-project-ref>`.
3. Despliega la función: `supabase functions deploy send-push`.
4. Configura sus variables de entorno (usa el service role key, **no** el anon key):
   ```bash
   supabase secrets set SUPABASE_URL=https://<tu-project-ref>.supabase.co
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
   ```
5. Actualiza la URL en la base de datos para que los triggers sepan a dónde llamar:
   ```sql
   update public.app_config
   set value = 'https://<tu-project-ref>.supabase.co/functions/v1/send-push'
   where key = 'push_function_url';
   ```
6. En `app.json`, reemplaza `"projectId": "REEMPLAZA_CON_TU_PROJECT_ID_DE_EAS"` con el de tu proyecto (`eas init` si nunca lo has corrido — necesitas cuenta de Expo/EAS, es gratis).
7. Prueba en un dispositivo físico (las notificaciones push no funcionan en simulador/emulador). Cada persona debe abrir la app al menos una vez para que se guarde su token.

Si saltas este paso, la app funciona igual — los triggers de la base de datos detectan que `push_function_url` no está configurada y simplemente no hacen nada (no rompen ninguna otra funcionalidad).

## 13. Notas de optimización de esta ronda

- **Errores de red**: `src/lib/errors.ts` centraliza la traducción de errores técnicos a mensajes claros en español, y `withRetry` reintenta automáticamente llamadas que fallan por conexión inestable (usado en la carga de comunidades).
- **Confirmaciones visuales**: `src/components/Toast.tsx` es un componente reutilizable que ya se usa en comentarios, YouTube, crear/unirse a comunidades. Se puede agregar a cualquier pantalla nueva con `const { showToast, Toast } = useToast()`.
- **Tablet/pantallas anchas**: `app/_layout.tsx` centra automáticamente el contenido en columnas de hasta 640px en pantallas anchas (tablet, web, iPad), sin afectar el celular normal.
- **Verificación de sintaxis**: todo el código pasó un chequeo de compilación TypeScript (`tsc --noEmit`) sin errores de sintaxis antes de esta entrega — no garantiza cero errores de tipos (no se instalaron `node_modules` en este entorno), pero sí que no hay problemas estructurales de código.

## 14. Metrónomo — por qué es local y nunca se sincroniza

Vive en la pantalla de cada canción, justo debajo del control de tonalidad.

- **Pulso visual** (4 puntos que se iluminan al compás) — siempre visible, sin importar el contexto.
- **Clic audible** — solo suena cuando NO hay una transmisión en vivo activa en la comunidad (o sea, en ensayo personal). En cuanto el director inicia el modo en vivo, el clic se apaga automáticamente para todos y solo queda el pulso visual.
- **100% local a cada dispositivo, a propósito**: el metrónomo nunca viaja por la red ni se guarda en `live_sessions`. Un clic de audio "sincronizado" entre varios teléfonos siempre llega con unos milisegundos de diferencia por la variación normal de la red — eso desincroniza más de lo que ayuda. Cada integrante corre su propio metrónomo de forma independiente, igual que lo haría con un metrónomo físico en su atril.
- El **tempo (BPM)** se guarda por canción (columna `songs.bpm`, ya existía en el esquema original) y se edita desde la pantalla de editar letra/acordes. Dentro de la pantalla de la canción, los botones +/− del metrónomo ajustan el tempo solo para esa sesión de ese dispositivo, sin sobreescribir el valor guardado — para eso hay que entrar al editor y guardar explícitamente.
- Técnicamente: usa `expo-audio` con dos clics sintetizados (`assets/click.wav` normal y `assets/click-accent.wav` para el primer pulso del compás), y un `setTimeout` autocorregido (compensa el drift en cada tick) en vez de `setInterval` plano, para que no se desfase con el tiempo.
- **Optimización de fluidez**: la primera versión se sentía "trabada" — dos causas reales: (1) un solo reproductor de audio haciendo `seekTo(0)` + `play()` en carrera, ahora resuelto con un pool de 3 reproductores por sonido que rotan; (2) el pulso visual actualizaba estado de React en cada tick, forzando que toda la pantalla de la canción (scroll, video, letra) se volviera a renderizar — ahora el pulso usa valores compartidos de Reanimated (`src/components/MetronomeDot.tsx`), que animan fuera del ciclo de render de React.

## 15. Búsqueda de referencia (CifraClub / La Cuerda)

En la pantalla de la canción, junto al botón de editar letra, hay dos chips: "CifraClub" y "La Cuerda". Abren una búsqueda en el navegador del celular (no dentro de la app) para el título + artista de esa canción en esos sitios.

**Por qué es solo un enlace de salida y no una búsqueda integrada:** copiar o mostrar dentro de KORO las letras/acordes de esos sitios sería reproducir contenido de terceros que probablemente tiene derechos de autor de por medio (aunque el sitio en sí opere en una zona gris). Abrir el navegador y dejar que el integrante copie manualmente lo que necesite hacia el editor de KORO evita ese riesgo por completo, y sigue ahorrando el paso de buscar el nombre del sitio y escribir la canción a mano.

## 16. Recuperar contraseña — cómo funciona y qué falta probar en vivo

- En el login, "¿Olvidaste tu contraseña?" pide el correo y llama a `supabase.auth.resetPasswordForEmail`, con `redirectTo: 'koro://reset-password'`.
- Supabase manda un correo con un enlace. Al abrirlo desde el iPhone, el sistema operativo detecta el esquema `koro://` y abre la app directo en `app/reset-password.tsx` (fuera de los grupos de auth/app, para que funcione sin sesión previa).
- Esa pantalla toma los tokens que vienen en el enlace, arranca una sesión de recuperación, y muestra el formulario de contraseña nueva.

**Esto es exactamente el tipo de flujo que no se puede verificar al 100% sin probarlo en un dispositivo real** — el manejo de deep links (que el enlace del correo realmente abra la app en vez del navegador, que iOS reconozca el esquema `koro://`, etc.) depende del sistema operativo y no se puede simular en este entorno. Cuando lo pruebes:
1. Pide el enlace desde la app
2. Ábrelo desde el correo **en tu iPhone** (no desde la computadora)
3. Debe abrir KORO directo, no Safari

Si en cambio abre Safari o no pasa nada, avísame — lo más probable es que haya que ajustar algo de la configuración de deep linking en `app.json` que no se puede terminar de afinar sin ver el comportamiento real.

## 17. Distribución real: TestFlight, Internal Testing, y las tiendas

Esta sección es la guía completa para pasar de "solo funciona con mi computadora prendida" a una app instalable de verdad. Se hace en tres etapas.

### Etapa 1 — Cuentas de desarrollador (esto lo haces tú, no yo)

- **Apple Developer Program**: [developer.apple.com/programs](https://developer.apple.com/programs/enroll/) — US$99/año. Pide verificación de identidad (puede tardar 24-48h la primera vez).
- **Google Play Console**: [play.google.com/console](https://play.google.com/console/signup) — US$25 pago único, de por vida.

No hay forma de saltarse esto — ambas tiendas lo exigen para publicar cualquier app, incluso en modo de pruebas cerradas.

### Etapa 2 — Generar los builds reales con EAS

Ya dejé todo configurado en el proyecto (`eas.json`, `app.json` con bundle identifiers `com.nery.koro` para ambas plataformas). Una vez que tengas las cuentas:

```bash
npm install -g eas-cli
eas login
eas build:configure
```

`eas build:configure` va a reemplazar el placeholder `REEMPLAZA_CON_TU_PROJECT_ID_DE_EAS` en `app.json` automáticamente con tu project ID real de EAS (necesario para que las notificaciones push funcionen en producción, no solo en Expo Go).

Luego, para generar un build de pruebas (instalable directo en tu iPhone/Android sin pasar por las tiendas):

```bash
eas build --profile preview --platform all
```

La primera vez te va a pedir tus credenciales de Apple Developer (para firmar el build de iOS) — EAS las gestiona por ti, no necesitas manejar certificados a mano. Tarda entre 10-20 minutos por plataforma. Al terminar te da un link para instalar directo en tu teléfono (iOS) o un `.apk` descargable (Android).

### Etapa 3 — Publicar en las tiendas

Cuando el build de `preview` ya lo probaste y confía en él:

```bash
eas build --profile production --platform all
eas submit --profile production --platform all
```

`eas submit` sube el build directo a App Store Connect / Play Console. Desde ahí, en el panel de cada tienda, tienes que completar (esto es manual, cada tienda tiene su propio formulario):

- **Descripción de la app**, capturas de pantalla (puedo ayudarte a redactar la descripción cuando llegues aquí)
- **Política de privacidad**: ya la redacté en `legal/PRIVACY_POLICY.md` — pero las tiendas piden un **link público**, no un archivo. Opciones gratis para publicarla: GitHub Pages, Notion (página pública), o una página simple en tu sitio web si ya tienes uno. Avísame cuando quieras montarla y te ayudo con esa parte también.
- **Clasificación de edad** (cuestionario dentro de cada panel)
- **Categoría**: sugiero "Música" en ambas tiendas
- **Cuenta de soporte**: un correo o página donde la gente pueda escribirte si algo falla

### Qué ya quedó resuelto de los requisitos de las tiendas

- ✅ Eliminar cuenta desde la app (Apple lo exige — ver Perfil → "Eliminar mi cuenta")
- ✅ Política de privacidad redactada (falta solo publicarla en una URL)
- ✅ Bundle identifiers configurados para ambas plataformas
- ✅ `ITSAppUsesNonExemptEncryption: false` en `app.json` (evita una pregunta manual de Apple sobre cifrado — KORO solo usa HTTPS estándar, que está exento)

### Lo que sigue pendiente

- [ ] Publicar la política de privacidad en una URL pública
- [ ] Capturas de pantalla reales para las fichas de las tiendas (necesito verlas corriendo en tu dispositivo para generarlas bien, o las tomas tú directo de la app)
- [ ] Descripción/marketing copy de la ficha de la tienda
- [ ] Moderación de contenido básica (recomendable antes de abrir a público general, no solo a tu banda)

## 18. Versión web (Netlify) — cómo funciona y cómo desplegarla

Mismo código, mismo Supabase, mismo backend — KORO también corre como sitio web, exportando el mismo proyecto Expo a HTML/JS/CSS estático.

### Qué tuvo que ajustarse para que funcione en navegador

- **Sesión guardada**: en el celular se usa el keychain cifrado (`expo-secure-store`); en navegador no existe eso, así que cae automáticamente a `localStorage` (`src/lib/supabase.ts` decide según `Platform.OS`).
- **Video de YouTube**: en el celular se usa un WebView nativo; en navegador es un `<iframe>` normal. Metro elige el archivo correcto solo (`src/components/YouTubeEmbed.tsx` para nativo, `YouTubeEmbed.web.tsx` para web) — es el patrón estándar de Expo/React Native para código específico de plataforma.
- Todo lo demás (transposición, setlists, comunidades, Director en vivo, metrónomo, modo offline) es JavaScript puro y corre igual en los tres lugares.
- **Mensajes de error y confirmaciones (`Alert.alert`)**: este fue un bug real descubierto al probar la versión web en vivo — `react-native-web` define `Alert.alert()` como una función completamente vacía, sin avisar nada. Cualquier error ("No se pudo iniciar sesión", confirmaciones de "¿Eliminar?", etc.) se quedaba en silencio total en el navegador. Arreglado con `src/lib/alert.ts`, que cae a `window.alert()`/`window.confirm()` en web — reemplazado en los 12 archivos que lo usaban.

**Honestidad sobre lo que no pude verificar del todo:** no tengo un navegador real disponible en mi entorno para abrir la página y verla funcionar visualmente — solo pude confirmar que compila sin errores y que el código nativo/web se está intercambiando correctamente (verifiqué que el bundle web no contiene rastros del reproductor nativo de YouTube, y sí contiene el `<iframe>`). Lo primero que hay que revisar al abrirla de verdad en un navegador: que el pulso visual del metrónomo (usa `react-native-reanimated`) se vea fluido — si no pulsa bien en web, es un detalle cosmético, no afecta el resto de la app.

### Bug real encontrado y arreglado: "Page not found" al abrir desde la pantalla de inicio

Al agregar KORO a la pantalla de inicio del iPhone, iOS la abre directo en `/communities` (el `start_url` del manifest), no en la portada (`/`). Netlify necesita una regla que le diga "para cualquier ruta que no sea un archivo real, sirve `index.html` y deja que la app decida qué mostrar" — sin eso, cualquier carga directa a una ruta interna (no solo desde el ícono: también un link compartido a una comunidad o canción) da 404.

Esa regla ya estaba en `netlify.toml`, **pero ese archivo vive en la raíz del proyecto, fuera de `dist/`** — cuando subes manualmente solo la carpeta `dist` arrastrándola a Netlify ("Deploy manually"), `netlify.toml` nunca se sube, así que la regla nunca se aplica. El arreglo: `public/_redirects` (formato simple de Netlify, una sola línea) — todo lo que está en `public/` se copia automáticamente a `dist/` en cada export, así que esta regla **siempre viaja junto con la carpeta**, sin importar cómo la subas.

### Agregar a pantalla de inicio (iPhone/Android) — cómo quedó configurado

Ya viene listo para que, al abrir la web en el celular y usar "Agregar a inicio" (Safari) o "Instalar app" (Chrome/Android), se vea con el ícono correcto y abra en pantalla completa (sin la barra del navegador):

- `public/index.html` — plantilla personalizada (generada con `npx expo customize public/index.html`, el mecanismo correcto para el modo `single`/SPA; `app/+html.tsx` NO aplica en este modo, solo en `static`/`server`) con las etiquetas `apple-touch-icon`, `theme-color`, y el link al manifest.
- `public/manifest.json` — manifest PWA (nombre, colores, íconos) para Android/Chrome.
- `public/apple-touch-icon.png` (180×180), `public/icon-192.png`, `public/icon-512.png` — el logo de KORO en los tamaños que cada plataforma espera.

### Cómo desplegarla en Netlify

1. Ve a [netlify.com](https://netlify.com) y crea una cuenta gratis (o inicia sesión con GitHub).
2. **"Add new site" → "Deploy manually"** (la forma más rápida sin conectar un repo):
   ```bash
   npx expo export -p web
   ```
   Esto genera la carpeta `dist/`. Arrástrala directo a la zona de "Deploy manually" de Netlify.
3. **O, mejor para el largo plazo, conecta el repo de GitHub** (Add new site → Import an existing project): así cada vez que subas un cambio, Netlify recompila y publica solo. Ya dejé `netlify.toml` configurado con el comando de build (`npx expo export -p web`) y la carpeta a publicar (`dist`).
4. **Importante — variables de entorno**: Netlify no tiene acceso a tu archivo `.env` local (y no debe, por seguridad). En el panel de Netlify ve a **Site configuration → Environment variables** y agrega las mismas dos que tienes en tu `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   ```
   Sin esto, el sitio publicado no va a poder conectarse a Supabase.
5. El archivo `netlify.toml` ya incluye la regla de redirección necesaria para que las rutas internas (`/community/xyz`, `/song/abc`, etc.) funcionen al refrescar la página o compartir un link directo — sin esa regla, cualquier ruta que no sea la portada daría error 404.

### Lo que NO tiene la versión web (por ahora)

- **Notificaciones push** — el sistema que construimos es 100% para apps nativas (usa el token de Expo Push). En web simplemente no se activan; el resto de la app funciona normal.
- Cualquier limitación propia del navegador (por ejemplo, el audio del metrónomo puede necesitar que el usuario interactúe con la página primero, por las políticas de autoplay de los navegadores — es una restricción del navegador, no de KORO).

## Estructura del proyecto





```
app/
  (auth)/          → login, signup, recuperar contraseña
  reset-password.tsx → destino del link de recuperación (fuera de (auth)/(app))
  (app)/
    communities.tsx        → lista/crear/unirse a comunidades
    profile.tsx             → editar perfil y preferencias de notificación
    community/[id]/
      index.tsx             → setlists de una comunidad + código + salir
      members.tsx           → gestión de integrantes y roles
      songs.tsx             → biblioteca de canciones con búsqueda
    setlist/[id]            → canciones del setlist, reordenar, tonalidad, Director en vivo, exportar PDF
    song/[id]/
      index.tsx             → letra+acordes, transposición, YouTube, comentarios, autoscroll, tamaño de letra
      edit.tsx               → editor visual de letra/acordes con vista previa
src/
  lib/
    supabase.ts           → cliente Supabase
    AuthContext.tsx        → contexto de autenticación
    useMemberRole.ts       → hook: rol del usuario en una comunidad
    useLiveSession.ts      → hook: estado y control del Director en vivo (Realtime)
    useLivePresence.ts     → hook: quién está conectado/siguiendo en vivo (Realtime Presence)
    useRegisterPushToken.ts → hook: registra el push token del dispositivo
    offlineCache.ts        → helpers de caché local (AsyncStorage) para modo offline
    errors.ts              → mensajes de error amigables + reintento automático
    useMetronome.ts        → hook del metrónomo local (pulso + clic, sin red)
  components/
    Toast.tsx              → confirmación visual reutilizable
    MetronomeDot.tsx        → punto de pulso del metrónomo (Reanimated)
    YouTubeEmbed.tsx / YouTubeEmbed.web.tsx → reproductor nativo vs. iframe web
  utils/chords.ts          → motor de transposición
  types/                   → tipos compartidos con el esquema de Supabase
supabase/
  schema.sql                              → esquema base
  migrations/002_live_session.sql         → modo Director en vivo
  migrations/003_leave_community.sql      → permite salir de una comunidad
  migrations/004_admin_safety.sql         → nunca dejar una comunidad sin admin
  migrations/005_song_search_index.sql    → índice de búsqueda de canciones
  migrations/006_push_notifications.sql   → infraestructura de notificaciones push
  migrations/007_profile_auto_create.sql  → crea el perfil automáticamente al registrarse
  migrations/008_fix_admin_trigger_security.sql → arregla el admin automático (RLS)
  functions/send-push/index.ts            → Edge Function que envía las notificaciones
  functions/delete-account/index.ts       → Edge Function que borra la cuenta del usuario
eas.json                                  → configuración de EAS Build (preview/producción)
netlify.toml                              → configuración de despliegue web (build + rutas SPA)
legal/PRIVACY_POLICY.md                   → borrador de política de privacidad
```
