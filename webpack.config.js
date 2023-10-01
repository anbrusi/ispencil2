// webpack.config.js

'use strict';

const path = require( 'path' );
const { styles } = require( '@ckeditor/ckeditor5-dev-utils' );

module.exports = {
    entry: './sample/ckeditor.js',

    output: {
		// The name under which the editor will be exported.
		library: 'ClassicEditor',
        path: path.resolve( __dirname, 'build' ),
        filename: 'ckeditor.js',
		libraryTarget: 'umd',
		libraryExport: 'default'
    },
    
    module: {
        rules: [
            {
                // test: /ckeditor5-[^/\\]+[/\\]theme[/\\]icons[/\\][^/\\]+\.svg$/,
                test: /\.svg$/,
                use: [ 'raw-loader' ]
            },
            {
                // test: /ckeditor5-[^/\\]+[/\\]theme[/\\].+\.css$/,
                test: /\.css$/,
                use: [
                    {
                        loader: 'style-loader',
                        options: {
                            injectType: 'singletonStyleTag',
                            attributes: {
                                'data-cke': true
                            }
                        }
                    },
                    'css-loader',
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: styles.getPostCssConfig( {
                                themeImporter: {
                                    themePath: require.resolve( '@ckeditor/ckeditor5-theme-lark' )
                                },
                                minify: false
                            } )
                        }
                    }
                ]
            }
        ]
    },

    // Useful for debugging.
    devtool: 'source-map',

    // By default webpack logs warnings if the bundle is bigger than 200kb.
    performance: { hints: false }
};
