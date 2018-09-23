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
    this.modules = [];
    this.defaults = {
      appParams,
      localLevel,
      remoteLevel,
      remoteAuth,
    };
    this.logger = this.createLogger(appParams, localLevel, remoteLevel, remoteAuth);
  }

  createLogger(appParams, localLevel, remoteLevel, remoteAuth, name) {
    const options = {
      name: appParams.name,
      streams: this.createStreams(appParams, localLevel, remoteLevel, remoteAuth),
    };
    if (name) {
      options.module = name;
    }
    const logger = bunyan.createLogger(options);
    logger.log = myLoggerMethod(logger, 'info');

    ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].forEach(logMethod => myLoggerMethod(logger, logMethod));
    logger.module = (moduleName) => {
      const moduleLogger = this.createLogger(appParams, localLevel, remoteLevel, remoteAuth, moduleName);
      this.modules.push(moduleLogger);
      return moduleLogger;
    };
    logger.setLevels = logger.levels; // original bunyan method
    logger.levels = (level, module, stream) => this.levels(level, module, stream);
    return logger;
  }

  levels(level, moduleName, streamName) {
    if (level !== undefined) {
      if (moduleName) {
        const module = this.modules.find(m => m.fields.module === moduleName);
        if (module) {
          this.updateStream(level, module, streamName);
        }
      } else {
        this.modules.forEach(m => this.levels(level, m.fields.module, streamName));
      }
    }
    return this.getLevels();
  }

  updateStream(level, module, streamName) {
    let newLevel;
    try {
      newLevel = bunyan.resolveLevel(level);
    } catch(e) {
      newLevel = bunyan.resolveLevel('info');
    }
    if (streamName) {
      const streamIndex = module.streams.findIndex(s => s.name === streamName);
      if (streamIndex >= 0) {
        if (!level) {
          module.streams.splice(streamIndex, 1);
        } else {
          module.streams[streamIndex].level = newLevel;
        }
      } else if (streamName === 'stdout' && level) {
        module.addStream(this.createLocalStream(level));
      } else if (streamName === 'gcloud' && level) {
        module.addStream(this.createRemoteStream(level, this.defaults.remoteAuth, this.defaults.appParams));
      }
    } else {
      module.level(newLevel);
    }
  }

  getLevels() {
    const toLevels = logger => {
      const streamLevels = {};
      logger.streams.forEach(s => streamLevels[s.name] = bunyan.nameFromLevel[s.level]);
      return streamLevels;
    };
    const levels = {
      main: toLevels(this.logger),
    };
    this.modules.forEach(m => levels[m.fields.module] = toLevels(m));
    return levels;
  }

  createStreams(appParams, localLevel, remoteLevel, remoteAuth) {
    const streams = [];
    if (localLevel) {
      streams.push(this.createLocalStream(localLevel));
    }

    if (remoteLevel) {
      streams.push(this.createRemoteStream(remoteLevel, remoteAuth, appParams));
    }
    return streams;
  }

  createLocalStream(level) {
    const PrettyStream = require('bunyan-prettystream-circularsafe');
    const stream = new PrettyStream();
    stream.pipe(process.stdout);
    return {
      type: 'raw',
      stream: stream,
      level: level,
      name: 'stdout',
    };
  }

  createRemoteStream(level, auth, appParams) {
    const options = {
      logName: appParams.name,
      serviceContext: {
        service: appParams.name,
        version: appParams.version,
      },
    };
    if (auth) {
      Object.assign(options, auth);
      options.resource = auth.resource || {
        type: 'project',
        labels: {
          project_id: process.env.GCLOUD_PROJECT || appParams.name,
          container_name: process.env.CONTAINER_NAME,
        },
      };
    }
    const { LoggingBunyan } = require('@google-cloud/logging-bunyan');
    const loggingBunyan = new LoggingBunyan(options);
    const stream = loggingBunyan.stream(level);
    stream.name = 'gcloud';
    return stream;
  }
}

/**
 * Override original logging methods to add functionality
 * 1) Call function arguments to get data (rather than logging 'Function')
 *    - shorthand for if (logger.level() < logger.TRACE) ...
 * 2) Bunyan has special handling for error objects, but they need to be the first arg, so move if necessary
 *
 */
function myLoggerMethod(logger, levelName) {
  const minLevel = bunyan.levelFromName[levelName];
  const original = logger[levelName];
  logger[levelName] = function() {
    let msgArgs = arguments;
    if (logger._level <= minLevel) {
      for (let i = 0; i < msgArgs.length; i++) {
        const arg = msgArgs[i];
        // call function arguments to get data (rather than logging 'Function')
        if (typeof arg === 'function') {
          try {
            msgArgs[i] = arg();
          } catch(e) {}
        }

        // Bunyan has special handling for error objects - but they need to be the first arg. So move if necessary...
        if (i > 0 && arg instanceof Error && !(msgArgs[0] instanceof Error)) {
          msgArgs = Array.from(msgArgs);
          msgArgs.splice(i, 1);
          msgArgs.unshift(arg);
        }
      }
    }
    original.apply(logger, arguments);
  }
}
