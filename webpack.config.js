const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const path = require("path");
const fs = require('fs');

module.exports = env => {
    return {
        context: __dirname,
        entry: {
            api: './src/api-lambda.ts',
            'state-machine': './src/state-machine-lambda.ts'
        },
        devtool: env.production ? 'source-map' : 'inline-source-map',
        mode: env.production ? 'production' : 'development',
        output: {
            filename: '[name]/[name]-lambda.js',
            path: path.resolve(__dirname, 'dist'),
            // We need our code to be bundled as a library since AWS Lambda will require() it and run our handler function.
            library: JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'))).name,
            libraryTarget: 'umd',
        },
        resolve: {
            extensions: ['.ts', '.js', '.mjs', '.json'],
        },
        target: 'node',
        module: {
            // Causes webpack bundle to fail on runtime due to `define()` usage
            noParse: /node_modules\/json-schema\/lib\/validate\.js/,
            rules: [
                // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
                {
                    test: /\.tsx?$/,
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        experimentalWatchApi: true,
                    },
                },
                {
                    test: /\.mjs$/,
                    include: /node_modules/,
                    type: 'javascript/auto',
                },
            ],
        },
        optimization: {
            removeAvailableModules: false,
            removeEmptyChunks: false,
            splitChunks: false,
            minimize: false,
        },
        plugins: [new ForkTsCheckerWebpackPlugin()]
    }
};