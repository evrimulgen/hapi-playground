'use strict';

const Hapi = require('hapi');
const HapiSwagger = require('hapi-swagger');
const Models = require('./models');
const Routes = require('./routes');
const Pack = require('./package');
const Fixtures = require('sequelize-fixtures');

console.log("process.env");
console.log(process.env);
console.log("process.env.NODE_ENV: " + process.env.NODE_ENV);

const server = Hapi.server({
    host: 'localhost',
    port: process.env.PORT || '3000'
});

async function start() {

    await Fixtures.loadFile('import.yaml', Models); // import test data

    await server.register(require('hapi-auth-jwt2'));

    server.auth.strategy('jwt', 'jwt', {
        key: Pack.my_app.secret_key, // your secret key, dont share with others
        urlKey: false,
        cookieKey: false,
        verifyOptions: {
            algorithms: ['HS256']
        },
        validate: async function (decoded, request) {

            const user = await Models.User.findOne({
                where : {
                    id : decoded.id
                }
            });

            return {
                isValid: user != null
            };
        }
    });

    server.auth.default('jwt');

    for (const i in Routes) {
        server.route(Routes[i]);
    }

    await server.register({
        plugin: require('good'),
        options: {
            ops: {
                interval: 1000
            },
            reporters: {
                myConsoleReporter: [{
                    module: 'good-squeeze',
                    name: 'Squeeze',
                    args: [{ log: '*', response: '*' }]
                }, {
                    module: 'good-console'
                }, 'stdout']
            }
        }
    });

    await server.register([
        require('inert'),
        require('vision'),
        {
            plugin: HapiSwagger,
            options: {
                info: {
                    title: 'API Documentation',
                    version: Pack.version,
                },
                securityDefinitions: {
                    'jwt': {
                        'type': 'apiKey',
                        'name': 'Authorization',
                        'in': 'header'
                    }
                },
                security: [{ 'jwt': [] }]
            }
        }
    ]);

    try {
        await server.start();
    }
    catch (err) {
        console.log(err);
        process.exit(1);
    }

    console.log('Server running at:', server.info.uri);
}

Models.sequelize.sync().then(start);
