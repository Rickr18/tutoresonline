import { useState } from 'react';
import { Text } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { almacen, api, type Usuario } from '../api';
import { useSesion } from '../sesion';
import { Alerta, Boton, Campo, Hoja, mensajeDe } from '../ui';
import { e } from '../tema';

/** Recuperar la contraseña con un código de 6 dígitos, sin depender de un administrador. */
export default function Recuperar({ emailInicial, servidor, cerrar }: { emailInicial: string; servidor: string; cerrar: () => void }) {
  const { entrar } = useSesion();
  const [email, setEmail] = useState(emailInicial);
  const [enviado, setEnviado] = useState<{ mensaje: string; codigoDemo?: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');

  const pedir = useMutation({
    mutationFn: async () => {
      await almacen.guardarServidor(servidor);
      return api<{ mensaje: string; codigoDemo?: string }>('/auth/recuperar', { email: email.trim() });
    },
    onSuccess: setEnviado,
  });
  const cambiar = useMutation({
    mutationFn: () => api<{ token: string; usuario: Usuario }>('/auth/restablecer', { email: email.trim(), codigo, nueva }),
    onSuccess: (r) => {
      if (r.usuario.rol === 'ADMIN' || r.usuario.rol === 'SOPORTE') { cerrar(); return; }
      entrar(r.token, r.usuario);
    },
  });
  const confirmar = () => {
    if (nueva !== repetir) { setError('Las dos contraseñas no coinciden.'); return; }
    setError('');
    cambiar.mutate();
  };

  return (
    <Hoja titulo="Recuperar la contraseña" cerrar={cerrar}>
      {!enviado ? (
        <>
          <Text style={e.tenue}>Escribe el correo de tu cuenta y te enviamos un código de 6 dígitos.</Text>
          <Campo etiqueta="Correo de la cuenta" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          {pedir.isError && <Alerta>{mensajeDe(pedir.error)}</Alerta>}
          <Boton texto="Enviar código" cargando={pedir.isPending} deshabilitado={!email.includes('@')} alPresionar={() => pedir.mutate()} />
        </>
      ) : (
        <>
          <Alerta tono="info">{enviado.mensaje}</Alerta>
          {enviado.codigoDemo && <Alerta tono="espera" titulo="Modo demostración">El código que llegaría al correo es {enviado.codigoDemo}.</Alerta>}
          <Campo etiqueta="Código de 6 dígitos" value={codigo} onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" />
          <Campo etiqueta="Contraseña nueva" value={nueva} onChangeText={setNueva} secureTextEntry autoComplete="new-password" ayuda="Mínimo 8 caracteres, con letras y números." />
          <Campo etiqueta="Repite la contraseña nueva" value={repetir} onChangeText={setRepetir} secureTextEntry autoComplete="new-password" />
          {!!error && <Alerta>{error}</Alerta>}
          {cambiar.isError && <Alerta>{mensajeDe(cambiar.error)}</Alerta>}
          <Boton texto="Cambiar contraseña y entrar" cargando={cambiar.isPending} deshabilitado={codigo.length !== 6 || nueva.length < 8 || !repetir} alPresionar={confirmar} />
          <Boton texto="Pedir otro código" variante="fantasma" alPresionar={() => { setEnviado(null); setCodigo(''); cambiar.reset(); }} />
        </>
      )}
    </Hoja>
  );
}
