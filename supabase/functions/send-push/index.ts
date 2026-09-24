// supabase/functions/send-push/index.ts
//
// Recibe { event, payload } desde los triggers de Postgres (via pg_net) y envía
// notificaciones push a los miembros de la comunidad correspondiente usando la
// Expo Push API (https://docs.expo.dev/push-notifications/sending-notifications/).
//
// Desplegar con:
//   supabase functions deploy send-push
//
// Variables de entorno necesarias (configúralas con `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface EventBody {
  event: 'new_song' | 'live_session_started' | 'new_comment';
  payload: {
    community_id: string;
    actor_id?: string | null;
    song_title?: string;
  };
}

function messageFor(body: EventBody): { title: string; body: string } {
  switch (body.event) {
    case 'new_song':
      return { title: 'KORO', body: `Se agregó "${body.payload.song_title}" a un setlist` };
    case 'live_session_started':
      return { title: '🔴 KORO en vivo', body: 'El director inició una transmisión en vivo' };
    case 'new_comment':
      return { title: 'KORO', body: `Nuevo comentario en "${body.payload.song_title}"` };
    default:
      return { title: 'KORO', body: 'Tienes una novedad' };
  }
}

Deno.serve(async (req) => {
  try {
    const body = (await req.json()) as EventBody;
    const { title, body: message } = messageFor(body);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Trae los push tokens de todos los miembros de la comunidad (excepto quien disparó el evento)
    // que tengan activada la notificación correspondiente.
    const notifyColumn =
      body.event === 'new_song'
        ? 'notify_new_song'
        : body.event === 'live_session_started'
        ? 'notify_live_session'
        : 'notify_comment';

    const { data: members, error } = await supabase
      .from('community_members')
      .select('profile:profiles!inner(push_token, ' + notifyColumn + ')')
      .eq('community_id', body.payload.community_id);

    if (error) throw error;

    const tokens = (members ?? [])
      .map((m: any) => m.profile)
      .filter((p: any) => p?.push_token && p[notifyColumn])
      .map((p: any) => p.push_token as string);

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // La Expo Push API acepta hasta 100 mensajes por request.
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += 100) chunks.push(tokens.slice(i, i + 100));

    for (const chunk of chunks) {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          chunk.map((token) => ({ to: token, sound: 'default', title, body: message }))
        ),
      });
    }

    return new Response(JSON.stringify({ sent: tokens.length }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
