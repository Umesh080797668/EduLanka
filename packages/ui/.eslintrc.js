module.exports = {
    root: true,
    extends: [require.resolve('@edu-lanka/config/eslint-preset.js')],
    parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
    },
};
