// Configuración dinámica: parte de app.json y solo agrega la ruta base cuando se exporta la PWA (EXPO_BASE_URL=/app).
// El APK y la prueba móvil (exportada a la raíz) no cambian.
module.exports = ({ config }) => {
  const base = process.env.EXPO_BASE_URL;
  if (!base) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl: base } };
};
