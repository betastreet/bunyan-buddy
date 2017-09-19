# bunyan-buddy
[![Version](https://badge.fury.io/js/bunyan-buddy.svg)](http://badge.fury.io/js/bunyan-buddy)
[![Downloads](http://img.shields.io/npm/dm/bunyan-buddy.svg)](https://www.npmjs.com/package/bunyan-buddy)

Reduce the amount of Bunyan boilerplate code required with integration for Google Cloud Logging, ideal when working with microservices.

bunyan-buddy sets up a *local stream* using bunyan-prettystream and a *remote stream* using @google-cloud/logging-bunyan. You can set the log levels for each using environment variables or as options when initializing it. For testing Google Cloud Logging locally, you can manually auth with it using a service account file.

### Usage

```javascript
const log = require('bunyan-buddy')(
    app_name: 'my-app-name',    // defaults to 'app'
    local_level: 'debug',       // defaults to process.env.LOG_LEVEL_LOCAL or 'info'
    remote_level: 'info',       // defaults to process.env.LOG_LEVEL_REMOTE or not set

    // optionally auth with google cloud logging
    // defaults to not set (auth is automatic if hosted on Google Cloud Platform)
    remote_auth: {
        projectId: 'my-google-cloud-project',
        keyFilename: '/path/to/gcloud-auth.json',
    },
});

log.info('This is logged locally and to Google Cloud Logging!');

log.debug('This is only logged locally (with the above options)');

log.error('This will log an error locally and on Google Cloud Logging, but not Google Cloud Error Reporting');

log.error(new Error('This will log in Google Cloud Error Reporting only if hosted on Google Cloud Platform'));
```


