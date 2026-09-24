const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [
  ...config.resolver.assetExts,
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff",
  "PNG", "JPG", "JPEG", "GIF", "WEBP",
];

config.resolver.sourceExts = [
  "js", "jsx", "ts", "tsx", "cjs", "mjs", "json",
];

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
