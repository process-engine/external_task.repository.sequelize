'use strict';

const ExternalTaskRepository = require('./dist/commonjs/index').ExternalTaskRepository;
const disposableDiscoveryTag = require('@essential-projects/bootstrapper_contracts').disposableDiscoveryTag;

function registerInContainer(container) {

  container.register('ExternalTaskRepository', ExternalTaskRepository)
    .dependencies('SequelizeConnectionManager')
    .configure('process_engine:external_task_repository')
    .tags(disposableDiscoveryTag)
    .singleton();
}

module.exports.registerInContainer = registerInContainer;
