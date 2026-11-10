import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api, type Usuario } from '../api';
import { useSesion } from '../sesion';
import { Alerta, Boton, Campo, mensajeDe } from '../ui';
import { e } from '../tema';

/** Cambio de la propia contraseña. Al terminar, las demás sesiones abiertas de la cuenta se cierran. */
export function FormularioClave({ alTerminar }: { alTerminar?: () => void }) {
  const { renovar, avisar } = useSesion();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const cambiar = useMutation({
    mutationFn: () => api<{ token: string; usuario: Usuario }>('/yo/password', { actual, nueva }, 'PUT'),
    onSuccess: async (r) => {
      await renovar(r.token, r.usuario);
      avisar('Contraseña actualizada', 'bien', 'Las demás sesiones abiertas con tu cuenta se cerraron.');
      alTerminar?.();
    },
  });
  const enviar = () => {
    if (nueva !== repetir) { setError('Las dos contraseñas nuevas no coinciden.'); return; }
    setError('');
    cambiar.mutate();
  };

  return (
    <View style={{ gap: 14 }}>
      <Campo etiqueta="Contraseña actual" value={actual} onChangeText={setActual} secureTextEntry autoComplete="current-password" />
      <Campo etiqueta="Contraseña nueva" value={nueva} onChangeText={setNueva} secureTextEntry autoComplete="new-password"
        ayuda="Mínimo 8 caracteres, con letras y números." />
      <Campo etiqueta="Repite la contraseña nueva" value={repetir} onChangeText={setRepetir} secureTextEntry autoComplete="new-password" />
      {!!error && <Alerta>{error}</Alerta>}
      {cambiar.isError && <Alerta>{mensajeDe(cambiar.error)}</Alerta>}
      <Boton texto="Cambiar contraseña" alPresionar={enviar} cargando={cambiar.isPending}
        deshabilitado={!actual || nueva.length < 8 || !repetir} />
    </View>
  );
}

/** Se muestra en lugar de la app cuando un administrador restableció la contraseña. */
export function CambioObligatorio() {
  const { usuario, salir } = useSesion();
  return (
    <ScrollView style={e.pantalla} contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">
      <View style={e.tarjeta}>
        <Text style={e.h2}>Crea una contraseña nueva</Text>
        <Text style={e.tenue}>
          Hola, {usuario?.nombre}. Un administrador restableció tu contraseña. Escribe la temporal que te dieron y elige una nueva para continuar.
        </Text>
        <FormularioClave />
      </View>
      <Boton texto="Salir" variante="fantasma" alPresionar={salir} />
    </ScrollView>
  );
}
