const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// expo-sqlite usa un .wasm para web que Metro no resuelve bien.
// Agregar la extensión permite que el bundler lo encuentre.
config.resolver.assetExts = [...(config.resolver.assetExts || []), 'wasm'];

module.exports = withNativeWind(config, { input: './global.css' });
