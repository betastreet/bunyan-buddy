const bunyan = require('bunyan');

module.exports = (options) => {
    if (!options) options = {};

    if (typeof options.app_name === 'undefined') options.app_name = 'app';
    if (typeof options.local_level === 'undefined') options.local_level = process.env.LOG_LEVEL_LOCAL || 'info';
    if (typeof options.remote_level === 'undefined') options.remote_level = process.env.LOG_LEVEL_REMOTE || 'info';

    const logger = new Logger(options.app_name, options.local_level, options.remote_level, options.remote_auth);

    return logger.logger;
};

class Logger {
    constructor(appName, localLevel, remoteLevel, remoteAuth) {
        this.streams = [];

        if (localLevel) {
            this.addLocalStream(localLevel);
        }

        if (remoteLevel) {
            this.addRemoteStream(remoteLevel, remoteAuth);
        }

        this.logger = bunyan.createLogger({
            name: appName,
            streams: this.streams,
        });
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

    addRemoteStream(level, auth) {
        const loggingBunyan = require('@google-cloud/logging-bunyan')(auth);
        let stream = loggingBunyan.stream(level);
        this.streams.push(stream);
    }
}
