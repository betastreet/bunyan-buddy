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

        this.logger.logRestifyHttpRequest = this.logRestifyHttpRequest;
    }

    addLocalStream(level) {
        const PrettyStream = require('bunyan-prettystream');
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

    logRestifyHttpRequest(req, res, server, logResponse, requestTimeStart, level) {
        if (typeof level === 'undefined') level = 'info';

        let truncatedBody = null;
        if (logResponse) {
            truncatedBody = (typeof res._data === 'object' ? JSON.stringify(res._data) : res._data);
            if (truncatedBody && truncatedBody.length > 300) {
                truncatedBody = `${truncatedBody.substring(0, 300)} ...`;
            }
        }

        let latency = undefined;
        if (requestTimeStart) {
            latency = {
                seconds: `${(Date.now() - requestTimeStart) / 1000}s`,
            };
        }

        this[level]({
            httpRequest: {
                status: res.statusCode,
                requestUrl: req.url,
                requestSize: req.contentLength(),
                requestMethod: req.method,
                remoteIp: req.connection.remoteAddress,
                serverIp: server.address().address,
                responseSize: res.header('Content-Length'),
                latency: latency,
            }
        }, req.getPath());

        if (truncatedBody) {
            this[level](truncatedBody);
        }
    }
}
