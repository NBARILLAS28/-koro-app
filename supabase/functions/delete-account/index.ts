// supabase/functions/delete-account/index.ts
//
// Borra por completo la cuenta del usuario autenticado que hace la llamada.
// Solo puede borrar SU PROPIA cuenta — el user id nunca viene del cliente,
// se extrae validando el token de la persona que llama.
//
// Por qué esto necesita una Edge Function y no se puede hacer directo desde
// la app: borrar una fila de auth.users requiere la service role key
// (privilegios de administrador), que JAMÁS debe estar en el código del
// celular — cualquiera podría extraerla y borrar cuentas ajenas. Aquí la
// service role key vive únicamente en el servidor.
//
// Desplegar con:
//   supabase functions deploy delete-account
//
// Variables de entorno necesarias (configúralas con `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Falta el token de autenticación' }), { status: 401 });
    }

    // Cliente "de usuario": valida el token y extrae quién es la persona
    // que llama. No tiene permisos de administrador.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido o vencido' }), { status: 401 });
    }

    // Cliente de administrador: SOLO se usa para borrar exactamente el id
    // que acabamos de validar arriba — nunca un id que venga del body de
    // la petición (eso permitiría que alguien borrara la cuenta de otro).
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 });
    }

    // Borrar auth.users dispara en cascada el borrado de public.profiles
    // (y desde ahí, de todo lo que le pertenecía a esa persona — membresías,
    // comentarios propios, etc. — según las reglas ON DELETE CASCADE del
    // esquema). Las comunidades que esa persona haya creado NO se borran
    // (ver migración 009): owner_id simplemente queda en null.
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
