import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { almacen, api, ErrorApi, type Usuario } from '../api';
import { useSesion } from '../sesion';
import { Alerta, Boton, Campo, Segmentos, mensajeDe } from '../ui';
import { C, e } from '../tema';
import Recuperar from './Recuperar';

const DEMOS = [
  { rol: 'Estudiante', email: 'ana@demo.co' },
  { rol: 'Tutor', email: 'carlos@demo.co' },
];

export default function Acceso() {
  const { entrar } = useSesion();
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<'ESTUDIANTE' | 'TUTOR'>('ESTUDIANTE');
  const [servidor, setServidor] = useState(almacen.servidor());
  const [verServidor, setVerServidor] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  useEffect(() => { setServidor(almacen.servidor()); }, []);

  const enviar = useMutation({
    mutationFn: async (datos: { email: string; password: string }) => {
      await almacen.guardarServidor(servidor);
      const r = await api<{ token: string; usuario: Usuario }>(
        modo === 'entrar' ? '/auth/login' : '/auth/registro',
        modo === 'entrar' ? datos : { ...datos, nombre: nombre.trim(), rol },
      );
      if (r.usuario.rol === 'ADMIN' || r.usuario.rol === 'SOPORTE') throw new Error('El equipo de soporte y administración trabaja desde la versión web.');
      return r;
    },
    onSuccess: (r) => entrar(r.token, r.usuario),
    onError: (err) => { if (err instanceof ErrorApi && err.estado === 0) setVerServidor(true); },
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.marino }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ padding: 24, paddingTop: 36, gap: 12 }}>
          <View style={e.fila}>
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.ambar, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '900', fontSize: 20, color: C.marino }}>T</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 21, fontWeight: '800' }}>Tutores<Text style={{ color: C.ambar }}>On-Line</Text></Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 25, fontWeight: '800', lineHeight: 31 }}>Un tutor para la materia que te está costando.</Text>
          <Text style={{ color: '#c4cfe0', fontSize: 15, lineHeight: 21 }}>Reserva con un tutor verificado o pide ayuda ahora: el primer tutor disponible que acepte se conecta contigo.</Text>
        </View>

        <View style={{ flex: 1, backgroundColor: C.fondo, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, gap: 14 }}>
          <Segmentos valor={modo} cambiar={(m) => { setModo(m); enviar.reset(); }}
            opciones={[{ valor: 'entrar', texto: 'Ingresar' }, { valor: 'registro', texto: 'Crear cuenta' }]} />
          {modo === 'registro' && (
            <>
              <Segmentos valor={rol} cambiar={setRol} opciones={[{ valor: 'ESTUDIANTE', texto: 'Soy estudiante' }, { valor: 'TUTOR', texto: 'Soy tutor' }]} />
              <Campo etiqueta="Nombre completo" value={nombre} onChangeText={setNombre} autoComplete="name" />
            </>
          )}
          <Campo etiqueta="Correo electrónico" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Campo etiqueta="Contraseña" value={password} onChangeText={setPassword} secureTextEntry
            ayuda={modo === 'registro' ? 'Mínimo 8 caracteres, con letras y números.' : undefined} />
          {enviar.isError && <Alerta>{mensajeDe(enviar.error)}</Alerta>}
          <Boton texto={modo === 'entrar' ? 'Ingresar' : 'Crear cuenta'} cargando={enviar.isPending}
            alPresionar={() => enviar.mutate({ email: email.trim(), password })} />
          {modo === 'entrar' && (
            <Pressable onPress={() => setRecuperando(true)} accessibilityRole="button" style={{ alignSelf: 'center', padding: 4 }}>
              <Text style={{ color: C.marino, fontWeight: '700' }}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          )}
          {recuperando && <Recuperar emailInicial={email} servidor={servidor} cerrar={() => setRecuperando(false)} />}
          {modo === 'registro' && rol === 'TUTOR' && (
            <Text style={e.pequeno}>Después de registrarte completas tu perfil en la web y un administrador lo verifica antes de publicarlo.</Text>
          )}

          {modo === 'entrar' && (
            <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: C.linea, paddingTop: 14 }}>
              <Text style={e.pequeno}>Cuentas de demostración (contraseña Demo1234)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {DEMOS.map((d) => (
                  <Boton key={d.email} texto={d.rol} variante="fantasma" chico deshabilitado={enviar.isPending} estilo={{ flex: 1 }}
                    alPresionar={() => { setEmail(d.email); setPassword('Demo1234'); enviar.mutate({ email: d.email, password: 'Demo1234' }); }} />
                ))}
              </View>
            </View>
          )}

          <Pressable onPress={() => setVerServidor(!verServidor)} accessibilityRole="button" style={{ alignSelf: 'center', padding: 6 }}>
            <Text style={e.pequeno}>Servidor: {servidor} {verServidor ? '▲' : '▼'}</Text>
          </Pressable>
          {verServidor && (
            <Campo etiqueta="Dirección del servidor" value={servidor} onChangeText={setServidor} autoCapitalize="none" keyboardType="url"
              ayuda="En el computador: http://IP-del-PC:3000 (la IP sale con ipconfig). En la nube: la URL de Render." />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
