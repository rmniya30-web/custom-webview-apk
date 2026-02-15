module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // react-native-config for .env support
    ['module:react-native-dotenv', {
      envName: 'APP_ENV',
      moduleName: '@env',
      path: '.env',
      allowUndefined: true,
    }],
  ],
};
