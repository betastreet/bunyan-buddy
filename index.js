const bunyan = require('bunyan');

module.exports = (options) => {
    if (!options) options = {};

    if (typeof options.app === 'undefined') options.app = {name: options.app_name};
    if (typeof options.app.name === 'undefined') options.app.name = 'app';
    if (typeof options.local_level === 'undefined') options.local_level = process.env.LOG_LEVEL_LOCAL;
    if (typeof options.remote_level === 'undefined') options.remote_level = process.env.LOG_LEVEL_REMOTE;

    const logger = new Logger(options.app, options.local_level, options.remote_level, options.remote_auth);

    return logger.logger;
};

class Logger {
    constructor(appParams, localLevel, remoteLevel, remoteAuth) {
        this.streams = [];

        let options = {};
        if (localLevel) {
            this.addLocalStream(localLevel);
        }

        if (remoteLevel) {
            this.addRemoteStream(remoteLevel, remoteAuth, appParams);
            Object.assign(options, {
                serviceContext: {
                    service: appParams.name,
                    version: appParams.version,
                }});
        }

        Object.assign(options, {
            name: appParams.name,
            streams: this.streams
        });
        this.logger = bunyan.createLogger(options);

        this.logger.module = (moduleName) => {
            return bunyan.createLogger(Object.assign({}, options, {module: moduleName}));
        };
    }

    addLocalStream(level) {
        const PrettyStream = require('bunyan-prettystream-circularsafe');
        let stream = new PrettyStream();
        stream.pipe(process.stdout);
        this.streams.push({
            type: 'raw',
            stream: stream,
            level: level,
        });
    }

    addRemoteStream(level, auth, appParams) {
        if (auth) {
            auth.logName = auth.logName || appParams.name;
            auth.resource = auth.resource || {
                type: 'project',
                labels: {
                    project_id: process.env.GCLOUD_PROJECT || appParams.name,
                },
            };
        }
        const loggingBunyan = require('@google-cloud/logging-bunyan')(auth);
        let stream = loggingBunyan.stream(level);
        this.streams.push(stream);
    }
}
